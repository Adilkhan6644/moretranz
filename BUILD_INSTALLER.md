# How to Build the Desktop App Installer

## Issue
The download button returns a 404/500 error because the installer file doesn't exist yet.

## Solution
You need to build the installer **on your local Windows machine** (not in Docker), then copy it to the server.

## Steps

### 1. Build Installer Locally (Windows)
```bash
cd desktop-app
npm install
npm run build:win
```

This creates: `desktop-app/dist/MoreTranz Printer Setup.exe`

### 2. Copy to Server (if deploying)
If you're running Docker on a server, copy the `.exe` file:
```bash
# Copy to server directory that's mounted in Docker
scp desktop-app/dist/MoreTranz\ Printer\ Setup.exe \
   user@server:/path/to/project/desktop-app/dist/
```

### 3. For Local Docker Development
If running Docker locally, just ensure the file exists at:
```
desktop-app/dist/MoreTranz Printer Setup.exe
```

The Docker volume mount (`./desktop-app/dist:/app/static/desktop-app:ro`) will make it available in the container.

### 4. Verify
After building and copying, restart Docker:
```bash
docker-compose restart backend
```

### 5. Test Download
Try the download button again. It should work now!

---

## Quick Check
- ✅ Installer built: `desktop-app/dist/MoreTranz Printer Setup.exe` exists
- ✅ Docker volume mount: `docker-compose.yml` has the volume configured
- ✅ Backend restarted: Changes are active

If the file doesn't exist, you'll get a helpful 404 error message.

