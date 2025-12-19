# SES Configuration Set for email tracking
resource "aws_ses_configuration_set" "email_notifications" {
  name = "${var.project_name}-${var.environment}-email-notifications"

  delivery_options {
    tls_policy = "Require"
  }
}

# SES Event Destination for CloudWatch
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "cloudwatch-destination"
  configuration_set_name = aws_ses_configuration_set.email_notifications.name
  enabled                = true
  matching_types         = ["send", "reject", "bounce", "complaint", "delivery", "open", "click", "renderingFailure"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "MessageTag"
    value_source   = "messageTag"
  }
}

# IAM policy document for SES sending permissions
data "aws_iam_policy_document" "ses_send_email" {
  statement {
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
      "ses:SendBulkTemplatedEmail"
    ]
    resources = ["*"]
  }
}

# Note: Email verification must be done manually in AWS Console
# This resource outputs instructions for manual verification
output "ses_email_verification_instructions" {
  value = <<-EOT
    IMPORTANT: Email verification required
    
    1. Go to AWS SES Console: https://console.aws.amazon.com/ses/
    2. Navigate to "Verified identities"
    3. Click "Create identity"
    4. Select "Email address"
    5. Enter: ${var.ses_from_email}
    6. Click "Create identity"
    7. Check your email and click the verification link
    
    For production, you may also need to:
    - Request production access (move out of SES sandbox)
    - Verify your domain instead of individual email addresses
    - Configure SPF, DKIM, and DMARC records
    
    Configuration Set: ${aws_ses_configuration_set.email_notifications.name}
  EOT
}
