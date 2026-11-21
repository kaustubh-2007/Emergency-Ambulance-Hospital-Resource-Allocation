from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Ambulance, AmbulanceStatus, User, UserRole, EmergencyRequest, TripStatus
from backend.schemas import (
    AmbulanceResponse,
    AmbulanceCreate,
    AmbulanceUpdate,
    AmbulanceTelemetry,
)
from backend.auth import get_current_user, require_role
from backend.ws.manager import ws_manager

router = APIRouter(prefix="/api/v1/ambulances", tags=["Ambulances"])


@router.get("/", response_model=List[AmbulanceResponse])
def list_ambulances(
    status_filter: Optional[AmbulanceStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    query = db.query(Ambulance)
    if status_filter:
        query = query.filter(Ambulance.status == status_filter)
    return query.all()


@router.get("/my-vehicle", response_model=AmbulanceResponse)
def get_my_vehicle(
    current_user: User = Depends(require_role([UserRole.DRIVER])),
    db: Session = Depends(get_db),
):
    ambulance = db.query(Ambulance).filter(Ambulance.driver_id == current_user.id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vehicle assigned to the current driver",
        )
    return ambulance


@router.get("/{ambulance_id}", response_model=AmbulanceResponse)
def get_ambulance(ambulance_id: int, db: Session = Depends(get_db)):
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance not found",
        )
    return ambulance


@router.post("/", response_model=AmbulanceResponse, status_code=status.HTTP_201_CREATED)
def create_ambulance(
    payload: AmbulanceCreate,
    current_user: User = Depends(require_role([UserRole.DISPATCHER])),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Ambulance)
        .filter(Ambulance.vehicle_number == payload.vehicle_number)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An ambulance with this vehicle number already exists",
        )

    ambulance = Ambulance(
        vehicle_number=payload.vehicle_number,
        vehicle_type=payload.vehicle_type,
        current_latitude=payload.current_latitude,
        current_longitude=payload.current_longitude,
        status=payload.status,
        driver_id=payload.driver_id,
        last_heartbeat=datetime.utcnow(),
    )
    db.add(ambulance)
    db.commit()
    db.refresh(ambulance)
    return ambulance


@router.patch("/{ambulance_id}/status", response_model=AmbulanceResponse)
async def update_status(
    ambulance_id: int,
    payload: AmbulanceUpdate,
    current_user: User = Depends(
        require_role([UserRole.DRIVER, UserRole.DISPATCHER])
    ),
    db: Session = Depends(get_db),
):
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance not found",
        )

    if current_user.role == UserRole.DRIVER and ambulance.driver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update an ambulance not assigned to you",
        )

    if payload.status is not None:
        ambulance.status = payload.status
    if payload.vehicle_type is not None:
        ambulance.vehicle_type = payload.vehicle_type
    if payload.current_latitude is not None:
        ambulance.current_latitude = payload.current_latitude
    if payload.current_longitude is not None:
        ambulance.current_longitude = payload.current_longitude

    ambulance.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(ambulance)

    msg = {
        "event": "AMBULANCE_STATUS_UPDATED",
        "ambulance_id": ambulance.id,
        "status": ambulance.status.value,
        "vehicle_number": ambulance.vehicle_number,
    }
    await ws_manager.broadcast_dispatcher(msg)

    return ambulance


@router.patch("/{ambulance_id}/telemetry", response_model=AmbulanceResponse)
async def update_telemetry(
    ambulance_id: int,
    telemetry: AmbulanceTelemetry,
    current_user: User = Depends(
        require_role([UserRole.DRIVER, UserRole.DISPATCHER])
    ),
    db: Session = Depends(get_db),
):
    ambulance = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
    if not ambulance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance not found",
        )

    if current_user.role == UserRole.DRIVER and ambulance.driver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update telemetry for another driver's vehicle",
        )

    ambulance.current_latitude = telemetry.latitude
    ambulance.current_longitude = telemetry.longitude
    ambulance.last_heartbeat = datetime.utcnow()

    db.commit()
    db.refresh(ambulance)

    active_trip = (
        db.query(EmergencyRequest)
        .filter(
            EmergencyRequest.ambulance_id == ambulance.id,
            EmergencyRequest.status.in_([
                TripStatus.DISPATCHED,
                TripStatus.EN_ROUTE,
                TripStatus.PICKED_UP,
                TripStatus.ARRIVED,
            ]),
        )
        .first()
    )

    telemetry_msg = {
        "event": "TELEMETRY_UPDATE",
        "ambulance_id": ambulance.id,
        "vehicle_number": ambulance.vehicle_number,
        "coordinates": {
            "latitude": telemetry.latitude,
            "longitude": telemetry.longitude,
        },
        "speed_kmh": telemetry.speed_kmh,
        "heading": telemetry.heading,
        "request_id": active_trip.id if active_trip else None,
    }

    if active_trip:
        await ws_manager.broadcast_tracking(active_trip.id, telemetry_msg)
    await ws_manager.broadcast_dispatcher(telemetry_msg)

    return ambulance
