# Terraform Deployment Guide for Divemap Notification System

This guide is the **end-to-end runbook** for deploying, configuring, testing,
and maintaining the AWS email notification infrastructure for Divemap.

If you only need to understand what this infrastructure does at a high level,
start with `README.md`. If you need to set up AWS credentials and IAM
permissions, see `SETUP.md`.

---

## 1. Configure Terraform Variables

From the project root:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set your values (example):

```hcl
aws_region      = "eu-central-1"
environment     = "prod"
backend_api_url = "https://api.divemap.example.com"

ses_from_email  = "notifications@yourdomain.com"
ses_from_name   = "Divemap Notifications"
frontend_url    = "https://divemap.example.com"

# Strong random value, used by legacy LAMBDA_API_KEY auth path
lambda_api_key  = "<secure-random-hex>"

# Cloudflare Configuration (optional - only if backend is behind Cloudflare)
# See "Cloudflare Configuration" section below for setup instructions
cloudflare_api_token = ""  # Optional: Leave empty if not using Cloudflare
```

**Security notes:**

- Do **not** commit real secrets to git.
- For production, prefer AWS Secrets Manager / SSM Parameter Store instead of
  plain `terraform.tfvars`.

To generate a strong key for `lambda_api_key` / `LAMBDA_API_KEY`:

```bash
openssl rand -hex 32
```

---

## 2. Initialize and Plan Terraform

Initialize the Terraform working directory:

```bash
cd terraform
terraform init
```

Review what will be created:

```bash
terraform plan
```

If the plan looks correct, apply it:

```bash
terraform apply
```

Type `yes` when prompted.

After apply completes, record the key outputs:

```bash
terraform output
```

Pay special attention to:

- `sqs_queue_url`
- `lambda_function_name`
- `app_iam_user_name`
- `backend_api_url`

---

## 3. Package and Upload the Lambda Function

The Lambda function `backend/lambda/email_processor.py` must be packaged with
its dependencies and email templates.

From the project root:

```bash
cd terraform

# Create a temporary directory for packaging
mkdir -p lambda_package
cd lambda_package

# Copy Lambda function code
cp -r ../../backend/lambda/* .

# Copy email service and templates from backend
mkdir -p app/services app/templates/emails
cp ../../backend/app/services/email_service.py app/services/
cp ../../backend/app/services/ses_service.py app/services/
cp -r ../../backend/app/templates/emails/* app/templates/emails/

# Install dependencies (only boto3 and jinja2 are needed)
pip install boto3 jinja2 -t .

# Create zip file
zip -r ../lambda_email_processor.zip .
cd ..
rm -rf lambda_package
```

Now update the Lambda function code using the AWS CLI:

```bash
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file fileb://lambda_email_processor.zip \
  --region eu-central-1
```

Verify:

```bash
aws lambda get-function --function-name "$LAMBDA_NAME" --region eu-central-1
```

---

## 4. Application IAM User and Access Keys

**Critical security requirement:** never use root AWS account credentials in the
backend.

Terraform creates a dedicated IAM user for the application (see
`app_iam_user_name` output).

1. Open the AWS console → **IAM → Users**.
2. Find user `divemap-prod-app-user` (or name from Terraform output).
3. Go to **Security credentials** tab.
4. In **Access keys**, click **Create access key**.
5. Choose use case **Application running outside AWS**.
6. Create the key and store **Access key ID** and **Secret access key**
   **securely**.

Best practices:

- Store these only in backend `.env` (git-ignored).
- Rotate every ~90 days.

---

## 5. Configure Backend Environment Variables

Once you have the IAM user keys and Terraform outputs, configure the backend
`.env`.

From the `terraform` directory, get the SQS queue URL:

```bash
cd terraform
SQS_URL=$(terraform output -raw sqs_queue_url)
echo "SQS Queue URL: $SQS_URL"
```

In your backend `.env` file:

```bash
# AWS configuration for email notifications
AWS_ACCESS_KEY_ID=<app-iam-access-key-id>
AWS_SECRET_ACCESS_KEY=<app-iam-secret-access-key>
AWS_REGION=eu-central-1
AWS_SQS_QUEUE_URL=<paste SQS_URL here>
AWS_SES_FROM_EMAIL=<from terraform.tfvars>
AWS_SES_FROM_NAME=<from terraform.tfvars>
FRONTEND_URL=<from terraform.tfvars>

# Lambda API key (must match terraform.tfvars if using legacy path)
LAMBDA_API_KEY=<same value as lambda_api_key in terraform.tfvars>
```

Notes:

- For **database-backed API keys** (recommended), see section 7 below.
- `.env` must **not** be committed to git.

Restart the backend after updating `.env` (for example, if running via Docker):

```bash
docker restart divemap_backend
```

---

## 6. Verify SES Sender Email

Before SES can send emails, your sender email address must be verified.

1. Go to **AWS SES Console**.
2. Navigate to **Verified identities**.
3. Click **Create identity**.
4. Choose **Email address**.
5. Enter your `ses_from_email` from `terraform.tfvars`.
6. Create identity and click the verification link sent to that address.

For production use, you should also:

- Request SES production access (leave sandbox mode).
- Verify your sending domain.
- Configure SPF, DKIM and DMARC records.

---

## 6.5 Cloudflare Configuration (If Backend is Behind Cloudflare)

If your backend API is behind **Cloudflare** and Lambda requests are being blocked with 403 errors, you need to configure Cloudflare to allow Lambda requests.

**Note**: Cloudflare has replaced the "Allow" action with "Skip" action in WAF Custom Rules. The "Skip" action provides more granular control over which security features to bypass.

### Option A: Cloudflare WAF Custom Rules (Recommended)

This is the **recommended approach** - configure Cloudflare to skip security challenges for requests with the `X-API-Key` header:

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Select your domain (`divemap.gr`)

2. **Navigate to Security → WAF → Custom rules**
   - Click "Security" in the left sidebar
   - Click "WAF" (Web Application Firewall)
   - Click "Custom rules" tab

3. **Create a Custom Rule**
   - Click "Create rule" button
   - **Rule name**: `Allow Lambda API Requests`
   
4. **Define Matching Conditions**
   - Under "When incoming requests match", configure:
     - **Field**: Select `http.request.headers.names` or use the expression editor
     - **Expression** (recommended): 
       ```
       http.request.headers["X-API-Key"] ne ""
       ```
       This matches any request with a non-empty `X-API-Key` header
   - **OR** use the field dropdown:
     - **Field**: `http.request.headers.x-api-key` (if available)
     - **Operator**: `is present` or `is not empty`
   
5. **Set the Action**
   - Under "Then take action":
     - **Choose action**: Select `Skip`
   
6. **Configure Skip Options**
   - A modal will appear with skip configuration options
   - **Log matching requests**: Toggle ON (recommended) to see these requests in Security overview
   
   - **WAF components to skip**: Check the boxes for what to bypass:
     - ✅ **All remaining custom rules** (recommended - stops evaluating other custom rules)
     - ☐ **All rate limiting rules** (check if you want to bypass rate limits)
     - ☐ **All managed rules** (check if you want to bypass managed WAF rules)
     - ✅ **All Super Bot Fight Mode Rules** (recommended for API requests)
   
   - **More components to skip**: Click to expand and see additional options:
     - ☐ **Zone Lockdown**
     - ☐ **User Agent Blocking**
     - ✅ **Browser Integrity Check** (recommended for API requests - this is what causes challenges)
     - ☐ **Hotlink Protection**
     - ☐ **Security Level**
     - ☐ **Rate limiting rules (Previous version)**
     - ☐ **Managed rules (Previous version)**
   
   - **Recommended configuration for Lambda API requests**:
     - ✅ All remaining custom rules
     - ✅ All Super Bot Fight Mode Rules
     - ✅ Browser Integrity Check
     - ✅ Log matching requests (to monitor)
   
   - Click **Save** or **Deploy** to apply the rule

7. **Alternative: Skip by User-Agent**
   - If you prefer to identify Lambda by User-Agent:
   - **Expression**: 
     ```
     http.request.headers["user-agent"] eq "Divemap-Lambda-EmailProcessor/1.0"
     ```
   - **Action**: `Skip`
   - **Skip options**: Configure the same skip options as above:
     - ✅ All remaining custom rules
     - ✅ All Super Bot Fight Mode Rules
     - ✅ Browser Integrity Check

8. **Test the Rule**
   - Send a test notification from Lambda
   - Check Cloudflare Analytics & Logs → Logs to verify requests are allowed
   - Verify Lambda logs show successful API calls (no 403 errors)

### Option B: Cloudflare API Token (Alternative)

If Firewall Rules don't work or you need more control, you can use a Cloudflare API token:

1. **Access API Tokens Section**
   - Log in to Cloudflare Dashboard: https://dash.cloudflare.com/
   - For user tokens: Go to **My Profile** → **API Tokens**
   - For account tokens (recommended for service integrations): Go to **Manage Account** → **Account API Tokens**

2. **Create Custom Token**
   - Click "Create Token"
   - Click "Create Custom Token"

3. **Configure Token Details**
   - **Token name**: `Divemap Lambda Email Processor`
   
4. **Set Permissions**
   - **Scope**: Select `Zone`
   - **Permission Group**: Select `Firewall Services`
   - **Access Level**: Select `Edit` (if you want to manage firewall rules) or `Read` (if just reading)
   - **Additional Permissions** (optional):
     - **Scope**: `Zone`
     - **Permission Group**: `Zone`
     - **Access Level**: `Read`
     - **Scope**: `Zone`
     - **Permission Group**: `Zone Settings`
     - **Access Level**: `Read`

5. **Specify Zone Resources**
   - **Zone Resources**: Select "Include" → "Specific Zone"
   - Choose `divemap.gr` from the dropdown

6. **Set Optional Restrictions**
   - **Client IP Address Filtering**: Leave empty (or restrict to AWS Lambda IP ranges if known)
   - **TTL (Time to Live)**: Leave empty for no expiration, or set an expiration date

7. **Create and Copy Token**
   - Click "Continue to summary"
   - Review the token configuration
   - Click "Create Token"
   - **Copy the token immediately** (you won't be able to see it again)
   - Store it securely (e.g., in AWS Secrets Manager or Parameter Store)

4. **Add Token to Terraform Configuration**
   - Edit `terraform/terraform.tfvars`:
   
   ```hcl
   cloudflare_api_token = "your-cloudflare-api-token-here"
   ```

5. **Update Lambda Environment Variables**
   - Run `terraform apply` to update Lambda with the token
   - OR update manually via AWS CLI:
   
   ```bash
   cd terraform
   LAMBDA_NAME=$(terraform output -raw lambda_function_name)
   CLOUDFLARE_TOKEN="your-cloudflare-api-token-here"
   
   aws lambda update-function-configuration \
     --function-name "$LAMBDA_NAME" \
     --environment "Variables={CLOUDFLARE_API_TOKEN=$CLOUDFLARE_TOKEN,...existing vars...}" \
     --region eu-central-1
   ```

6. **Rebuild and Upload Lambda Package**
   - The Lambda code now includes support for Cloudflare tokens
   - Rebuild the package (see section 3) and upload it

**Note**: 
- The Cloudflare API token approach (Option B) is primarily for managing Cloudflare resources via API, not for bypassing challenges. 
- **Option A (WAF Custom Rules with Skip action) is strongly recommended** as it's the proper way to allow specific requests to bypass Cloudflare's security challenges.
- The "Skip" action replaces the old "Allow" action and provides more granular control over which security products to bypass.

### Verifying Cloudflare Configuration

After configuring Cloudflare:

1. **Check Cloudflare Logs**
   - Go to Cloudflare Dashboard → **Analytics & Logs** → **Logs**
   - Filter for requests to `/api/v1/notifications/internal/*`
   - Verify requests show as "Skip" or "Pass" status (not "Blocked" or "Challenge")
   - Check the "Action" column to confirm requests are being skipped/bypassed

2. **Test Lambda Request**
   - Send a test notification via `/admin/test-email-queue`
   - Check Lambda logs - should see successful API calls (no 403 errors)
   - Verify the response is JSON (not HTML challenge page)

3. **Monitor Cloudflare Dashboard**
   - Go to **Security** → **WAF** → **Custom rules**
   - Verify your rule is active and shows recent matches
   - Check **Analytics & Logs** → **Security Events** for any false positives

---

## 7. Backend API Key for Lambda (Recommended)

The backend supports two ways to authenticate Lambda:

- **Legacy mode**: environment variable `LAMBDA_API_KEY` compared directly.
- **Recommended mode**: **database-backed API key** managed through admin
  endpoints.

### 7.1 Get an admin JWT token

Make sure the backend is running, then from your shell:

```bash
BACKEND_URL="http://localhost:8000"  # adjust to your backend URL

LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_username",
    "password": "admin_password"
  }')

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Error: failed to obtain admin token. Check credentials and BACKEND_URL."
  exit 1
fi

echo "Admin token obtained: ${ADMIN_TOKEN:0:20}..."
```

(Optionally use `jq` if installed to parse the JSON more cleanly.)

### 7.2 Create an API key for Lambda

```bash
curl -X POST "$BACKEND_URL/api/v1/users/admin/api-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lambda Email Processor",
    "description": "API key for Lambda function to authenticate with backend API",
    "expires_at": null
  }'
```

The response includes a `key` value (e.g. `"dm_live_abc123..."`). **Save this
value**; it is only shown once.

### 7.3 Point Lambda at the chosen API key

Decide which key to use in Lambda:

- **Option A (recommended)**: the **database-backed API key** (`key` from the
  step above).
- **Option B (legacy)**: the `lambda_api_key` from `terraform.tfvars` /
  `LAMBDA_API_KEY` env var.

Lambda itself does **not** care which type it is. It just sends `LAMBDA_API_KEY`
as `X-API-Key`.
The backend logic:

1. First checks if the provided key matches any **database-backed** API key (by
   hash).
2. If not found, falls back to comparing with the `LAMBDA_API_KEY` environment
   variable.

Update Lambda environment variables via AWS CLI (fast path):

```bash
cd terraform
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

API_KEY="<your-chosen-api-key>"   # database API key (recommended) or legacy key
BACKEND_API_URL="<your-backend-url>"  # should match backend_api_url in terraform.tfvars
SES_FROM_EMAIL="<from-tfvars>"
SES_FROM_NAME="<from-tfvars>"
FRONTEND_URL="<from-tfvars>"

aws lambda update-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --environment "Variables={LAMBDA_API_KEY=$API_KEY,BACKEND_API_URL=$BACKEND_API_URL,SES_FROM_EMAIL=$SES_FROM_EMAIL,SES_FROM_NAME=$SES_FROM_NAME,FRONTEND_URL=$FRONTEND_URL,LOG_LEVEL=INFO}" \
  --region eu-central-1

# If using Cloudflare API token, add it:
# CLOUDFLARE_TOKEN="your-token-here"
# aws lambda update-function-configuration \
#   --function-name "$LAMBDA_NAME" \
#   --environment "Variables={...,CLOUDFLARE_API_TOKEN=$CLOUDFLARE_TOKEN}" \
#   --region eu-central-1
```

You can also update environment variables via Terraform by editing
`terraform.tfvars` and running `terraform apply`, but the CLI approach above is
quicker for experimentation.

---

## 8. How the Lambda Function Works

The Lambda function (`backend/lambda/email_processor.py`):

1. Is triggered by messages in the SQS queue.
2. Calls the backend API to fetch notification details.
3. Checks if email was already sent (idempotent processing).
4. Renders email templates using **Jinja2**.
5. Sends the email via **SES**.
6. Calls the backend API to mark the email as sent.

### 8.1 Lambda environment variables (managed by Terraform / CLI)

- `BACKEND_API_URL`
- `LAMBDA_API_KEY`
- `CLOUDFLARE_API_TOKEN` (optional, only if using Cloudflare API token approach)
- `SES_FROM_EMAIL`
- `SES_FROM_NAME`
- `FRONTEND_URL`
- `LOG_LEVEL`

### 8.2 Lambda dependencies

The Lambda package must include at minimum:

- `boto3` – AWS SDK for SES / SQS
- `jinja2` – template rendering

(Older versions used database libraries; the current architecture does **not**
require direct DB access.)

---

## 9. End-to-End Testing

### 9.1 Basic email test via admin endpoint

1. Ensure backend is running and configured with AWS and SQS.
2. Obtain an admin token as in Step 7.1.
3. Call the admin test email endpoint:

```bash
BACKEND_URL="http://localhost:8000"  # or your backend URL

curl -X POST "$BACKEND_URL/api/v1/notifications/admin/test-email" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

If everything is configured correctly, you should see:

- SQS message enqueued.
- Lambda consuming the message and sending an email.
- Email arriving in the inbox of the admin user.

### 9.2 Check SQS queue

```bash
cd terraform
SQS_URL=$(terraform output -raw sqs_queue_url)

aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-central-1
```

### 9.3 Check Lambda logs

```bash
cd terraform
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

aws logs tail "/aws/lambda/$LAMBDA_NAME" \
  --follow \
  --region eu-central-1
```

Look for messages such as:

- `Email task queued successfully` (backend logs)
- `Email sent successfully` (Lambda logs)

### 9.4 Trigger real notifications

1. Configure notification preferences for a test user (via frontend or
   `/api/v1/notifications/preferences`).
2. Create a new dive site, dive, etc., so the backend creates notifications.
3. If email is enabled and frequency is `immediate`, the backend will enqueue an
   SQS message.
4. Verify that Lambda processes and sends the email.

---

## 10. Monitoring and Troubleshooting

### 10.1 CloudWatch metrics

Monitor via AWS CloudWatch:

- **SQS**: queue depth, message age
- **Lambda**: invocations, errors, duration, throttles
- **SES**: sends, bounces, complaints, deliveries

### 10.2 Monitoring SQS Retries

When Lambda encounters retryable errors (5xx), it raises an exception which causes SQS to redeliver the message. Here's how to monitor retries:

**Check SQS Queue Status:**

```bash
cd terraform
SQS_URL=$(terraform output -raw sqs_queue_url)

# Messages waiting to be processed
aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --region eu-central-1 \
  --attribute-names ApproximateNumberOfMessages \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text

# Messages currently being processed or retrying (in flight)
aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --region eu-central-1 \
  --attribute-names ApproximateNumberOfMessagesNotVisible \
  --query 'Attributes.ApproximateNumberOfMessagesNotVisible' \
  --output text
```

**Check Dead Letter Queue:**

```bash
# Get DLQ URL (queue name from terraform output)
DLQ_NAME="divemap-prod-divemap-email-notifications-dlq"
DLQ_URL=$(aws sqs get-queue-url \
  --queue-name "$DLQ_NAME" \
  --region eu-central-1 \
  --query 'QueueUrl' \
  --output text)

# Check for failed messages
aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --region eu-central-1 \
  --attribute-names ApproximateNumberOfMessages \
  --query 'Attributes.ApproximateNumberOfMessages' \
  --output text
```

**Understanding Retry Behavior:**

- **Visibility Timeout**: 120 seconds (2 minutes) - message becomes visible again after this time
- **Max Receive Count**: 3 - message will be retried up to 3 times
- **Retry Timeline**: 
  - Attempt 1: Immediate
  - Attempt 2: After 2 minutes (visibility timeout)
  - Attempt 3: After 4 minutes total
  - After 3 failures: Message moves to DLQ

**How to Verify Retries are Working:**

1. Send a test notification when backend is down (504 error)
2. Check Lambda logs - should see "Retryable server error 504 - will trigger SQS redelivery"
3. Check `ApproximateNumberOfMessagesNotVisible` - should be > 0 if message is retrying
4. Wait 2 minutes, check again - message should become visible and retry
5. After 3 attempts, check DLQ - message should appear there

### 10.3 Common issues

**Emails not sending:**

1. Verify SES identity is verified (and account is not limited to
   sandbox-only behavior).
2. Check Lambda logs for exceptions.
3. Confirm `LAMBDA_API_KEY` matches between backend and Lambda / Terraform.
4. Ensure backend is accessible from Lambda (network, URL correctness).
5. Verify IAM permissions allow SES send and SQS read.

**Lambda not triggered:**

1. Check event source mappings: `aws lambda list-event-source-mappings`.
2. Verify Lambda role has permission to read from SQS.
3. Confirm SQS has messages awaiting processing.
4. Review CloudWatch logs for mapping errors.

**Backend API connection issues:**

1. Confirm `BACKEND_API_URL` is correct and reachable.
2. Check backend container logs for errors.
3. Test manually:

```bash
curl -H "X-API-Key: <your-api-key>" \
  "$BACKEND_API_URL/api/v1/notifications/internal/1"
```

**Cloudflare blocking Lambda requests (403 Forbidden):**

1. Check Cloudflare dashboard logs - requests should appear as blocked
2. Verify Cloudflare Firewall Rules are configured (see section 6.5)
3. If using Cloudflare API token, verify `CLOUDFLARE_API_TOKEN` is set in Lambda
4. Check Lambda logs for Cloudflare challenge pages in error response body
5. Consider whitelisting AWS Lambda IP ranges in Cloudflare (if static IPs are used)

**IAM / AWS credential issues:**

1. Ensure you are using the **application IAM user** credentials, not root.
2. Verify IAM user policy matches what is described in `SETUP.md`.
3. Test the credentials with a simple SQS or SES command using
   `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

---

## 11. Production Hardening

Before going to production:

1. **SES production access**

   - Request leaving sandbox mode.
   - Verify your sending domain.
   - Configure SPF, DKIM, DMARC.

2. **Secure secrets**

   - Move API keys and AWS credentials into Secrets Manager / SSM.
   - Rotate IAM keys and API keys regularly.

3. **Monitoring and alerts**

   - Add CloudWatch alarms for Lambda error rate, DLQ growth, SES bounces.
   - Monitor SQS dead-letter queue.

4. **Backups and recovery**

   - Back up Terraform state.
   - Document recovery procedures.

---

## 12. Destroying the Infrastructure

When you want to tear everything down:

```bash
cd terraform
terraform destroy
```

**Warning:** this deletes:

- Lambda function
- SQS queues (including DLQ)
- IAM roles and policies
- Application IAM user
- EventBridge rules
- CloudWatch log groups

Make sure this is what you intend.

---

## 13. Summary Checklist

- [ ] Terraform `apply` completed successfully
- [ ] Lambda package built and uploaded
- [ ] Application IAM user created and access keys stored securely
- [ ] Backend `.env` configured with IAM user credentials (not root!)
- [ ] SES sender email verified
- [ ] API key for Lambda created and configured (recommended)
- [ ] Backend restarted with new configuration
- [ ] Test email endpoint verified
- [ ] SQS, Lambda and SES monitored in CloudWatch
- [ ] Production hardening steps planned or completed

---

## 14. References

- `SETUP.md` – AWS credentials / IAM policy setup
- AWS docs:
  - SQS: https://docs.aws.amazon.com/sqs/
  - SES: https://docs.aws.amazon.com/ses/
  - Lambda: https://docs.aws.amazon.com/lambda/
  - EventBridge: https://docs.aws.amazon.com/eventbridge/
  - Terraform AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
