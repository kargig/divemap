"""
AWS SES Service

Provides email sending via AWS SES with template support.
Automatically detects AWS credentials and falls back gracefully when unavailable.
"""

import os
import orjson
import logging
from typing import Optional, Dict, Any, List
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logger = logging.getLogger(__name__)


class SESService:
    """Service for sending emails via AWS SES."""
    
    def __init__(self):
        """Initialize SES service with credential checking."""
        self.ses_available = self._check_ses_credentials() and BOTO3_AVAILABLE
        self.ses_client = self._create_ses_client() if self.ses_available else None
        # Support both naming conventions (AWS_SES_* and SES_*)
        self.from_email = os.getenv('AWS_SES_FROM_EMAIL') or os.getenv('SES_FROM_EMAIL', 'noreply@divemap.com')
        self.from_name = os.getenv('AWS_SES_FROM_NAME') or os.getenv('SES_FROM_NAME', 'Divemap')
        
        if self.ses_available:
            logger.info("SES service initialized successfully")
        else:
            logger.warning("SES service unavailable - email notifications will not be sent")
    
    def _check_ses_credentials(self) -> bool:
        """
        Check if SES credentials are available.
        
        In Lambda, IAM role credentials are used automatically.
        Outside Lambda, explicit credentials are required.
        """
        # Check if running in Lambda (IAM role credentials available)
        if os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
            # Lambda automatically uses IAM role credentials
            # Just need region (AWS_REGION is set by Lambda automatically)
            return True
        
        # Outside Lambda, require explicit credentials
        required_vars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_REGION'
        ]
        return all(os.getenv(var) for var in required_vars)
    
    def _create_ses_client(self):
        """Create SES client with appropriate credential handling."""
        try:
            # Get region (Lambda sets AWS_REGION automatically)
            region = os.getenv('AWS_REGION', 'us-east-1')
            
            # Check if running in Lambda
            if os.getenv('AWS_LAMBDA_FUNCTION_NAME'):
                # In Lambda: Use IAM role credentials (boto3 does this automatically)
                # Don't pass explicit credentials - let boto3 use IAM role
                logger.info(f"Creating SES client in Lambda environment using IAM role (region: {region})")
                return boto3.client('ses', region_name=region)
            else:
                # Outside Lambda: Use explicit credentials from environment
                access_key = os.getenv('AWS_ACCESS_KEY_ID')
                secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
                
                if not access_key or not secret_key:
                    logger.error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY required outside Lambda")
                    return None
                
                logger.info(f"Creating SES client with explicit credentials (region: {region})")
                return boto3.client(
                    'ses',
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region
                )
        except Exception as e:
            logger.error(f"Failed to create SES client: {e}")
            return None
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """
        Send email via AWS SES.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional, auto-generated from HTML if not provided)
            from_email: Sender email (defaults to AWS_SES_FROM_EMAIL)
            from_name: Sender name (defaults to AWS_SES_FROM_NAME)
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        if not self.ses_available or not self.ses_client:
            logger.warning("SES not available - cannot send email")
            return False
        
        try:
            from_email = from_email or self.from_email
            from_name = from_name or self.from_name
            
            # Create multipart message
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = f"{from_name} <{from_email}>"
            message['To'] = to_email
            
            # Add text part
            if text_body:
                text_part = MIMEText(text_body, 'plain')
                message.attach(text_part)
            
            # Add HTML part
            html_part = MIMEText(html_body, 'html')
            message.attach(html_part)
            
            # Send email via SES
            response = self.ses_client.send_raw_email(
                Source=from_email,
                Destinations=[to_email],
                RawMessage={'Data': message.as_string()}
            )
            
            logger.info(f"Email sent successfully via SES: MessageId={response.get('MessageId')}")
            return True
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            logger.error(f"AWS SES error ({error_code}): {e}")
            
            # Handle common SES errors
            if error_code == 'MessageRejected':
                logger.error("Email rejected by SES - check email address and SES sandbox status")
            elif error_code == 'MailFromDomainNotVerified':
                logger.error("From email domain not verified in SES")
            
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending email via SES: {e}")
            return False
    
    def send_bulk_email(
        self,
        destinations: List[Dict[str, str]],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send bulk emails via AWS SES (up to 50 recipients).
        
        Args:
            destinations: List of dicts with 'email' and optional 'name' keys
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)
            from_email: Sender email (defaults to AWS_SES_FROM_EMAIL)
            from_name: Sender name (defaults to AWS_SES_FROM_NAME)
        
        Returns:
            Dict with 'success_count' and 'failed_count'
        """
        if not self.ses_available or not self.ses_client:
            logger.warning("SES not available - cannot send bulk emails")
            return {'success_count': 0, 'failed_count': len(destinations)}
        
        if not destinations:
            return {'success_count': 0, 'failed_count': 0}
        
        # SES bulk email limit is 50 destinations
        if len(destinations) > 50:
            logger.warning(f"Too many destinations ({len(destinations)}), splitting into batches of 50")
            # Process in batches
            success_count = 0
            failed_count = 0
            
            for i in range(0, len(destinations), 50):
                batch = destinations[i:i + 50]
                result = self.send_bulk_email(batch, subject, html_body, text_body, from_email, from_name)
                success_count += result['success_count']
                failed_count += result['failed_count']
            
            return {'success_count': success_count, 'failed_count': failed_count}
        
        try:
            from_email = from_email or self.from_email
            from_name = from_name or self.from_name
            
            # Prepare destinations for SES
            ses_destinations = []
            for dest in destinations:
                ses_dest = {'Destination': {'ToAddresses': [dest['email']]}}
                if 'name' in dest:
                    ses_dest['Destination']['ToAddresses'] = [f"{dest['name']} <{dest['email']}>"]
                ses_destinations.append(ses_dest)
            
            # Create message
            message = {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                }
            }
            
            if text_body:
                message['Body']['Text'] = {'Data': text_body, 'Charset': 'UTF-8'}
            
            # Send bulk email
            response = self.ses_client.send_bulk_templated_email(
                Source=f"{from_name} <{from_email}>",
                Template='',  # Not using templates for now
                DefaultTemplateData=orjson.dumps({}).decode('utf-8'),
                Destinations=ses_destinations
            )
            
            # Note: SES send_bulk_templated_email requires templates
            # For now, fall back to individual sends
            logger.warning("Bulk email via templates not implemented, falling back to individual sends")
            return self._send_individual_emails(destinations, subject, html_body, text_body, from_email, from_name)
            
        except Exception as e:
            logger.error(f"Error sending bulk email: {e}")
            # Fall back to individual sends
            return self._send_individual_emails(destinations, subject, html_body, text_body, from_email, from_name)
    
    def _send_individual_emails(
        self,
        destinations: List[Dict[str, str]],
        subject: str,
        html_body: str,
        text_body: Optional[str],
        from_email: str,
        from_name: str
    ) -> Dict[str, Any]:
        """Fallback: Send emails individually."""
        success_count = 0
        failed_count = 0
        
        for dest in destinations:
            if self.send_email(dest['email'], subject, html_body, text_body, from_email, from_name):
                success_count += 1
            else:
                failed_count += 1
        
        return {'success_count': success_count, 'failed_count': failed_count}
    
    def verify_email_address(self, email: str) -> bool:
        """
        Verify an email address in SES (for sandbox mode).
        
        Args:
            email: Email address to verify
        
        Returns:
            True if verification request was sent successfully
        """
        if not self.ses_available or not self.ses_client:
            logger.warning("SES not available - cannot verify email")
            return False
        
        try:
            self.ses_client.verify_email_identity(EmailAddress=email)
            logger.info(f"Verification email sent to {email}")
            return True
        except ClientError as e:
            logger.error(f"Error verifying email: {e}")
            return False
