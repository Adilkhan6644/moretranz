# Docker Deployment Guide for Desktop App

## 🎯 Key Point: **NO Source Code in Docker**

The desktop app **source code** does NOT go into Docker. Only the **built installer** (.exe file) needs to be served.

## Architecture

```
┌─────────────────────────────────────┐
│  Local Development Machine           │
│  └─ desktop-app/                     │
│     ├─ src code                      │
│     ├─ npm install                   │
│     └─ npm run build:win             │
│        └─ dist/                      │
│           └─ MoreTranz Printer Setup.exe  ← ONLY THIS GOES TO SERVER
└─────────────────────────────────────┘
              │
              │ Copy only .exe
              ▼
┌─────────────────────────────────────┐
│  Server (Docker)                     │
│  └─ static/desktop-app/              │
│     └─ MoreTranz Printer Setup.exe   │
│                                      │
│  Backend serves this file           │
│  via /api/v1/desktop/download       │
└─────────────────────────────────────┘
```

## Deployment Steps

### Step 1: Build Installer (Local Windows Machine)

**NOT in Docker** - Build on your local Windows machine:

```bash
cd desktop-app
npm install
npm run build:win
```

This creates: `desktop-app/dist/MoreTranz Printer Setup.exe`

### Step 2: Copy Installer to Server

**Only copy the .exe file**, not the entire desktop-app folder:

```bash
# On server or before Docker build
mkdir -p static/desktop-app
cp desktop-app/dist/MoreTranz\ Printer\ Setup.exe static/desktop-app/
```

### Step 3: Docker Configuration

The `docker-compose.yml` already mounts the installer:

```yaml
backend:
  volumes:
    - ./desktop-app/dist:/app/static/desktop-app:ro
```

**This mounts only the `dist/` folder**, not the source code.

### Step 4: Docker Ignore

The `.dockerignore` excludes desktop-app source:

```
desktop-app/
!desktop-app/dist/
!desktop-app/dist/**/*.exe
```

This means:
- ✅ Excludes all desktop-app source code
- ✅ Includes only the dist folder and .exe files

---

## Why This Design?

### ✅ Benefits:

1. **Smaller Docker Image**: No Node.js, Electron dependencies, or source code
2. **Faster Builds**: Docker doesn't need to build Electron apps
3. **Security**: Source code not in production containers
4. **Separation**: Development (local) vs Production (server)

### ❌ What NOT to Do:

- ❌ Don't copy `desktop-app/` source code to Docker
- ❌ Don't install Node.js in Docker for desktop app
- ❌ Don't run `npm install` or `npm build` in Docker

### ✅ What TO Do:

- ✅ Build installer on local Windows machine
- ✅ Copy only the `.exe` file to server
- ✅ Mount via Docker volume
- ✅ Serve via FastAPI endpoint

---

## File Structure

### Local Development Machine:
```
moretranz_api/
├── desktop-app/          ← Source code (NOT in Docker)
│   ├── main.js
│   ├── package.json
│   ├── services/
│   └── dist/             ← Build output
│       └── MoreTranz Printer Setup.exe
└── ...
```

### Server (Docker):
```
/app/
├── static/
│   └── desktop-app/      ← Only installer (mounted volume)
│       └── MoreTranz Printer Setup.exe
├── app/
│   └── api/
│       └── endpoints/
│           └── desktop.py  ← Serves installer
└── ...
```

---

## Production Workflow

1. **Build locally** (Windows machine):
   ```bash
   cd desktop-app
   npm run build:win
   ```

2. **Copy to server**:
   ```bash
   scp desktop-app/dist/MoreTranz\ Printer\ Setup.exe \
      server:/path/to/project/static/desktop-app/
   ```

3. **Docker serves it**:
   - Volume mount makes it available at `/app/static/desktop-app/`
   - Backend endpoint serves it to users

---

## Alternative: Use CDN

For even better separation, upload installer to CDN:

1. Build installer locally
2. Upload to S3/CloudFlare/static hosting
3. Update endpoint to redirect:
   ```python
   return RedirectResponse(url="https://cdn.example.com/installer.exe")
   ```

---

## Summary

**✅ Only Installer in Docker**:
- Copy `MoreTranz Printer Setup.exe` to `static/desktop-app/`
- Docker volume mounts this folder
- Backend serves it via endpoint

**❌ No Source Code in Docker**:
- Desktop app source stays local
- Node.js dependencies stay local
- Build happens locally

**Result**: Clean separation, smaller images, faster deployments! 🚀

