# Lambda Email Processor

AWS Lambda function for processing email notification tasks from SQS queue.

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Lambda execution role with permissions for:
   - SQS (read messages)
   - SES (send emails)
   - RDS/VPC (if database is in VPC)

### Environment Variables

Set these in Lambda configuration:

- `DB_HOST` - Database hostname
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DB_PORT` - Database port (default: 3306)
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_SES_FROM_EMAIL` - Default sender email
- `AWS_SES_FROM_NAME` - Default sender name
- `FRONTEND_URL` - Frontend URL for email links

### Package Lambda Function

```bash
cd backend/lambda
pip install -r requirements.txt -t .
zip -r email_processor.zip . -x "*.pyc" "__pycache__/*" "*.md" "*.txt"
```

### Deploy to AWS Lambda

```bash
aws lambda create-function \
  --function-name divemap-email-processor \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler email_processor.lambda_handler \
  --zip-file fileb://email_processor.zip \
  --timeout 60 \
  --memory-size 256 \
  --environment Variables={
    DB_HOST=your-db-host,
    DB_USER=your-db-user,
    DB_PASSWORD=your-db-password,
    DB_NAME=divemap,
    DB_PORT=3306,
    AWS_REGION=us-east-1,
    AWS_SES_FROM_EMAIL=noreply@divemap.com,
    AWS_SES_FROM_NAME=Divemap,
    FRONTEND_URL=https://divemap.com
  }
```

### Configure SQS Trigger

```bash
aws lambda create-event-source-mapping \
  --function-name divemap-email-processor \
  --event-source-arn arn:aws:sqs:REGION:ACCOUNT_ID:divemap-email-queue \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 5
```

## Testing

Test locally:

```bash
python email_processor.py
```

Test with AWS SAM or invoke directly:

```bash
aws lambda invoke \
  --function-name divemap-email-processor \
  --payload file://test-event.json \
  response.json
```

## Monitoring

- CloudWatch Logs: `/aws/lambda/divemap-email-processor`
- CloudWatch Metrics: Lambda invocations, errors, duration
- SQS Metrics: Messages processed, dead letter queue

## Troubleshooting

- **Database connection errors**: Check VPC configuration, security groups, and environment variables
- **SES errors**: Verify email addresses are verified (sandbox mode) or domain is verified
- **Timeout errors**: Increase Lambda timeout or optimize database queries
- **Import errors**: Ensure all dependencies are packaged correctly
