"""
AWS EventBridge Service

Provides EventBridge integration for scheduling notification digest tasks.
Note: EventBridge rules are typically created via AWS Console or Infrastructure as Code,
but this service provides helper functions for rule management.
"""

import os
import orjson
import logging
from typing import Optional, Dict, Any

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logger = logging.getLogger(__name__)


class EventBridgeService:
    """Service for managing AWS EventBridge rules and scheduled tasks."""
    
    def __init__(self):
        """Initialize EventBridge service with credential checking."""
        self.eventbridge_available = self._check_eventbridge_credentials() and BOTO3_AVAILABLE
        self.eventbridge_client = self._create_eventbridge_client() if self.eventbridge_available else None
        
        if self.eventbridge_available:
            logger.info("EventBridge service initialized successfully")
        else:
            logger.warning("EventBridge service unavailable - scheduled tasks will not be configured")
    
    def _check_eventbridge_credentials(self) -> bool:
        """Check if all required EventBridge environment variables are present."""
        required_vars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_REGION'
        ]
        return all(os.getenv(var) for var in required_vars)
    
    def _create_eventbridge_client(self):
        """Create EventBridge client."""
        try:
            return boto3.client(
                'events',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION', 'us-east-1')
            )
        except Exception as e:
            logger.error(f"Failed to create EventBridge client: {e}")
            return None
    
    def create_scheduled_rule(
        self,
        rule_name: str,
        schedule_expression: str,
        target_arn: str,
        input_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Create or update an EventBridge rule for scheduled tasks.
        
        Args:
            rule_name: Name of the rule
            schedule_expression: Cron or rate expression (e.g., 'cron(0 8 * * ? *)' for daily at 8 AM)
            target_arn: ARN of the target (Lambda function, SQS queue, etc.)
            input_data: Optional input data to pass to the target
        
        Returns:
            True if rule was created/updated successfully, False otherwise
        """
        if not self.eventbridge_available or not self.eventbridge_client:
            logger.warning("EventBridge not available - cannot create scheduled rule")
            return False
        
        try:
            # Check if rule exists
            try:
                self.eventbridge_client.describe_rule(Name=rule_name)
                rule_exists = True
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    rule_exists = False
                else:
                    raise
            
            # Create or update rule
            rule_params = {
                'Name': rule_name,
                'ScheduleExpression': schedule_expression,
                'State': 'ENABLED',
                'Description': f'Scheduled task: {rule_name}'
            }
            
            if rule_exists:
                self.eventbridge_client.put_rule(**rule_params)
                logger.info(f"Updated EventBridge rule: {rule_name}")
            else:
                self.eventbridge_client.put_rule(**rule_params)
                logger.info(f"Created EventBridge rule: {rule_name}")
            
        targets = [{
            'Id': '1',
            'Arn': target_arn
        }]

        # Prepare target parameters
        target_params = {
            'Rule': rule_name,
            'Targets': targets
        }
        
        # Add Input if provided (must be JSON string)
        if input_data:
            target_params['Targets'][0]['Input'] = orjson.dumps(input_data).decode('utf-8')
            
        try:
            response = self.eventbridge_client.put_targets(**target_params)
            logger.info(f"Added target to rule: {rule_name} -> {target_arn}")
            
            return True
            
        except ClientError as e:
            logger.error(f"AWS EventBridge error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error creating EventBridge rule: {e}")
            return False
    
    def delete_rule(self, rule_name: str) -> bool:
        """
        Delete an EventBridge rule.
        
        Args:
            rule_name: Name of the rule to delete
        
        Returns:
            True if rule was deleted successfully, False otherwise
        """
        if not self.eventbridge_available or not self.eventbridge_client:
            logger.warning("EventBridge not available - cannot delete rule")
            return False
        
        try:
            # Remove targets first
            targets = self.eventbridge_client.list_targets_by_rule(Rule=rule_name)
            if targets.get('Targets'):
                target_ids = [t['Id'] for t in targets['Targets']]
                self.eventbridge_client.remove_targets(Rule=rule_name, Ids=target_ids)
            
            # Delete rule
            self.eventbridge_client.delete_rule(Name=rule_name)
            logger.info(f"Deleted EventBridge rule: {rule_name}")
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.info(f"Rule {rule_name} does not exist")
                return True
            logger.error(f"AWS EventBridge error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting EventBridge rule: {e}")
            return False
