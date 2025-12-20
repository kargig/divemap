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
    
    # Log the full URL being called (without API key for security)
    logger.info(f"Calling backend API: {method} {url}")
    
    try:
        # Prepare request
        req_data = None
        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        
        # Add Cloudflare API token if configured (for bypassing challenges)
        cloudflare_token = os.getenv('CLOUDFLARE_API_TOKEN')
        if cloudflare_token:
            headers["CF-Access-Token"] = cloudflare_token
        
        if data and method in ["PUT", "POST"]:
            req_data = json.dumps(data).encode('utf-8')
        
        # Create request - User-Agent must be set via add_header to override urllib default
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        req.add_header("User-Agent", "Divemap-Lambda-EmailProcessor/1.0")
        
        # Make request
        # Increased timeout to 30 seconds to handle slower backend responses or Cloudflare delays
        with urllib.request.urlopen(req, timeout=30) as response:
            response_data = response.read().decode('utf-8')
            logger.info(f"Backend API response: {response.status} {response.reason}")
            if response_data:
                return json.loads(response_data)
            return {}
            
    except urllib.error.HTTPError as e:
        # Log full error details including response body if available
        error_body = None
        try:
            error_body = e.read().decode('utf-8')
        except:
            pass
        
        logger.error(f"HTTP error calling backend API {url}: {e.code} - {e.reason}")
        if error_body:
            logger.error(f"Error response body: {error_body}")
        
        # 404 is a valid response (notification doesn't exist)
        if e.code == 404:
            return None
        
        # 5xx errors (500, 502, 503, 504) are retryable - raise exception to trigger SQS redelivery
        if e.code >= 500:
            logger.warning(f"Retryable server error {e.code} - will trigger SQS redelivery")
            raise Exception(f"Backend API returned {e.code} {e.reason}: {error_body or 'No error body'}")
        
        # 4xx errors (except 404) are client errors - don't retry
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


def process_email_notification(
    notification_id: int,
    user_email: str,
    notification_data: Dict[str, Any],
    user_id: Optional[int] = None,
    unsubscribe_token: Optional[str] = None
) -> bool:
    """
    Process a single email notification task.
    
    Args:
        notification_id: ID of the notification record
        user_email: Recipient email address
        notification_data: Notification data dict (title, message, link_url, category)
        user_id: Optional user ID (from SQS message, avoids API call)
        unsubscribe_token: Optional unsubscribe token (from SQS message, avoids API call)
    
    Returns:
        True if email was sent successfully, False otherwise
    
    Raises:
        Exception: For retryable errors (5xx) to trigger SQS redelivery
    """
    try:
        # Fetch notification from backend API to check status
        # This may raise Exception for 5xx errors (retryable)
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
        
        # Get user_id and unsubscribe_token from function parameters (from SQS message) or notification
        # Tokens are now included in SQS messages, eliminating the need for Lambda to call the backend API
        final_user_id = user_id or notification_data.get('user_id') or notification.get('user_id')
        final_unsubscribe_token = unsubscribe_token or notification_data.get('unsubscribe_token')
        
        if final_unsubscribe_token:
            logger.debug(f"Using unsubscribe token from SQS message for user {final_user_id}")
        elif final_user_id and template_name not in ['admin_alert', 'email_verification']:
            logger.warning(f"No unsubscribe token found in SQS message for user {final_user_id} - email will be sent without unsubscribe links")
        
        # Send email with unsubscribe token (if available)
        success = email_service.send_notification_email(
            user_email=user_email,
            notification={
                'title': notification_data.get('title', notification.get('title', '')),
                'message': notification_data.get('message', notification.get('message', '')),
                'link_url': notification_data.get('link_url', notification.get('link_url')),
                'category': notification_data.get('category', notification.get('category', ''))
            },
            template_name=template_name,
            user_id=final_user_id,
            db=None,  # Lambda doesn't have database access
            unsubscribe_token=final_unsubscribe_token  # Token from SQS message or API fallback
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
        # Check if this is a retryable error (5xx from backend API)
        error_msg = str(e)
        if "Backend API returned 5" in error_msg or any(code in error_msg for code in ["504", "503", "502", "500"]):
            # Re-raise retryable errors so SQS will redeliver
            logger.warning(f"Retryable error processing notification {notification_id}: {e} - re-raising for SQS redelivery")
            raise
        else:
            # Non-retryable errors - log and return False
            logger.error(f"Non-retryable error processing email notification {notification_id}: {e}")
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
                user_id = body.get('user_id')  # Optional: from SQS message
                unsubscribe_token = body.get('unsubscribe_token')  # Optional: from SQS message
                
                if not all([notification_id, user_email, notification_data]):
                    logger.error(f"Invalid message format: {body}")
                    failure_count += 1
                    continue
                
                # Process email notification
                # If process_email_notification raises an exception (e.g., 5xx errors),
                # we need to re-raise it so SQS will redeliver the message for retry
                try:
                    if process_email_notification(
                        notification_id,
                        user_email,
                        notification_data,
                        user_id=user_id,
                        unsubscribe_token=unsubscribe_token
                    ):
                        success_count += 1
                    else:
                        failure_count += 1
                except Exception as e:
                    # Re-raise retryable errors (5xx) to trigger SQS redelivery
                    # The exception message should indicate if it's retryable
                    error_msg = str(e)
                    if "Backend API returned 5" in error_msg or "504" in error_msg or "503" in error_msg or "502" in error_msg or "500" in error_msg:
                        logger.warning(f"Retryable error for notification {notification_id}: {e} - re-raising to trigger SQS redelivery")
                        raise  # Re-raise to trigger SQS retry
                    else:
                        # Non-retryable errors - log and continue
                        logger.error(f"Non-retryable error processing notification {notification_id}: {e}")
                        failure_count += 1
                    
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message body: {e}")
                failure_count += 1
            except Exception as e:
                # This catches retryable exceptions that were re-raised above
                # Re-raise them so Lambda fails and SQS redelivers
                error_msg = str(e)
                if "Backend API returned 5" in error_msg or "504" in error_msg or "503" in error_msg or "502" in error_msg or "500" in error_msg:
                    logger.error(f"Retryable error - re-raising to trigger SQS redelivery: {e}")
                    raise  # Re-raise to fail Lambda and trigger SQS retry
                else:
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
        # Check if this is a retryable error (5xx from backend API)
        error_msg = str(e)
        if "Backend API returned 5" in error_msg or any(code in error_msg for code in ["504", "503", "502", "500"]):
            # Re-raise retryable errors so Lambda fails and SQS redelivers
            logger.error(f"Lambda handler: Retryable error - re-raising to trigger SQS redelivery: {e}")
            raise  # This will cause Lambda to fail and SQS to retry
        
        # For non-retryable errors, return error response
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
