import os
import sys
import time
import math
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.database import SessionLocal
from backend.models import Ambulance, EmergencyRequest, TripStatus, Hospital
from backend.scripts.seed_data import seed

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")


def interpolate_points(start_lat: float, start_lon: float, end_lat: float, end_lon: float, steps: int):
    points = []
    for i in range(steps + 1):
        fraction = i / float(steps)
        lat = start_lat + (end_lat - start_lat) * fraction
        lon = start_lon + (end_lon - start_lon) * fraction
        points.append((round(lat, 6), round(lon, 6)))
    return points


def fetch_osrm_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float):
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson"
    try:
        res = requests.get(url, timeout=2.0)
        if res.status_code == 200:
            data = res.json()
            if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                coords = data["routes"][0]["geometry"]["coordinates"]
                return [(c[1], c[0]) for c in coords]
    except Exception:
        pass
    return interpolate_points(start_lat, start_lon, end_lat, end_lon, steps=15)


def run_simulation():
    seed()

    print("\n============================================================")
    print("🚑 EMERGENCY AMBULANCE & GPS TELEMETRY SIMULATOR")
    print("============================================================\n")

    login_res = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": "driver1@emergency.org", "password": "Driver@123"},
    )
    if login_res.status_code != 200:
        print(f"Error: Unable to authenticate driver. HTTP {login_res.status_code}")
        return

    driver_token = login_res.json()["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}

    print("Step 1: Ingesting Mock Emergency Distress Call (Cardiac in Hazratganj)...")
    sos_payload = {
        "caller_name": "Siddharth Verma",
        "caller_phone": "+91-9876543299",
        "emergency_type": "CARDIAC",
        "pickup_latitude": 26.8520,
        "pickup_longitude": 80.9490,
        "pickup_address": "Near GPO, Hazratganj, Lucknow, UP",
    }

    sos_res = requests.post(f"{BASE_URL}/api/v1/emergencies/trigger", json=sos_payload)
    if sos_res.status_code != 201:
        print(f"Failed to trigger emergency: {sos_res.text}")
        return

    emergency_data = sos_res.json()
    request_id = emergency_data["id"]
    ambulance_id = emergency_data["ambulance_id"]
    hospital_id = emergency_data["hospital_id"]

    db = SessionLocal()
    try:
        amb = db.query(Ambulance).filter(Ambulance.id == ambulance_id).first()
        hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        amb_start_lat = amb.current_latitude
        amb_start_lon = amb.current_longitude
        amb_number = amb.vehicle_number
        hosp_name = hosp.name
        hosp_lat = hosp.latitude
        hosp_lon = hosp.longitude
    finally:
        db.close()

    print(f"\n[ALLOCATION SUCCESSFUL]")
    print(f"  Incident ID   : #{request_id}")
    print(f"  Assigned Unit : {amb_number}")
    print(f"  Target Center : {hosp_name}")
    print(f"  Status        : {emergency_data['status']}")
    print(f"  Initial ETA   : {round(emergency_data['estimated_eta_seconds'] or 240, 1)} seconds\n")

    print("Step 2: Fetching Waypoints from Ambulance Position to Patient...")
    pickup_route = fetch_osrm_route(amb_start_lat, amb_start_lon, sos_payload["pickup_latitude"], sos_payload["pickup_longitude"])
    print(f"  Route acquired: {len(pickup_route)} trajectory coordinates.")

    requests.patch(
        f"{BASE_URL}/api/v1/emergencies/{request_id}/status",
        params={"new_status": "EN_ROUTE"},
        headers=driver_headers,
    )
    print("  Ambulance Status Updated: EN_ROUTE to Patient.\n")

    print("Step 3: Streaming Live Coordinates along Route to Caller...")
    for idx, (lat, lon) in enumerate(pickup_route):
        requests.patch(
            f"{BASE_URL}/api/v1/ambulances/{ambulance_id}/telemetry",
            json={"latitude": lat, "longitude": lon, "speed_kmh": 48.0, "heading": 175.0},
            headers=driver_headers,
        )
        pct = int(((idx + 1) / len(pickup_route)) * 100)
        print(f"  [TRANSIT -> CALLER] Waypoint {idx+1}/{len(pickup_route)} ({pct}%) -> Lat: {lat}, Lon: {lon}")
        time.sleep(0.5)

    print("\nStep 4: Ambulance Arrived at Patient Location.")
    requests.patch(
        f"{BASE_URL}/api/v1/emergencies/{request_id}/status",
        params={"new_status": "PICKED_UP"},
        headers=driver_headers,
    )
    print("  Incident Status Updated: PATIENT_ONBOARD (Picked Up).\n")

    print("Step 5: Fetching Waypoints from Pickup Location to Target Hospital...")
    hospital_route = fetch_osrm_route(sos_payload["pickup_latitude"], sos_payload["pickup_longitude"], hosp_lat, hosp_lon)
    print(f"  Hospital Route acquired: {len(hospital_route)} trajectory coordinates.\n")

    print("Step 6: Streaming Live Coordinates along Transit to Hospital...")
    for idx, (lat, lon) in enumerate(hospital_route):
        requests.patch(
            f"{BASE_URL}/api/v1/ambulances/{ambulance_id}/telemetry",
            json={"latitude": lat, "longitude": lon, "speed_kmh": 52.0, "heading": 85.0},
            headers=driver_headers,
        )
        pct = int(((idx + 1) / len(hospital_route)) * 100)
        print(f"  [TRANSIT -> HOSPITAL] Waypoint {idx+1}/{len(hospital_route)} ({pct}%) -> Lat: {lat}, Lon: {lon}")
        time.sleep(0.5)

    print("\nStep 7: Arrived at Emergency Department.")
    requests.patch(
        f"{BASE_URL}/api/v1/emergencies/{request_id}/status",
        params={"new_status": "ARRIVED"},
        headers=driver_headers,
    )
    print("  Incident Status: ARRIVED at Hospital.\n")

    time.sleep(1.0)
    print("Step 8: Patient Admitted, Bed Transferred, Mission Completed.")
    requests.patch(
        f"{BASE_URL}/api/v1/emergencies/{request_id}/status",
        params={"new_status": "COMPLETED"},
        headers=driver_headers,
    )
    print("  Incident Status: COMPLETED. Ambulance returned to AVAILABLE status.\n")

    print("============================================================")
    print("✓ GPS TELEMETRY & LIFECYCLE SIMULATION SUCCESSFULLY FINISHED")
    print("============================================================\n")


if __name__ == "__main__":
    run_simulation()
