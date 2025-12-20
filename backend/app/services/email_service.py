"""
Email Service

Provides email sending via AWS SES with Jinja2 template rendering.
Handles notification emails with HTML and plain text templates.
"""

import os
import logging
from typing import Optional, Dict, Any, TYPE_CHECKING
from pathlib import Path
from datetime import datetime

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    JINJA2_AVAILABLE = True
except ImportError:
    JINJA2_AVAILABLE = False

from app.services.ses_service import SESService

# Optional imports for database-dependent methods
try:
    from app.models import EmailConfig
    from sqlalchemy.orm import Session
    DB_AVAILABLE = True
except ImportError:
    EmailConfig = None
    Session = None
    DB_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending notification emails via AWS SES with template rendering."""
    
    def __init__(self):
        """Initialize email service with SES and template engine."""
        self.ses_service = SESService()
        self.template_env = self._create_template_env() if JINJA2_AVAILABLE else None
        
        if not JINJA2_AVAILABLE:
            logger.warning("Jinja2 not available - email templates will not be rendered")
    
    def _create_template_env(self):
        """Create Jinja2 template environment."""
        try:
            template_dir = Path(__file__).parent.parent / 'templates' / 'emails'
            template_dir.mkdir(parents=True, exist_ok=True)
            
            env = Environment(
                loader=FileSystemLoader(str(template_dir)),
                autoescape=select_autoescape(['html', 'xml'])
            )
            return env
        except Exception as e:
            logger.error(f"Failed to create template environment: {e}")
            return None
    
    def _render_template(self, template_name: str, context: Dict[str, Any], extension: str = 'html') -> Optional[str]:
        """
        Render email template with context.
        
        Args:
            template_name: Name of template (without extension)
            context: Template context variables
            extension: Template file extension ('html' or 'txt')
        
        Returns:
            Rendered template string or None if rendering fails
        """
        if not self.template_env:
            logger.error("Template environment not available")
            return None
        
        try:
            template = self.template_env.get_template(f"{template_name}.{extension}")
            return template.render(**context)
        except Exception as e:
            logger.error(f"Failed to render template {template_name}.{extension}: {e}")
            return None
    
    def send_notification_email(
        self,
        user_email: str,
        notification: Dict[str, Any],
        template_name: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """
        Send notification email using template.
        
        Args:
            user_email: Recipient email address
            notification: Notification data dict with title, message, link_url, etc.
            template_name: Name of template to use (without extension)
            from_email: Sender email (optional, uses SES default)
            from_name: Sender name (optional, uses SES default)
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        # Prepare template context
        context = {
            'notification': notification,
            'user_email': user_email,
            'site_name': 'Divemap',
            'site_url': os.getenv('FRONTEND_URL', 'https://divemap.com'),
            'current_year': datetime.now().year
        }
        
        # Render HTML template
        html_body = self._render_template(template_name, context, 'html')
        if not html_body:
            logger.error(f"Failed to render HTML template: {template_name}")
            return False
        
        # Render text template (fallback to HTML if text template doesn't exist)
        text_body = self._render_template(template_name, context, 'txt')
        if not text_body:
            # Generate basic text version from HTML
            import re
            text_body = re.sub(r'<[^>]+>', '', html_body)  # Strip HTML tags
            text_body = re.sub(r'\n\s*\n', '\n\n', text_body)  # Normalize whitespace
        
        # Send email via SES
        subject = notification.get('title', 'Notification from Divemap')
        return self.ses_service.send_email(
            to_email=user_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_email=from_email,
            from_name=from_name
        )
    
    def send_digest_email(
        self,
        user_email: str,
        notifications: list[Dict[str, Any]],
        frequency: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """
        Send digest email with multiple notifications.
        
        Args:
            user_email: Recipient email address
            notifications: List of notification dicts
            frequency: 'daily_digest' or 'weekly_digest'
            from_email: Sender email (optional)
            from_name: Sender name (optional)
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        # Prepare template context
        context = {
            'notifications': notifications,
            'user_email': user_email,
            'frequency': frequency,
            'count': len(notifications),
            'site_name': 'Divemap',
            'site_url': os.getenv('FRONTEND_URL', 'https://divemap.com'),
            'current_year': datetime.now().year
        }
        
        # Render HTML template
        html_body = self._render_template(frequency, context, 'html')
        if not html_body:
            logger.error(f"Failed to render HTML template: {frequency}")
            return False
        
        # Render text template
        text_body = self._render_template(frequency, context, 'txt')
        if not text_body:
            import re
            text_body = re.sub(r'<[^>]+>', '', html_body)
            text_body = re.sub(r'\n\s*\n', '\n\n', text_body)
        
        # Determine subject based on frequency
        if frequency == 'daily_digest':
            subject = f"Your Daily Divemap Digest - {len(notifications)} new notifications"
        else:
            subject = f"Your Weekly Divemap Digest - {len(notifications)} new notifications"
        
        return self.ses_service.send_email(
            to_email=user_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_email=from_email,
            from_name=from_name
        )
    
    def send_verification_email(
        self,
        user_email: str,
        verification_token: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> bool:
        """
        Send email verification email with verification link.
        
        Args:
            user_email: Recipient email address
            verification_token: Verification token to include in link
            from_email: Sender email (optional, uses SES default)
            from_name: Sender name (optional, uses SES default)
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        # Build verification link - should point to backend API endpoint
        # The backend will then redirect to frontend with success/error parameters
        # Use FRONTEND_URL as base since nginx proxies both frontend and backend
        base_url = os.getenv('FRONTEND_URL', 'http://localhost')
        # Remove trailing slash if present
        base_url = base_url.rstrip('/')
        verification_link = f"{base_url}/api/v1/auth/verify-email?token={verification_token}"
        
        # Get token expiry hours from env
        expiry_hours = int(os.getenv("EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS", "24"))
        
        # Get frontend URL for site_url in template
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost')
        
        # Prepare template context
        context = {
            'verification_link': verification_link,
            'user_email': user_email,
            'expires_in_hours': expiry_hours,
            'site_name': 'Divemap',
            'site_url': frontend_url,
            'current_year': datetime.now().year
        }
        
        # Render HTML template
        html_body = self._render_template('email_verification', context, 'html')
        if not html_body:
            logger.error("Failed to render HTML template: email_verification")
            return False
        
        # Render text template
        text_body = self._render_template('email_verification', context, 'txt')
        if not text_body:
            # Generate basic text version from HTML
            import re
            text_body = re.sub(r'<[^>]+>', '', html_body)  # Strip HTML tags
            text_body = re.sub(r'\n\s*\n', '\n\n', text_body)  # Normalize whitespace
        
        # Send email via SES
        subject = "Verify your email address - Divemap"
        return self.ses_service.send_email(
            to_email=user_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_email=from_email,
            from_name=from_name
        )
    
    def get_email_config(self, db: Optional[Session] = None) -> Optional[Any]:
        """
        Get active email configuration from database.
        
        Args:
            db: Database session (optional, only needed if DB_AVAILABLE)
        
        Returns:
            EmailConfig instance or None if not found or DB not available
        """
        if not DB_AVAILABLE or not db:
            logger.warning("Database not available - get_email_config not supported")
            return None
        try:
            return db.query(EmailConfig).filter(EmailConfig.is_active == True).first()
        except Exception as e:
            logger.error(f"Error fetching email config: {e}")
            return None
    
    def test_email_connection(self, config: Optional[Any] = None) -> bool:
        """
        Test email configuration by sending a test email.
        
        Note: This is for SMTP testing. For AWS SES, we use SES verification instead.
        
        Args:
            config: EmailConfig instance (optional, not used for SES)
        
        Returns:
            True if test email was sent successfully
        """
        # For AWS SES, we don't need SMTP connection testing
        # Instead, we can verify the SES email address
        logger.info("AWS SES doesn't require SMTP connection testing")
        logger.info("Use SES verify_email_address() to verify email addresses in sandbox mode")
        return True
