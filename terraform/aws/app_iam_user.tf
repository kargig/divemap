# IAM User for Application (Backend)
# This user is used by the backend application to interact with AWS services
# It has minimal permissions - only what's needed for SQS and SES operations

resource "aws_iam_user" "app_user" {
  name = "${var.project_name}-${var.environment}-app-user"
  path = "/"

  tags = {
    Name        = "${var.project_name}-${var.environment}-app-user"
    Description = "IAM user for backend application to access SQS and SES"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for Application User
# Grants permissions to:
# - Send messages to SQS queue
# - Send emails via SES
# - Use KMS key for SQS encryption
resource "aws_iam_user_policy" "app_user_policy" {
  name = "${var.project_name}-${var.environment}-app-user-policy"
  user = aws_iam_user.app_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSQSSendMessage"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.email_notifications.arn,
          aws_sqs_queue.email_notifications_dlq.arn
        ]
      },
      {
        Sid    = "AllowSESSendEmail"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendBulkTemplatedEmail"
        ]
        Resource = "*"
        # Note: SES permissions are account-wide, not resource-specific
        # The application can only send from verified email addresses
      },
      {
        Sid    = "AllowKMSForSQS"
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.sqs_key.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "sqs.${var.aws_region}.amazonaws.com"
          }
        }
      },
      {
        Sid    = "AllowSESGetAccountSendingEnabled"
        Effect = "Allow"
        Action = [
          "ses:GetAccountSendingEnabled",
          "ses:GetSendQuota",
          "ses:GetSendStatistics"
        ]
        Resource = "*"
      }
    ]
  })
}

# Output the IAM user name and instructions for creating access keys
output "app_iam_user_name" {
  description = "Name of the IAM user for the application"
  value       = aws_iam_user.app_user.name
}

output "app_iam_user_arn" {
  description = "ARN of the IAM user for the application"
  value       = aws_iam_user.app_user.arn
}

output "app_iam_user_access_key_instructions" {
  description = "Instructions for creating access keys for the application IAM user"
  value = <<-EOT
    To create access keys for the application IAM user:
    
    1. Go to AWS IAM Console: https://console.aws.amazon.com/iam/
    2. Navigate to "Users" in the left sidebar
    3. Click on the user: ${aws_iam_user.app_user.name}
    4. Go to the "Security credentials" tab
    5. Scroll down to "Access keys" section
    6. Click "Create access key"
    7. Select "Application running outside AWS" as the use case
    8. Click "Next"
    9. (Optional) Add a description tag
    10. Click "Create access key"
    11. IMPORTANT: Copy both the Access key ID and Secret access key immediately
       - The secret key is only shown once
       - Store these securely (e.g., in your backend .env file)
    
    Use these credentials in your backend .env file:
    AWS_ACCESS_KEY_ID=<access-key-id>
    AWS_SECRET_ACCESS_KEY=<secret-access-key>
    
    DO NOT use your root AWS account credentials!
  EOT
}
