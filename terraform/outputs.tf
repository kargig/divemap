output "sqs_queue_url" {
  description = "URL of the SQS queue for email notifications"
  value       = aws_sqs_queue.email_notifications.url
}

output "sqs_queue_arn" {
  description = "ARN of the SQS queue for email notifications"
  value       = aws_sqs_queue.email_notifications.arn
}

output "sqs_dlq_url" {
  description = "URL of the dead letter queue"
  value       = aws_sqs_queue.email_notifications_dlq.url
}

output "sqs_dlq_arn" {
  description = "ARN of the dead letter queue"
  value       = aws_sqs_queue.email_notifications_dlq.arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.email_processor.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.email_processor.arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_email_processor.arn
}

output "ses_configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = aws_ses_configuration_set.email_notifications.name
}

output "kms_key_id" {
  description = "ID of the KMS key for SQS encryption"
  value       = aws_kms_key.sqs_key.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key for SQS encryption"
  value       = aws_kms_key.sqs_key.arn
}

output "daily_digest_rule_arn" {
  description = "ARN of the daily digest EventBridge rule"
  value       = var.enable_daily_digest ? aws_cloudwatch_event_rule.daily_digest[0].arn : null
}

output "weekly_digest_rule_arn" {
  description = "ARN of the weekly digest EventBridge rule"
  value       = var.enable_weekly_digest ? aws_cloudwatch_event_rule.weekly_digest[0].arn : null
}

output "environment_variables" {
  description = "Environment variables to set in backend application"
  value = {
    AWS_SQS_QUEUE_URL  = aws_sqs_queue.email_notifications.url
    AWS_REGION         = var.aws_region
    AWS_SES_FROM_EMAIL = var.ses_from_email
    AWS_SES_FROM_NAME  = var.ses_from_name
    FRONTEND_URL       = var.frontend_url
    LAMBDA_API_KEY     = "Set this manually - same value as in terraform.tfvars"
  }
  sensitive = false
}

output "backend_api_url" {
  description = "Backend API URL (should match BACKEND_API_URL in terraform.tfvars)"
  value       = var.backend_api_url
}
