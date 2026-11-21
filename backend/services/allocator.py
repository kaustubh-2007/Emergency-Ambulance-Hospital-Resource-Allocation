import math
from datetime import datetime
from typing import Optional, Tuple, List, Dict
import requests
from sqlalchemy.orm import Session
from sqlalchemy import update
from backend.models import (
    Ambulance,
    AmbulanceStatus,
    Hospital,
    HospitalResource,
    ResourceType,
    EmergencyRequest,
    EmergencyType,
    TripStatus,
    DispatchLog,
)
from backend.schemas import AllocationResult


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def estimate_road_eta_seconds(
    start_lat: float,
    start_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> float:
    url = (
        f"http://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{dest_lon},{dest_lat}?overview=false"
    )
    try:
        response = requests.get(url, timeout=1.2)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                duration = data["routes"][0].get("duration")
                if duration and duration > 0:
                    return float(duration)
    except Exception:
        pass

    dist_km = haversine_distance(start_lat, start_lon, dest_lat, dest_lon)
    avg_speed_kmh = 40.0
    return max(60.0, (dist_km / avg_speed_kmh) * 3600.0)


def get_preferred_resource_types(emergency_type: EmergencyType) -> List[ResourceType]:
    if emergency_type == EmergencyType.CARDIAC:
        return [ResourceType.ICU_BED, ResourceType.OXYGEN_UNIT, ResourceType.GENERAL_BED]
    elif emergency_type == EmergencyType.TRAUMA:
        return [ResourceType.ICU_BED, ResourceType.GENERAL_BED]
    elif emergency_type == EmergencyType.MATERNITY:
        return [ResourceType.GENERAL_BED, ResourceType.ICU_BED]
    else:
        return [ResourceType.GENERAL_BED, ResourceType.OXYGEN_UNIT, ResourceType.ICU_BED]


def calculate_hospital_score(
    hospital: Hospital,
    resource: HospitalResource,
    emergency_type: EmergencyType,
    eta_seconds: float,
    min_eta: float,
    max_eta: float,
    w1: float = 0.45,
    w2: float = 0.25,
    w3: float = 0.30,
) -> float:
    eta_range = max_eta - min_eta
    normalized_eta = 0.0 if eta_range <= 0.0 else (eta_seconds - min_eta) / (eta_range + 0.001)

    total_beds = max(1, resource.total_count)
    occupied_beds = max(0, resource.total_count - resource.available_count)
    occupancy_ratio = occupied_beds / total_beds

    specialty_penalty = 0.0
    if emergency_type == EmergencyType.CARDIAC and not hospital.has_cardiac:
        specialty_penalty = 1.0
    elif emergency_type == EmergencyType.TRAUMA and not hospital.has_trauma:
        specialty_penalty = 1.0
    elif emergency_type == EmergencyType.MATERNITY and not hospital.has_maternity:
        specialty_penalty = 1.0

    return (w1 * normalized_eta) + (w2 * occupancy_ratio) + (w3 * specialty_penalty)


def allocate_emergency_resources(
    emergency_id: int,
    db: Session,
) -> Optional[AllocationResult]:
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == emergency_id).first()
    if not emergency or emergency.status != TripStatus.PENDING:
        return None

    available_ambulances = (
        db.query(Ambulance)
        .filter(Ambulance.status == AmbulanceStatus.AVAILABLE)
        .all()
    )
    if not available_ambulances:
        return None

    ambulance_candidates = []
    for amb in available_ambulances:
        eta = estimate_road_eta_seconds(
            amb.current_latitude,
            amb.current_longitude,
            emergency.pickup_latitude,
            emergency.pickup_longitude,
        )
        ambulance_candidates.append((amb, eta))

    ambulance_candidates.sort(key=lambda x: x[1])
    selected_ambulance, selected_amb_eta = ambulance_candidates[0]

    preferred_resources = get_preferred_resource_types(emergency.emergency_type)
    hospitals = db.query(Hospital).all()

    hospital_candidates: List[Dict] = []
    etas = []

    for hosp in hospitals:
        matching_resource = None
        for res_type in preferred_resources:
            res = (
                db.query(HospitalResource)
                .filter(
                    HospitalResource.hospital_id == hosp.id,
                    HospitalResource.resource_type == res_type,
                    HospitalResource.available_count > 0,
                )
                .first()
            )
            if res:
                matching_resource = res
                break

        if not matching_resource:
            continue

        eta_to_hosp = estimate_road_eta_seconds(
            emergency.pickup_latitude,
            emergency.pickup_longitude,
            hosp.latitude,
            hosp.longitude,
        )
        etas.append(eta_to_hosp)
        hospital_candidates.append({
            "hospital": hosp,
            "resource": matching_resource,
            "eta": eta_to_hosp,
        })

    if not hospital_candidates:
        return None

    min_hosp_eta = min(etas)
    max_hosp_eta = max(etas)

    for item in hospital_candidates:
        score = calculate_hospital_score(
            hospital=item["hospital"],
            resource=item["resource"],
            emergency_type=emergency.emergency_type,
            eta_seconds=item["eta"],
            min_eta=min_hosp_eta,
            max_eta=max_hosp_eta,
        )
        item["score"] = score

    hospital_candidates.sort(key=lambda x: x["score"])

    assigned_hospital = None
    assigned_resource_type = None
    assigned_score = 0.0

    for candidate in hospital_candidates:
        target_hosp = candidate["hospital"]
        target_res = candidate["resource"]

        stmt = (
            update(HospitalResource)
            .where(
                HospitalResource.hospital_id == target_hosp.id,
                HospitalResource.resource_type == target_res.resource_type,
                HospitalResource.available_count > 0,
            )
            .values(
                available_count=HospitalResource.available_count - 1,
                reserved_count=HospitalResource.reserved_count + 1,
                updated_at=datetime.utcnow(),
            )
        )
        res_update = db.execute(stmt)

        if res_update.rowcount == 1:
            assigned_hospital = target_hosp
            assigned_resource_type = target_res.resource_type
            assigned_score = candidate["score"]
            break

    if not assigned_hospital or not assigned_resource_type:
        return None

    selected_ambulance.status = AmbulanceStatus.DISPATCHED
    emergency.ambulance_id = selected_ambulance.id
    emergency.hospital_id = assigned_hospital.id
    emergency.allocated_resource_type = assigned_resource_type
    emergency.status = TripStatus.DISPATCHED
    emergency.estimated_eta_seconds = selected_amb_eta
    emergency.updated_at = datetime.utcnow()

    log = DispatchLog(
        request_id=emergency.id,
        ambulance_id=selected_ambulance.id,
        event_type="DISPATCH_ALLOCATED",
        recorded_latitude=emergency.pickup_latitude,
        recorded_longitude=emergency.pickup_longitude,
        details_json=(
            f'{{"ambulance": "{selected_ambulance.vehicle_number}", '
            f'"hospital": "{assigned_hospital.name}", '
            f'"bed_type": "{assigned_resource_type.value}", '
            f'"score": {round(assigned_score, 4)}, '
            f'"eta_seconds": {round(selected_amb_eta, 1)}}}'
        ),
    )
    db.add(log)
    db.commit()
    db.refresh(emergency)

    return AllocationResult(
        request_id=emergency.id,
        ambulance_id=selected_ambulance.id,
        hospital_id=assigned_hospital.id,
        allocated_resource_type=assigned_resource_type,
        ambulance_eta_seconds=selected_amb_eta,
        hospital_score=assigned_score,
        hospital_name=assigned_hospital.name,
        vehicle_number=selected_ambulance.vehicle_number,
    )
