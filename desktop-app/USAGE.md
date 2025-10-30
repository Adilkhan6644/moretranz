# Desktop App Usage Guide

## Running in Background

Once configured, the app runs **silently in the background** - you don't need to keep it open!

- ✅ WebSocket connects automatically
- ✅ Attachments print automatically
- ✅ No window needed - runs hidden
- ✅ Starts automatically with Windows (if enabled)

## Accessing Configuration Window

If you need to change settings or view the app:

### Method 1: Keyboard Shortcut (Recommended)
Press **`Ctrl+Shift+P`** (or **`Cmd+Shift+P`** on Mac) to show the configuration window.

### Method 2: Task Manager
1. Open Task Manager (`Ctrl+Shift+Esc`)
2. Find "MoreTranz Printer" or "electron.exe"
3. Right-click → "Bring to front" (if available)

### Method 3: Restart App
- Close and reopen the app to show configuration window

## Checking if App is Running

1. **Check Console Logs**: If you started with `npm start`, check the terminal for:
   - `✅ WebSocket connected successfully`
   - `✅ Configuration complete - running in background`

2. **Check Task Manager**: Look for "electron.exe" or "MoreTranz Printer" process

3. **Test Printing**: Send a test email - if it prints automatically, the app is working!

## When Window Appears

The window will **automatically appear** if:
- ❌ Server URL is missing
- ❌ Auth token is missing  
- ❌ No printers are configured

Once all are set, it runs in background.

## Silent Operation

The app is designed to:
- ✅ Run without user interaction
- ✅ Connect to server automatically
- ✅ Print attachments automatically
- ✅ Reconnect if connection is lost
- ✅ Show console logs for debugging

## Stopping the App

1. **If running from terminal**: Press `Ctrl+C`
2. **If installed**: 
   - Right-click system tray icon (if available)
   - Or close via Task Manager
   - Or use `Ctrl+Shift+P` → Close from window

## Troubleshooting

If app doesn't start in background:
- Check console for errors
- Verify configuration in `config.json`
- Try restarting the app

If you can't access configuration:
- Use `Ctrl+Shift+P` keyboard shortcut
- Or restart the app

