from datetime import datetime
import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    Text,
)
from sqlalchemy.orm import relationship
from backend.database import Base


class UserRole(str, enum.Enum):
    PATIENT = "PATIENT"
    DRIVER = "DRIVER"
    HOSPITAL_ADMIN = "HOSPITAL_ADMIN"
    DISPATCHER = "DISPATCHER"


class EmergencyType(str, enum.Enum):
    CARDIAC = "CARDIAC"
    TRAUMA = "TRAUMA"
    MATERNITY = "MATERNITY"
    GENERAL = "GENERAL"


class AmbulanceType(str, enum.Enum):
    BASIC = "BASIC"
    ADVANCED_LIFE_SUPPORT = "ADVANCED_LIFE_SUPPORT"


class AmbulanceStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    DISPATCHED = "DISPATCHED"
    EN_ROUTE = "EN_ROUTE"
    PICKED_UP = "PICKED_UP"
    ARRIVED = "ARRIVED"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"


class TripStatus(str, enum.Enum):
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    EN_ROUTE = "EN_ROUTE"
    PICKED_UP = "PICKED_UP"
    ARRIVED = "ARRIVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ResourceType(str, enum.Enum):
    GENERAL_BED = "GENERAL_BED"
    ICU_BED = "ICU_BED"
    VENTILATOR = "VENTILATOR"
    OXYGEN_UNIT = "OXYGEN_UNIT"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.PATIENT)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ambulance = relationship("Ambulance", back_populates="driver", uselist=False)
    hospitals = relationship("Hospital", back_populates="admin")
    emergency_requests = relationship("EmergencyRequest", back_populates="caller")


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    vehicle_number = Column(String(50), unique=True, index=True, nullable=False)
    vehicle_type = Column(
        SQLEnum(AmbulanceType),
        default=AmbulanceType.ADVANCED_LIFE_SUPPORT,
        nullable=False,
    )
    current_latitude = Column(Float, nullable=False, default=0.0)
    current_longitude = Column(Float, nullable=False, default=0.0)
    status = Column(
        SQLEnum(AmbulanceStatus),
        default=AmbulanceStatus.AVAILABLE,
        index=True,
        nullable=False,
    )
    last_heartbeat = Column(DateTime, default=datetime.utcnow, nullable=False)

    driver = relationship("User", back_populates="ambulance")
    emergency_requests = relationship("EmergencyRequest", back_populates="ambulance")
    dispatch_logs = relationship("DispatchLog", back_populates="ambulance")


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), index=True, nullable=False)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    contact_phone = Column(String(50), nullable=True)
    has_cardiac = Column(Boolean, default=True, nullable=False)
    has_trauma = Column(Boolean, default=True, nullable=False)
    has_maternity = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    admin = relationship("User", back_populates="hospitals")
    resources = relationship("HospitalResource", back_populates="hospital", cascade="all, delete-orphan")
    emergency_requests = relationship("EmergencyRequest", back_populates="hospital")


class HospitalResource(Base):
    __tablename__ = "hospital_resources"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    resource_type = Column(SQLEnum(ResourceType), nullable=False, index=True)
    total_count = Column(Integer, default=0, nullable=False)
    available_count = Column(Integer, default=0, nullable=False)
    reserved_count = Column(Integer, default=0, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    hospital = relationship("Hospital", back_populates="resources")


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"

    id = Column(Integer, primary_key=True, index=True)
    caller_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    caller_name = Column(String(255), nullable=False)
    caller_phone = Column(String(50), nullable=False)
    emergency_type = Column(
        SQLEnum(EmergencyType),
        default=EmergencyType.GENERAL,
        nullable=False,
    )
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)
    pickup_address = Column(String(500), nullable=True)
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True, index=True)
    allocated_resource_type = Column(SQLEnum(ResourceType), nullable=True)
    status = Column(
        SQLEnum(TripStatus),
        default=TripStatus.PENDING,
        index=True,
        nullable=False,
    )
    estimated_eta_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    resolved_at = Column(DateTime, nullable=True)

    caller = relationship("User", back_populates="emergency_requests")
    ambulance = relationship("Ambulance", back_populates="emergency_requests")
    hospital = relationship("Hospital", back_populates="emergency_requests")
    logs = relationship("DispatchLog", back_populates="request", cascade="all, delete-orphan")


class DispatchLog(Base):
    __tablename__ = "dispatch_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("emergency_requests.id"), nullable=False, index=True)
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=True)
    event_type = Column(String(100), nullable=False)
    recorded_latitude = Column(Float, nullable=True)
    recorded_longitude = Column(Float, nullable=True)
    details_json = Column(Text, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    request = relationship("EmergencyRequest", back_populates="logs")
    ambulance = relationship("Ambulance", back_populates="dispatch_logs")
