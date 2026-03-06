variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "divemap"
}

variable "notification_queue_name" {
  description = "Name of the SQS queue for email notifications"
  type        = string
  default     = "divemap-email-notifications"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function for email processing"
  type        = string
  default     = "divemap-email-processor"
}

variable "lambda_runtime" {
  description = "Python runtime version for Lambda"
  type        = string
  default     = "python3.11"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 300 # 5 minutes
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
}

variable "backend_api_url" {
  description = "Backend API URL for Lambda to call (e.g., https://api.divemap.com)"
  type        = string
}

variable "lambda_api_key" {
  description = "API key for Lambda to authenticate with backend API"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for bypassing Cloudflare challenges (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ses_from_email" {
  description = "Email address to send notifications from (must be verified in SES)"
  type        = string
}

variable "ses_from_name" {
  description = "Display name for email sender"
  type        = string
  default     = "Divemap"
}

variable "frontend_url" {
  description = "Frontend URL for notification links"
  type        = string
}

variable "dead_letter_queue_name" {
  description = "Name of the DLQ for failed email notifications"
  type        = string
  default     = "divemap-email-notifications-dlq"
}

variable "max_receive_count" {
  description = "Maximum number of times a message can be received before moving to DLQ"
  type        = number
  default     = 3
}

variable "message_retention_seconds" {
  description = "SQS message retention period in seconds (max 14 days)"
  type        = number
  default     = 1209600 # 14 days
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout in seconds (should be >= Lambda timeout)"
  type        = number
  default     = 300 # 5 minutes, matches Lambda timeout
}

variable "enable_daily_digest" {
  description = "Enable daily digest EventBridge rule"
  type        = bool
  default     = true
}

variable "enable_weekly_digest" {
  description = "Enable weekly digest EventBridge rule"
  type        = bool
  default     = true
}

variable "daily_digest_schedule" {
  description = "Cron expression for daily digest (UTC)"
  type        = string
  default     = "cron(0 8 * * ? *)" # 8 AM UTC daily
}

variable "weekly_digest_schedule" {
  description = "Cron expression for weekly digest (UTC)"
  type        = string
  default     = "cron(0 8 ? * MON *)" # 8 AM UTC every Monday
}
