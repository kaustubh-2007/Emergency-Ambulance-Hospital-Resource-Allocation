from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import update
from backend.database import get_db
from backend.models import (
    EmergencyRequest,
    TripStatus,
    Ambulance,
    AmbulanceStatus,
    Hospital,
    HospitalResource,
    User,
    UserRole,
    DispatchLog,
)
from backend.schemas import (
    EmergencyRequestCreate,
    EmergencyRequestResponse,
    EmergencyRequestOverride,
)
from backend.auth import get_current_user, get_optional_user, require_role
from backend.services.allocator import allocate_emergency_resources
from backend.ws.manager import ws_manager

router = APIRouter(prefix="/api/v1/emergencies", tags=["Emergencies"])


@router.post("/trigger", response_model=EmergencyRequestResponse, status_code=status.HTTP_201_CREATED)
async def trigger_emergency(
    payload: EmergencyRequestCreate,
    optional_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    caller_id = optional_user.id if optional_user else None
    emergency = EmergencyRequest(
        caller_id=caller_id,
        caller_name=payload.caller_name,
        caller_phone=payload.caller_phone,
        emergency_type=payload.emergency_type,
        pickup_latitude=payload.pickup_latitude,
        pickup_longitude=payload.pickup_longitude,
        pickup_address=payload.pickup_address,
        status=TripStatus.PENDING,
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    log = DispatchLog(
        request_id=emergency.id,
        event_type="SOS_TRIGGERED",
        recorded_latitude=payload.pickup_latitude,
        recorded_longitude=payload.pickup_longitude,
        details_json=f'{{"emergency_type": "{payload.emergency_type.value}", "caller_name": "{payload.caller_name}"}}',
    )
    db.add(log)
    db.commit()

    allocation = allocate_emergency_resources(emergency.id, db)
    db.refresh(emergency)

    if allocation:
        msg = {
            "event": "DISPATCH_ALLOCATED",
            "request_id": emergency.id,
            "status": emergency.status.value,
            "ambulance_id": emergency.ambulance_id,
            "vehicle_number": allocation.vehicle_number,
            "hospital_id": emergency.hospital_id,
            "hospital_name": allocation.hospital_name,
            "bed_type": allocation.allocated_resource_type.value,
            "eta_seconds": allocation.ambulance_eta_seconds,
            "pickup": {
                "latitude": emergency.pickup_latitude,
                "longitude": emergency.pickup_longitude,
            },
        }
        await ws_manager.broadcast_tracking(emergency.id, msg)
        await ws_manager.broadcast_hospital(emergency.hospital_id, msg)
        await ws_manager.broadcast_dispatcher(msg)
    else:
        msg = {
            "event": "SOS_PENDING",
            "request_id": emergency.id,
            "status": "PENDING",
            "detail": "No ambulance or beds available; queued for dispatch",
        }
        await ws_manager.broadcast_dispatcher(msg)

    return emergency


@router.post("/{request_id}/allocate", response_model=EmergencyRequestResponse)
async def retry_allocation(
    request_id: int,
    current_user: User = Depends(require_role([UserRole.DISPATCHER])),
    db: Session = Depends(get_db),
):
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency request not found",
        )

    allocation = allocate_emergency_resources(request_id, db)
    db.refresh(emergency)

    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation failed: no available ambulance or qualifying bed found",
        )

    msg = {
        "event": "DISPATCH_ALLOCATED",
        "request_id": emergency.id,
        "status": emergency.status.value,
        "ambulance_id": emergency.ambulance_id,
        "hospital_id": emergency.hospital_id,
    }
    await ws_manager.broadcast_tracking(emergency.id, msg)
    await ws_manager.broadcast_hospital(emergency.hospital_id, msg)
    await ws_manager.broadcast_dispatcher(msg)

    return emergency


@router.post("/{request_id}/override", response_model=EmergencyRequestResponse)
async def override_allocation(
    request_id: int,
    payload: EmergencyRequestOverride,
    current_user: User = Depends(require_role([UserRole.DISPATCHER])),
    db: Session = Depends(get_db),
):
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency request not found",
        )

    if payload.ambulance_id and payload.ambulance_id != emergency.ambulance_id:
        new_amb = db.query(Ambulance).filter(Ambulance.id == payload.ambulance_id).first()
        if not new_amb:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected ambulance does not exist",
            )
        if emergency.ambulance:
            emergency.ambulance.status = AmbulanceStatus.AVAILABLE
        new_amb.status = AmbulanceStatus.DISPATCHED
        emergency.ambulance_id = new_amb.id

    if payload.hospital_id and payload.hospital_id != emergency.hospital_id:
        new_hosp = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
        if not new_hosp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected hospital does not exist",
            )

        target_res = (
            db.query(HospitalResource)
            .filter(
                HospitalResource.hospital_id == new_hosp.id,
                HospitalResource.resource_type == emergency.allocated_resource_type,
                HospitalResource.available_count > 0,
            )
            .first()
        )
        if not target_res:
            target_res = (
                db.query(HospitalResource)
                .filter(
                    HospitalResource.hospital_id == new_hosp.id,
                    HospitalResource.available_count > 0,
                )
                .first()
            )
        if not target_res:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected override hospital has no available beds",
            )

        if emergency.hospital_id and emergency.allocated_resource_type:
            old_res = (
                db.query(HospitalResource)
                .filter(
                    HospitalResource.hospital_id == emergency.hospital_id,
                    HospitalResource.resource_type == emergency.allocated_resource_type,
                )
                .first()
            )
            if old_res and old_res.reserved_count > 0:
                old_res.reserved_count -= 1
                old_res.available_count += 1

        target_res.available_count -= 1
        target_res.reserved_count += 1
        emergency.hospital_id = new_hosp.id
        emergency.allocated_resource_type = target_res.resource_type

    emergency.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(emergency)

    log = DispatchLog(
        request_id=emergency.id,
        ambulance_id=emergency.ambulance_id,
        event_type="DISPATCHER_OVERRIDE",
        details_json=f'{{"reason": "{payload.reason}", "dispatcher_id": {current_user.id}}}',
    )
    db.add(log)
    db.commit()

    msg = {
        "event": "DISPATCH_OVERRIDDEN",
        "request_id": emergency.id,
        "ambulance_id": emergency.ambulance_id,
        "hospital_id": emergency.hospital_id,
        "reason": payload.reason,
    }
    await ws_manager.broadcast_tracking(emergency.id, msg)
    if emergency.hospital_id:
        await ws_manager.broadcast_hospital(emergency.hospital_id, msg)
    await ws_manager.broadcast_dispatcher(msg)

    return emergency


@router.get("/", response_model=List[EmergencyRequestResponse])
def list_emergencies(
    status_filter: Optional[TripStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    query = db.query(EmergencyRequest)
    if status_filter:
        query = query.filter(EmergencyRequest.status == status_filter)
    return query.order_by(EmergencyRequest.created_at.desc()).all()


@router.get("/my-active", response_model=Optional[EmergencyRequestResponse])
def get_my_active_emergency(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active_statuses = [
        TripStatus.PENDING,
        TripStatus.DISPATCHED,
        TripStatus.EN_ROUTE,
        TripStatus.PICKED_UP,
    ]
    if current_user.role == UserRole.PATIENT:
        return (
            db.query(EmergencyRequest)
            .filter(
                EmergencyRequest.caller_id == current_user.id,
                EmergencyRequest.status.in_(active_statuses),
            )
            .order_by(EmergencyRequest.created_at.desc())
            .first()
        )
    elif current_user.role == UserRole.DRIVER:
        ambulance = (
            db.query(Ambulance)
            .filter(Ambulance.driver_id == current_user.id)
            .first()
        )
        if not ambulance:
            return None
        return (
            db.query(EmergencyRequest)
            .filter(
                EmergencyRequest.ambulance_id == ambulance.id,
                EmergencyRequest.status.in_(active_statuses),
            )
            .order_by(EmergencyRequest.created_at.desc())
            .first()
        )
    return None


@router.get("/{request_id}", response_model=EmergencyRequestResponse)
def get_emergency(request_id: int, db: Session = Depends(get_db)):
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency request not found",
        )
    return emergency


@router.patch("/{request_id}/status", response_model=EmergencyRequestResponse)
async def update_emergency_status(
    request_id: int,
    new_status: TripStatus,
    current_user: User = Depends(
        require_role([UserRole.DRIVER, UserRole.DISPATCHER, UserRole.HOSPITAL_ADMIN])
    ),
    db: Session = Depends(get_db),
):
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency request not found",
        )

    emergency.status = new_status
    if new_status == TripStatus.COMPLETED:
        emergency.resolved_at = datetime.utcnow()
        if emergency.ambulance:
            emergency.ambulance.status = AmbulanceStatus.AVAILABLE
        if emergency.hospital_id and emergency.allocated_resource_type:
            res = (
                db.query(HospitalResource)
                .filter(
                    HospitalResource.hospital_id == emergency.hospital_id,
                    HospitalResource.resource_type == emergency.allocated_resource_type,
                )
                .first()
            )
            if res and res.reserved_count > 0:
                res.reserved_count -= 1

    db.commit()
    db.refresh(emergency)

    log = DispatchLog(
        request_id=emergency.id,
        ambulance_id=emergency.ambulance_id,
        event_type=f"STATUS_TRANSITION_{new_status.value}",
        recorded_latitude=emergency.pickup_latitude,
        recorded_longitude=emergency.pickup_longitude,
        details_json=f'{{"updated_by_user_id": {current_user.id}, "role": "{current_user.role.value}"}}',
    )
    db.add(log)
    db.commit()

    msg = {
        "event": "STATUS_CHANGED",
        "request_id": emergency.id,
        "new_status": new_status.value,
        "ambulance_id": emergency.ambulance_id,
        "hospital_id": emergency.hospital_id,
    }
    await ws_manager.broadcast_tracking(emergency.id, msg)
    if emergency.hospital_id:
        await ws_manager.broadcast_hospital(emergency.hospital_id, msg)
    await ws_manager.broadcast_dispatcher(msg)

    return emergency


@router.post("/{request_id}/cancel", response_model=EmergencyRequestResponse)
async def cancel_emergency(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emergency = db.query(EmergencyRequest).filter(EmergencyRequest.id == request_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency request not found",
        )

    if current_user.role == UserRole.PATIENT and emergency.caller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot cancel another caller's emergency request",
        )

    if emergency.status in [TripStatus.PICKED_UP, TripStatus.ARRIVED, TripStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel emergency once patient is picked up or trip completed",
        )

    emergency.status = TripStatus.CANCELLED
    emergency.resolved_at = datetime.utcnow()

    if emergency.ambulance:
        emergency.ambulance.status = AmbulanceStatus.AVAILABLE

    if emergency.hospital_id and emergency.allocated_resource_type:
        resource = (
            db.query(HospitalResource)
            .filter(
                HospitalResource.hospital_id == emergency.hospital_id,
                HospitalResource.resource_type == emergency.allocated_resource_type,
            )
            .first()
        )
        if resource and resource.reserved_count > 0:
            resource.reserved_count -= 1
            resource.available_count += 1

    db.commit()
    db.refresh(emergency)

    log = DispatchLog(
        request_id=emergency.id,
        event_type="CANCELLED",
        details_json=f'{{"cancelled_by": {current_user.id}}}',
    )
    db.add(log)
    db.commit()

    msg = {
        "event": "STATUS_CHANGED",
        "request_id": emergency.id,
        "new_status": "CANCELLED",
    }
    await ws_manager.broadcast_tracking(emergency.id, msg)
    if emergency.hospital_id:
        await ws_manager.broadcast_hospital(emergency.hospital_id, msg)
    await ws_manager.broadcast_dispatcher(msg)

    return emergency
