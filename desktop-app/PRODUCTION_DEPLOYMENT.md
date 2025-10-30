# Production Deployment Guide

## Overview

This guide helps you deploy the desktop app for production use, making it easy for end users to download and install with minimal configuration.

## Prerequisites

1. Backend server running (Docker or standalone)
2. Node.js installed on build machine
3. Windows machine for building Windows installer (or use GitHub Actions)

## Step 1: Build the Installer

### On Windows Build Machine

```bash
cd desktop-app
npm install
npm run build:win
```

This creates: `dist/MoreTranz Printer Setup.exe`

### Using Build Script

```bash
# Windows
build-installer.bat

# Linux/Mac (if using Wine)
chmod +x build-installer.sh
./build-installer.sh
```

## Step 2: Deploy Installer to Server

### Option A: Copy to Server Directory

```bash
# Copy installer to a location accessible by the backend
cp dist/MoreTranz\ Printer\ Setup.exe /path/to/server/static/desktop-app/
```

Update `app/api/endpoints/desktop.py`:
```python
installer_path = "/path/to/server/static/desktop-app/MoreTranz Printer Setup.exe"
```

### Option B: Serve from Docker Volume

1. Mount volume in `docker-compose.yml`:
```yaml
backend:
  volumes:
    - ./desktop-app/dist:/app/static/desktop-app
```

2. Update endpoint:
```python
installer_path = os.path.join("static", "desktop-app", "MoreTranz Printer Setup.exe")
```

### Option C: Use CDN/Static File Server

1. Upload installer to CDN (S3, CloudFlare, etc.)
2. Update endpoint to redirect to CDN URL:
```python
from fastapi.responses import RedirectResponse

@router.get("/download")
async def download_desktop_app(...):
    cdn_url = "https://your-cdn.com/MoreTranz-Printer-Setup.exe"
    return RedirectResponse(url=cdn_url)
```

## Step 3: Set Server URL Environment Variable

The backend needs to know the server URL for auto-configuration:

```bash
# In docker-compose.yml or .env
SERVER_URL=https://your-domain.com
```

Or in environment:
```python
# In desktop.py
server_url = os.getenv("SERVER_URL", request.base_url.replace(path="", query=""))
```

## Step 4: Update Desktop App Endpoint

Edit `app/api/endpoints/desktop.py` to point to correct installer location:

```python
installer_path = os.path.join("static", "desktop-app", "MoreTranz Printer Setup.exe")
```

## Step 5: Deploy and Test

1. **Deploy backend** with updated endpoints
2. **Login to web app**
3. **Go to Dashboard**
4. **Click "Download Desktop App"**
5. **Verify download works**

## User Experience Flow

### Simplified Setup (Production Ready)

1. **User logs into web app**
2. **Clicks "Download Desktop App"** in Dashboard
3. **Downloads installer** (pre-authenticated)
4. **Runs installer** → Installs app
5. **Opens app** → Configuration window appears
6. **Selects printers** → Done!

### Even Simpler (With Auto-Config)

User can optionally download `config.json` separately:

1. **Downloads app** from Dashboard
2. **Downloads config** from Dashboard  
3. **Places config.json** in Downloads folder
4. **Installs app** → Auto-detects config → Ready!

## Configuration Auto-Loading

The desktop app automatically:
- ✅ Checks Downloads folder for `config.json`
- ✅ Loads server URL and auth token automatically
- ✅ Only asks user to select printers
- ✅ Minimizes manual configuration

## Environment Variables

Add to your `.env` or `docker-compose.yml`:

```env
# Server URL for desktop app auto-configuration
SERVER_URL=https://your-production-domain.com

# Or use request.base_url for automatic detection
```

## Testing in Production

1. **Test download endpoint**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-domain.com/api/v1/desktop/download \
        -o test-installer.exe
   ```

2. **Test config endpoint**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-domain.com/api/v1/desktop/config
   ```

3. **Test in browser**: Login → Dashboard → Download button

## Troubleshooting

### Installer not found (404)

- Check installer path in `desktop.py`
- Verify file permissions
- Check Docker volume mounts

### Download fails

- Check authentication token is valid
- Verify file size (should be ~100MB+)
- Check server logs for errors

### Auto-config not working

- Verify `config.json` format
- Check Downloads folder path
- Enable console logs in desktop app

## Production Checklist

- [ ] Installer built and tested locally
- [ ] Installer deployed to server/static location
- [ ] SERVER_URL environment variable set
- [ ] Desktop endpoint updated with correct path
- [ ] Download tested from Dashboard
- [ ] Auto-config tested with config.json download
- [ ] User flow tested end-to-end
- [ ] Documentation updated

## Security Considerations

1. **Token Expiry**: Desktop app tokens expire after 30 days (configurable)
2. **HTTPS Required**: Use HTTPS in production for secure downloads
3. **File Validation**: Consider adding file hash verification
4. **Rate Limiting**: Add rate limiting to download endpoints

## Next Steps

1. Build installer
2. Deploy to server
3. Test download flow
4. Announce to users
5. Monitor usage and feedback

