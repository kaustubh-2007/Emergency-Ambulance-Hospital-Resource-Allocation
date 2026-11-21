from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Hospital, HospitalResource, User, UserRole, EmergencyRequest, TripStatus
from backend.schemas import (
    HospitalResponse,
    HospitalCreate,
    HospitalUpdate,
    HospitalResourceUpdate,
    HospitalResourceResponse,
    EmergencyRequestResponse,
)
from backend.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/hospitals", tags=["Hospitals"])


@router.get("/", response_model=List[HospitalResponse])
def list_hospitals(db: Session = Depends(get_db)):
    return db.query(Hospital).all()


@router.get("/my-hospital", response_model=HospitalResponse)
def get_my_hospital(
    current_user: User = Depends(require_role([UserRole.HOSPITAL_ADMIN])),
    db: Session = Depends(get_db),
):
    hospital = db.query(Hospital).filter(Hospital.admin_id == current_user.id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hospital associated with this administrator account",
        )
    return hospital


@router.get("/{hospital_id}", response_model=HospitalResponse)
def get_hospital(hospital_id: int, db: Session = Depends(get_db)):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found",
        )
    return hospital


@router.post("/", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
def create_hospital(
    payload: HospitalCreate,
    current_user: User = Depends(require_role([UserRole.DISPATCHER])),
    db: Session = Depends(get_db),
):
    hospital = Hospital(
        name=payload.name,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        contact_phone=payload.contact_phone,
        has_cardiac=payload.has_cardiac,
        has_trauma=payload.has_trauma,
        has_maternity=payload.has_maternity,
        admin_id=payload.admin_id,
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.put("/{hospital_id}/resources/{resource_type}", response_model=HospitalResourceResponse)
def update_resource(
    hospital_id: int,
    resource_type: str,
    payload: HospitalResourceUpdate,
    current_user: User = Depends(
        require_role([UserRole.HOSPITAL_ADMIN, UserRole.DISPATCHER])
    ),
    db: Session = Depends(get_db),
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found",
        )

    if current_user.role == UserRole.HOSPITAL_ADMIN and hospital.admin_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage inventory for this hospital",
        )

    resource = (
        db.query(HospitalResource)
        .filter(
            HospitalResource.hospital_id == hospital_id,
            HospitalResource.resource_type == resource_type,
        )
        .first()
    )

    if not resource:
        resource = HospitalResource(
            hospital_id=hospital_id,
            resource_type=resource_type,
            total_count=payload.total_count or 0,
            available_count=payload.available_count or 0,
            reserved_count=payload.reserved_count or 0,
        )
        db.add(resource)
    else:
        if payload.total_count is not None:
            resource.total_count = payload.total_count
        if payload.available_count is not None:
            resource.available_count = max(0, payload.available_count)
        if payload.reserved_count is not None:
            resource.reserved_count = max(0, payload.reserved_count)
        resource.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(resource)
    return resource


@router.get("/{hospital_id}/alerts", response_model=List[EmergencyRequestResponse])
def get_hospital_alerts(
    hospital_id: int,
    current_user: User = Depends(
        require_role([UserRole.HOSPITAL_ADMIN, UserRole.DISPATCHER])
    ),
    db: Session = Depends(get_db),
):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital not found",
        )

    active_statuses = [
        TripStatus.DISPATCHED,
        TripStatus.EN_ROUTE,
        TripStatus.PICKED_UP,
        TripStatus.ARRIVED,
    ]
    alerts = (
        db.query(EmergencyRequest)
        .filter(
            EmergencyRequest.hospital_id == hospital_id,
            EmergencyRequest.status.in_(active_statuses),
        )
        .order_by(EmergencyRequest.created_at.desc())
        .all()
    )
    return alerts
