# Dead Letter Queue for failed email notifications
resource "aws_sqs_queue" "email_notifications_dlq" {
  name                      = "${var.project_name}-${var.environment}-${var.dead_letter_queue_name}"
  message_retention_seconds = var.message_retention_seconds

  tags = {
    Name        = "${var.project_name}-${var.environment}-email-notifications-dlq"
    Description = "Dead letter queue for failed email notifications"
  }
}

# Main SQS queue for email notifications
resource "aws_sqs_queue" "email_notifications" {
  name                      = "${var.project_name}-${var.environment}-${var.notification_queue_name}"
  message_retention_seconds = var.message_retention_seconds
  visibility_timeout_seconds = var.visibility_timeout_seconds

  # Redrive policy to send failed messages to DLQ
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_notifications_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  # Enable server-side encryption
  kms_master_key_id                 = aws_kms_key.sqs_key.id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${var.project_name}-${var.environment}-email-notifications"
    Description = "Queue for email notification tasks"
  }
}

# KMS key for SQS encryption
resource "aws_kms_key" "sqs_key" {
  description             = "KMS key for SQS queue encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true

  tags = {
    Name = "${var.project_name}-${var.environment}-sqs-key"
  }
}

resource "aws_kms_alias" "sqs_key_alias" {
  name          = "alias/${var.project_name}-${var.environment}-sqs"
  target_key_id = aws_kms_key.sqs_key.key_id
}

# Queue policy to allow Lambda to receive messages
resource "aws_sqs_queue_policy" "email_notifications_policy" {
  queue_url = aws_sqs_queue.email_notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.email_notifications.arn
      }
    ]
  })
}
