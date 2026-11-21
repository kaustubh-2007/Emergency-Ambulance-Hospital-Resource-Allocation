# 🚑 Emergency Ambulance & Hospital Resource Allocation System

A full-stack, real-time emergency response platform designed to automate the coordination between emergency callers, available ambulances, and equipped hospitals. Built as a Software Engineering project, the system minimizes response times and eliminates hospital diversions by combining live GPS tracking, intelligent resource scoring, and concurrency-safe bed reservations.

## ✨ Key Features

- **Role-Based Access Control (RBAC):** Dedicated dashboards for **Patients/Callers**, **Ambulance Drivers**, **Hospital Admins**, and **Central Dispatchers**.
- **Two-Stage Allocation Engine:**
  - **Nearest Ambulance Dispatch:** Matches active SOS requests with the closest available ambulance using OSRM road routing (with Haversine fallback).
  - **Weighted Hospital Scoring:** Ranks capable hospitals by combining ETA, real-time bed occupancy ratio, and emergency specialty match (`Cardiac`, `Trauma`, `Maternity`, `General`).
- **Concurrency-Safe Bed Locking:** Uses atomic database transactions to temporarily lock ICU/general beds upon dispatch, preventing race conditions during simultaneous emergencies.
- **Live Real-Time Tracking:** Streams ambulance GPS coordinates, trip status transitions, and hospital inventory updates via WebSockets onto interactive Leaflet maps.
- **Built-In GPS Simulator:** Includes a Python simulation script to replay live ambulance movement along routes for seamless local demos and testing.

## 🛠️ Tech Stack

- **Frontend:** React.js (Vite), Tailwind CSS, React-Leaflet (OpenStreetMap + OSRM)
- **Backend:** FastAPI (Python), SQLAlchemy, WebSockets, JWT Authentication
- **Database:** PostgreSQL (with SQLite fallback for local development)
- **Testing:** Pytest (unit tests for allocation logic and concurrent bed-locking)
