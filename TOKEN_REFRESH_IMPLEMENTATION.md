# Desktop App Token Refresh Implementation

## Overview
The desktop app now has **automatic token refresh** functionality, eliminating the need for users to manually re-download configuration files when tokens expire.

## How It Works

### Token Lifetimes
- **Access Token**: 30 days (43,200 minutes)
- **Refresh Token**: 90 days

### Automatic Refresh Process
1. When the desktop app makes an API call and receives a `401 Unauthorized` error
2. The app automatically uses the refresh token to get a new access token
3. The new tokens are saved to `config.json`
4. The original API request is retried with the new access token
5. Everything continues working seamlessly - **no user interaction needed!**

## What Changed

### Backend Changes (`app/api/endpoints/desktop.py`)
- ✅ `/api/v1/desktop/config` now returns `refreshToken` 
- ✅ `/api/v1/desktop/download-config` includes `refreshToken` in config.json
- ✅ Refresh tokens expire after 90 days (vs 30 days for access token)

### Desktop App Changes

#### `desktop-app/services/api.js`
- ✅ Added `refreshToken` parameter to constructor
- ✅ New `refreshAccessToken()` method - calls `/api/v1/auth/refresh`
- ✅ New `updateConfigFile()` method - updates config.json with new tokens
- ✅ New `makeRequest()` wrapper - catches 401 errors and auto-refreshes
- ✅ All API calls now use `makeRequest()` for automatic retry on token expiration

#### `desktop-app/main.js`
- ✅ ApiClient initialized with refresh token from config
- ✅ Fixed cache permission errors by using AppData folder

## User Experience

### Before (Manual Refresh)
❌ Token expires after 30 days → App stops working → User must:
1. Open dashboard
2. Download new config.json
3. Replace the old config file
4. Restart the app

### After (Automatic Refresh)
✅ Token expires after 30 days → App automatically:
1. Detects the 401 error
2. Uses refresh token to get new tokens
3. Updates config.json automatically
4. Retries the request
5. **Continues working seamlessly!**

## Token Expiration Timeline

```
Day 0:   User downloads and installs desktop app
         - Access token valid for 30 days
         - Refresh token valid for 90 days

Day 30:  Access token expires
         - App automatically refreshes using refresh token
         - Gets new 30-day access token
         - Gets new 90-day refresh token
         - Updates config.json
         - User notices NOTHING

Day 60:  Access token expires again
         - Auto-refresh happens again
         - User still notices NOTHING

Day 90:  Refresh token expires
         - User must re-download config (only once every 90 days)
         - Simple download from dashboard
```

## Configuration Example

### Old config.json (without refresh token)
```json
{
  "serverUrl": "http://localhost:8000",
  "authToken": "eyJhbGc...",
  "labelPrinter": "HP LaserJet",
  "bodyPrinter": "HP LaserJet",
  "autoStart": true
}
```

### New config.json (with refresh token)
```json
{
  "serverUrl": "http://localhost:8000",
  "authToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "labelPrinter": "HP LaserJet",
  "bodyPrinter": "HP LaserJet",
  "autoStart": true
}
```

## Logs

When token refresh happens, you'll see console output like:
```
🔄 Refreshing access token...
✅ Token refreshed successfully
✅ Config file updated with new tokens
```

## Testing

To test token refresh:
1. Manually expire the token in config.json (set past date)
2. Trigger an API call (e.g., print an attachment)
3. Watch console - should see automatic refresh
4. Check config.json - should have new tokens

## Security Notes

- ✅ Refresh tokens are stored locally in config.json
- ✅ Refresh tokens expire after 90 days (configurable)
- ✅ Each refresh generates a NEW refresh token (token rotation)
- ✅ Old refresh tokens are invalidated after use
- ✅ If refresh token is compromised, user can re-download config to invalidate

## Fallback

If refresh token fails (expired or invalid):
- App will show authentication error
- User simply re-downloads config from dashboard
- Takes 30 seconds vs daily manual intervention

## Summary

**Problem Solved:** Users no longer need to manually update tokens every 30 days!

**Automatic:** App handles token refresh completely in the background
**Seamless:** Zero user interaction required for 90 days
**Reliable:** Built-in retry logic and error handling
**Secure:** Token rotation and proper expiration handling

