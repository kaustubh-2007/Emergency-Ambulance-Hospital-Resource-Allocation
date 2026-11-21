from typing import Dict, List
import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.tracking_connections: Dict[int, List[WebSocket]] = {}
        self.hospital_connections: Dict[int, List[WebSocket]] = {}
        self.dispatcher_connections: List[WebSocket] = []

    async def connect_tracking(self, request_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        if request_id not in self.tracking_connections:
            self.tracking_connections[request_id] = []
        self.tracking_connections[request_id].append(websocket)

    def disconnect_tracking(self, request_id: int, websocket: WebSocket) -> None:
        if request_id in self.tracking_connections:
            if websocket in self.tracking_connections[request_id]:
                self.tracking_connections[request_id].remove(websocket)
            if not self.tracking_connections[request_id]:
                del self.tracking_connections[request_id]

    async def broadcast_tracking(self, request_id: int, message: dict) -> None:
        if request_id in self.tracking_connections:
            dead_connections = []
            for ws in self.tracking_connections[request_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead_connections.append(ws)
            for ws in dead_connections:
                self.disconnect_tracking(request_id, ws)

    async def connect_hospital(self, hospital_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        if hospital_id not in self.hospital_connections:
            self.hospital_connections[hospital_id] = []
        self.hospital_connections[hospital_id].append(websocket)

    def disconnect_hospital(self, hospital_id: int, websocket: WebSocket) -> None:
        if hospital_id in self.hospital_connections:
            if websocket in self.hospital_connections[hospital_id]:
                self.hospital_connections[hospital_id].remove(websocket)
            if not self.hospital_connections[hospital_id]:
                del self.hospital_connections[hospital_id]

    async def broadcast_hospital(self, hospital_id: int, message: dict) -> None:
        if hospital_id in self.hospital_connections:
            dead_connections = []
            for ws in self.hospital_connections[hospital_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead_connections.append(ws)
            for ws in dead_connections:
                self.disconnect_hospital(hospital_id, ws)

    async def connect_dispatcher(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.dispatcher_connections.append(websocket)

    def disconnect_dispatcher(self, websocket: WebSocket) -> None:
        if websocket in self.dispatcher_connections:
            self.dispatcher_connections.remove(websocket)

    async def broadcast_dispatcher(self, message: dict) -> None:
        dead_connections = []
        for ws in self.dispatcher_connections:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead_connections.append(ws)
        for ws in dead_connections:
            self.disconnect_dispatcher(ws)


ws_manager = ConnectionManager()
