# 🌐 Production Server URL Configuration

## Your Server Information

**Server IP:** `74.208.173.203`

---

## 📋 What URLs Users Will Use

### 1. **Dashboard (Web Interface)**
```
http://74.208.173.203/
```
Users access this to:
- Login to the web dashboard
- Download desktop app
- View orders

### 2. **Desktop App Server URL**
When users install the desktop app and see the login screen, they should enter:
```
http://74.208.173.203
```
**NOT** `http://74.208.173.203/api/v1` ❌

### 3. **API Endpoints**
Desktop app automatically adds `/api/v1` to make requests like:
```
http://74.208.173.203/api/v1/desktop/authenticate
http://74.208.173.203/api/v1/orders
http://74.208.173.203/api/v1/config
```

### 4. **Swagger Documentation**
After fixing nginx, accessible at:
```
http://74.208.173.203/docs
```

### 5. **Desktop App Download**
Direct download link:
```
http://74.208.173.203/desktop-app/dist/MoreTranz%20Printer%20Setup%201.0.0.exe
```

---

## 🔧 Setup Steps on Server

### Step 1: Update nginx.conf
✅ Already done! The nginx.conf now includes:
- `/docs` route for Swagger UI
- `/openapi.json` route for API schema
- `/desktop-app/` route for installer download

### Step 2: Create/Update .env File on Server

SSH to your server and create `.env`:

```bash
ssh user@74.208.173.203
cd /path/to/moretranz_api
nano .env
```

Add this content:

```env
# Server URL (WITHOUT /api/v1)
SERVER_URL=http://74.208.173.203

# Database
DATABASE_URL=postgresql://moretranz_user:your_password@db:5432/moretranz

# JWT Settings
SECRET_KEY=your-super-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days
REFRESH_TOKEN_EXPIRE_DAYS=90       # 90 days
ALGORITHM=HS256

# Email (if using)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_PROCESSING_ENABLED=true

# Storage
ATTACHMENTS_FOLDER=/root/attachments
LOGS_FOLDER=/data/logs
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### Step 3: Commit and Push nginx.conf Changes

On your local machine:

```bash
git add nginx/nginx.conf env.production.example PRODUCTION_SERVER_SETUP.md
git commit -m "fix: Add nginx routes for /docs and desktop-app download"
git push origin backdev
```

### Step 4: Deploy on Server

```bash
# On server
cd /path/to/moretranz_api

# Pull latest changes (includes nginx.conf fix)
git pull origin backdev

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Wait 10 seconds
sleep 10

# Verify containers
docker-compose ps
```

### Step 5: Verify Everything Works

```bash
# Test API
curl http://74.208.173.203/api/v1/auth/me

# Test Swagger docs
curl -I http://74.208.173.203/docs

# Test desktop endpoint
curl http://74.208.173.203/api/v1/desktop/config
```

---

## ✅ Verification Checklist

After deployment, test these URLs in your browser:

- [ ] `http://74.208.173.203/` - Dashboard loads
- [ ] `http://74.208.173.203/docs` - Swagger UI appears ✨
- [ ] `http://74.208.173.203/api/v1/auth/me` - Returns 401 (correct, needs auth)
- [ ] `http://74.208.173.203/desktop-app/dist/` - Shows installer file
- [ ] Desktop app download button works
- [ ] Desktop app can connect to server

---

## 🖥️ Desktop App Configuration

### What Users See in Login Screen:

```
┌─────────────────────────────────────┐
│   MoreTranz Printer - Login         │
├─────────────────────────────────────┤
│                                      │
│  Email:                              │
│  [user@example.com              ]   │
│                                      │
│  Password:                           │
│  [••••••••••                    ]   │
│                                      │
│  Server URL:                         │
│  [http://74.208.173.203         ]   │  ← THIS!
│                                      │
│  [ Login & Configure ]               │
│                                      │
└─────────────────────────────────────┘
```

**Important:** Users enter `http://74.208.173.203` (NOT `/api/v1`)

The desktop app code automatically constructs the full API URLs:

```javascript
// In desktop-app/services/api.js
this.baseURL = `${serverUrl}/api/v1`;  // Automatically adds /api/v1

// So when user enters: http://74.208.173.203
// Desktop app uses: http://74.208.173.203/api/v1/desktop/authenticate
```

---

## 🔐 HTTPS Setup (Recommended)

For production, you should use HTTPS. Here's how:

### Option 1: Use a Domain Name (Recommended)

1. **Get a domain:** `moretranz.com` or `printer.yourdomain.com`

2. **Point domain to your server:**
   - A Record: `@` → `74.208.173.203`
   - A Record: `www` → `74.208.173.203`

3. **Install SSL certificate (Let's Encrypt - FREE):**

```bash
# On server
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
```

4. **Update .env:**
```env
SERVER_URL=https://yourdomain.com
```

5. **Users will use:**
```
https://yourdomain.com
```

### Option 2: Self-Signed Certificate (For Testing Only)

Not recommended for production as users will get security warnings.

---

## 🧪 Testing Desktop App Connection

### Test 1: Manual API Call

```bash
curl -X POST http://74.208.173.203/api/v1/desktop/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password",
    "serverUrl": "http://74.208.173.203"
  }'
```

**Expected Response:**
```json
{
  "serverUrl": "http://74.208.173.203",
  "authToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "userId": 1,
  "userEmail": "your-email@example.com",
  "labelPrinter": "",
  "bodyPrinter": "",
  "autoStart": true
}
```

### Test 2: Desktop App Login

1. Download installer from: `http://74.208.173.203/`
2. Install and run
3. Login screen appears
4. Enter:
   - Email: `your-email@example.com`
   - Password: `your-password`
   - Server URL: `http://74.208.173.203`
5. Click "Login & Configure"
6. Should connect successfully ✅

---

## 🐛 Troubleshooting

### Issue 1: /docs Shows 404

**Cause:** nginx.conf not updated or not reloaded

**Fix:**
```bash
# On server
docker-compose restart nginx
docker-compose logs nginx
```

### Issue 2: Desktop App Can't Connect

**Symptoms:** "Connection failed" or "Network error"

**Check:**
```bash
# 1. Is backend running?
docker-compose ps backend

# 2. Can server access backend?
docker-compose exec nginx curl http://backend:8000/api/v1/desktop/config

# 3. Is port 80 open?
sudo ufw status
sudo ufw allow 80/tcp

# 4. Check backend logs
docker-compose logs -f backend
```

### Issue 3: Swagger Shows But API Calls Fail

**Cause:** CORS or SERVER_URL misconfiguration

**Fix:**
```bash
# Check .env has correct SERVER_URL
cat .env | grep SERVER_URL

# Should be: SERVER_URL=http://74.208.173.203
# NOT: SERVER_URL=http://74.208.173.203/api/v1

# If wrong, fix it and restart
docker-compose restart backend
```

### Issue 4: Desktop App Download 404

**Check:**
```bash
# Is installer built?
ls -lh desktop-app/dist/*.exe

# If missing, build it
cd desktop-app
npm install
npm run build:win
cd ..

# Restart nginx
docker-compose restart nginx
```

---

## 📝 User Instructions to Share

Send this to your users:

---

### How to Install MoreTranz Printer App

**Step 1: Download**
- Go to: `http://74.208.173.203`
- Login with your email and password
- Click "Download Desktop App"

**Step 2: Install**
- Run the downloaded installer
- Follow installation wizard
- Click "Install"

**Step 3: Login**
- Login screen appears automatically
- Enter your credentials:
  - **Server URL:** `http://74.208.173.203`
  - **Email:** Your registered email
  - **Password:** Your password
- Click "Login & Configure"

**Step 4: Configure Printers**
- Select your label printer (for 4x6 labels)
- Select your document printer
- Click "Save Configuration"

**Step 5: Done!**
- App runs in background
- Automatically prints new orders
- Use `Ctrl+Shift+P` to show window anytime

---

## 🎯 Production Deployment Summary

```bash
# 1. Commit nginx changes
git add nginx/nginx.conf
git commit -m "fix: Add /docs and desktop-app routes"
git push origin backdev

# 2. On server: Pull and deploy
ssh user@74.208.173.203
cd /path/to/moretranz_api
git pull origin backdev
docker-compose down
docker-compose up -d --build

# 3. Verify
curl http://74.208.173.203/docs
curl http://74.208.173.203/api/v1/desktop/config

# 4. Test desktop app
# Download from dashboard and login
```

---

## ✅ Final Checklist

- [ ] nginx.conf updated with /docs route
- [ ] nginx.conf updated with /desktop-app route
- [ ] .env has `SERVER_URL=http://74.208.173.203`
- [ ] Changes committed and pushed to GitHub
- [ ] Server pulled latest code
- [ ] Docker containers rebuilt
- [ ] Swagger accessible at `/docs`
- [ ] Desktop app downloadable
- [ ] Desktop app can login successfully
- [ ] Consider setting up HTTPS with domain

---

**Production Server:** `http://74.208.173.203`  
**Dashboard:** `http://74.208.173.203/`  
**API Docs:** `http://74.208.173.203/docs`  
**Desktop URL:** `http://74.208.173.203` (users enter this)

