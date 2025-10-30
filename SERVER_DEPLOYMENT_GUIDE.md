# 🚀 Server Deployment Guide - Desktop App Functionality

## Overview
This guide shows you what to do on your production server after pushing the desktop app code to GitHub.

---

## 📋 Prerequisites

- ✅ Server with Docker and Docker Compose installed
- ✅ GitHub repository access
- ✅ SSH access to your server
- ✅ Domain/subdomain configured (optional, can use IP)
- ✅ SSL certificate (recommended for production)

---

## 🔄 Deployment Steps

### Step 1: Connect to Your Server

```bash
ssh user@your-server-ip
# or
ssh user@yourdomain.com
```

### Step 2: Navigate to Your Application Directory

```bash
cd /path/to/your/moretranz_api
# Example: cd /var/www/moretranz_api
```

### Step 3: Pull Latest Changes from GitHub

```bash
# Make sure you're on the backdev branch
git checkout backdev

# Pull the latest changes
git pull origin backdev
```

**Expected Output:**
```
Updating 060dfd6..4072a52
Fast-forward
 44 files changed, 9139 insertions(+), 20 deletions(-)
 create mode 100644 desktop-app/main.js
 create mode 100644 app/api/endpoints/desktop.py
 ...
```

### Step 4: Build the Desktop App Installer on Server

```bash
cd desktop-app

# Install dependencies (first time only)
npm install

# Build the Windows installer
npm run build:win

cd ..
```

**Note:** This creates the installer at `desktop-app/dist/MoreTranz Printer Setup 1.0.0.exe`

### Step 5: Rebuild Docker Containers

```bash
# Stop all containers
docker-compose down

# Rebuild and start containers
docker-compose up -d --build
```

**This will:**
- Rebuild backend with new desktop authentication endpoints
- Rebuild frontend with download button
- Update nginx with desktop-app volume mount
- Start all services

### Step 6: Verify Deployment

```bash
# Check all containers are running
docker-compose ps
```

**Expected Output:**
```
NAME                    STATUS          PORTS
moretranz_api-backend   Up 30 seconds   0.0.0.0:8000->8000/tcp
moretranz_api-frontend  Up 30 seconds   0.0.0.0:3000->80/tcp
moretranz_api-nginx     Up 30 seconds   0.0.0.0:80->80/tcp
moretranz_api-db        Up 30 seconds   5432/tcp
```

### Step 7: Check Backend Logs

```bash
docker-compose logs -f backend
```

**Look for:**
- ✅ `Desktop endpoints registered`
- ✅ `Application startup complete`
- ✅ No errors

Press `Ctrl+C` to exit logs.

### Step 8: Test Desktop Endpoints

```bash
# Test desktop authentication endpoint
curl -X POST http://localhost:8000/api/v1/desktop/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password","serverUrl":"http://localhost:8000"}'
```

**Expected Response:**
```json
{
  "serverUrl": "http://localhost:8000",
  "authToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "userId": 1,
  "userEmail": "your-email@example.com",
  "labelPrinter": "",
  "bodyPrinter": "",
  "autoStart": true
}
```

### Step 9: Access Frontend Dashboard

Open browser and navigate to:
```
http://your-server-ip
# or
http://yourdomain.com
```

**Verify:**
- ✅ Login page loads
- ✅ Dashboard shows "Download Desktop App" button
- ✅ Clicking downloads the installer

---

## 🔧 Configuration

### Environment Variables

Make sure your `.env` file on the server has these settings:

```bash
# Database
DATABASE_URL=postgresql://user:password@db:5432/moretranz

# JWT Settings
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days
REFRESH_TOKEN_EXPIRE_DAYS=90       # 90 days

# Server URL (important for desktop app)
SERVER_URL=http://yourdomain.com:8000  # or http://your-ip:8000

# Email Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Docker Compose Configuration

The `docker-compose.yml` already includes the desktop-app volume mount:

```yaml
nginx:
  volumes:
    - ./desktop-app:/usr/share/nginx/html/desktop-app:ro
```

This makes the installer available at: `http://yourdomain.com/desktop-app/dist/MoreTranz Printer Setup 1.0.0.exe`

---

## 📥 How Users Download the Desktop App

### Method 1: Dashboard Download (Recommended)

1. User logs in to dashboard: `http://yourdomain.com`
2. Clicks "Download Desktop App" button
3. Browser downloads: `MoreTranz Printer Setup 1.0.0.exe`
4. User runs installer

### Method 2: Direct Download Link

Share this link with users:
```
http://yourdomain.com/desktop-app/dist/MoreTranz%20Printer%20Setup%201.0.0.exe
```

---

## 🔐 Security Considerations

### 1. HTTPS (Strongly Recommended)

For production, use HTTPS to secure:
- User login credentials
- API authentication tokens
- Desktop app downloads

**Setup HTTPS with Let's Encrypt:**

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (already set up by certbot)
sudo systemctl status certbot.timer
```

### 2. Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp  # Backend API

# Enable firewall
sudo ufw enable
```

### 3. Update Server URL in Environment

After setting up HTTPS, update `.env`:

```bash
SERVER_URL=https://yourdomain.com
```

Then restart containers:

```bash
docker-compose restart
```

---

## 🧪 Testing After Deployment

### Test 1: Backend API

```bash
curl https://yourdomain.com/api/v1/desktop/config
```

Should return: `401 Unauthorized` (correct, needs authentication)

### Test 2: Frontend Access

```bash
curl https://yourdomain.com
```

Should return: HTML content of your frontend

### Test 3: Desktop App Download

```bash
curl -I https://yourdomain.com/desktop-app/dist/MoreTranz%20Printer%20Setup%201.0.0.exe
```

Should return: `200 OK` with `Content-Type: application/x-msdownload`

### Test 4: WebSocket Connection

```bash
# From your local machine, test WebSocket
wscat -c wss://yourdomain.com/ws
```

---

## 🐛 Troubleshooting

### Issue 1: Desktop Endpoints Not Found (404)

**Solution:**
```bash
# Check if desktop.py endpoint is included
docker-compose exec backend ls -la app/api/endpoints/desktop.py

# Rebuild backend
docker-compose up -d --build backend

# Check logs
docker-compose logs backend
```

### Issue 2: Desktop App Download Button Not Showing

**Solution:**
```bash
# Rebuild frontend
docker-compose up -d --build frontend

# Clear browser cache
# Hard refresh: Ctrl+Shift+R
```

### Issue 3: Installer Download 404

**Solution:**
```bash
# Check if installer exists
ls -lh desktop-app/dist/

# If missing, build it
cd desktop-app
npm run build:win
cd ..

# Restart nginx
docker-compose restart nginx
```

### Issue 4: Desktop App Can't Connect to Server

**Symptoms:** Users report "Connection failed" after login

**Solution:**
1. Check `SERVER_URL` in `.env`
2. Ensure port 8000 is accessible
3. Check firewall rules
4. Verify WebSocket connection works

```bash
# Test from server
curl http://localhost:8000/api/v1/auth/me

# Test WebSocket
docker-compose logs nginx | grep -i websocket
```

### Issue 5: Token Refresh Not Working

**Solution:**
```bash
# Verify refresh token expiry is set
docker-compose exec backend env | grep REFRESH_TOKEN

# Check database has refresh_token column
docker-compose exec db psql -U user -d moretranz -c "\d users"

# Should show: refresh_token | character varying
```

---

## 📊 Monitoring

### Check Service Health

```bash
# All containers
docker-compose ps

# Specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx

# Resource usage
docker stats
```

### Check Disk Space

```bash
# Desktop app installer is ~78MB
du -h desktop-app/dist/
```

### Monitor Downloads

```bash
# Nginx access logs
docker-compose logs nginx | grep "MoreTranz Printer Setup"

# Count downloads
docker-compose logs nginx | grep -c "GET /desktop-app/dist/MoreTranz"
```

---

## 🔄 Updating the Desktop App

When you make changes to the desktop app:

### On Development Machine:

```bash
cd desktop-app

# Make your changes to main.js, etc.

# Rebuild installer
npm run build:win

# Commit and push
git add .
git commit -m "Update desktop app"
git push origin backdev
```

### On Production Server:

```bash
# Pull changes
git pull origin backdev

# Rebuild installer (if needed)
cd desktop-app
npm run build:win
cd ..

# No need to restart Docker for installer updates
# The installer is served directly from the file system
```

**Users will get the new version next time they download!**

---

## 📱 User Instructions

Share these instructions with your users:

### Desktop App Installation:

1. **Download:**
   - Go to: `https://yourdomain.com`
   - Login with your credentials
   - Click "Download Desktop App"

2. **Install:**
   - Run `MoreTranz Printer Setup 1.0.0.exe`
   - Choose installation directory
   - Click "Install"

3. **First Launch:**
   - Login screen appears
   - Enter email, password, and server URL
   - Click "Login & Configure"

4. **Configure Printers:**
   - Select Label Printer (for 4x6 labels)
   - Select Body Printer (for documents)
   - Click "Save Configuration"

5. **Done!**
   - App runs in background
   - Automatically prints new orders
   - Use `Ctrl+Shift+P` to show window

### Uninstalling:

1. Go to: Settings → Apps
2. Find "MoreTranz Printer"
3. Click "Uninstall"
4. Done! (All files automatically cleaned up)

---

## 🎯 Production Checklist

Before going live, verify:

- ✅ All Docker containers are running
- ✅ HTTPS is configured (recommended)
- ✅ Firewall rules are set
- ✅ `.env` file has correct `SERVER_URL`
- ✅ Desktop app installer is built and accessible
- ✅ Dashboard download button works
- ✅ Backend authentication endpoints work
- ✅ WebSocket connection works
- ✅ Token refresh mechanism works
- ✅ Email processing works
- ✅ Printer service works (test with real order)
- ✅ User isolation works (test with multiple users)

---

## 🆘 Support

### Logs to Check:

```bash
# Backend API logs
docker-compose logs -f backend --tail=100

# Frontend logs
docker-compose logs -f frontend --tail=100

# Nginx logs
docker-compose logs -f nginx --tail=100

# Database logs
docker-compose logs -f db --tail=100
```

### Emergency Restart:

```bash
# Stop all services
docker-compose down

# Remove all containers, networks, volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up -d --build

# Check status
docker-compose ps
```

---

## 🎉 Deployment Complete!

Your desktop app functionality is now live on the server!

**What's Working:**
- ✅ Backend authentication for desktop app
- ✅ Frontend download button
- ✅ Desktop app installer (Windows)
- ✅ Automatic token generation (30-day expiry)
- ✅ Automatic token refresh (90-day expiry)
- ✅ WebSocket real-time updates
- ✅ Automatic PDF printing
- ✅ Background operation
- ✅ Clean uninstallation

**Next Steps:**
1. Test with real users
2. Monitor logs for any issues
3. Set up automated backups
4. Configure monitoring/alerting
5. Document any custom server configurations

---

## 📞 Quick Reference Commands

```bash
# Pull updates
git pull origin backdev

# Rebuild all
docker-compose up -d --build

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop all
docker-compose down

# Start all
docker-compose up -d
```

---

**Created:** October 30, 2025  
**Version:** 1.0.0  
**Branch:** backdev

