"""
AWS SQS Service

Provides SQS integration for queuing email notification tasks.
Automatically detects AWS credentials and falls back gracefully when unavailable.
"""

import os
import json
import logging
from typing import Optional, Dict, Any

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logger = logging.getLogger(__name__)


class SQSService:
    """Service for sending messages to AWS SQS queue."""
    
    def __init__(self):
        """Initialize SQS service with credential checking."""
        self.sqs_available = self._check_sqs_credentials() and BOTO3_AVAILABLE
        self.sqs_client = self._create_sqs_client() if self.sqs_available else None
        self.queue_url = os.getenv('AWS_SQS_QUEUE_URL')
        
        if self.sqs_available:
            logger.info("SQS service initialized successfully")
        else:
            logger.warning("SQS service unavailable - email notifications will not be queued")
    
    def _check_sqs_credentials(self) -> bool:
        """Check if all required SQS environment variables are present."""
        required_vars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_SQS_QUEUE_URL',
            'AWS_REGION'
        ]
        return all(os.getenv(var) for var in required_vars)
    
    def _create_sqs_client(self):
        """Create SQS client."""
        try:
            return boto3.client(
                'sqs',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION', 'us-east-1')
            )
        except Exception as e:
            logger.error(f"Failed to create SQS client: {e}")
            return None
    
    def send_email_task(self, notification_id: int, user_email: str, notification_data: Dict[str, Any], delay_seconds: int = 0) -> bool:
        """
        Send email notification task to SQS queue.
        
        Args:
            notification_id: ID of the notification record
            user_email: Recipient email address
            notification_data: Notification data (title, message, link_url, etc.)
            delay_seconds: Optional delay before processing (0-900 seconds)
        
        Returns:
            True if message was sent successfully, False otherwise
        """
        if not self.sqs_available or not self.sqs_client:
            logger.warning("SQS not available - cannot queue email task")
            return False
        
        try:
            message_body = {
                'notification_id': notification_id,
                'user_email': user_email,
                'notification': notification_data
            }
            
            response = self.sqs_client.send_message(
                QueueUrl=self.queue_url,
                MessageBody=json.dumps(message_body),
                DelaySeconds=min(delay_seconds, 900)  # SQS max delay is 900 seconds
            )
            
            logger.info(f"Email task queued successfully: MessageId={response.get('MessageId')}")
            return True
            
        except ClientError as e:
            logger.error(f"AWS SQS error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending to SQS: {e}")
            return False
    
    def send_batch_email_tasks(self, tasks: list[Dict[str, Any]], delay_seconds: int = 0) -> int:
        """
        Send multiple email notification tasks to SQS queue in batch.
        
        Args:
            tasks: List of task dictionaries, each with 'notification_id', 'user_email', 'notification'
            delay_seconds: Optional delay before processing (0-900 seconds)
        
        Returns:
            Number of successfully sent messages
        """
        if not self.sqs_available or not self.sqs_client:
            logger.warning("SQS not available - cannot queue email tasks")
            return 0
        
        if not tasks:
            return 0
        
        # SQS batch limit is 10 messages
        batch_size = 10
        success_count = 0
        
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            
            try:
                entries = []
                for idx, task in enumerate(batch):
                    entries.append({
                        'Id': str(i + idx),
                        'MessageBody': json.dumps({
                            'notification_id': task['notification_id'],
                            'user_email': task['user_email'],
                            'notification': task['notification']
                        }),
                        'DelaySeconds': min(delay_seconds, 900)
                    })
                
                response = self.sqs_client.send_message_batch(
                    QueueUrl=self.queue_url,
                    Entries=entries
                )
                
                success_count += len(response.get('Successful', []))
                
                if response.get('Failed'):
                    logger.warning(f"Some messages failed in batch: {response['Failed']}")
                    
            except ClientError as e:
                logger.error(f"AWS SQS batch error: {e}")
            except Exception as e:
                logger.error(f"Unexpected error sending batch to SQS: {e}")
        
        logger.info(f"Queued {success_count}/{len(tasks)} email tasks")
        return success_count
