from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User
from pydantic import BaseModel
import os
import json

router = APIRouter()

class DesktopLoginRequest(BaseModel):
    email: str
    password: str

@router.post("/authenticate")
async def desktop_authenticate(
    request: Request,
    login_data: DesktopLoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate desktop app and return configuration"""
    from app.core.security import verify_password, create_access_token, create_refresh_token
    from app.models.user import User
    
    # Find user by email
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Get server URL
    server_url = os.getenv("SERVER_URL", "")
    if not server_url:
        base_url = str(request.base_url).rstrip('/')
        server_url = base_url
    if not server_url:
        server_url = "http://localhost:8000"
    
    # Create tokens for desktop app (long expiry)
    access_token = create_access_token(
        subject=str(user.id),
        expires_minutes=43200  # 30 days
    )
    
    refresh_token = create_refresh_token(
        subject=str(user.id),
        expires_days=90  # 90 days
    )
    
    # Store refresh token
    user.refresh_token = refresh_token
    db.commit()
    
    # Return configuration
    return {
        "success": True,
        "config": {
            "serverUrl": server_url,
            "authToken": access_token,
            "refreshToken": refresh_token,
            "labelPrinter": "",
            "bodyPrinter": "",
            "autoStart": True,
            "userId": user.id,
            "userEmail": user.email
        }
    }

@router.get("/download")
async def download_desktop_app(
    os_type: str = "windows",
    current_user: User = Depends(get_current_user)
):
    """Download the desktop app installer with auto-configured settings
    
    Args:
        os_type: Operating system type - "windows" or "macos"
    """
    try:
        import glob
        
        # Determine paths based on OS type
        if os_type.lower() in ["macos", "mac", "darwin"]:
            # macOS paths - look for .dmg files
            installer_paths = [
                # Production: Docker volume mount - exact match
                os.path.join("static", "desktop-app", "MoreTranz Printer.dmg"),
                # Production: Docker volume mount - versioned
                os.path.join("static", "desktop-app", "MoreTranz Printer *.dmg"),
                # Development: local paths - exact match
                os.path.join("desktop-app", "dist", "MoreTranz Printer.dmg"),
                # Development: local paths - versioned (actual build output)
                os.path.join("desktop-app", "dist", "MoreTranz Printer *.dmg"),
                # Development: alternative paths
                os.path.join("..", "desktop-app", "dist", "MoreTranz Printer *.dmg"),
                os.path.join("build", "MoreTranz Printer *.dmg"),
            ]
            default_filename = "MoreTranzPrinter-Setup.dmg"
            build_instruction = "1. Run: cd desktop-app && npm install && npm run build:mac\n2. This creates: desktop-app/dist/MoreTranz Printer.dmg\n"
        else:
            # Windows paths - look for .exe files (default)
            installer_paths = [
                # Production: Docker volume mount (read-only) - exact match
                os.path.join("static", "desktop-app", "MoreTranz Printer Setup.exe"),
                # Production: Docker volume mount - versioned
                os.path.join("static", "desktop-app", "MoreTranz Printer Setup *.exe"),
                # Development: local paths - exact match
                os.path.join("desktop-app", "dist", "MoreTranz Printer Setup.exe"),
                # Development: local paths - versioned (actual build output)
                os.path.join("desktop-app", "dist", "MoreTranz Printer Setup *.exe"),
                # Development: alternative paths
                os.path.join("..", "desktop-app", "dist", "MoreTranz Printer Setup *.exe"),
                os.path.join("desktop-app", "dist", "win-unpacked", "MoreTranz Printer.exe"),
                os.path.join("build", "MoreTranz Printer Setup *.exe"),
            ]
            default_filename = "MoreTranzPrinter-Setup.exe"
            build_instruction = "1. Run: cd desktop-app && npm install && npm run build:win\n2. This creates: desktop-app/dist/MoreTranz Printer Setup.exe\n"
        
        installer_path = None
        checked_paths = []
        
        for path_pattern in installer_paths:
            checked_paths.append(path_pattern)
            # Check if it's a glob pattern
            if '*' in path_pattern:
                matches = glob.glob(path_pattern)
                if matches:
                    # Use the most recent file (likely the latest version)
                    installer_path = max(matches, key=os.path.getmtime)
                    break
            elif os.path.exists(path_pattern):
                installer_path = path_pattern
                break
        
        if not installer_path:
            error_msg = (
                f"Desktop app installer for {os_type} not found.\n\n"
                "Please build the installer first:\n"
                + build_instruction +
                f"3. Checked paths: {', '.join(checked_paths)}"
            )
            raise HTTPException(
                status_code=404,
                detail=error_msg
            )
        
        # Validate file is readable
        if not os.access(installer_path, os.R_OK):
            raise HTTPException(
                status_code=403,
                detail=f"Installer file exists but is not readable: {installer_path}"
            )
        
        # Extract clean filename for download (remove path, keep version number)
        installer_filename = os.path.basename(installer_path)
        # Use a simpler name for the downloaded file
        download_filename = default_filename
        
        return FileResponse(
            path=installer_path,
            filename=download_filename,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={download_filename}"
            }
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error downloading desktop app: {error_trace}")  # Log full traceback
        raise HTTPException(
            status_code=500,
            detail=f"Error downloading desktop app: {str(e)}"
        )

@router.get("/config")
async def get_desktop_config(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get auto-configuration data for desktop app setup"""
    from app.core.security import create_access_token, create_refresh_token
    import os
    
    # Get server URL - prioritize environment variable, fallback to request
    server_url = os.getenv("SERVER_URL", "")
    
    if not server_url:
        # Get from request URL
        base_url = str(request.base_url).rstrip('/')
        server_url = base_url
    
    # If still empty, use localhost (development)
    if not server_url:
        server_url = "http://localhost:8000"
    
    # Create a fresh token for desktop app with longer expiry (30 days = 43,200 minutes)
    access_token = create_access_token(
        subject=str(current_user.id),
        expires_minutes=43200  # 30-day token for desktop app
    )
    
    # Create refresh token (7 days by default, but can be extended)
    refresh_token = create_refresh_token(
        subject=str(current_user.id),
        expires_days=90  # 90-day refresh token for desktop app
    )
    
    # Store refresh token in database
    current_user.refresh_token = refresh_token
    db.commit()
    
    # Return configuration data
    config = {
        "serverUrl": server_url,
        "authToken": access_token,
        "refreshToken": refresh_token,
        "labelPrinter": "",  # User selects in app
        "bodyPrinter": "",   # User selects in app
        "autoStart": True,
        "userId": current_user.id,
        "userEmail": current_user.email
    }
    
    return config

@router.get("/download-config")
async def download_config_file(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a pre-configured config.json file for desktop app"""
    from app.core.security import create_access_token, create_refresh_token
    import tempfile
    import os
    
    # Get server URL
    server_url = os.getenv("SERVER_URL", "")
    
    if not server_url:
        # Get from request URL
        base_url = str(request.base_url).rstrip('/')
        server_url = base_url
    
    if not server_url:
        server_url = "http://localhost:8000"
    
    # Create token with 30-day expiry (30 days = 43,200 minutes)
    access_token = create_access_token(
        subject=str(current_user.id),
        expires_minutes=43200  # 30-day token for desktop app
    )
    
    # Create refresh token (90 days)
    refresh_token = create_refresh_token(
        subject=str(current_user.id),
        expires_days=90  # 90-day refresh token for desktop app
    )
    
    # Store refresh token in database
    current_user.refresh_token = refresh_token
    db.commit()
    
    # Create config JSON
    config = {
        "serverUrl": server_url,
        "authToken": access_token,
        "refreshToken": refresh_token,
        "labelPrinter": "",
        "bodyPrinter": "",
        "autoStart": True
    }
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(
        mode='w',
        suffix='.json',
        delete=False
    )
    json.dump(config, temp_file, indent=2)
    temp_file.close()
    
    return FileResponse(
        path=temp_file.name,
        filename="config.json",
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=config.json"
        }
    )

