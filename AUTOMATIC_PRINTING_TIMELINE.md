# 2-Day Timeline: Automatic Printing with Desktop App

## Overview
This timeline outlines the implementation plan to achieve fully automated printing functionality using the desktop app, including end-to-end testing and production readiness.

---

## 📋 Prerequisites

- ✅ Desktop app installer built and working
- ✅ Backend API serving download endpoints
- ✅ WebSocket communication established
- ✅ Printer service configured
- ✅ Email processing sending `attachment_ready` events

---

## 📅 DAY 1: Core Functionality Implementation

### Morning (4 hours)

#### **Phase 1: WebSocket Integration & Event Handling**
**Time: 2 hours**

- [ ] **1.1** Verify WebSocket connection in desktop app
  - [ ] Test connection establishment on app startup
  - [ ] Verify authentication token is sent correctly
  - [ ] Add connection status indicators
  - [ ] Implement reconnection logic

- [ ] **1.2** Implement `attachment_ready` event listener
  - [ ] Parse WebSocket message structure
  - [ ] Extract attachment metadata (id, file_name, pdf_path, is_label)
  - [ ] Queue attachments for processing
  - [ ] Add error handling for malformed messages

**Deliverable:** Desktop app connects to WebSocket and receives `attachment_ready` events

---

#### **Phase 2: File Download Implementation**
**Time: 2 hours**

- [ ] **2.1** Implement attachment download service
  - [ ] Create download function with authentication
  - [ ] Handle file download from `/api/v1/orders/attachments/{id}/download?format=pdf`
  - [ ] Save file to temporary directory
  - [ ] Add progress indicators for large files
  - [ ] Implement retry logic for failed downloads

- [ ] **2.2** File management
  - [ ] Create temp directory structure (`%TEMP%/MoreTranzPrintQueue/`)
  - [ ] Track downloaded files
  - [ ] Clean up old files after printing
  - [ ] Handle concurrent downloads

**Deliverable:** Desktop app can download attachments from server

---

### Afternoon (4 hours)

#### **Phase 3: Printer Selection & Auto-Detection**
**Time: 1.5 hours**

- [ ] **3.1** Implement printer detection on startup
  - [ ] Auto-detect available printers
  - [ ] Identify label printers (by name patterns or user config)
  - [ ] Store default printers in config
  - [ ] Add printer refresh functionality

- [ ] **3.2** Printer configuration UI
  - [ ] Show printer selection dropdowns
  - [ ] Save printer preferences to `config.json`
  - [ ] Validate printer availability before saving
  - [ ] Allow printer changes without restart

**Deliverable:** Users can configure label and body printers

---

#### **Phase 4: Automatic Printing Logic**
**Time: 2.5 hours**

- [ ] **4.1** Implement print queue handler
  - [ ] Process queued attachments sequentially
  - [ ] Determine printer based on `is_label` flag
  - [ ] Route to label printer for labels, body printer for others
  - [ ] Handle printer offline errors gracefully

- [ ] **4.2** Print execution
  - [ ] Use `pdf-to-printer` to send to printer
  - [ ] Add print job monitoring
  - [ ] Track print success/failure
  - [ ] Log print activity

- [ ] **4.3** Error handling & recovery
  - [ ] Handle printer not available
  - [ ] Retry failed prints (max 3 attempts)
  - [ ] Notify user of errors (system tray notification)
  - [ ] Queue management (pause/resume)

**Deliverable:** Automatic printing works for both labels and body prints

---

## 📅 DAY 2: Testing, Refinement & Production Readiness

### Morning (4 hours)

#### **Phase 5: End-to-End Testing**
**Time: 2 hours**

- [ ] **5.1** Test full workflow
  - [ ] Start email processing on server
  - [ ] Receive email with attachments
  - [ ] Verify WebSocket event received
  - [ ] Confirm download completes
  - [ ] Verify automatic print execution
  - [ ] Check printer output quality

- [ ] **5.2** Edge case testing
  - [ ] Multiple attachments in rapid succession
  - [ ] Large file downloads (>10MB)
  - [ ] Printer offline scenario
  - [ ] Network disconnection/reconnection
  - [ ] Simultaneous label and body prints
  - [ ] Invalid file formats

**Deliverable:** Complete test scenarios documented and passing

---

#### **Phase 6: User Experience Improvements**
**Time: 2 hours**

- [ ] **6.1** System tray integration
  - [ ] Minimize to tray on startup
  - [ ] Tray icon with status indicator (green=ready, yellow=printing, red=error)
  - [ ] Right-click context menu:
    - Show window
    - View print queue
    - Pause/Resume printing
    - Settings
    - Exit
  - [ ] Balloon notifications for print events

- [ ] **6.2** Status monitoring UI
  - [ ] Real-time print queue display
  - [ ] Show current print job (filename, printer, status)
  - [ ] Print history log
  - [ ] Connection status indicator
  - [ ] Statistics (total printed, failed, etc.)

**Deliverable:** Polished UI with system tray support

---

### Afternoon (4 hours)

#### **Phase 7: Auto-Start & Configuration**
**Time: 1 hour**

- [ ] **7.1** Auto-start implementation
  - [ ] Register app for Windows startup
  - [ ] Start minimized to tray
  - [ ] Load saved configuration on startup
  - [ ] Auto-connect to WebSocket
  - [ ] Handle startup errors gracefully

- [ ] **7.2** Configuration management
  - [ ] Validate config on startup
  - [ ] Auto-fix common config issues
  - [ ] Import config from downloaded file
  - [ ] Export current config

**Deliverable:** App starts automatically with saved settings

---

#### **Phase 8: Error Handling & Logging**
**Time: 1.5 hours**

- [ ] **8.1** Comprehensive error handling
  - [ ] Network errors (timeout, unreachable server)
  - [ ] Authentication errors (token expired)
  - [ ] Printer errors (offline, paper jam, etc.)
  - [ ] File system errors (disk full, permissions)
  - [ ] User-friendly error messages

- [ ] **8.2** Logging system
  - [ ] Create log file (`%APPDATA%/MoreTranz Printer/logs/app.log`)
  - [ ] Log levels: ERROR, WARN, INFO, DEBUG
  - [ ] Rotate logs (keep last 7 days)
  - [ ] Log critical events:
    - WebSocket connections
    - Downloads
    - Print jobs
    - Errors and exceptions

**Deliverable:** Robust error handling with detailed logging

---

#### **Phase 9: Production Build & Documentation**
**Time: 1.5 hours**

- [ ] **9.1** Final build
  - [ ] Update version number
  - [ ] Build production installer
  - [ ] Test installer on clean Windows machine
  - [ ] Verify all dependencies included
  - [ ] Create release notes

- [ ] **9.2** Documentation
  - [ ] User setup guide (config file download)
  - [ ] Troubleshooting guide
  - [ ] Printer configuration guide
  - [ ] Known issues and workarounds
  - [ ] Update main README

**Deliverable:** Production-ready installer with documentation

---

## 🎯 Success Criteria

### Day 1 End Goals:
- ✅ Desktop app receives `attachment_ready` WebSocket events
- ✅ Attachments download automatically
- ✅ Files print to configured printers automatically
- ✅ Basic error handling in place

### Day 2 End Goals:
- ✅ All test scenarios pass
- ✅ System tray integration working
- ✅ Auto-start functional
- ✅ Production installer ready
- ✅ Documentation complete

---

## 📊 Testing Checklist

### Functional Tests:
- [ ] Single attachment prints automatically
- [ ] Multiple attachments print in sequence
- [ ] Labels route to label printer
- [ ] Body prints route to body printer
- [ ] App handles printer offline gracefully
- [ ] App reconnects after network issues
- [ ] Config file loads correctly on startup

### Non-Functional Tests:
- [ ] App starts in <5 seconds
- [ ] Download completes in <30 seconds for 10MB file
- [ ] Print job completes in <60 seconds
- [ ] Memory usage stable (<200MB)
- [ ] CPU usage minimal when idle (<1%)
- [ ] Logs don't exceed 50MB

---

## 🔧 Technical Implementation Details

### WebSocket Event Structure:
```json
{
  "type": "attachment_ready",
  "data": {
    "id": 123,
    "order_id": 45,
    "file_name": "label.pdf",
    "file_type": "pdf",
    "sheet_type": "label",
    "pdf_path": "/data/attachments/123/123.pdf",
    "is_label": true
  }
}
```

### Print Queue Handler Flow:
1. Receive `attachment_ready` event
2. Download file to temp directory
3. Determine target printer (label vs body)
4. Queue print job
5. Execute print using `pdf-to-printer`
6. Monitor completion
7. Clean up temp file
8. Log result

### Configuration File (`config.json`):
```json
{
  "serverUrl": "http://your-server:8000",
  "authToken": "jwt_token_here",
  "labelPrinter": "Dymo Label Printer",
  "bodyPrinter": "HP LaserJet",
  "autoStart": true,
  "startMinimized": true,
  "logLevel": "INFO"
}
```

---

## 🚨 Risk Mitigation

### Potential Issues & Solutions:

| Issue | Risk Level | Mitigation |
|-------|-----------|------------|
| Printer not available | High | Queue job, retry later, notify user |
| Network timeout | Medium | Exponential backoff retry, save for later |
| Token expiration | Medium | Auto-refresh or prompt user |
| Large file downloads | Low | Chunked download, progress bar |
| Multiple simultaneous prints | Medium | Queue management, one-at-a-time printing |
| WebSocket disconnection | High | Auto-reconnect with exponential backoff |

---

## 📝 Daily Standup Questions

**End of Day 1:**
- What worked well?
- What blockers were encountered?
- Is the core printing flow functional?
- What needs refinement for Day 2?

**End of Day 2:**
- Are all test scenarios passing?
- Is the production build ready?
- Are there any critical bugs?
- Is documentation complete?

---

## 🎉 Final Deliverables

1. **Working Desktop App**
   - Automatic printing functional
   - System tray integration
   - Auto-start enabled

2. **Production Installer**
   - All dependencies bundled
   - Tested on clean Windows install
   - Version numbered and signed (optional)

3. **Documentation**
   - User setup guide
   - Configuration guide
   - Troubleshooting guide

4. **Test Results**
   - Test report with all scenarios
   - Known issues documented
   - Performance metrics

---

## 📞 Support & Escalation

**If blockers arise:**
- Check logging for error details
- Review WebSocket connection status
- Verify printer availability
- Test API endpoints manually
- Check server logs for backend issues

**Critical Path:**
- WebSocket connection → File download → Print execution
- Any failure in this chain needs immediate resolution

---

**Timeline created:** October 29, 2025  
**Estimated completion:** 2 business days  
**Status:** Ready to begin implementation

