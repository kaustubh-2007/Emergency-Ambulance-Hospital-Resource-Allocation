import concurrent.futures
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.models import (
    Hospital,
    HospitalResource,
    ResourceType,
    Ambulance,
    AmbulanceStatus,
    EmergencyRequest,
    EmergencyType,
    TripStatus,
)
from backend.services.allocator import (
    haversine_distance,
    calculate_hospital_score,
    allocate_emergency_resources,
)

TEST_DB_URL = "sqlite:///./test_allocator.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def setup_function():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)


def teardown_function():
    Base.metadata.drop_all(bind=test_engine)


def test_haversine_distance_accuracy():
    lat1, lon1 = 26.8467, 80.9462
    lat2, lon2 = 26.8687, 80.9168
    distance = haversine_distance(lat1, lon1, lat2, lon2)
    assert 3.0 < distance < 5.0


def test_nearest_ambulance_selection():
    db = TestingSessionLocal()
    try:
        amb_far = Ambulance(
            vehicle_number="UP32-TEST-01",
            current_latitude=26.7000,
            current_longitude=80.8000,
            status=AmbulanceStatus.AVAILABLE,
        )
        amb_near = Ambulance(
            vehicle_number="UP32-TEST-02",
            current_latitude=26.8480,
            current_longitude=80.9450,
            status=AmbulanceStatus.AVAILABLE,
        )
        hosp = Hospital(
            name="Test General Hospital",
            address="Lucknow",
            latitude=26.8500,
            longitude=80.9500,
            has_cardiac=True,
            has_trauma=True,
            has_maternity=True,
        )
        db.add_all([amb_far, amb_near, hosp])
        db.commit()

        res = HospitalResource(
            hospital_id=hosp.id,
            resource_type=ResourceType.ICU_BED,
            total_count=10,
            available_count=5,
            reserved_count=0,
        )
        db.add(res)
        db.commit()

        req = EmergencyRequest(
            caller_name="Test Caller",
            caller_phone="9999999999",
            emergency_type=EmergencyType.CARDIAC,
            pickup_latitude=26.8470,
            pickup_longitude=80.9460,
            status=TripStatus.PENDING,
        )
        db.add(req)
        db.commit()

        result = allocate_emergency_resources(req.id, db)
        assert result is not None
        assert result.ambulance_id == amb_near.id
        assert result.vehicle_number == "UP32-TEST-02"
    finally:
        db.close()


def test_weighted_hospital_scoring_prefers_specialty():
    hosp_with_cardiac = Hospital(
        name="Cardiac Center",
        address="Central",
        latitude=26.8600,
        longitude=80.9600,
        has_cardiac=True,
    )
    hosp_no_cardiac = Hospital(
        name="Non-Cardiac Clinic",
        address="West",
        latitude=26.8600,
        longitude=80.9600,
        has_cardiac=False,
    )
    res = HospitalResource(
        hospital_id=1,
        resource_type=ResourceType.ICU_BED,
        total_count=10,
        available_count=5,
    )

    score_cardiac = calculate_hospital_score(
        hospital=hosp_with_cardiac,
        resource=res,
        emergency_type=EmergencyType.CARDIAC,
        eta_seconds=300.0,
        min_eta=300.0,
        max_eta=600.0,
    )

    score_no_cardiac = calculate_hospital_score(
        hospital=hosp_no_cardiac,
        resource=res,
        emergency_type=EmergencyType.CARDIAC,
        eta_seconds=300.0,
        min_eta=300.0,
        max_eta=600.0,
    )

    assert score_cardiac < score_no_cardiac


def test_zero_bed_fallback_to_second_hospital():
    db = TestingSessionLocal()
    try:
        amb = Ambulance(
            vehicle_number="UP32-TEST-03",
            current_latitude=26.8500,
            current_longitude=80.9500,
            status=AmbulanceStatus.AVAILABLE,
        )
        hosp_full = Hospital(
            name="Saturated Hospital",
            address="Lucknow North",
            latitude=26.8510,
            longitude=80.9510,
            has_cardiac=True,
        )
        hosp_available = Hospital(
            name="Capable Hospital",
            address="Lucknow South",
            latitude=26.8700,
            longitude=80.9700,
            has_cardiac=True,
        )
        db.add_all([amb, hosp_full, hosp_available])
        db.commit()

        res_full = HospitalResource(
            hospital_id=hosp_full.id,
            resource_type=ResourceType.ICU_BED,
            total_count=10,
            available_count=0,
            reserved_count=10,
        )
        res_available = HospitalResource(
            hospital_id=hosp_available.id,
            resource_type=ResourceType.ICU_BED,
            total_count=10,
            available_count=4,
            reserved_count=1,
        )
        db.add_all([res_full, res_available])
        db.commit()

        req = EmergencyRequest(
            caller_name="Critical Patient",
            caller_phone="9999999999",
            emergency_type=EmergencyType.CARDIAC,
            pickup_latitude=26.8505,
            pickup_longitude=80.9505,
            status=TripStatus.PENDING,
        )
        db.add(req)
        db.commit()

        result = allocate_emergency_resources(req.id, db)
        assert result is not None
        assert result.hospital_id == hosp_available.id
        assert result.allocated_resource_type == ResourceType.ICU_BED

        db.refresh(res_available)
        assert res_available.available_count == 3
        assert res_available.reserved_count == 2
    finally:
        db.close()


def test_concurrent_bed_locking_prevents_double_booking():
    db = TestingSessionLocal()
    try:
        amb = Ambulance(
            vehicle_number="UP32-LOCK-01",
            current_latitude=26.85,
            current_longitude=80.95,
            status=AmbulanceStatus.AVAILABLE,
        )
        hosp = Hospital(
            name="Last Bed Hospital",
            address="Lucknow",
            latitude=26.85,
            longitude=80.95,
            has_cardiac=True,
        )
        db.add_all([amb, hosp])
        db.commit()

        single_bed = HospitalResource(
            hospital_id=hosp.id,
            resource_type=ResourceType.ICU_BED,
            total_count=1,
            available_count=1,
            reserved_count=0,
        )
        db.add(single_bed)
        db.commit()

        requests = []
        for i in range(5):
            req = EmergencyRequest(
                caller_name=f"Caller {i}",
                caller_phone=f"900000000{i}",
                emergency_type=EmergencyType.CARDIAC,
                pickup_latitude=26.85,
                pickup_longitude=80.95,
                status=TripStatus.PENDING,
            )
            db.add(req)
            requests.append(req)
        db.commit()

        req_ids = [r.id for r in requests]
    finally:
        db.close()

    def attempt_allocation(req_id: int):
        thread_db = TestingSessionLocal()
        try:
            return allocate_emergency_resources(req_id, thread_db)
        finally:
            thread_db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(attempt_allocation, req_ids))

    successful_allocations = [r for r in results if r is not None]

    assert len(successful_allocations) == 1

    verify_db = TestingSessionLocal()
    try:
        final_resource = (
            verify_db.query(HospitalResource)
            .filter(HospitalResource.resource_type == ResourceType.ICU_BED)
            .first()
        )
        assert final_resource.available_count == 0
        assert final_resource.reserved_count == 1
    finally:
        verify_db.close()
