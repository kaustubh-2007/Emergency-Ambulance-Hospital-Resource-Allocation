import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal, engine, Base
from backend.models import (
    User,
    UserRole,
    Ambulance,
    AmbulanceType,
    AmbulanceStatus,
    Hospital,
    HospitalResource,
    ResourceType,
)
from backend.auth import get_password_hash


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(User).first():
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding initial users for all 4 roles...")

        users_data = [
            {
                "email": "caller@emergency.org",
                "full_name": "Rahul Sharma",
                "phone": "+91-9876543210",
                "password": "Caller@123",
                "role": UserRole.PATIENT,
            },
            {
                "email": "driver1@emergency.org",
                "full_name": "Vikram Singh (Paramedic Lead)",
                "phone": "+91-9876543211",
                "password": "Driver@123",
                "role": UserRole.DRIVER,
            },
            {
                "email": "driver2@emergency.org",
                "full_name": "Amit Kumar (ALS Driver)",
                "phone": "+91-9876543212",
                "password": "Driver@123",
                "role": UserRole.DRIVER,
            },
            {
                "email": "driver3@emergency.org",
                "full_name": "Rajesh Yadav (BLS Driver)",
                "phone": "+91-9876543213",
                "password": "Driver@123",
                "role": UserRole.DRIVER,
            },
            {
                "email": "admin.kgmu@emergency.org",
                "full_name": "Dr. S. K. Verma (KGMU ER Head)",
                "phone": "+91-9876543214",
                "password": "Admin@123",
                "role": UserRole.HOSPITAL_ADMIN,
            },
            {
                "email": "admin.rml@emergency.org",
                "full_name": "Dr. Ananya Roy (RMLIMS Triage)",
                "phone": "+91-9876543215",
                "password": "Admin@123",
                "role": UserRole.HOSPITAL_ADMIN,
            },
            {
                "email": "dispatcher@emergency.org",
                "full_name": "Officer Priya Nair (Control Room)",
                "phone": "+91-9876543216",
                "password": "Dispatch@123",
                "role": UserRole.DISPATCHER,
            },
        ]

        created_users = {}
        for u in users_data:
            user = User(
                email=u["email"],
                full_name=u["full_name"],
                phone=u["phone"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"],
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created_users[u["email"]] = user

        print("Seeding hospitals and clinical inventory...")
        hospitals_data = [
            {
                "name": "King George's Medical University (KGMU) Trauma Center",
                "address": "Shah Mina Road, Chowk, Lucknow, UP 226003",
                "latitude": 26.8687,
                "longitude": 80.9168,
                "contact_phone": "+91-522-2257540",
                "has_cardiac": True,
                "has_trauma": True,
                "has_maternity": True,
                "admin_id": created_users["admin.kgmu@emergency.org"].id,
                "resources": [
                    {"type": ResourceType.GENERAL_BED, "total": 120, "available": 24, "reserved": 2},
                    {"type": ResourceType.ICU_BED, "total": 35, "available": 5, "reserved": 1},
                    {"type": ResourceType.VENTILATOR, "total": 20, "available": 4, "reserved": 0},
                    {"type": ResourceType.OXYGEN_UNIT, "total": 50, "available": 18, "reserved": 2},
                ],
            },
            {
                "name": "Dr. Ram Manohar Lohia Institute of Medical Sciences (RMLIMS)",
                "address": "Vibhuti Khand, Gomti Nagar, Lucknow, UP 226010",
                "latitude": 26.8631,
                "longitude": 80.9996,
                "contact_phone": "+91-522-4918504",
                "has_cardiac": True,
                "has_trauma": True,
                "has_maternity": True,
                "admin_id": created_users["admin.rml@emergency.org"].id,
                "resources": [
                    {"type": ResourceType.GENERAL_BED, "total": 90, "available": 15, "reserved": 1},
                    {"type": ResourceType.ICU_BED, "total": 25, "available": 3, "reserved": 0},
                    {"type": ResourceType.VENTILATOR, "total": 15, "available": 3, "reserved": 0},
                    {"type": ResourceType.OXYGEN_UNIT, "total": 40, "available": 12, "reserved": 1},
                ],
            },
            {
                "name": "Medanta Super Specialty Hospital",
                "address": "Sector A, Pocket 1, Sushant Golf City, Amar Shaheed Path, Lucknow, UP 226030",
                "latitude": 26.7797,
                "longitude": 81.0022,
                "contact_phone": "+91-522-4505050",
                "has_cardiac": True,
                "has_trauma": True,
                "has_maternity": False,
                "admin_id": None,
                "resources": [
                    {"type": ResourceType.GENERAL_BED, "total": 150, "available": 45, "reserved": 0},
                    {"type": ResourceType.ICU_BED, "total": 40, "available": 8, "reserved": 0},
                    {"type": ResourceType.VENTILATOR, "total": 25, "available": 6, "reserved": 0},
                    {"type": ResourceType.OXYGEN_UNIT, "total": 60, "available": 25, "reserved": 0},
                ],
            },
            {
                "name": "Sanjay Gandhi Postgraduate Institute (SGPGIMS)",
                "address": "Raebareli Road, Lucknow, UP 226014",
                "latitude": 26.7456,
                "longitude": 80.9416,
                "contact_phone": "+91-522-2668700",
                "has_cardiac": True,
                "has_trauma": True,
                "has_maternity": False,
                "admin_id": None,
                "resources": [
                    {"type": ResourceType.GENERAL_BED, "total": 200, "available": 30, "reserved": 1},
                    {"type": ResourceType.ICU_BED, "total": 50, "available": 6, "reserved": 1},
                    {"type": ResourceType.VENTILATOR, "total": 30, "available": 5, "reserved": 0},
                    {"type": ResourceType.OXYGEN_UNIT, "total": 80, "available": 20, "reserved": 0},
                ],
            },
            {
                "name": "Max Super Speciality Hospital (Sahara)",
                "address": "Viraj Khand, Gomti Nagar, Lucknow, UP 226010",
                "latitude": 26.8524,
                "longitude": 81.0261,
                "contact_phone": "+91-522-6780001",
                "has_cardiac": True,
                "has_trauma": True,
                "has_maternity": True,
                "admin_id": None,
                "resources": [
                    {"type": ResourceType.GENERAL_BED, "total": 80, "available": 18, "reserved": 0},
                    {"type": ResourceType.ICU_BED, "total": 20, "available": 4, "reserved": 0},
                    {"type": ResourceType.VENTILATOR, "total": 10, "available": 2, "reserved": 0},
                    {"type": ResourceType.OXYGEN_UNIT, "total": 35, "available": 10, "reserved": 0},
                ],
            },
        ]

        for h in hospitals_data:
            hospital = Hospital(
                name=h["name"],
                address=h["address"],
                latitude=h["latitude"],
                longitude=h["longitude"],
                contact_phone=h["contact_phone"],
                has_cardiac=h["has_cardiac"],
                has_trauma=h["has_trauma"],
                has_maternity=h["has_maternity"],
                admin_id=h["admin_id"],
            )
            db.add(hospital)
            db.commit()
            db.refresh(hospital)

            for r in h["resources"]:
                resource = HospitalResource(
                    hospital_id=hospital.id,
                    resource_type=r["type"],
                    total_count=r["total"],
                    available_count=r["available"],
                    reserved_count=r["reserved"],
                )
                db.add(resource)
            db.commit()

        print("Seeding municipal ambulance fleet...")
        ambulances_data = [
            {
                "vehicle_number": "UP32-EA-1001",
                "vehicle_type": AmbulanceType.ADVANCED_LIFE_SUPPORT,
                "latitude": 26.8467,
                "longitude": 80.9462,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": created_users["driver1@emergency.org"].id,
            },
            {
                "vehicle_number": "UP32-EA-1002",
                "vehicle_type": AmbulanceType.ADVANCED_LIFE_SUPPORT,
                "latitude": 26.8322,
                "longitude": 80.9234,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": created_users["driver2@emergency.org"].id,
            },
            {
                "vehicle_number": "UP32-EA-1003",
                "vehicle_type": AmbulanceType.BASIC,
                "latitude": 26.8528,
                "longitude": 80.9984,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": created_users["driver3@emergency.org"].id,
            },
            {
                "vehicle_number": "UP32-EA-1004",
                "vehicle_type": AmbulanceType.ADVANCED_LIFE_SUPPORT,
                "latitude": 26.8142,
                "longitude": 80.9023,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": None,
            },
            {
                "vehicle_number": "UP32-EA-1005",
                "vehicle_type": AmbulanceType.BASIC,
                "latitude": 26.8712,
                "longitude": 80.9089,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": None,
            },
            {
                "vehicle_number": "UP32-EA-1006",
                "vehicle_type": AmbulanceType.ADVANCED_LIFE_SUPPORT,
                "latitude": 26.8835,
                "longitude": 80.9841,
                "status": AmbulanceStatus.AVAILABLE,
                "driver_id": None,
            },
        ]

        for a in ambulances_data:
            amb = Ambulance(
                vehicle_number=a["vehicle_number"],
                vehicle_type=a["vehicle_type"],
                current_latitude=a["latitude"],
                current_longitude=a["longitude"],
                status=a["status"],
                driver_id=a["driver_id"],
                last_heartbeat=datetime.utcnow(),
            )
            db.add(amb)
        db.commit()

        print("Database successfully seeded with realistic emergency infrastructure!")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
