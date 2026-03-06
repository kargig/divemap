# IAM role for EventBridge to invoke Lambda (for digest generation)
resource "aws_iam_role" "eventbridge_lambda_invoke" {
  name = "${var.project_name}-${var.environment}-eventbridge-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-eventbridge-lambda-role"
  }
}

# IAM policy for EventBridge to invoke Lambda
resource "aws_iam_role_policy" "eventbridge_lambda_invoke" {
  name = "${var.project_name}-${var.environment}-eventbridge-lambda-invoke"
  role = aws_iam_role.eventbridge_lambda_invoke.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = aws_lambda_function.email_processor.arn
      }
    ]
  })
}

# EventBridge rule for daily digest generation
resource "aws_cloudwatch_event_rule" "daily_digest" {
  count       = var.enable_daily_digest ? 1 : 0
  name        = "${var.project_name}-${var.environment}-daily-digest"
  description = "Trigger daily digest email generation"

  schedule_expression = var.daily_digest_schedule

  tags = {
    Name = "${var.project_name}-${var.environment}-daily-digest-rule"
  }
}

# EventBridge target for daily digest (invokes backend API endpoint)
# Note: This assumes you have an API endpoint for digest generation
# You may need to create a separate Lambda or use API Gateway
resource "aws_cloudwatch_event_target" "daily_digest_target" {
  count     = var.enable_daily_digest ? 1 : 0
  rule      = aws_cloudwatch_event_rule.daily_digest[0].name
  target_id = "DailyDigestTarget"
  arn       = aws_lambda_function.email_processor.arn

  input = jsonencode({
    action = "generate_daily_digest"
  })
}

# EventBridge rule for weekly digest generation
resource "aws_cloudwatch_event_rule" "weekly_digest" {
  count       = var.enable_weekly_digest ? 1 : 0
  name        = "${var.project_name}-${var.environment}-weekly-digest"
  description = "Trigger weekly digest email generation"

  schedule_expression = var.weekly_digest_schedule

  tags = {
    Name = "${var.project_name}-${var.environment}-weekly-digest-rule"
  }
}

# EventBridge target for weekly digest
resource "aws_cloudwatch_event_target" "weekly_digest_target" {
  count     = var.enable_weekly_digest ? 1 : 0
  rule      = aws_cloudwatch_event_rule.weekly_digest[0].name
  target_id = "WeeklyDigestTarget"
  arn       = aws_lambda_function.email_processor.arn

  input = jsonencode({
    action = "generate_weekly_digest"
  })
}

# Permission for EventBridge to invoke Lambda
resource "aws_lambda_permission" "allow_eventbridge_daily" {
  count         = var.enable_daily_digest ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridgeDaily"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_digest[0].arn
}

resource "aws_lambda_permission" "allow_eventbridge_weekly" {
  count         = var.enable_weekly_digest ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridgeWeekly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_digest[0].arn
}
