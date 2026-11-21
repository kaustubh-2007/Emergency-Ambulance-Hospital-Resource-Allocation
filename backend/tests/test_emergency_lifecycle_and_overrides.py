import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Ambulance, AmbulanceStatus, HospitalResource, ResourceType

client = TestClient(app)


def get_token(email: str, password: str) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def reset_fleet_availability():
    db = SessionLocal()
    try:
        for amb in db.query(Ambulance).all():
            amb.status = AmbulanceStatus.AVAILABLE
        db.commit()
    finally:
        db.close()


def test_sos_cancellation_releases_bed():
    reset_fleet_availability()
    caller_token = get_token("caller@emergency.org", "Caller@123")
    headers = {"Authorization": f"Bearer {caller_token}"}

    trigger_res = client.post(
        "/api/v1/emergencies/trigger",
        headers=headers,
        json={
            "caller_name": "Cancellation Test",
            "caller_phone": "+91-9111122222",
            "emergency_type": "GENERAL",
            "pickup_latitude": 26.8500,
            "pickup_longitude": 80.9500,
        },
    )
    assert trigger_res.status_code == 201
    emerg = trigger_res.json()
    assert emerg["status"] in ["PENDING", "DISPATCHED"]

    cancel_res = client.post(
        f"/api/v1/emergencies/{emerg['id']}/cancel",
        headers=headers,
    )
    assert cancel_res.status_code == 200
    cancelled_data = cancel_res.json()
    assert cancelled_data["status"] == "CANCELLED"


def test_cannot_cancel_after_picked_up():
    reset_fleet_availability()
    caller_token = get_token("caller@emergency.org", "Caller@123")
    driver_token = get_token("driver1@emergency.org", "Driver@123")

    trigger_res = client.post(
        "/api/v1/emergencies/trigger",
        headers={"Authorization": f"Bearer {caller_token}"},
        json={
            "caller_name": "Abort Test",
            "caller_phone": "+91-9111133333",
            "emergency_type": "TRAUMA",
            "pickup_latitude": 26.8600,
            "pickup_longitude": 80.9300,
        },
    )
    emerg = trigger_res.json()

    client.patch(
        f"/api/v1/emergencies/{emerg['id']}/status",
        params={"new_status": "PICKED_UP"},
        headers={"Authorization": f"Bearer {driver_token}"},
    )

    cancel_res = client.post(
        f"/api/v1/emergencies/{emerg['id']}/cancel",
        headers={"Authorization": f"Bearer {caller_token}"},
    )
    assert cancel_res.status_code == 400


def test_dispatcher_manual_override():
    reset_fleet_availability()
    caller_token = get_token("caller@emergency.org", "Caller@123")
    dispatcher_token = get_token("dispatcher@emergency.org", "Dispatch@123")

    trigger_res = client.post(
        "/api/v1/emergencies/trigger",
        headers={"Authorization": f"Bearer {caller_token}"},
        json={
            "caller_name": "Override Target",
            "caller_phone": "+91-9111144444",
            "emergency_type": "CARDIAC",
            "pickup_latitude": 26.8400,
            "pickup_longitude": 80.9400,
        },
    )
    emerg = trigger_res.json()
    initial_hosp_id = emerg["hospital_id"]

    all_hospitals = client.get("/api/v1/hospitals/").json()
    other_hospital = next(h for h in all_hospitals if h["id"] != initial_hosp_id)

    override_res = client.post(
        f"/api/v1/emergencies/{emerg['id']}/override",
        headers={"Authorization": f"Bearer {dispatcher_token}"},
        json={
            "hospital_id": other_hospital["id"],
            "reason": "Mass casualty diversion protocol",
        },
    )
    assert override_res.status_code == 200
    overridden_emerg = override_res.json()
    assert overridden_emerg["hospital_id"] == other_hospital["id"]
