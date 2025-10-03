# Docker Troubleshooting Guide

## Current Issues and Solutions

### ✅ Issue 1: WebSocket Support Missing
**Error:**
```
WARNING: No supported WebSocket library detected
```

**Solution:** 
Updated `requirements.txt` to include:
- `uvicorn[standard]` - Full uvicorn with WebSocket support
- `websockets>=10.0` - WebSocket protocol library

**Fix Applied:** Requirements updated, rebuild needed

---

### ⚠️ Issue 2: Email Authentication Failed
**Error:**
```
❌ Error: b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)'
Checking inbox of: gabbas.temp@gmail.com
```

**Root Cause:**
- Email credentials not configured in Docker environment
- Using placeholder/test credentials

**Solution:**
1. Create a `.env` file in the project root:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your actual Gmail credentials:
   ```env
   EMAIL_ADDRESS=your-real-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   EMAIL_PROCESSING_ENABLED=true
   ALLOWED_SENDERS=sender@example.com
   ```

3. **Important:** Use Gmail App Password, not regular password:
   - Go to: https://myaccount.google.com/apppasswords
   - Generate a new App Password
   - Use that 16-character password in `.env`

4. Restart Docker:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

**Note:** If you don't need email processing, set:
```env
EMAIL_PROCESSING_ENABLED=false
```

---

### ✅ Issue 3: Database Connection
**Status:** ✅ Working correctly

The database is using the PostgreSQL container:
```
DATABASE_URL=postgresql://moretranz_user:moretranz_password@db:5432/moretranz_db
```

**Confirmation:**
- Your local database is NOT being used
- Fresh PostgreSQL database created in Docker
- Completely isolated from your development environment

---

## How to Rebuild After Fixes

```bash
# Stop containers
docker-compose down

# Rebuild and start
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

---

## Verification Steps

After rebuild, verify:

1. **Backend API:** http://localhost:8000/docs
2. **Frontend:** http://localhost:3000
3. **WebSocket:** Should connect automatically (no 404 errors)
4. **Database:** PostgreSQL running in container
5. **Email:** Check logs for authentication success (if enabled)

---

## Quick Status Check

View logs:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

Check running containers:
```bash
docker-compose ps
```

