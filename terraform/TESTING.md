# Testing Email Notifications

This guide provides step-by-step instructions for testing the email notification
system end-to-end.

## Prerequisites

Before testing, ensure:

- [ ] Terraform infrastructure is deployed (`terraform apply` completed)
- [ ] Lambda function is packaged and uploaded
- [ ] Backend `.env` is configured with AWS credentials and SQS queue URL
- [ ] SES sender email is verified
- [ ] Backend is running and accessible
- [ ] Lambda environment variables are configured (including `LAMBDA_API_KEY`)

## Method 1: Quick Test via Admin Endpoint (Recommended First Test)

This method sends a test email directly to verify the basic email sending flow.

### Step 1: Get Admin JWT Token

Login as an admin user to get a JWT token:

```bash
BACKEND_URL="http://localhost:8000"  # Adjust to your backend URL

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_username",
    "password": "admin_password"
  }')

# Extract token
ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# Verify token was obtained
if [ -z "$ADMIN_TOKEN" ]; then
  echo "Error: Failed to get admin token. Check credentials."
  exit 1
fi

echo "Admin token obtained: ${ADMIN_TOKEN:0:20}..."
```

**Alternative using `jq` (if installed):**

```bash
ADMIN_TOKEN=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_username",
    "password": "admin_password"
  }' | jq -r '.access_token')
```

### Step 2: Send Test Email (Direct SES)

This endpoint sends an email **directly** via SES, bypassing SQS/Lambda:

```bash
curl -X POST "$BACKEND_URL/api/v1/notifications/admin/test-email" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected response:**

```json
{"message": "Test email sent successfully"}
```

**Note:** This endpoint tests SES configuration but does **not** test the SQS → Lambda → SES pipeline.

### Step 2b: Send Test Email via SQS/Lambda (Full Pipeline)

This endpoint tests the **complete** asynchronous email flow: Database → SQS → Lambda → SES:

```bash
curl -X POST "$BACKEND_URL/api/v1/notifications/admin/test-email-queue" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected response:**

```json
{
  "message": "Test notification queued successfully. Lambda will process it and send the email.",
  "notification_id": 123,
  "user_email": "admin@example.com",
  "category": "admin_alerts",
  "queued_to_sqs": true
}
```

**What happens:**
1. Creates a notification record in the database
2. Queues the email task to SQS
3. Lambda is triggered automatically
4. Lambda fetches notification details from backend API
5. Lambda sends email via SES
6. Lambda marks notification as email_sent

**To verify the full flow:**
- Check Lambda CloudWatch logs for processing activity
- Verify email is received (may take 10-30 seconds)
- Check notification record: `email_sent` should be `true`

### Step 3: Verify Email Delivery

1. Check the admin user's email inbox (the email address associated with the
   admin account)
2. You should receive a test email from the configured sender address

### Step 4: Check Backend Logs

```bash
docker logs divemap_backend --since 1m | grep -i "email\|sqs"
```

Look for messages like:

- `Email task queued successfully`
- `SQS message sent`

### Step 5: Check Lambda Logs

```bash
cd terraform
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

aws logs tail "/aws/lambda/$LAMBDA_NAME" \
  --follow \
  --region eu-central-1
```

Look for:

- `Email sent successfully`
- Any error messages

---

## Method 2: Real Notification Test (Full SQS/Lambda Flow)

This method tests the complete flow: notification creation → SQS queue → Lambda
→ email delivery.

### Step 1: Configure Notification Preferences for Test User

First, ensure a test user has email notifications enabled for a specific
category.

**Option A: Via Frontend**

1. Login as a test user (not admin)
2. Navigate to `/notifications/preferences`
3. Enable email notifications for a category (e.g., `new_dive_sites`)
4. Set frequency to `immediate`

**Option B: Via API**

```bash
# Get test user JWT token (replace with test user credentials)
TEST_USER_TOKEN="<test-user-jwt-token>"

# Create or update notification preference
curl -X POST "$BACKEND_URL/api/v1/notifications/preferences" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "new_dive_sites",
    "enable_website": true,
    "enable_email": true,
    "frequency": "immediate"
  }'
```

### Step 2: Trigger a Notification

Create content that triggers a notification. For example, create a new dive site:

```bash
# As admin user
curl -X POST "$BACKEND_URL/api/v1/dive-sites" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Dive Site for Email Notification",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "country": "United States",
    "region": "New York",
    "description": "Test site to trigger email notification"
  }'
```

**Other triggers:**

- Create a new dive (if test user has `new_dives` enabled)
- Create a new diving center (if test user has `new_diving_centers` enabled)
- Parse a dive trip newsletter (if test user has `new_dive_trips` enabled)

### Step 3: Verify Notification Was Created

Check that a notification was created in the database:

```bash
# Get notifications for test user
curl -X GET "$BACKEND_URL/api/v1/notifications/" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json"
```

You should see a new notification with `email_sent: false` initially.

### Step 4: Monitor SQS Queue

```bash
cd terraform
SQS_URL=$(terraform output -raw sqs_queue_url)

# Check queue depth
aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-central-1
```

You should see at least 1 message in the queue (or 0 if Lambda already
processed it).

### Step 5: Monitor Lambda Processing

```bash
cd terraform
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

# Watch Lambda logs in real-time
aws logs tail "/aws/lambda/$LAMBDA_NAME" \
  --follow \
  --region eu-central-1
```

**What to look for:**

- `Processing email task for notification ID: <id>`
- `Email sent successfully`
- `Marked notification as email_sent`

### Step 6: Verify Email Delivery

1. Check the test user's email inbox
2. You should receive an email notification about the new content

### Step 7: Verify Notification Status Updated

```bash
# Check notification status (should show email_sent: true)
curl -X GET "$BACKEND_URL/api/v1/notifications/" \
  -H "Authorization: Bearer $TEST_USER_TOKEN" \
  -H "Content-Type: application/json" | jq '.notifications[] | select(.email_sent == true)'
```

---

## Method 3: Test Multiple Users and Categories

Test that notifications work for different users and categories:

### Step 1: Set Up Multiple Test Users

Create or use existing users with different notification preferences:

- **User A**: `new_dive_sites` enabled, email enabled, immediate
- **User B**: `new_dives` enabled, email enabled, immediate
- **User C**: `new_diving_centers` enabled, email enabled, immediate

### Step 2: Trigger Different Events

1. Create a new dive site → User A should receive email
2. Create a new dive → User B should receive email
3. Create a new diving center → User C should receive email

### Step 3: Verify All Emails Sent

Check Lambda logs to see multiple emails processed:

```bash
aws logs tail "/aws/lambda/$LAMBDA_NAME" \
  --since 5m \
  --region eu-central-1 | grep "Email sent successfully"
```

You should see multiple "Email sent successfully" messages.

---

## Troubleshooting

### No Email Received

1. **Check SES verification:**
   - Ensure sender email is verified in SES Console
   - If in sandbox mode, recipient email must also be verified

2. **Check Lambda logs for errors:**
   ```bash
   aws logs tail "/aws/lambda/$LAMBDA_NAME" --since 10m --region eu-central-1
   ```

3. **Check backend logs:**
   ```bash
   docker logs divemap_backend --since 10m | grep -i "error\|sqs\|email"
   ```

4. **Verify SQS queue has messages:**
   ```bash
   aws sqs get-queue-attributes \
     --queue-url "$SQS_URL" \
     --attribute-names ApproximateNumberOfMessages \
     --region eu-central-1
   ```

5. **Check Lambda environment variables:**
   ```bash
   aws lambda get-function-configuration \
     --function-name "$LAMBDA_NAME" \
     --region eu-central-1 | jq '.Environment.Variables'
   ```

### Lambda Not Processing Messages

1. **Check event source mapping:**
   ```bash
   aws lambda list-event-source-mappings \
     --function-name "$LAMBDA_NAME" \
     --region eu-central-1
   ```

2. **Verify Lambda has SQS read permissions**

3. **Check dead-letter queue:**
   ```bash
   DLQ_URL=$(cd terraform && terraform output -raw sqs_dlq_url)
   aws sqs get-queue-attributes \
     --queue-url "$DLQ_URL" \
     --attribute-names ApproximateNumberOfMessages \
     --region eu-central-1
   ```

### Backend API Connection Issues

1. **Test API endpoint manually:**
   ```bash
   curl -H "X-API-Key: <your-lambda-api-key>" \
     "$BACKEND_API_URL/api/v1/notifications/internal/1"
   ```

2. **Verify `BACKEND_API_URL` in Lambda matches your actual backend URL**

3. **Check backend is accessible from Lambda's network**

---

## Expected Results

When everything works correctly:

1. ✅ Notification is created in database
2. ✅ SQS message is enqueued (visible in queue attributes)
3. ✅ Lambda is triggered automatically
4. ✅ Lambda calls backend API to fetch notification
5. ✅ Lambda renders email template
6. ✅ Lambda sends email via SES
7. ✅ Lambda calls backend API to mark `email_sent = true`
8. ✅ Email arrives in recipient's inbox
9. ✅ Notification status shows `email_sent: true` in database

---

## Next Steps

After successful testing:

1. Monitor CloudWatch metrics for SQS, Lambda, and SES
2. Set up CloudWatch alarms for errors
3. Test with production SES access (if still in sandbox)
4. Test digest notifications (daily/weekly) if enabled
5. Test area filtering (geographic preferences)
