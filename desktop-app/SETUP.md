# Quick Setup Guide

## For End Users (Installing)

1. **Download** the `MoreTranz Printer Setup.exe` file
2. **Run** the installer and follow prompts
3. **Launch** the app - configuration window will open
4. **Configure**:
   - Server URL: Your MoreTranz server URL (e.g., `https://moretranz.com`)
   - Auth Token: 
     - Log into MoreTranz web app
     - Press F12 (open DevTools)
     - Go to Application → Local Storage → Copy "token" value
     - Paste into desktop app
   - Select your Label Printer (4x6 labels)
   - Select your Body Printer (letter size documents)
5. **Test** connection - click "Test Connection" button
6. **Save** configuration
7. **Minimize** window - app runs in background

The app will now automatically print attachments when emails are processed!

## For Developers (Building from Source)

### Prerequisites
- Node.js 16+ installed
- npm or yarn

### Steps

```bash
# 1. Navigate to desktop-app folder
cd desktop-app

# 2. Install dependencies
npm install

# 3. Test run (development mode)
npm start

# 4. Build Windows installer
npm run build:win

# Installer will be in dist/ folder
```

### Configuration File

The app uses `config.json` for configuration. Structure:

```json
{
  "serverUrl": "https://your-server.com",
  "authToken": "your-jwt-token-here",
  "labelPrinter": "Name of Label Printer",
  "bodyPrinter": "Name of Body Printer",
  "autoStart": true
}
```

## Troubleshooting

### "Connection failed" error
- Verify server URL is correct
- Check auth token is valid (not expired)
- Verify server is accessible from your network

### "No printers found"
- Make sure printers are installed in Windows
- Run `npm start` and check console for printer list
- Try selecting "Default Printer" if available

### Files not printing
- Check that printer names match exactly (they're case-sensitive)
- Verify PDF files are being downloaded (check temp folder)
- Look at console logs for errors

### WebSocket not connecting
- Verify WebSocket endpoint `/ws` is accessible
- Check firewall settings
- Try connecting via browser to test

## Uninstallation

Simply uninstall through Windows Settings → Apps, or delete the installation folder.

## Running as Windows Service (Advanced)

To run as a proper Windows service (runs on boot, no user login required), you can use:
- `node-windows` package
- `nssm` (Non-Sucking Service Manager)

Example with nssm:
```bash
nssm install MoreTranzPrinter "C:\Program Files\MoreTranz Printer\MoreTranz Printer.exe"
nssm start MoreTranzPrinter
```

