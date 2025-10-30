# Production Deployment Checklist

## 🎯 Goal: Make Desktop App Production-Ready

### ✅ What's Been Implemented

1. **Backend API Endpoints** (`app/api/endpoints/desktop.py`):
   - ✅ `/api/v1/desktop/download` - Download installer
   - ✅ `/api/v1/desktop/config` - Get auto-config JSON
   - ✅ `/api/v1/desktop/download-config` - Download pre-configured config.json
   - ✅ Auto-generates 30-day JWT tokens
   - ✅ Auto-detects server URL from request

2. **Frontend Integration** (`frontend/src/pages/Dashboard.tsx`):
   - ✅ Download Desktop App button
   - ✅ Download Config Only button
   - ✅ User-friendly UI with instructions

3. **Desktop App Improvements**:
   - ✅ Auto-loads config.json from Downloads folder
   - ✅ Pre-filled server URL and token (if config downloaded)
   - ✅ Only asks user to select printers
   - ✅ Better error handling and validation

4. **Build Scripts**:
   - ✅ `build-installer.bat` (Windows)
   - ✅ `build-installer.sh` (Linux/Mac)

---

## 📋 Deployment Steps

### Step 1: Build the Installer

```bash
cd desktop-app
npm install
npm run build:win
```

This creates: `desktop-app/dist/MoreTranz Printer Setup.exe`

### Step 2: Deploy Installer to Server

#### Option A: Copy to Static Directory

```bash
# Create static directory
mkdir -p static/desktop-app

# Copy installer
cp desktop-app/dist/MoreTranz\ Printer\ Setup.exe static/desktop-app/

# Update desktop.py to point to this location
```

#### Option B: Use Docker Volume

In `docker-compose.yml`:
```yaml
backend:
  volumes:
    - ./desktop-app/dist:/app/static/desktop-app:ro
```

Update `app/api/endpoints/desktop.py`:
```python
installer_path = os.path.join("static", "desktop-app", "MoreTranz Printer Setup.exe")
```

### Step 3: Set Server URL Environment Variable

```env
# In .env or docker-compose.yml
SERVER_URL=https://your-production-domain.com
```

### Step 4: Test Download Flow

1. Login to web app
2. Go to Dashboard
3. Click "Download Desktop App"
4. Verify download works
5. Install and test auto-configuration

---

## 🚀 User Experience (Simplified)

### Before (Manual):
1. Download app manually
2. Get JWT token from DevTools
3. Copy token manually
4. Enter server URL manually
5. Select printers

### After (Automated):
1. **Click "Download Desktop App"** in Dashboard
2. **Download config.json** (optional, if not auto-detected)
3. **Install app**
4. **Select printers** → Done!

The app will:
- ✅ Auto-detect server URL
- ✅ Auto-load token from downloaded config.json
- ✅ Only ask for printer selection

---

## 🔧 Configuration Auto-Loading

The desktop app automatically:

1. **On First Launch**:
   - Checks Downloads folder for `config.json`
   - Loads server URL and auth token
   - Shows configuration window only if incomplete

2. **If Config Downloaded**:
   - Place `config.json` in Downloads folder
   - App auto-detects and loads it
   - No manual token entry needed!

3. **Fallback**:
   - If no config found, shows configuration window
   - User can enter manually (rarely needed)

---

## 📝 Next Steps for Production

1. **Build installer**:
   ```bash
   cd desktop-app
   npm run build:win
   ```

2. **Copy to server**:
   ```bash
   cp dist/MoreTranz\ Printer\ Setup.exe /path/to/server/static/
   ```

3. **Update desktop.py endpoint**:
   - Point `installer_path` to actual location

4. **Set SERVER_URL**:
   - Add to `.env`: `SERVER_URL=https://your-domain.com`

5. **Test**:
   - Login → Dashboard → Download → Install → Test

---

## 🎨 Production Improvements Made

✅ **No manual JWT token entry** - Auto-downloaded config
✅ **No server URL entry** - Auto-detected from web app
✅ **One-click download** - From Dashboard
✅ **Auto-configuration** - Loads from Downloads folder
✅ **Simplified UI** - Only asks for printer selection
✅ **Better error messages** - Clear user guidance
✅ **30-day tokens** - Longer expiry for desktop apps

---

## 📦 Deployment File Structure

```
server/
├── static/
│   └── desktop-app/
│       └── MoreTranz Printer Setup.exe  ← Installer here
├── app/
│   └── api/
│       └── endpoints/
│           └── desktop.py  ← Serves installer
└── docker-compose.yml
```

---

## ✅ Testing Checklist

- [ ] Build installer successfully
- [ ] Installer copied to server
- [ ] Download endpoint accessible
- [ ] Config download works
- [ ] Auto-configuration works
- [ ] Desktop app connects to server
- [ ] Printing works automatically
- [ ] Token auto-expires after 30 days (refresh mechanism)

---

## 🎉 Result

**End users now need to:**
1. Click "Download Desktop App" (one click!)
2. Install the app
3. Select printers

**That's it!** No manual token copying, no server URL entry - everything is automated! 🚀

