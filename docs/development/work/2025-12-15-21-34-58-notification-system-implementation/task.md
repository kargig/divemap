# Notification System Implementation

**Status:** In Progress
**Created:** 2025-12-15-21-34-58
**Started:** 2025-12-15T22:00:00Z
**Agent PID:** 601554
**Branch:** feature/notification-system-aws-implementation

## Original Todo

From `docs/development/todo.md` item #13:

Implement email notifications system for admin users and general users. Initially for admin notifications about new user registrations and diving center claims requiring review. Later expanded to user notifications about new dive sites and diving centers in areas of interest.

## Description

Implement a comprehensive notification system for Divemap with two delivery channels:

1. **Online Notifications**: In-app notifications for logged-in users (no push notifications)
   - Notifications shown when user logs in (since last check)
   - Polling while logged in to check for new notifications
   - Notification bell with unread count badge
2. **Email Notifications**: SMTP-based email delivery with STARTTLS authentication support (port 587)

Users can configure preferences for each notification category, choosing website notifications, email notifications, or both. The system supports area-specific notifications for geographic filtering.

**Notification Display Logic**:
- Track `last_notification_check` timestamp per user
- On login: Fetch notifications created after `last_notification_check`
- While logged in: Poll API every 30 seconds for new notifications
- Update `last_notification_check` when user views notifications page or marks as read

**Notification Categories**:
- `dive_site_updates` - New dive sites or updates to existing sites
- `new_dives` - New dives logged by other users
- `new_diving_centers` - New diving centers added
- `new_dive_trips` - New dive trips/newsletters parsed
- `admin_alerts` - Admin-only notifications (user registrations, claims)

**Key Features**:
- User-configurable notification preferences per category
- Website notifications (in-app) and/or email notifications
- Frequency controls: immediate, daily digest, weekly digest
- Area-specific filtering (country/region/radius)
- Email templates (HTML and plain text)
- Notification history and management
- Admin email configuration UI

## Success Criteria

### Functional Requirements

- [ ] Users can configure notification preferences for all categories
- [ ] Online notifications appear in real-time for logged-in users
- [ ] Email notifications are sent successfully with STARTTLS on port 587
- [ ] Users can filter notifications by area (country/region/radius)
- [ ] Digest notifications (daily/weekly) work correctly
- [ ] Admin can configure SMTP settings via UI
- [ ] All notification types (dive sites, dives, centers, trips) trigger correctly
- [ ] Notification preferences persist and are respected
- [ ] Unread count updates via polling (every 30 seconds while logged in)
- [ ] Notifications shown on login since last check timestamp
- [ ] Email templates render correctly (HTML and plain text)
- [ ] Area filtering calculates distances correctly

### Quality Requirements

- [ ] All TypeScript/JavaScript linting passes
- [ ] All Python linting passes
- [ ] All existing tests continue to pass
- [ ] New tests added for notification functionality
- [ ] Code follows project standards

### User Validation

- [ ] Manual testing: Users can set preferences and receive notifications
- [ ] Manual testing: Email notifications are delivered successfully
- [ ] Manual testing: Area filtering works correctly
- [ ] Manual testing: Digest notifications are generated on schedule

### Documentation

- [ ] API documentation updated with notification endpoints
- [ ] Project description updated with notification system feature
- [ ] Implementation plan documented

## Implementation Plan

See `implementation-plan.md` for detailed implementation plan.

**Quick Reference**: See `architecture-breakdown.md` for clarification on what components are needed for in-app vs email notifications.

## Review

- [ ] Bug that needs fixing
- [ ] Code that needs cleanup

## Notes

- Consider cost-effective alternatives (see implementation-plan.md for options)
- Celery architecture adds ~$15-20/month in infrastructure costs
- **AWS Hybrid** (SQS + SES): ~$0-7/month (no minimum cost, pay-as-you-go after free tiers) ⭐ RECOMMENDED
- **Cloudflare** (Queues + Email): NOT AVAILABLE - Email Service still in private beta (no GA date)
- **Simplified approach**: No push notifications - use polling and login-based notification fetching
- Decision needed on which architecture to implement (AWS recommended - fully available, lowest cost)

### Direct SMTP vs Queued Delivery

**Is SMTP a Queue?**
- SMTP servers have internal queues, but they're not a reliable application-level queue
- SMTP queues are not application-visible, not persistent, and have limited retry logic
- **Conclusion**: SMTP queue-like behavior is not a substitute for application-level message queues

**Direct SMTP Sending (Synchronous)**
- **Pros**: $0/month, simpler architecture, immediate feedback, easier debugging
- **Cons**: Blocking API requests (1-5s delay), no retry control, no rate limiting, no scalability, poor UX
- **Best For**: Low volume (< 100 emails/day), non-critical emails, development/testing

**Queued Delivery (Asynchronous)**
- **Pros**: Fast API responses (< 100ms), automatic retries, rate limiting, scalability, high reliability, visibility
- **Cons**: $0-7/month cost, increased complexity, eventual consistency, debugging complexity
- **Best For**: Production systems, high volume, scheduled digests, burst handling

**Recommendation**: Use queued delivery (AWS SQS + Lambda) for production. See implementation-plan.md for detailed comparison.
