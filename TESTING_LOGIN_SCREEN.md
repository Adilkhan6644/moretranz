# Testing the Desktop App with Login Screen

## ✅ Implementation Complete!

The desktop app now has a **professional login screen** that eliminates the need for manual config file downloads.

---

## 🧪 How to Test

### Step 1: Clean Installation Test

1. **Uninstall any existing MoreTranz Printer** (if installed)
   - Run: `D:\desktop\cleanup_moretranz.bat` as Administrator
   - Or manually uninstall from Control Panel

2. **Download the new installer**
   - Option A: From dashboard at `http://localhost/` → Click "Download Desktop App"
   - Option B: Directly from `desktop-app/dist/MoreTranz Printer Setup 1.0.0.exe`

3. **Install the application**
   - Double-click the installer
   - Follow installation steps
   - Choose installation directory (default: C:\Program Files\MoreTranz Printer)

4. **First Launch - Login Screen Should Appear!**
   ```
   ┌────────────────────────────────┐
   │  🖨️ MoreTranz Printer          │
   │  Desktop Application Setup     │
   ├────────────────────────────────┤
   │  Email: [                   ]  │
   │  Password: [                ]  │
   │  Server: [http://localhost:8000]│
   │  [ Login & Configure ]         │
   └────────────────────────────────┘
   ```

5. **Enter credentials**
   - Email: Your dashboard login email
   - Password: Your dashboard password
   - Server URL: Should auto-populate (http://localhost:8000 for dev)

6. **Click "Login & Configure"**
   - Should show "Configuring..." message
   - Should authenticate with your backend
   - Should automatically save config
   - Should close login window and open main config window

7. **Main Configuration Window Opens**
   - Shows server URL (pre-filled) ✅
   - Shows auth token (pre-filled, hidden) ✅
   - Shows printer dropdowns (your PC's printers) ✅
   - Select label printer
   - Select body printer
   - Click "Save Configuration"

8. **App Minimizes to Background**
   - Window should disappear
   - App continues running in background
   - Check Task Manager: "MoreTranz Printer" should be running

---

## 🔍 What to Check

### ✅ Login Screen Tests:

**Test 1: Valid Credentials**
- Enter correct email & password
- Should authenticate successfully
- Should show main config window
- Config file should be created at: `C:\Program Files\MoreTranz Printer\resources\app\config.json`

**Test 2: Invalid Credentials**
- Enter wrong password
- Should show error message: "Invalid email or password"
- Should NOT close login window
- User can try again

**Test 3: Network Error**
- Enter correct credentials but stop Docker backend
- Should show error message about connection failure
- User can fix and retry

**Test 4: Server URL**
- Default should be `http://localhost:8000` for dev
- For production, change to your actual server URL
- Should save the URL for future launches

### ✅ Subsequent Launches Tests:

**Test 5: Second Launch (Config Exists)**
- Close the app
- Launch again
- Should NOT show login screen
- Should start directly in background
- Should connect to WebSocket automatically
- Check console: "✅ Authentication exists - loading main window"

**Test 6: Show Window After Hidden**
- Press `Ctrl+Shift+P` (global shortcut)
- Main config window should appear
- Can modify printer selections
- Can save and hide again

**Test 7: Token Refresh (Simulate Expiration)**
- Edit `config.json` and set an expired token
- App should detect 401 error
- Should use refresh token to get new access token
- Should update config.json automatically
- Should continue working without user interaction

---

## 📊 Expected Console Output

### First Launch (Login):
```
🔐 Authentication required - showing login screen
🔐 Authenticating user: user@company.com with server: http://localhost:8000
✅ Authentication successful, config saved
✅ Auto-loaded configuration from download
✅ Configuration complete - running in background
🚀 Initializing services...
   Server: http://localhost:8000
   Label Printer: HP LaserJet
   Body Printer: Canon Printer
📡 WebSocket URL constructed: ws://localhost:8000/ws
   Connecting WebSocket...
🔌 Connecting to WebSocket: ws://localhost:8000/ws
✅ WebSocket connected
✅ WebSocket connected successfully
Found 4 printers: [...]
```

### Subsequent Launches:
```
✅ Authentication exists - loading main window
✅ Configuration complete - running in background
🚀 Initializing services...
📡 WebSocket connected
Ready to print!
```

---

## 🐛 Troubleshooting

### Problem: Login screen doesn't appear
**Solution:**
- Check if config.json already exists
- Delete config.json to force login screen
- Location: `C:\Program Files\MoreTranz Printer\resources\app\config.json`

### Problem: "Connection failed" error
**Solution:**
- Verify Docker backend is running: `docker ps`
- Check server URL is correct
- For development: Use `http://localhost:8000`
- For production: Use your actual domain

### Problem: "Invalid email or password"
**Solution:**
- Verify credentials work on web dashboard
- Check backend logs: `docker logs moretranz-backend`
- Verify `/desktop/authenticate` endpoint exists

### Problem: Login succeeds but main window doesn't open
**Solution:**
- Check console for errors
- Verify config.json was created
- Press `Ctrl+Shift+P` to show window manually

---

## 📁 Important Files

### Backend:
- `app/api/endpoints/desktop.py` - Authentication endpoint
- `/api/v1/desktop/authenticate` - Login API

### Desktop App:
- `desktop-app/login.html` - Login UI
- `desktop-app/main.js` - Login logic (IPC handler)
- `desktop-app/config.json` - Created after successful login

### Generated Config (Example):
```json
{
  "serverUrl": "http://localhost:8000",
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "labelPrinter": "",
  "bodyPrinter": "",
  "autoStart": true,
  "userId": 1,
  "userEmail": "user@company.com"
}
```

---

## 🚀 Production Deployment

### Update Server URL for Production:

Edit `desktop-app/login.html` line 131:
```html
<!-- Change from: -->
value="http://localhost:8000"

<!-- To your production URL: -->
value="https://yourserver.com"
```

Then rebuild:
```bash
cd desktop-app
npm run build:win
```

---

## 🎯 Testing Checklist

- [ ] Fresh install shows login screen
- [ ] Valid credentials work
- [ ] Invalid credentials show error
- [ ] Config file is created after login
- [ ] Main window opens after login
- [ ] Printers are detected
- [ ] Can save printer selections
- [ ] App runs in background after save
- [ ] WebSocket connects successfully
- [ ] Second launch skips login screen
- [ ] Ctrl+Shift+P shows window
- [ ] Token refresh works automatically
- [ ] Can download from dashboard

---

## ✅ Success Criteria

**The implementation is successful if:**

1. ✅ User can install app without any config files
2. ✅ Login screen appears on first launch
3. ✅ User can login with dashboard credentials
4. ✅ Config is automatically created
5. ✅ No manual file management needed
6. ✅ Subsequent launches skip login
7. ✅ Tokens refresh automatically
8. ✅ Professional user experience

---

## 🎉 Next Steps After Testing

1. **If testing succeeds:**
   - Deploy to production
   - Update dashboard to remove "Download Config" button (optional)
   - Add user documentation about login
   - Consider adding "Logout" button to reset app

2. **Optional improvements:**
   - Add "Forgot Password" link
   - Add "Remember Server URL" checkbox
   - Add QR code setup option
   - Add auto-update functionality

3. **Documentation:**
   - Create user guide with screenshots
   - Update deployment documentation
   - Train support staff on new flow

---

## 📞 Support

If you encounter issues during testing:

1. Check Docker logs: `docker logs moretranz-backend`
2. Check desktop app console (when run from terminal)
3. Check `config.json` was created correctly
4. Verify `/api/v1/desktop/authenticate` endpoint responds
5. Test credentials on web dashboard first

---

**Ready to test! Download the new installer from your dashboard and follow the testing steps above.** 🚀

