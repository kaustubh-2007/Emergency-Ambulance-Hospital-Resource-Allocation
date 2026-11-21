from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from backend.models import (
    UserRole,
    EmergencyType,
    AmbulanceType,
    AmbulanceStatus,
    TripStatus,
    ResourceType,
)


class UserBase(BaseModel):
    email: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.PATIENT


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None


class AmbulanceBase(BaseModel):
    vehicle_number: str
    vehicle_type: AmbulanceType = AmbulanceType.ADVANCED_LIFE_SUPPORT
    current_latitude: float = 0.0
    current_longitude: float = 0.0
    status: AmbulanceStatus = AmbulanceStatus.AVAILABLE


class AmbulanceCreate(AmbulanceBase):
    driver_id: Optional[int] = None


class AmbulanceUpdate(BaseModel):
    vehicle_type: Optional[AmbulanceType] = None
    status: Optional[AmbulanceStatus] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


class AmbulanceTelemetry(BaseModel):
    latitude: float
    longitude: float
    speed_kmh: Optional[float] = 0.0
    heading: Optional[float] = 0.0


class AmbulanceResponse(AmbulanceBase):
    id: int
    driver_id: Optional[int] = None
    last_heartbeat: datetime
    model_config = ConfigDict(from_attributes=True)


class HospitalResourceBase(BaseModel):
    resource_type: ResourceType
    total_count: int
    available_count: int
    reserved_count: int = 0


class HospitalResourceCreate(HospitalResourceBase):
    pass


class HospitalResourceUpdate(BaseModel):
    total_count: Optional[int] = None
    available_count: Optional[int] = None
    reserved_count: Optional[int] = None


class HospitalResourceResponse(HospitalResourceBase):
    id: int
    hospital_id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HospitalBase(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    contact_phone: Optional[str] = None
    has_cardiac: bool = True
    has_trauma: bool = True
    has_maternity: bool = True


class HospitalCreate(HospitalBase):
    admin_id: Optional[int] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    has_cardiac: Optional[bool] = None
    has_trauma: Optional[bool] = None
    has_maternity: Optional[bool] = None


class HospitalResponse(HospitalBase):
    id: int
    admin_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resources: List[HospitalResourceResponse] = []
    model_config = ConfigDict(from_attributes=True)


class EmergencyRequestCreate(BaseModel):
    caller_name: str
    caller_phone: str
    emergency_type: EmergencyType = EmergencyType.GENERAL
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: Optional[str] = None


class EmergencyRequestResponse(BaseModel):
    id: int
    caller_id: Optional[int] = None
    caller_name: str
    caller_phone: str
    emergency_type: EmergencyType
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: Optional[str] = None
    ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None
    allocated_resource_type: Optional[ResourceType] = None
    status: TripStatus
    estimated_eta_seconds: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    ambulance: Optional[AmbulanceResponse] = None
    hospital: Optional[HospitalResponse] = None
    model_config = ConfigDict(from_attributes=True)


class EmergencyRequestOverride(BaseModel):
    ambulance_id: Optional[int] = None
    hospital_id: Optional[int] = None
    reason: str


class DispatchLogResponse(BaseModel):
    id: int
    request_id: int
    ambulance_id: Optional[int] = None
    event_type: str
    recorded_latitude: Optional[float] = None
    recorded_longitude: Optional[float] = None
    details_json: Optional[str] = None
    recorded_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AllocationResult(BaseModel):
    request_id: int
    ambulance_id: int
    hospital_id: int
    allocated_resource_type: ResourceType
    ambulance_eta_seconds: float
    hospital_score: float
    hospital_name: str
    vehicle_number: str
