# MoreTranz Desktop Printer App

Desktop application for automatic printing of order attachments to local printers.

## Features

- ✅ **Automatic Printing**: Downloads and prints attachments automatically when emails are processed
- ✅ **WebSocket Integration**: Real-time connection to server for instant printing
- ✅ **Dual Printer Support**: Automatically routes labels vs documents to correct printers
- ✅ **Zero Configuration on Server**: All printer setup happens on end-user's PC
- ✅ **Background Operation**: Runs silently in system tray
- ✅ **Auto-Start**: Starts automatically when Windows boots

## Installation

### For End Users (Windows)

1. Download the installer from your server/distribution
2. Run `MoreTranz Printer Setup.exe`
3. Follow installation wizard
4. App will launch automatically after installation

### For Developers

```bash
cd desktop-app
npm install
npm start  # For development
npm run build:win  # To build Windows installer
```

## Configuration

1. First launch will open configuration window
2. Enter:
   - **Server URL**: `https://your-server.com` or `http://localhost:8000`
   - **Auth Token**: Get from browser DevTools → Local Storage → `token`
   - **Label Printer**: Select your 4x6 label printer
   - **Body Printer**: Select your letter-size document printer

3. Click "Test Connection" to verify
4. Click "Save Configuration"

## How It Works

1. **Server** processes email and broadcasts `attachment_ready` via WebSocket
2. **Desktop App** (running on user's PC) receives notification
3. **Downloads** attachment file from server
4. **Detects** if it's a label or document (based on filename/metadata)
5. **Prints automatically** to correct printer without user interaction
6. **Runs in background** - window only shows for configuration

## Troubleshooting

### App won't start
- Check `config.json` has valid `serverUrl` and `authToken`
- Verify server is accessible from your network

### Files not printing
- Verify printers are installed and accessible
- Check printer names match exactly (case-sensitive)
- Look at console logs (run app from terminal to see logs)

### WebSocket connection fails
- Verify server URL is correct (including http:// or https://)
- Check firewall isn't blocking WebSocket connections
- Verify auth token is still valid (tokens expire after 8 hours by default)

## Building Installer

```bash
npm run build:win
```

Creates installer in `dist/` folder.

## Technical Details

- **Framework**: Electron
- **Printing**: pdf-to-printer (Node.js)
- **WebSocket**: ws library
- **Platform**: Windows (can be extended to Mac/Linux)

## File Structure

```
desktop-app/
├── main.js              # Main Electron process
├── renderer.js          # UI logic
├── index.html           # Configuration UI
├── config.json          # User configuration
├── services/
│   ├── printer.js       # Printer service
│   ├── websocket.js    # WebSocket client
│   └── api.js          # API client for downloads
└── package.json        # Dependencies
```

