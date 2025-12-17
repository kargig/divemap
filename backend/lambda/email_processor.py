"""
AWS Lambda Function: Email Notification Processor

Processes email notification tasks from SQS queue.
Uses backend API instead of direct database access.
Triggered by SQS events, sends emails via AWS SES.
"""

import json
import os
import logging
from typing import Dict, Any, Optional
import urllib.request
import urllib.error
import urllib.parse

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS SDK imports
try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.error("boto3 not available")

# Email service imports
try:
    import sys
    # Add parent directory to path to import app modules
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.services.email_service import EmailService
    EMAIL_SERVICE_AVAILABLE = True
except Exception as e:
    logger.warning(f"Email service imports not available: {e}")
    EMAIL_SERVICE_AVAILABLE = False


def call_backend_api(endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Optional[Dict]:
    """
    Call backend API endpoint.
    
    Args:
        endpoint: API endpoint path (e.g., "/api/v1/notifications/internal/123")
        method: HTTP method (GET, PUT, POST)
        data: Optional JSON data for PUT/POST requests
    
    Returns:
        Response JSON dict or None if request failed
    """
    backend_url = os.getenv('BACKEND_API_URL')
    api_key = os.getenv('LAMBDA_API_KEY')
    
    if not backend_url:
        logger.error("BACKEND_API_URL environment variable not set")
        return None
    
    if not api_key:
        logger.error("LAMBDA_API_KEY environment variable not set")
        return None
    
    # Construct full URL
    url = f"{backend_url.rstrip('/')}{endpoint}"
    
    try:
        # Prepare request
        req_data = None
        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        
        if data and method in ["PUT", "POST"]:
            req_data = json.dumps(data).encode('utf-8')
        
        # Create request
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        # Make request
        with urllib.request.urlopen(req, timeout=10) as response:
            response_data = response.read().decode('utf-8')
            if response_data:
                return json.loads(response_data)
            return {}
            
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP error calling backend API {endpoint}: {e.code} - {e.reason}")
        if e.code == 404:
            return None  # Not found is a valid response
        return None
    except urllib.error.URLError as e:
        logger.error(f"URL error calling backend API {endpoint}: {e.reason}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response from {endpoint}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error calling backend API {endpoint}: {e}")
        return None


def process_email_notification(notification_id: int, user_email: str, notification_data: Dict[str, Any]) -> bool:
    """
    Process a single email notification task.
    
    Args:
        notification_id: ID of the notification record
        user_email: Recipient email address
        notification_data: Notification data dict (title, message, link_url, category)
    
    Returns:
        True if email was sent successfully, False otherwise
    """
    try:
        # Fetch notification from backend API to check status
        notification = call_backend_api(f"/api/v1/notifications/internal/{notification_id}")
        
        if not notification:
            logger.error(f"Notification {notification_id} not found")
            return False
        
        # Check if email already sent (idempotency)
        if notification.get('email_sent'):
            logger.info(f"Email already sent for notification {notification_id}")
            return True
        
        # Initialize email service
        if not EMAIL_SERVICE_AVAILABLE:
            logger.error("Email service not available")
            return False
        
        email_service = EmailService()
        
        # Determine template name based on category
        template_map = {
            'new_dive_sites': 'new_dive_site',
            'new_dives': 'new_dive',
            'new_diving_centers': 'new_diving_center',
            'new_dive_trips': 'new_dive_trip',
            'admin_alerts': 'admin_alert'
        }
        template_name = template_map.get(notification_data.get('category', ''), 'notification')
        
        # Send email
        success = email_service.send_notification_email(
            user_email=user_email,
            notification={
                'title': notification_data.get('title', notification.get('title', '')),
                'message': notification_data.get('message', notification.get('message', '')),
                'link_url': notification_data.get('link_url', notification.get('link_url')),
                'category': notification_data.get('category', notification.get('category', ''))
            },
            template_name=template_name
        )
        
        if success:
            # Mark email as sent via backend API
            result = call_backend_api(
                f"/api/v1/notifications/internal/{notification_id}/mark-email-sent",
                method="PUT"
            )
            
            if result:
                logger.info(f"Email sent successfully for notification {notification_id}")
                return True
            else:
                logger.warning(f"Email sent but failed to update status for notification {notification_id}")
                # Email was sent, so return True even if status update failed
                return True
        else:
            logger.error(f"Failed to send email for notification {notification_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error processing email notification {notification_id}: {e}")
        return False


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for SQS email notification processing.
    
    Event structure:
    {
        "Records": [
            {
                "body": "{\"notification_id\": 123, \"user_email\": \"...\", \"notification\": {...}}",
                ...
            }
        ]
    }
    """
    success_count = 0
    failure_count = 0
    
    try:
        # Process each SQS record
        for record in event.get('Records', []):
            try:
                # Parse message body
                body = json.loads(record['body'])
                notification_id = body.get('notification_id')
                user_email = body.get('user_email')
                notification_data = body.get('notification')
                
                if not all([notification_id, user_email, notification_data]):
                    logger.error(f"Invalid message format: {body}")
                    failure_count += 1
                    continue
                
                # Process email notification
                if process_email_notification(notification_id, user_email, notification_data):
                    success_count += 1
                else:
                    failure_count += 1
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message body: {e}")
                failure_count += 1
            except Exception as e:
                logger.error(f"Error processing record: {e}")
                failure_count += 1
        
        # Return result
        result = {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Email processing completed',
                'success_count': success_count,
                'failure_count': failure_count,
                'total_processed': success_count + failure_count
            })
        }
        
        logger.info(f"Processed {success_count + failure_count} notifications: {success_count} success, {failure_count} failures")
        return result
        
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'success_count': success_count,
                'failure_count': failure_count
            })
        }


# For local testing
if __name__ == '__main__':
    # Test event structure
    test_event = {
        'Records': [
            {
                'body': json.dumps({
                    'notification_id': 1,
                    'user_email': 'test@example.com',
                    'notification': {
                        'title': 'Test Notification',
                        'message': 'This is a test',
                        'link_url': None,
                        'category': 'new_dive_sites'
                    }
                })
            }
        ]
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
