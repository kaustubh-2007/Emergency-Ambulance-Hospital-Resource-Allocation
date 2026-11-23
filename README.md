# 🚑 Emergency Ambulance & Hospital Resource Allocation System (EAHRAS)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Leaflet.js](https://img.shields.io/badge/Leaflet.js-1.9+-199900.svg?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![WebSockets](https://img.shields.io/badge/WebSockets-RFC_6455-orange.svg?style=flat&logo=websocket&logoColor=white)](https://websockets.readthedocs.io)
[![Pytest Suite](https://img.shields.io/badge/Pytest-15%20Passed%20(100%25)-brightgreen.svg?style=flat&logo=pytest&logoColor=white)](backend/tests/)
[![Standards](https://img.shields.io/badge/IEEE_830%20%2F%20ISO_29148-Compliant-blue.svg?style=flat)](docs/SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.md)

An autonomous, full-stack, real-time cyber-physical emergency dispatch and clinical routing platform. Built as a university Software Engineering capstone project, the system eliminates manual dispatch bottlenecks and hospital ER saturation by coupling true road-network routing, multi-criteria hospital triage scoring, atomic concurrency-safe bed locking, and live WebSocket telemetry.

---

## 🌟 Key Innovations & Features

### 1. Two-Stage Intelligent Allocation Engine (`backend/services/allocator.py`)
- **Stage 1 (Nearest Ambulance Matching):** Queries real-time `AVAILABLE` fleet units and calculates actual road-network travel duration via the **OSRM (Open Source Routing Machine)** `/route/v1/driving` API (prioritizing road travel time over straight-line distance, with high-precision spherical Haversine geometric fallback).
- **Stage 2 (Weighted Multi-Factor Hospital Scoring):** Evaluates regional hospitals within the transit radius having active capacity and scores them using the objective function:
  $$\text{Score} = (w_1 \cdot \text{Normalized\_ETA}) + (w_2 \cdot \text{Bed\_Occupancy\_Ratio}) + (w_3 \cdot \text{Specialty\_Penalty})$$
  *(Default weights: $w_1 = 0.45, w_2 = 0.25, w_3 = 0.30$; lowest score indicates the optimal facility).*

### 2. Concurrency-Safe Bed Locking (Zero Double-Booking)
- Eliminates race conditions during mass-casualty events or simultaneous emergency spikes using atomic conditional SQL transactions:
  ```sql
  UPDATE hospital_resources 
  SET available_count = available_count - 1, 
      reserved_count = reserved_count + 1, 
      updated_at = NOW() 
  WHERE hospital_id = :target_hospital_id 
    AND resource_type = :required_resource 
    AND available_count > 0;
  ```
- If competing threads contest the last remaining ICU bed, exactly one claims it (`rowcount == 1`); competing threads receive `rowcount == 0` and automatically roll over to the second-highest ranked hospital in the queue.

### 3. Full-Duplex Real-Time Telemetry Hub (`backend/ws/manager.py`)
- Maintains bi-directional WebSocket connections (RFC 6455) across three distinct subscriber channels:
  - `/ws/tracking/{request_id}`: Streams live coordinates, speed, and ETA countdown to the caller.
  - `/ws/hospital/{hospital_id}`: Broadcasts inbound trauma alerts and patient arrival vectors to ER intake teams.
  - `/ws/dispatcher`: Streams global fleet movements and active incidents to the city command center.

### 4. Zero Proprietary Mapping Dependency
- Built entirely on open-source GIS infrastructure using **Leaflet.js**, **OpenStreetMap raster tiles**, and self-hosted/public **OSRM routing**, eliminating commercial API licensing costs and third-party tracking dependencies.

### 5. Automated GPS Simulator (`backend/scripts/simulate_gps.py`)
- Includes a standalone Python script that seeds realistic regional infrastructure, triggers a live SOS incident, and smoothly interpolates ambulance GPS telemetry along turn-by-turn road waypoints for live presentations and evaluative demonstrations.

---

## 🏗️ System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                        |
|  [ Patient / Caller ]   [ Paramedic Driver ]   [ Hospital Admin ]   [ City Dispatch ] |
|  - One-Touch SOS        - In-Vehicle Routing   - Live Bed Adjuster  - Global GIS Map  |
|  - Live Leaflet Map     - Status Transitions   - Inbound ER Alerts  - Manual Override |
+---------------------------------------------------------------------------------------+
                                   |                       ^
                      HTTP REST / JSON                     |  WSS (WebSockets)
                                   v                       |  Sub-250ms Telemetry
+---------------------------------------------------------------------------------------+
|                                 APPLICATION GATEWAY                                   |
|                                FastAPI (Python 3.11)                                  |
|   ├── Authentication & RBAC (HMAC-SHA256 JWT, bcrypt, Passlib)                       |
|   ├── Two-Stage Allocation Engine (OSRM Road Matrix + Haversine Fallback)             |
|   ├── Concurrency Manager (Atomic Row-Level Database Transactions)                    |
|   └── WebSocket Connection Hub (/ws/tracking, /ws/hospital, /ws/dispatcher)          |
+---------------------------------------------------------------------------------------+
                                   |                       |
                    SQLAlchemy / asyncpg                   |  OSRM Route Query
                                   v                       v
+----------------------------------------------+   +------------------------------------+
|               DATA STORAGE TIER              |   |       EXTERNAL ROUTING TIER        |
|  PostgreSQL 15+ (SQLite Fallback Engine)     |   |   Open Source Routing Machine      |
|  - Users & Roles (RBAC)                      |   |   (OSRM Driving API v1)            |
|  - Ambulances & Live Telemetry               |   |   - Road-Network Distance Matrix   |
|  - Hospitals & Inventory (ICU/Oxygen Beds)   |   |   - Polyline Route Geometries      |
|  - Emergency Requests & Audit Logs           |   |   - Turn-by-Turn Transit Durations |
+----------------------------------------------+   +------------------------------------+
```

---

## 👥 User Personas & Role-Based Access Control (RBAC)

The system provides 4 specialized dashboards accessible via one-click demonstration logins on the `/login` portal:

| Role | Pre-configured Credentials | Dashboard Features |
| :--- | :--- | :--- |
| **Patient / Caller** | `caller@emergency.org`<br>`Caller@123` | • 1-Touch SOS trigger with auto-detected GPS coordinates.<br>• Emergency category picker (`CARDIAC`, `TRAUMA`, `MATERNITY`, `GENERAL`).<br>• Interactive Leaflet map with live ambulance tracking and ETA.<br>• Details on locked clinical bed type and destination facility. |
| **Ambulance Driver** | `driver1@emergency.org`<br>`Driver@123`<br>*(Unit: UP32-EA-1001)* | • Readiness status toggle (`AVAILABLE`, `BUSY`, `OFFLINE`).<br>• Real-time audio/visual mission dispatch notifications.<br>• Waypoint routing (Caller Location $\rightarrow$ Hospital Destination).<br>• Monotonic trip advancement (`DISPATCHED` $\rightarrow$ `EN_ROUTE` $\rightarrow$ `PICKED_UP` $\rightarrow$ `ARRIVED` $\rightarrow$ `COMPLETED`).<br>• Step vehicle GPS telemetry control. |
| **Hospital Admin** | `admin.kgmu@emergency.org`<br>`Admin@123`<br>*(KGMU Trauma Center)* | • Live bed counters (`GENERAL_BED`, `ICU_BED`, `VENTILATOR`, `OXYGEN_UNIT`).<br>• Quick increment (`+1`) and decrement (`-1`) controls.<br>• Inbound Emergency Alerts feed streaming approaching ambulances.<br>• "Admit Patient & Confirm Bed" clinical handover action. |
| **Central Dispatcher** | `dispatcher@emergency.org`<br>`Dispatch@123` | • Full-viewport city situational awareness map.<br>• Live fleet metrics (Available, Dispatched, Offline, and active calls).<br>• Hospital saturation progress bars.<br>• Live Incident Ledger with **Manual Supervisory Override** (reassign ambulance or divert destination with atomic bed re-reservation). |

---

## 🛠️ Tech Stack & Dependencies

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, React Router v6, Lucide Icons, Axios |
| **Mapping & GIS** | Leaflet.js v1.9, React-Leaflet, OpenStreetMap Tiles, OSRM Public API |
| **Backend API** | FastAPI 0.110+, Uvicorn (ASGI), Pydantic v2, Python 3.11+ |
| **Real-Time Layer** | WebSockets (RFC 6455 persistent connections) |
| **Database & ORM** | PostgreSQL 15+ (with SQLite fallback for instant zero-setup local execution), SQLAlchemy 2.0 |
| **Security** | OAuth2 Password Bearer, HMAC-SHA256 JWT (`python-jose`), `bcrypt` hashing |
| **Testing** | Pytest 8.1+, Pytest-Asyncio, HTTPX / Starlette TestClient |

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── database.py              # PostgreSQL engine with SQLite automatic fallback
│   ├── models.py                # Strictly typed SQLAlchemy ORM models (6 tables)
│   ├── schemas.py               # Pydantic v2 validation and response schemas
│   ├── auth.py                  # Cryptographic bcrypt hashing, JWT issuance & RBAC guards
│   ├── main.py                  # FastAPI entry point, CORS middleware & WebSocket routes
│   ├── requirements.txt         # Pinned backend dependencies
│   ├── routers/
│   │   ├── auth.py              # /api/v1/auth (Register, Login, Me)
│   │   ├── ambulances.py        # /api/v1/ambulances (Fleet listing, Status, Telemetry)
│   │   ├── hospitals.py         # /api/v1/hospitals (Inventory management, Inbound alerts)
│   │   └── emergencies.py       # /api/v1/emergencies (SOS trigger, Lifecycle, Overrides)
│   ├── services/
│   │   └── allocator.py         # Two-Stage Allocation Engine & Atomic Bed Locking
│   ├── ws/
│   │   └── manager.py           # Full-duplex WebSocket ConnectionManager
│   ├── scripts/
│   │   ├── seed_data.py         # Database seeder (Lucknow hospitals, fleet & accounts)
│   │   └── simulate_gps.py      # Standalone GPS route replay simulation utility
│   └── tests/
│       ├── test_allocator_and_concurrency.py      # Nearest unit, scoring & race-condition tests
│       ├── test_auth_and_crud.py                  # RBAC barriers, JWT & endpoint validation
│       └── test_emergency_lifecycle_and_overrides.py # Cancellation rules & dispatcher overrides
├── frontend/
│   ├── package.json             # NPM package manifest
│   ├── vite.config.js           # Vite configuration with API and WebSocket reverse proxy
│   ├── tailwind.config.js       # Tailwind CSS theme configuration
│   ├── index.html               # Entry HTML with Leaflet CSS styles
│   └── src/
│       ├── components/          # Reusable Navbar, LeafletMap with animated SVG markers
│       ├── context/             # AuthContext (JWT management & session caching)
│       ├── pages/               # Login, PatientDashboard, DriverDashboard, HospitalDashboard, DispatcherDashboard
│       ├── services/            # Axios API client and WebSocket connection helper
│       ├── App.jsx              # Declarative router and role-based redirect guards
│       └── main.jsx             # React DOM root entry point
└── docs/
    └── SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.md # Formal IEEE 830 / ISO 29148 Specification
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- **Python 3.11+**
- **Node.js v18+** and **npm**

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/Emergency-Ambulance-Hospital-Resource-Allocation.git
cd Emergency-Ambulance-Hospital-Resource-Allocation
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Seed realistic mock infrastructure (Lucknow trauma hospitals and ambulances)
python backend/scripts/seed_data.py

# Launch the FastAPI backend server
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```
> The API will be available at **`http://127.0.0.1:8001`**.  
> Interactive Swagger UI docs: **`http://127.0.0.1:8001/docs`**.

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
> The web application will launch at **`http://localhost:3000`**.

---

## 🎮 Running the Live GPS Simulation

To demonstrate automated dispatch, road waypoint routing, and live coordinate streaming without needing real physical ambulances:

```bash
# Make sure the backend server is running on port 8001
source .venv/bin/activate
python backend/scripts/simulate_gps.py
```

#### What the Simulator Executes:
1. Triggers an emergency SOS distress call (Cardiac emergency at Hazratganj).
2. The allocation engine matches Unit `UP32-EA-1006` and locks an ICU bed at *KGMU Trauma Center*.
3. Queries OSRM road geometry and streams **152 waypoints** to the caller interface via WebSockets (`EN_ROUTE`).
4. Reaches patient and advances status to `PICKED_UP`.
5. Queries road geometry to the hospital and streams **172 waypoints** to the emergency room dashboard.
6. Arrives at hospital, executes patient handover (`COMPLETED`), and returns the ambulance to `AVAILABLE`.

---

## 🧪 Automated Testing & Verification

The project includes **15 comprehensive Pytest test cases** covering mathematical proximity ranking, specialty weighting, concurrency guarantees, and RBAC authorization boundaries:

```bash
# Execute the full automated test suite
pytest backend/tests/ -v
```

### Test Suite Summary:
```bash
backend/tests/test_allocator_and_concurrency.py::test_haversine_distance_accuracy PASSED [  6%]
backend/tests/test_allocator_and_concurrency.py::test_nearest_ambulance_selection PASSED [ 13%]
backend/tests/test_allocator_and_concurrency.py::test_weighted_hospital_scoring_prefers_specialty PASSED [ 20%]
backend/tests/test_allocator_and_concurrency.py::test_zero_bed_fallback_to_second_hospital PASSED [ 26%]
backend/tests/test_allocator_and_concurrency.py::test_concurrent_bed_locking_prevents_double_booking PASSED [ 33%]
backend/tests/test_auth_and_crud.py::test_health_check PASSED            [ 40%]
backend/tests/test_auth_and_crud.py::test_user_login_success PASSED      [ 46%]
backend/tests/test_auth_and_crud.py::test_user_login_invalid_password PASSED [ 53%]
backend/tests/test_auth_and_crud.py::test_list_hospitals PASSED          [ 60%]
backend/tests/test_auth_and_crud.py::test_list_ambulances PASSED         [ 66%]
backend/tests/test_auth_and_crud.py::test_driver_role_enforcement_on_telemetry PASSED [ 73%]
backend/tests/test_auth_and_crud.py::test_trigger_sos PASSED             [ 80%]
backend/tests/test_emergency_lifecycle_and_overrides.py::test_sos_cancellation_releases_bed PASSED [ 86%]
backend/tests/test_emergency_lifecycle_and_overrides.py::test_cannot_cancel_after_picked_up PASSED [ 93%]
backend/tests/test_emergency_lifecycle_and_overrides.py::test_dispatcher_manual_override PASSED [100%]

======================== 15 passed, 1 warning in 1.83s =========================
```

> **Concurrency Validation Highlight:**  
> In `test_concurrent_bed_locking_prevents_double_booking`, 5 simultaneous execution threads compete for 1 remaining ICU bed (`available_count = 1`). Exactly **1 thread succeeds**, while 4 threads safely roll over, leaving `available_count == 0` with **zero double-booking**.

---

## 📄 Formal Documentation & Specifications

The project includes an exhaustive, submission-ready **Software Requirements Specification (SRS)** and **Software Design Document (SDD)** adhering strictly to **IEEE Std 830-1998** and **ISO/IEC/IEEE 29148:2018** standards:

- **Location:** [`docs/SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.md`](docs/SRS_and_SDD_Emergency_Ambulance_Hospital_Resource_Allocation.md)
- **Includes:**
  - Complete Use Case, Level-0 (Context) & Level-1 Data Flow Diagrams (DFD).
  - Relational Entity-Relationship (ER) Schema Model.
  - Critical Path End-to-End Sequence Diagram.
  - Activity Diagram with Exception & Fallback Handlers.
  - 4-Sprint Agile/Scrum Development Plan & Risk Management Matrix.

---

## 📜 License

This project is open-source and developed for academic evaluation under the **MIT License**.
