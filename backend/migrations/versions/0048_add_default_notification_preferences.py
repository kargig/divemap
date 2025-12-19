"""Add default notification preferences for existing users

Create default notification preferences for all existing users:
- new_dive_sites (website enabled, email disabled)
- new_dive_trips (website enabled, email disabled)
- admin_alerts (website enabled, email disabled)

These are the default categories that should be enabled for all users.
Other categories (new_dives, new_diving_centers) remain opt-in.

Revision ID: 0048
Revises: 0047
Create Date: 2025-12-17 00:13:13.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '0048'
down_revision = '0047'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create default notification preferences for all existing users."""
    
    # Default categories to enable for all users
    default_categories = ['new_dive_sites', 'new_dive_trips', 'admin_alerts']
    
    # Get connection
    connection = op.get_bind()
    
    # Get all user IDs
    result = connection.execute(text("SELECT id FROM users"))
    user_ids = [row[0] for row in result]
    
    # Create default preferences for each user
    for user_id in user_ids:
        for category in default_categories:
            # Check if preference already exists
            check_result = connection.execute(
                text("""
                    SELECT id FROM notification_preferences 
                    WHERE user_id = :user_id AND category = :category
                """),
                {'user_id': user_id, 'category': category}
            )
            
            if check_result.first():
                continue  # Skip if already exists
            
            # Insert default preference
            connection.execute(
                text("""
                    INSERT INTO notification_preferences 
                    (user_id, category, enable_website, enable_email, frequency, area_filter, created_at, updated_at)
                    VALUES 
                    (:user_id, :category, 1, 0, 'immediate', NULL, NOW(), NOW())
                """),
                {'user_id': user_id, 'category': category}
            )
    
    # Commit the transaction
    connection.commit()


def downgrade() -> None:
    """Remove default notification preferences (only the ones created by this migration)."""
    
    # Note: This is a destructive operation that removes default preferences
    # We only remove preferences that match the default pattern:
    # - Categories: new_dive_sites, new_dive_trips, admin_alerts
    # - enable_website = True, enable_email = False, frequency = 'immediate', area_filter = NULL
    
    connection = op.get_bind()
    
    default_categories = ['new_dive_sites', 'new_dive_trips', 'admin_alerts']
    
    for category in default_categories:
        connection.execute(
            text("""
                DELETE FROM notification_preferences 
                WHERE category = :category 
                AND enable_website = 1 
                AND enable_email = 0 
                AND frequency = 'immediate' 
                AND area_filter IS NULL
            """),
            {'category': category}
        )
    
    connection.commit()
