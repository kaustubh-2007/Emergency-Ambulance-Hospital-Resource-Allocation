import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_user_login_success():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "caller@emergency.org", "password": "Caller@123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "PATIENT"


def test_user_login_invalid_password():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "caller@emergency.org", "password": "WrongPassword"},
    )
    assert response.status_code == 401


def test_list_hospitals():
    response = client.get("/api/v1/hospitals/")
    assert response.status_code == 200
    hospitals = response.json()
    assert len(hospitals) >= 5
    first_hosp = hospitals[0]
    assert "resources" in first_hosp
    assert len(first_hosp["resources"]) > 0


def test_list_ambulances():
    response = client.get("/api/v1/ambulances/")
    assert response.status_code == 200
    ambulances = response.json()
    assert len(ambulances) >= 6


def test_driver_role_enforcement_on_telemetry():
    caller_login = client.post(
        "/api/v1/auth/login",
        json={"email": "caller@emergency.org", "password": "Caller@123"},
    ).json()
    caller_token = caller_login["access_token"]

    response = client.patch(
        "/api/v1/ambulances/1/telemetry",
        headers={"Authorization": f"Bearer {caller_token}"},
        json={"latitude": 26.85, "longitude": 80.95},
    )
    assert response.status_code == 403


def test_trigger_sos():
    response = client.post(
        "/api/v1/emergencies/trigger",
        json={
            "caller_name": "Test Emergency Caller",
            "caller_phone": "+91-9999988888",
            "emergency_type": "CARDIAC",
            "pickup_latitude": 26.8500,
            "pickup_longitude": 80.9400,
            "pickup_address": "Near Hazratganj Metro Station, Lucknow",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] in ["PENDING", "DISPATCHED"]
    assert data["emergency_type"] == "CARDIAC"
    assert data["caller_name"] == "Test Emergency Caller"
    if data["status"] == "DISPATCHED":
        assert data["ambulance_id"] is not None
        assert data["hospital_id"] is not None
