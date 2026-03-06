# Lambda Logs Troubleshooting

## Issue: Empty logs with `aws logs tail`

If `aws logs tail` shows no output, use these alternative commands:

### Method 1: Filter log events (Recommended)

```bash
cd terraform
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

# Get logs from last hour
aws logs filter-log-events \
  --log-group-name "/aws/lambda/$LAMBDA_NAME" \
  --region eu-central-1 \
  --start-time $(($(date +%s) - 3600))000 \
  --query 'events[*].[timestamp,message]' \
  --output table
```

### Method 2: Get recent log streams

```bash
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

# List recent log streams
aws logs describe-log-streams \
  --log-group-name "/aws/lambda/$LAMBDA_NAME" \
  --region eu-central-1 \
  --order-by LastEventTime \
  --descending \
  --max-items 5 \
  --output table

# Get events from a specific stream
STREAM_NAME="2025/12/17/[\$LATEST]..."
aws logs get-log-events \
  --log-group-name "/aws/lambda/$LAMBDA_NAME" \
  --log-stream-name "$STREAM_NAME" \
  --region eu-central-1 \
  --output table
```

### Method 3: Check CloudWatch Metrics

```bash
LAMBDA_NAME=$(terraform output -raw lambda_function_name)

# Check if Lambda was invoked
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="$LAMBDA_NAME" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region eu-central-1 \
  --output table

# Check for errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value="$LAMBDA_NAME" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region eu-central-1 \
  --output table
```

## Common Issues

### 1. Lambda not invoked

**Symptoms:** No logs, no invocations in metrics

**Causes:**
- SQS queue is empty
- Event source mapping is disabled
- Lambda doesn't have permission to read from SQS

**Check:**
```bash
# Check SQS queue
SQS_URL=$(terraform output -raw sqs_queue_url)
aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --attribute-names ApproximateNumberOfMessages \
  --region eu-central-1

# Check event source mapping
LAMBDA_NAME=$(terraform output -raw lambda_function_name)
aws lambda list-event-source-mappings \
  --function-name "$LAMBDA_NAME" \
  --region eu-central-1
```

### 2. Lambda invoked but no logs

**Symptoms:** Invocations > 0, but `aws logs tail` shows nothing

**Solution:** Use `filter-log-events` instead (see Method 1 above)

**Why:** `aws logs tail` may not work if:
- Log streams are in a specific format
- There's a delay in log ingestion
- The log group was just created

### 3. "No module named 'app'" error

**Symptoms:** Lambda logs show `Email service imports not available: No module named 'app'`

**Cause:** Lambda package is missing `app/services/` and `app/templates/` directories

**Fix:** Recreate the Lambda package following `DEPLOY.md` section 3:

```bash
cd terraform
rm -rf lambda_package lambda_email_processor.zip
mkdir -p lambda_package
cd lambda_package

# Copy Lambda function code
cp -r ../../backend/lambda/* .

# Copy email service and templates from backend
mkdir -p app/services app/templates/emails
cp ../../backend/app/services/email_service.py app/services/
cp ../../backend/app/services/ses_service.py app/services/
cp -r ../../backend/app/templates/emails/* app/templates/emails/

# Install dependencies
pip install boto3 jinja2 -t .

# Create zip file
zip -r ../lambda_email_processor.zip .
cd ..
rm -rf lambda_package

# Update Lambda
LAMBDA_NAME=$(terraform output -raw lambda_function_name)
aws lambda update-function-code \
  --function-name "$LAMBDA_NAME" \
  --zip-file fileb://lambda_email_processor.zip \
  --region eu-central-1
```

### 4. Lambda package too small

**Symptoms:** Package size < 1MB, missing dependencies

**Check package contents:**
```bash
unzip -l lambda_email_processor.zip | head -30
```

Should include:
- `email_processor.py`
- `app/services/email_service.py`
- `app/services/ses_service.py`
- `app/templates/emails/*.html` and `*.txt`
- `boto3/`, `jinja2/` directories (dependencies)

### 5. Event source mapping issues

**Check mapping status:**
```bash
LAMBDA_NAME=$(terraform output -raw lambda_function_name)
aws lambda list-event-source-mappings \
  --function-name "$LAMBDA_NAME" \
  --region eu-central-1 \
  --query 'EventSourceMappings[*].[UUID,State,EventSourceArn]' \
  --output table
```

**State should be:** `Enabled`

**If disabled:**
```bash
UUID="<uuid-from-above>"
aws lambda update-event-source-mapping \
  --uuid "$UUID" \
  --enabled \
  --region eu-central-1
```

## Quick Diagnostic Commands

```bash
cd terraform

# Get all Lambda info
LAMBDA_NAME=$(terraform output -raw lambda_function_name)
echo "=== Lambda Status ==="
aws lambda get-function --function-name "$LAMBDA_NAME" --region eu-central-1 --query 'Configuration.[FunctionName,State,LastUpdateStatus,CodeSize]' --output table

echo -e "\n=== Recent Logs ==="
aws logs filter-log-events \
  --log-group-name "/aws/lambda/$LAMBDA_NAME" \
  --region eu-central-1 \
  --start-time $(($(date +%s) - 3600))000 \
  --query 'events[-10:].[timestamp,message]' \
  --output table

echo -e "\n=== SQS Queue Status ==="
SQS_URL=$(terraform output -raw sqs_queue_url)
aws sqs get-queue-attributes \
  --queue-url "$SQS_URL" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region eu-central-1 \
  --output table

echo -e "\n=== Event Source Mapping ==="
aws lambda list-event-source-mappings \
  --function-name "$LAMBDA_NAME" \
  --region eu-central-1 \
  --query 'EventSourceMappings[*].[State,EventSourceArn]' \
  --output table
```
