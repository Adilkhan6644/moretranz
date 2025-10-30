# Troubleshooting Guide

## WebSocket Connection Issues

### Error: "Invalid URL: /ws"

**Problem**: The server URL is missing or incorrectly configured.

**Solution**:
1. Open the configuration window
2. Check that **Server URL** is set correctly:
   - For local development: `http://localhost:8000` (backend port)
   - For production: `https://your-server.com`
3. Make sure the URL includes the protocol (`http://` or `https://`)
4. Save configuration and restart the app

### Error: "WebSocket connection error"

**Possible causes**:
1. **Wrong port**: Make sure you're using port **8000** (backend), not 3000 (frontend)
2. **Server not running**: Ensure your backend server is running
3. **Firewall blocking**: Check if firewall is blocking WebSocket connections
4. **Invalid auth token**: The token might be expired - get a new one from the web app

### How to Get a New Auth Token

1. Open MoreTranz web application in browser
2. Log in
3. Open Developer Tools (F12)
4. Go to **Application** (or **Storage**) tab
5. Select **Local Storage** → Your domain
6. Find the `token` key
7. Copy the entire token value
8. Paste into desktop app configuration

## Printers Not Showing

1. Make sure printers are installed in Windows Settings
2. Run app with `npm start` and check console for errors
3. Try restarting the app after adding printers

## Automatic Printing Not Working

### Checklist:

1. ✅ **Configuration Complete**
   - Server URL is correct (check port 8000 for backend)
   - Auth token is valid (not expired)
   - Both printers are selected

2. ✅ **WebSocket Connected**
   - Check console logs for "✅ WebSocket connected successfully"
   - If you see reconnection attempts, there's a connection issue

3. ✅ **Server Processing Emails**
   - Make sure email processing is started in web app
   - Check that emails are being received and processed

4. ✅ **Test the Flow**
   - Send a test email
   - Watch console logs for "📄 Attachment ready for printing"
   - Check for download and print messages

### Debug Steps:

1. **Check Console Logs**
   ```bash
   npm start
   ```
   Watch for:
   - `🚀 Initializing services...`
   - `✅ WebSocket connected successfully`
   - `📄 Attachment ready for printing`
   - `🖨️ Printing to: ...`

2. **Test WebSocket Manually**
   - Use a WebSocket client tool
   - Connect to `ws://localhost:8000/ws`
   - Include header: `Authorization: Bearer YOUR_TOKEN`
   - Should receive messages when attachments are ready

3. **Check Server Logs**
   - Look for "📡 Broadcasted attachment ready for printing"
   - Verify attachments are being created

## Common Configuration Mistakes

### Wrong Server URL
- ❌ `http://localhost:3000` (frontend port)
- ✅ `http://localhost:8000` (backend port)

### Missing Protocol
- ❌ `localhost:8000`
- ✅ `http://localhost:8000`

### Wrong Auth Token
- Make sure you copy the **entire** token
- Token should start with `eyJ...`
- Tokens expire after 8 hours - get a new one if needed

## Still Having Issues?

1. Check all console logs (both Electron and server)
2. Verify WebSocket endpoint is accessible
3. Test with a manual email to see if server processes it
4. Make sure printer names match exactly (case-sensitive)

