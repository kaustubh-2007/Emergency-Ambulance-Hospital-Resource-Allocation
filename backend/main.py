from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend import models
from backend.routers import auth, ambulances, hospitals, emergencies
from backend.ws.manager import ws_manager

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Emergency Ambulance and Hospital Resource Allocation API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ambulances.router)
app.include_router(hospitals.router)
app.include_router(emergencies.router)


@app.get("/")
def root():
    return {
        "system": "Emergency Ambulance & Hospital Resource Allocation",
        "status": "OPERATIONAL",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "service": "emergency-backend",
    }


@app.websocket("/ws/tracking/{request_id}")
async def websocket_tracking_endpoint(websocket: WebSocket, request_id: int):
    await ws_manager.connect_tracking(request_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_tracking(request_id, websocket)


@app.websocket("/ws/hospital/{hospital_id}")
async def websocket_hospital_endpoint(websocket: WebSocket, hospital_id: int):
    await ws_manager.connect_hospital(hospital_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_hospital(hospital_id, websocket)


@app.websocket("/ws/dispatcher")
async def websocket_dispatcher_endpoint(websocket: WebSocket):
    await ws_manager.connect_dispatcher(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_dispatcher(websocket)
