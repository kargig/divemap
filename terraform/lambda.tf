# IAM role for Lambda function
resource "aws_iam_role" "lambda_email_processor" {
  name = "${var.project_name}-${var.environment}-lambda-email-processor-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-email-processor-role"
  }
}

# IAM policy for Lambda to access SQS
resource "aws_iam_role_policy" "lambda_sqs_access" {
  name = "${var.project_name}-${var.environment}-lambda-sqs-access"
  role = aws_iam_role.lambda_email_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = aws_sqs_queue.email_notifications.arn
      }
    ]
  })
}

# IAM policy for Lambda to access SES
resource "aws_iam_role_policy" "lambda_ses_access" {
  name = "${var.project_name}-${var.environment}-lambda-ses-access"
  role = aws_iam_role.lambda_email_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendBulkTemplatedEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM policy for Lambda to access CloudWatch Logs
resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.project_name}-${var.environment}-lambda-logs"
  role = aws_iam_role.lambda_email_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${var.project_name}-${var.environment}-${var.lambda_function_name}:*"
      }
    ]
  })
}

# IAM policy for Lambda to access KMS (for SQS decryption)
resource "aws_iam_role_policy" "lambda_kms_access" {
  name = "${var.project_name}-${var.environment}-lambda-kms-access"
  role = aws_iam_role.lambda_email_processor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.sqs_key.arn
      }
    ]
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_email_processor" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-${var.lambda_function_name}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-lambda-email-processor-logs"
  }
}

# Lambda function deployment package
# Note: You need to create the deployment package separately
# See terraform/README.md for instructions
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambda"
  output_path = "${path.module}/lambda_email_processor.zip"
  excludes    = ["__pycache__", "*.pyc", "README.md", "requirements.txt"]
  
  # Note: Email templates and services are copied during manual packaging
  # See README.md section "Prepare Lambda Deployment Package"
}

# Lambda function
resource "aws_lambda_function" "email_processor" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-${var.environment}-${var.lambda_function_name}"
  role            = aws_iam_role.lambda_email_processor.arn
  handler         = "email_processor.lambda_handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = merge(
      {
        BACKEND_API_URL = var.backend_api_url
        LAMBDA_API_KEY  = var.lambda_api_key
        # AWS_REGION is automatically set by Lambda - don't set it manually
        SES_FROM_EMAIL  = var.ses_from_email
        SES_FROM_NAME   = var.ses_from_name
        FRONTEND_URL    = var.frontend_url
        LOG_LEVEL       = "INFO"
      },
      var.cloudflare_api_token != "" ? { CLOUDFLARE_API_TOKEN = var.cloudflare_api_token } : {}
    )
  }

  # VPC configuration (if database is in VPC)
  # Uncomment and configure if needed:
  # vpc_config {
  #   subnet_ids         = var.lambda_subnet_ids
  #   security_group_ids = [aws_security_group.lambda.id]
  # }

  tags = {
    Name = "${var.project_name}-${var.environment}-email-processor"
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_email_processor,
    aws_iam_role_policy.lambda_logs
  ]
}

# SQS event source mapping for Lambda
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.email_notifications.arn
  function_name    = aws_lambda_function.email_processor.arn
  batch_size       = 10
  maximum_batching_window_in_seconds = 5

  # Enable partial batch failure reporting
  function_response_types = ["ReportBatchItemFailures"]

  depends_on = [
    aws_lambda_function.email_processor,
    aws_sqs_queue_policy.email_notifications_policy
  ]
}

# Lambda function URL (optional, for manual testing)
# Uncomment if you want to test Lambda directly via HTTP
# resource "aws_lambda_function_url" "email_processor" {
#   function_name      = aws_lambda_function.email_processor.function_name
#   authorization_type = "NONE"
# }
