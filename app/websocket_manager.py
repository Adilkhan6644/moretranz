from fastapi import WebSocket
from typing import List
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌 WebSocket connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                print(f"🔌 WebSocket disconnected. Total connections: {len(self.active_connections)}")
            
            # Clean up any stale connections
            stale_connections = []
            for conn in self.active_connections:
                try:
                    # Try to ping the connection
                    await conn.send_text('ping')
                except:
                    stale_connections.append(conn)
            
            # Remove stale connections
            for conn in stale_connections:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)
                    print(f"🧹 Removed stale connection. Total connections: {len(self.active_connections)}")
                    
        except Exception as e:
            print(f"⚠️ Error during WebSocket disconnect: {str(e)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Mark for removal
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            await self.disconnect(connection)

    async def broadcast_order_update(self, order_data: dict):
        """Broadcast a new order to all connected clients"""
        message = json.dumps({
            "type": "new_order",
            "data": order_data
        })
        await self.broadcast(message)

    async def broadcast_status_update(self, status_data: dict):
        """Broadcast processing status update to all connected clients"""
        message = json.dumps({
            "type": "status_update", 
            "data": status_data
        })
        await self.broadcast(message)

# Global WebSocket manager instance
manager = ConnectionManager()
