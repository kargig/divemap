# Notification System Architecture Breakdown

## What Components Are Needed For What?

### In-App Notifications (No Push) ✅ Simple & Free

**Components Needed**:
- ✅ **Database** (MySQL) - Store notification records
- ✅ **Backend API** - Endpoints to fetch notifications
- ✅ **Frontend** - Polling logic (every 30 seconds)
- ❌ **NO external services** (no Celery, no SQS, no Queues, no Redis)

**How It Works**:
```
1. Notification Created → Stored in database (notifications table)
2. User Logs In → API fetches notifications since last_notification_check
3. While Logged In → Frontend polls /api/v1/notifications/unread-count every 30s
4. User Views Notifications → Update last_notification_check timestamp
```

**Cost**: **$0/month** - Uses existing infrastructure

**Files Needed**:
- `backend/app/models.py` - Notification model
- `backend/app/routers/notifications.py` - API endpoints
- `frontend/src/components/NotificationBell.js` - UI component
- `frontend/src/hooks/useNotifications.js` - Polling hook

### Email Notifications ⚠️ Requires External Services

**Components Needed**:
- ✅ **Email Sending Service** (SMTP server OR AWS SES OR other)
- ✅ **Task Queue** (to send emails asynchronously - optional but recommended)
- ✅ **Scheduled Tasks** (for daily/weekly digests - optional)

**Why External Services?**
- Email sending is slow (can take seconds per email)
- Without queue: API requests wait for email to send (poor UX)
- With queue: Email sent in background, API responds immediately

**Architecture Options**:

#### Option 1: Full Celery ($15-20/month)
- Redis container (message broker)
- Celery Worker container (processes email tasks)
- Celery Beat container (scheduled digests)
- SMTP server (or email service)

#### Option 2: AWS Hybrid ($0-7/month) ⭐ RECOMMENDED
- AWS SQS (task queue - free tier: 1M requests/month) - **Replaces Redis**
- AWS Lambda (processes tasks - free tier: 1M requests/month)
- AWS SES (email delivery - free tier: 3K emails/month)
- AWS EventBridge (scheduled tasks - free tier)
- **No Redis needed** - SQS is the message broker
- No containers needed

#### Option 3: Synchronous ($0/month)
- Send emails directly from API (with timeout)
- No queue, no workers
- Trade-off: Slower API responses (1-5 seconds per request)
- **Note**: SMTP servers have internal queues, but they're not a reliable application-level queue. See implementation-plan.md for detailed pros/cons of direct SMTP vs queued delivery.

## Complete System Architecture

```
┌─────────────────────────────────────────┐
│      In-App Notifications               │
│      (Always $0/month)                  │
├─────────────────────────────────────────┤
│  Database (MySQL)                       │
│    └─ notifications table               │
│  Backend API                             │
│    └─ GET /notifications                 │
│    └─ GET /notifications/unread-count    │
│  Frontend                                │
│    └─ Polling every 30 seconds          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Email Notifications                │
│      ($0-20/month depending on option)  │
├─────────────────────────────────────────┤
│  Choose ONE architecture:                │
│                                          │
│  Option A: Celery ($15-20/mo)           │
│    ├─ Redis (message broker)            │
│    ├─ Celery Worker (processes tasks)   │
│    ├─ Celery Beat (scheduled tasks)     │
│    └─ SMTP server                        │
│                                          │
│  Option B: AWS Hybrid ($0-7/mo) ⭐       │
│    ├─ AWS SQS (task queue - replaces Redis) │
│    ├─ AWS Lambda (processes tasks)      │
│    │  └─ Requires database access for:  │
│    │     • Idempotency checks           │
│    │     • Status updates               │
│    ├─ AWS EventBridge (scheduled tasks) │
│    └─ AWS SES (email delivery)          │
│    └─ NO Redis needed                  │
│    └─ Database access from Lambda       │
│                                          │
│  Option C: Synchronous ($0/mo)           │
│    └─ Send directly from API            │
└─────────────────────────────────────────┘
```

## Decision Tree

**Question 1: Do you need email notifications?**
- **No** → Use only in-app notifications ($0/month total)
- **Yes** → Continue to Question 2

**Question 2: What's your email volume?**
- **Low** (< 3,000/month) → Use AWS SES free tier + synchronous sending ($0/month)
- **Medium** (3K-10K/month) → Use AWS Hybrid ($0-5/month)
- **High** (> 10K/month) → Use AWS Hybrid or Celery ($5-20/month)

**Question 3: Do you need scheduled digests?**
- **No** → Synchronous email sending is fine ($0/month)
- **Yes** → Need scheduled tasks (AWS EventBridge or Celery Beat)

## Recommended Architecture

**For Divemap**:
- **In-App Notifications**: Database + API + Polling ($0/month)
- **Email Notifications**: AWS Hybrid ($0-7/month)
  - AWS SQS for task queue
  - AWS SES for email delivery
  - AWS EventBridge for scheduled digests
- **Total Cost**: $0-7/month

**Why This Combination**:
- In-app notifications are simple and free
- Email notifications need external services (email sending is slow)
- AWS services have free tiers and no minimum costs
- Can start with $0/month and scale as needed
