# User Isolation Guide

## Overview

This system now provides **complete user isolation** for email processing. Each user can independently start and stop their own email processing without affecting other users.

## Key Features

### ✅ Per-User Email Processing
- Each user has their own independent email processing scheduler
- Users can start and stop their processing at any time
- Multiple users can process emails simultaneously without conflicts

### ✅ User-Specific Data
- Orders are filtered by `user_id` - users only see their own orders
- Email folders are organized by user: `downloads/user_{user_id}/`
- Each user configures their own email credentials

### ✅ Independent Controls
- **Start Processing**: Only starts processing for the logged-in user
- **Stop Processing**: Only stops processing for the logged-in user
- **Status Check**: Shows status only for the logged-in user

## Architecture Changes

### Before (Global Scheduler)
```
┌─────────────────────────────────────┐
│  Global Email Scheduler (Singleton) │
│  - Processes ALL users at once      │
│  - Start/Stop affects everyone      │
└─────────────────────────────────────┘
         │
         ├──> User A's emails
         ├──> User B's emails
         └──> User C's emails
```

**Problems:**
- ❌ When User A starts processing, it processes ALL users
- ❌ When User B stops processing, it stops for ALL users
- ❌ No isolation or independence

### After (Per-User Schedulers)
```
┌────────────────────────────────────┐
│  Email Scheduler Manager           │
│  (Manages multiple user schedulers)│
└────────────────────────────────────┘
         │
         ├──> ┌──────────────────────┐
         │    │ User A's Scheduler   │ ──> User A's emails only
         │    └──────────────────────┘
         │
         ├──> ┌──────────────────────┐
         │    │ User B's Scheduler   │ ──> User B's emails only
         │    └──────────────────────┘
         │
         └──> ┌──────────────────────┐
              │ User C's Scheduler   │ ──> User C's emails only
              └──────────────────────┘
```

**Benefits:**
- ✅ Complete isolation between users
- ✅ Independent start/stop controls
- ✅ Concurrent processing for multiple users
- ✅ User-specific configurations respected

## API Endpoints

### Start Processing
```http
POST /api/v1/orders/start-processing
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "Email processing started successfully for your account",
  "user_id": 1,
  "message": "Your emails will be checked every 5 seconds. Other users are not affected."
}
```

### Stop Processing
```http
POST /api/v1/orders/stop-processing
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "Email processing stopped for your account",
  "user_id": 1,
  "message": "Your email processing has been stopped. Other users are not affected."
}
```

### Check Processing Status
```http
GET /api/v1/orders/processing-status
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "running",
  "is_processing": true,
  "scheduler_running": true,
  "user_id": 1,
  "jobs": [
    {
      "id": "email_monitor_user_1",
      "name": "Email Monitor - User 1",
      "next_run": "2025-10-29T12:34:56.789Z"
    }
  ]
}
```

### Get Active Users (Debug Endpoint)
```http
GET /api/v1/orders/active-users
Authorization: Bearer {token}
```

**Response:**
```json
{
  "active_users": [1, 3, 5],
  "total_active": 3,
  "your_user_id": 1,
  "you_are_active": true
}
```

## Code Changes Summary

### 1. New Scheduler System (`app/services/scheduler.py`)

**UserEmailScheduler**: Individual scheduler for each user
- Manages email processing for ONE user only
- Independent start/stop control
- User-specific job scheduling

**EmailSchedulerManager**: Central manager for all user schedulers
- `start_user_processing(user_id, sleep_time)`: Start processing for a user
- `stop_user_processing(user_id)`: Stop processing for a user
- `is_user_processing(user_id)`: Check if user is processing
- `get_user_status(user_id)`: Get status for a user
- `get_all_active_users()`: List all active users

### 2. Updated Endpoints (`app/api/endpoints/orders.py`)

- **Import changed**: `email_scheduler` → `email_scheduler_manager`
- **All endpoints now user-specific**: Pass `current_user.id` to manager
- **Better error messages**: Clarify that actions only affect the current user

### 3. Email Processor (`app/services/email_processor.py`)

- **Already had user isolation**: `monitor_user_emails(user)` method
- **Works perfectly with new scheduler**: Each scheduler calls this with specific user

## User Experience

### Scenario 1: User A Starts Processing
1. User A logs in and clicks "Start Processing"
2. System creates a scheduler specifically for User A (ID: 1)
3. User A's emails are checked every X seconds (their configured interval)
4. **User B and User C are NOT affected** - they can be stopped or have different intervals

### Scenario 2: User B Stops Processing
1. User B logs in and clicks "Stop Processing"
2. System stops ONLY User B's scheduler (ID: 2)
3. **User A and User C continue processing** - completely unaffected

### Scenario 3: Multiple Users Processing Simultaneously
1. User A starts processing (interval: 5 seconds)
2. User B starts processing (interval: 10 seconds)
3. User C starts processing (interval: 3 seconds)
4. All three users process emails independently:
   - User A: checks every 5 seconds
   - User B: checks every 10 seconds
   - User C: checks every 3 seconds

## Database Isolation

Orders are filtered by `user_id`:

```python
# In get_orders endpoint
query = db.query(OrderModel).filter(OrderModel.user_id == current_user.id)
```

This ensures:
- Users only see their own orders
- No data leakage between users
- Proper multi-tenancy

## File Storage Isolation

Files are organized by user:

```python
folder_path = os.path.join(
    settings.ATTACHMENTS_FOLDER, 
    f"user_{user.id}", 
    f"{po_number}_{customer_name}"
)
```

Directory structure:
```
downloads/
├── user_1/
│   ├── PO12345_CustomerA/
│   └── PO12346_CustomerB/
├── user_2/
│   ├── PO99999_CustomerC/
│   └── PO88888_CustomerD/
└── user_3/
    └── PO77777_CustomerE/
```

## Testing User Isolation

### Test 1: Independent Start
1. Create two test users (User A and User B)
2. Login as User A, start processing
3. Check `/api/v1/orders/active-users` - should show only User A
4. Login as User B, check status - should show "not running"
5. ✅ Confirms isolation

### Test 2: Independent Stop
1. Both User A and User B start processing
2. Check `/api/v1/orders/active-users` - should show [1, 2]
3. User A stops processing
4. Check `/api/v1/orders/active-users` - should show [2]
5. User B should still be processing
6. ✅ Confirms independent control

### Test 3: Order Isolation
1. User A processes an email (creates order)
2. Login as User B
3. GET `/api/v1/orders/` - should NOT see User A's orders
4. ✅ Confirms data isolation

## Migration from Old System

If you have the old system running:

1. **Stop the global scheduler** (if it's running)
2. **Deploy the new code** with per-user schedulers
3. **Each user must start their own processing** - they'll need to click "Start Processing" in their dashboard

No database migrations needed - the user isolation was already in place at the data level, we just fixed the scheduler level.

## Benefits Summary

| Feature | Before | After |
|---------|--------|-------|
| Start/Stop Control | Global (affects all) | Per-user (isolated) |
| Concurrent Processing | No (single scheduler) | Yes (multiple schedulers) |
| User Configuration | Shared interval | Individual intervals |
| Independence | ❌ Not isolated | ✅ Fully isolated |
| Scalability | Limited | High |
| Multi-tenancy | Partial | Complete |

## Technical Details

### Scheduler Lifecycle

```python
# User logs in and starts processing
await email_scheduler_manager.start_user_processing(user_id=1, sleep_time=5)
  ├─> Creates UserEmailScheduler(user_id=1, sleep_time=5)
  ├─> Starts AsyncIOScheduler
  ├─> Adds job: _monitor_emails_job() every 5 seconds
  └─> Stores in manager.user_schedulers[1]

# Job runs every interval
_monitor_emails_job()
  ├─> Gets User(id=1) from database
  ├─> Calls email_processor.monitor_user_emails(user)
  ├─> Processes ONLY emails for User 1
  └─> Saves orders with user_id=1

# User stops processing
await email_scheduler_manager.stop_user_processing(user_id=1)
  ├─> Gets scheduler from manager.user_schedulers[1]
  ├─> Calls scheduler.stop()
  ├─> Shuts down AsyncIOScheduler
  └─> Removes from manager.user_schedulers
```

### Memory Management

- Each `UserEmailScheduler` is lightweight (~1KB overhead)
- Schedulers are cleaned up when stopped
- No memory leaks from old schedulers
- Multiple users can run simultaneously without issues

## Troubleshooting

### Issue: "Email processing already running"
**Cause**: User tried to start processing when it's already running for them
**Solution**: Stop processing first, then start again

### Issue: Can't see other users' processing status
**Cause**: By design - each user only sees their own status
**Solution**: Use `/api/v1/orders/active-users` endpoint to see all active users (for debugging)

### Issue: Processing stops unexpectedly
**Cause**: User account became inactive or credentials became invalid
**Solution**: Check user status in database, verify email credentials

## Security Considerations

1. **JWT Token Required**: All endpoints require valid authentication
2. **User ID from Token**: User ID is extracted from JWT, not from request parameters
3. **Data Filtered by User**: All database queries filter by `current_user.id`
4. **No Cross-User Access**: Users cannot start/stop processing for other users
5. **Credential Isolation**: Each user's email credentials are separate

## Conclusion

The system now provides **complete user isolation** for email processing. Each user operates independently, with their own scheduler, configuration, and data. This ensures a true multi-tenant architecture where users don't interfere with each other.

