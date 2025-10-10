from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.websocket_manager import manager

# Import endpoints (models will be imported automatically)
from app.api.endpoints import orders, config, auth

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if hasattr(settings, 'ALLOWED_ORIGINS') and settings.ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}/orders", tags=["orders"])
app.include_router(config.router, prefix=f"{settings.API_V1_STR}/config", tags=["config"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            # Echo back for testing (optional)
            await manager.send_personal_message(f"Echo: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
