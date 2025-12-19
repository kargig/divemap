# Notification System Implementation Plan

**Task:** Notification System Implementation  
**Created:** 2025-12-15  
**Status:** Planning

## Overview

This plan implements a comprehensive notification system for Divemap with two delivery channels:

1. **Online Notifications**: In-app notifications for logged-in users (no push notifications)
   - Notifications are fetched when user logs in (since last check)
   - Polling while logged in to check for new notifications (every 30 seconds)
   - Notification bell component with unread count badge
   - No external push notification service required
2. **Email Notifications**: SMTP-based email delivery with STARTTLS authentication support (port 587)

Users can configure preferences for each notification category, choosing website notifications, email notifications, or both. The system supports area-specific notifications for geographic filtering.

**Notification Display Logic**:
- Track `last_notification_check` timestamp per user (stored in User model or separate table)
- On login: Fetch notifications created after user's `last_notification_check`
- While logged in: Poll `/api/v1/notifications/unread-count` every 30 seconds
- Update `last_notification_check` when user views notifications page or marks notifications as read

## Existing Context

- **TODO Item #13** in `docs/development/todo.md` mentions email notifications but is basic
- Architecture document mentions `trip_notifications` table concept (not implemented)
- No existing notification models or infrastructure
- User model exists with `email` field
- Settings system exists for runtime configuration
- No WebSocket infrastructure (will use polling - no push notifications)
- No push notification service needed (simpler, cheaper approach)
- **Celery**: Package exists in requirements.txt but no configuration or workers
- **Redis**: Package exists in requirements.txt but no service configured
- Architecture document mentions Celery with RabbitMQ, but Redis will be used instead (simpler, already available)

## Architecture Decision: Cost Considerations

The proposed Celery architecture adds ~$10-20/month in infrastructure costs. See **Cost-Effective Alternatives** section below for options to reduce costs using third-party services.

**Recommended Approach**: 
- **AWS Hybrid** (Option 6): AWS SQS + SES reduces cost to ~$0-7/month (no minimum cost, pay-as-you-go) ⭐ RECOMMENDED
- **Cloudflare** (Option 5): NOT RECOMMENDED - Cloudflare Email Service is not available (private beta only, no GA date)
- No push notification service needed - use polling and login-based fetching instead

## Database Schema

### 1. Notification Preferences Table

**File**: `backend/migrations/versions/00XX_add_notification_preferences.py`

```sql
CREATE TABLE notification_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    enable_website BOOLEAN DEFAULT TRUE,
    enable_email BOOLEAN DEFAULT FALSE,
    frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily_digest', 'weekly_digest'
    area_filter JSON, -- {country: "Australia", region: "Queensland", radius_km: 50, center_lat: -16.9, center_lng: 145.7}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_category (user_id, category),
    INDEX idx_user_id (user_id),
    INDEX idx_category (category)
);
```

**Categories**:
- `dive_site_updates` - New dive sites or updates to existing sites
- `new_dives` - New dives logged by other users
- `new_diving_centers` - New diving centers added
- `new_dive_trips` - New dive trips/newsletters parsed
- `admin_alerts` - Admin-only notifications (user registrations, claims)

### 2. Notifications Table

**File**: `backend/migrations/versions/00XX_add_notifications_table.py`

```sql
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(500), -- URL to related content
    entity_type VARCHAR(50), -- 'dive_site', 'dive', 'diving_center', 'dive_trip'
    entity_id INT, -- ID of related entity
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read, created_at),
    INDEX idx_category (category),
    INDEX idx_entity (entity_type, entity_id)
);
```

### 3. Email Configuration Table

**File**: `backend/migrations/versions/00XX_add_email_config_table.py`

### 4. User Model Update

**File**: `backend/migrations/versions/00XX_add_last_notification_check_to_users.py`

Add `last_notification_check` field to users table:

```sql
ALTER TABLE users 
ADD COLUMN last_notification_check TIMESTAMP NULL;
```

**Purpose**: Track when user last checked notifications to determine which notifications to show on login.

```sql
CREATE TABLE email_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL DEFAULT 587,
    use_starttls BOOLEAN DEFAULT TRUE,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password VARCHAR(500) NOT NULL, -- Encrypted
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) DEFAULT 'Divemap',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Backend Implementation

### 1. Database Models

**File**: `backend/app/models.py`

Add three new SQLAlchemy models:
- `NotificationPreference` - User notification preferences
- `Notification` - Individual notification records
- `EmailConfig` - SMTP configuration (admin-managed)

**Update User Model**:
- Add `last_notification_check` field (DateTime, nullable) to track when user last checked notifications
- Used to determine which notifications to show on login

### 2. Email Service

**File**: `backend/app/services/email_service.py` (new)

**Features**:
- SMTP connection with STARTTLS support (port 587)
- Email template rendering (Jinja2 templates)
- Retry logic for failed sends
- Queue integration for async sending
- Support for HTML and plain text emails

**Key Functions**:
```python
async def send_notification_email(user_email, notification, template_name)
async def test_email_connection(config)
def get_email_config(db: Session) -> EmailConfig
```

**Email Templates** (stored in `backend/app/templates/emails/`):
- `dive_site_update.html` / `.txt`
- `new_dive.html` / `.txt`
- `new_diving_center.html` / `.txt`
- `new_dive_trip.html` / `.txt`
- `daily_digest.html` / `.txt`
- `weekly_digest.html` / `.txt`

### 3. Notification Service

**File**: `backend/app/services/notification_service.py` (new)

**Core Functions**:
```python
async def create_notification(user_id, category, title, message, link_url, entity_type, entity_id)
async def notify_users_for_new_dive_site(dive_site_id, db)
async def notify_users_for_new_dive(dive_id, db)
async def notify_users_for_new_diving_center(center_id, db)
async def notify_users_for_new_dive_trip(trip_id, db)
async def send_pending_email_notifications(db)
async def create_digest_notifications(frequency: str, db)
```

**Area Filtering Logic**:
- Check user's `area_filter` JSON in preferences
- Calculate distance from notification entity to filter center
- Only notify if within `radius_km` (if specified)

### 4. API Endpoints

**File**: `backend/app/routers/notifications.py` (new)

**User Endpoints**:
- `GET /api/v1/notifications` - List user's notifications (paginated, filter by read/unread, since last_check)
- `GET /api/v1/notifications/unread-count` - Get unread count
- `GET /api/v1/notifications/new-since-last-check` - Get notifications created since user's last_notification_check
- `PUT /api/v1/notifications/{id}/read` - Mark notification as read
- `PUT /api/v1/notifications/read-all` - Mark all as read, update last_notification_check
- `PUT /api/v1/notifications/update-last-check` - Update user's last_notification_check timestamp
- `DELETE /api/v1/notifications/{id}` - Delete notification

**Preference Endpoints**:
- `GET /api/v1/notifications/preferences` - Get user's notification preferences
- `PUT /api/v1/notifications/preferences/{category}` - Update preference for category
- `POST /api/v1/notifications/preferences` - Create new preference
- `DELETE /api/v1/notifications/preferences/{category}` - Delete preference

**Admin Endpoints**:
- `GET /api/v1/admin/notifications/stats` - Notification statistics
- `POST /api/v1/admin/notifications/test-email` - Test email configuration
- `PUT /api/v1/admin/notifications/email-config` - Update email configuration

### 5. Integration Points

**File**: `backend/app/routers/dive_sites.py`
- After creating/updating dive site, call `notify_users_for_new_dive_site()`

**File**: `backend/app/routers/dives/dives_crud.py`
- After creating dive, call `notify_users_for_new_dive()`

**File**: `backend/app/routers/diving_centers.py`
- After creating diving center, call `notify_users_for_new_diving_center()`

**File**: `backend/app/routers/newsletters.py`
- After parsing newsletter and creating trips, call `notify_users_for_new_dive_trip()`

**File**: `backend/app/routers/users.py`
- After user registration, create admin notification if admin approval required

## Background Task Processing - Email Only

**Important**: These architecture options are ONLY needed for **email sending**. In-app notifications don't need any of these - they work with just database + API polling ($0/month).

See `architecture-breakdown.md` for detailed explanation of what's needed for each feature.

### Option A: Celery Architecture (Full Control, Higher Cost)

See detailed Celery setup in plan document. Adds ~$15-20/month in infrastructure costs.

**What It's For**: Email sending only (asynchronous task queue + scheduled digests)

### Option B: AWS Hybrid Architecture (Recommended, Lower Cost)

Uses third-party services to reduce costs to ~$0-7/month:

- **AWS SQS**: Task queue for email sending (free tier: 1M requests/month)
- **AWS SES**: Email delivery (free tier: 3K emails/month)
- **AWS EventBridge**: Scheduled tasks for digests (free tier covers usage)
- **In-App Notifications**: Not needed - uses database + polling ($0/month)

See **Cost-Effective Alternatives** section for details.

### Option C: Simplified Synchronous Email (Lowest Cost)

Send emails synchronously from API (with timeout). No external services needed.

**Cost**: $0/month (uses existing backend)
**Trade-off**: API requests may be slower (waiting for email send)

**What It's For**: Email sending only (synchronous, no queue)

## Direct SMTP vs Queued Email Delivery

### Is SMTP a Queue?

**Short Answer**: SMTP servers do have internal queues, but they're not a reliable application-level queue.

**Technical Explanation**:
- SMTP servers (like Postfix, Sendmail, AWS SES) maintain internal queues for:
  - Messages waiting to be sent
  - Retry attempts for failed deliveries
  - Rate limiting and throttling
- However, these queues are:
  - **Not application-visible**: Your application can't query queue status
  - **Not persistent across server restarts** (in many cases)
  - **Not reliable for application-level retries**: If your app crashes, queued emails may be lost
  - **Limited retry logic**: SMTP servers retry, but with limited control
  - **No dead letter queue**: Failed emails may be lost without application-level tracking

**Conclusion**: While SMTP has queue-like behavior, it's not a substitute for an application-level message queue for reliable email delivery.

### Direct SMTP Sending (Synchronous)

**Architecture**: Application → SMTP Server → Recipient

```
User Action → API Request → Backend sends email via SMTP → Wait for response → Return to user
```

#### Pros ✅

1. **Zero Infrastructure Cost**
   - No additional services needed (SQS, Lambda, Celery workers)
   - Uses existing backend server
   - **Cost**: $0/month

2. **Simpler Architecture**
   - No queue management
   - No worker processes
   - No message serialization/deserialization
   - Easier to debug (synchronous flow)

3. **Immediate Feedback**
   - Know immediately if email send failed
   - Can return error to user in same request
   - Easier error handling

4. **Lower Latency for Small Volumes**
   - For single emails, direct send is faster (no queue overhead)
   - No message serialization delay

5. **Simpler Deployment**
   - No additional containers/services to deploy
   - No queue monitoring needed
   - Fewer moving parts

#### Cons ❌

1. **Blocking API Requests**
   - API request waits for SMTP connection, handshake, and send
   - Typical SMTP send takes 1-5 seconds
   - User waits for email to send before getting response
   - **Poor UX**: Slow API responses

2. **No Retry Control**
   - If SMTP server is temporarily down, request fails immediately
   - Application can't retry later automatically
   - Must implement retry logic in application code
   - More complex error handling needed

3. **No Rate Limiting Protection**
   - If sending many emails, all hit SMTP server simultaneously
   - SMTP server may throttle or reject
   - No built-in backpressure mechanism
   - Risk of overwhelming SMTP server

4. **No Dead Letter Queue**
   - Failed emails are lost (unless application stores them)
   - No automatic retry mechanism
   - Hard to debug delivery failures

5. **No Scalability**
   - Can't handle bursts of email sends
   - All emails processed by same backend instance
   - Backend becomes bottleneck during high email volume

6. **No Idempotency Guarantees**
   - If API request fails after email sent, user may retry
   - Could result in duplicate emails
   - Need application-level idempotency tracking

7. **SMTP Connection Overhead**
   - Each email requires new SMTP connection (or connection pooling)
   - Connection setup adds latency
   - Connection failures affect user experience

8. **No Visibility**
   - Can't see queue depth
   - Can't monitor pending emails
   - Hard to debug delivery issues

### Queued Email Delivery (Asynchronous)

**Architecture**: Application → Message Queue → Worker/Lambda → SMTP Server → Recipient

```
User Action → API Request → Add message to queue → Return immediately to user
                                    ↓
                            Worker/Lambda processes queue
                                    ↓
                            Send email via SMTP
                                    ↓
                            Update status in database
```

#### Pros ✅

1. **Non-Blocking API Requests**
   - API responds immediately (< 100ms)
   - Email sent in background
   - **Better UX**: Fast user experience

2. **Automatic Retries**
   - Queue can retry failed messages
   - Configurable retry policies
   - Dead letter queue for permanent failures
   - **Reliability**: Emails eventually delivered

3. **Rate Limiting & Backpressure**
   - Queue controls rate of email sending
   - Prevents overwhelming SMTP server
   - Built-in throttling mechanisms
   - **Protection**: SMTP server stays healthy

4. **Scalability**
   - Multiple workers can process queue in parallel
   - Handle bursts of email sends
   - Scale workers independently from API
   - **Performance**: Handle high volume

5. **Visibility & Monitoring**
   - See queue depth (pending emails)
   - Monitor processing rate
   - Track failed messages
   - **Observability**: Know system health

6. **Idempotency**
   - Messages processed once
   - Duplicate detection built-in
   - **Reliability**: No duplicate emails

7. **Decoupling**
   - API doesn't depend on SMTP server availability
   - SMTP server issues don't affect API
   - **Resilience**: System continues working

8. **Scheduled Processing**
   - Can schedule emails for future delivery
   - Digest generation (daily/weekly)
   - **Features**: More capabilities

#### Cons ❌

1. **Additional Infrastructure Cost**
   - SQS: ~$0.40 per million requests (first 1M free)
   - Lambda: ~$0.20 per million requests (first 1M free)
   - **Cost**: $0-7/month for low-medium usage

2. **Increased Complexity**
   - More components to manage
   - Queue monitoring needed
   - Worker/Lambda deployment
   - **Complexity**: More moving parts

3. **Eventual Consistency**
   - Email sent asynchronously
   - User doesn't know if email sent immediately
   - Need status tracking in database
   - **Trade-off**: Delayed feedback

4. **Debugging Complexity**
   - Asynchronous flow harder to trace
   - Need distributed logging
   - Queue visibility tools needed
   - **Debugging**: More complex

5. **Potential Delays**
   - Queue processing adds latency
   - Messages may wait in queue
   - **Latency**: Slight delay in delivery

### Comparison Table

| Aspect | Direct SMTP | Queued (SQS + Lambda) |
|--------|-------------|------------------------|
| **Cost** | $0/month | $0-7/month |
| **API Response Time** | 1-5 seconds | < 100ms |
| **Retry Logic** | Manual | Automatic |
| **Scalability** | Limited | High |
| **Reliability** | Medium | High |
| **Complexity** | Low | Medium |
| **Visibility** | Low | High |
| **Rate Limiting** | Manual | Built-in |
| **Dead Letter Queue** | No | Yes |
| **Best For** | Low volume, simple use cases | Production, high volume |

### When to Use Direct SMTP

**Use Direct SMTP When**:
- ✅ Very low email volume (< 100 emails/day)
- ✅ Email sending is not critical (nice-to-have feature)
- ✅ API response time is acceptable (1-5 seconds)
- ✅ Budget is extremely constrained ($0/month requirement)
- ✅ Simple use case (single email, no digests)
- ✅ Development/testing environment

**Example Use Cases**:
- Password reset emails (low volume, user expects slight delay)
- Welcome emails (sent once per user)
- Admin alerts (very low volume)

### When to Use Queued Delivery

**Use Queued Delivery When**:
- ✅ Production environment
- ✅ Email volume > 100 emails/day
- ✅ Fast API response time required
- ✅ High reliability needed
- ✅ Scheduled digests needed
- ✅ Burst handling required
- ✅ Monitoring and observability important

**Example Use Cases**:
- Notification emails (can be high volume)
- Daily/weekly digests (scheduled processing)
- Marketing emails (burst handling)
- Transactional emails (high reliability)

### Recommendation for Divemap

**Recommended**: **Queued Delivery (AWS SQS + Lambda)**

**Reasons**:
1. **Production System**: Divemap is a production application
2. **User Experience**: Fast API responses are important
3. **Scalability**: Need to handle growth
4. **Reliability**: Email delivery should be reliable
5. **Low Cost**: AWS free tiers cover most usage ($0-7/month)
6. **Features**: Need scheduled digests (daily/weekly)

**Alternative**: Start with Direct SMTP for MVP, migrate to queued delivery when:
- Email volume increases
- Users complain about slow API responses
- Need scheduled digests
- Need better reliability

### Hybrid Approach

**Option**: Use both approaches selectively

- **Direct SMTP**: For low-volume, non-critical emails (password resets, admin alerts)
- **Queued Delivery**: For high-volume, critical emails (notifications, digests)

**Implementation**: Route emails based on priority/volume
```python
if email_priority == "high" or email_volume > threshold:
    send_via_queue(email)
else:
    send_direct_smtp(email)
```

## Frontend Implementation

### 1. Notification Components

**File**: `frontend/src/components/NotificationBell.js` (new)
- Bell icon in navbar with unread count badge
- Dropdown showing recent notifications
- Click to mark as read
- Link to full notifications page

**File**: `frontend/src/components/NotificationItem.js` (new)
- Individual notification display
- Read/unread styling
- Click handler to navigate to related content
- Delete button

**File**: `frontend/src/components/NotificationPreferences.js` (new)
- Preference management UI
- Toggle switches for website/email per category
- Frequency selector (immediate/daily/weekly)
- Area filter configuration (map picker for center point, radius slider)

**File**: `frontend/src/pages/Notifications.js` (new)
- Full notifications page
- Filter by category, read/unread
- Mark all as read button
- Pagination
- Empty state

### 2. API Integration

**File**: `frontend/src/api.js`

Add notification API functions:
```javascript
export const getNotifications = (params) => api.get('/api/v1/notifications', { params })
export const getUnreadCount = () => api.get('/api/v1/notifications/unread-count')
export const getNewSinceLastCheck = () => api.get('/api/v1/notifications/new-since-last-check')
export const markNotificationRead = (id) => api.put(`/api/v1/notifications/${id}/read`)
export const markAllRead = () => api.put('/api/v1/notifications/read-all')
export const updateLastCheck = () => api.put('/api/v1/notifications/update-last-check')
export const deleteNotification = (id) => api.delete(`/api/v1/notifications/${id}`)
export const getNotificationPreferences = () => api.get('/api/v1/notifications/preferences')
export const updateNotificationPreference = (category, data) => api.put(`/api/v1/notifications/preferences/${category}`, data)
```

### 3. Real-Time Updates

**File**: `frontend/src/hooks/useNotifications.js` (new)

**Features**:
- Poll `/api/v1/notifications/unread-count` every 30 seconds when user is logged in
- Update notification bell badge in real-time
- Use React Query for caching and automatic refetching
- On login: Fetch notifications since last check using `/api/v1/notifications/new-since-last-check`
- Update `last_notification_check` when user views notifications page

**File**: `frontend/src/contexts/NotificationContext.js` (new)
- Global notification state management
- Unread count tracking
- Notification polling logic (every 30 seconds while logged in)
- Integration with AuthContext (only poll when logged in)
- On login: Fetch and display new notifications since last check
- Update last_notification_check timestamp when user views notifications

### 4. Navigation Integration

**File**: `frontend/src/components/Navbar.js`
- Add NotificationBell component
- Position in navbar (right side, near user menu)

**File**: `frontend/src/App.js`
- Add route: `/notifications` -> Notifications page
- Add route: `/profile/notifications` -> Notification preferences (in Profile)

### 5. Profile Integration

**File**: `frontend/src/pages/Profile.js`
- Add "Notification Preferences" section
- Link to notification preferences management
- Show current preference summary

## Cost-Effective Alternatives

See separate document: `cost-effective-alternatives.md` for detailed comparison of:

1. **Managed Redis** (Upstash via Fly.io) - Eliminates Redis container
2. **Serverless Task Queue** (AWS SQS) - Eliminates Celery workers
3. **Email Service** (AWS SES) - Simplifies email delivery
4. **Push Notifications** (Firebase FCM) - Free real-time notifications
5. **Hybrid Approach** - Recommended: ~$2-9/month vs $15-20/month

## Files to Create/Modify

### Backend
- `backend/migrations/versions/00XX_add_notification_preferences.py`
- `backend/migrations/versions/00XX_add_notifications_table.py`
- `backend/migrations/versions/00XX_add_email_config_table.py`
- `backend/app/models.py` (add 3 models)
- `backend/app/services/email_service.py` (new)
- `backend/app/services/notification_service.py` (new)
- `backend/app/routers/notifications.py` (new)
- `backend/app/templates/emails/*.html` (new, multiple files)
- `backend/app/templates/emails/*.txt` (new, multiple files)
- `backend/app/routers/dive_sites.py` (add notification trigger)
- `backend/app/routers/dives/dives_crud.py` (add notification trigger)
- `backend/app/routers/diving_centers.py` (add notification trigger)
- `backend/app/routers/newsletters.py` (add notification trigger)
- `backend/app/routers/users.py` (add admin notification trigger)
- `backend/requirements.txt` (add: aiosmtplib, jinja2, cryptography)

### Frontend
- `frontend/src/components/NotificationBell.js` (new)
- `frontend/src/components/NotificationItem.js` (new)
- `frontend/src/components/NotificationPreferences.js` (new)
- `frontend/src/pages/Notifications.js` (new)
- `frontend/src/pages/admin/EmailConfig.js` (new)
- `frontend/src/hooks/useNotifications.js` (new)
- `frontend/src/contexts/NotificationContext.js` (new)
- `frontend/src/api.js` (add notification API functions)
- `frontend/src/components/Navbar.js` (add NotificationBell)
- `frontend/src/pages/Profile.js` (add notification preferences section)
- `frontend/src/App.js` (add routes)

### Documentation
- `docs/development/notification-system-implementation.md` (new)
- Update `docs/development/todo.md` (mark item #13 as in progress)
- Update `docs/development/api.md` (add notification API docs)
- Update `spec/project-description.md` (add notification system feature)

## Migration Strategy

1. **Phase 1**: Database migrations and models
2. **Phase 2**: Backend services and API endpoints
3. **Phase 3**: Basic frontend components (notification bell, list)
4. **Phase 4**: Preference management UI
5. **Phase 5**: Email integration and testing
6. **Phase 6**: Background tasks and digests (choose architecture)
7. **Phase 7**: Area filtering and advanced features
8. **Phase 8**: Fly.io deployment (if using Celery) or AWS setup (if using hybrid)

## Next Steps

1. **Decision Required**: Choose architecture (Celery vs Hybrid)
2. **Review Cost Analysis**: See cost-effective alternatives document
3. **Begin Implementation**: Start with Phase 1 (database migrations)
