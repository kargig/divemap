"""add_center_association_to_edit_request_type

Revision ID: 0083
Revises: 0082
Create Date: 2026-04-19 14:43:12.462234

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0083'
down_revision = '0082'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Manual SQL for MySQL ENUM update
    op.execute("""
        ALTER TABLE dive_site_edit_requests 
        MODIFY COLUMN edit_type ENUM(
            'site_data', 
            'media_addition', 
            'media_update', 
            'media_deletion', 
            'tag_addition', 
            'tag_removal', 
            'center_association', 
            'center_removal'
        ) NOT NULL;
    """)


def downgrade() -> None:
    # Revert to original ENUM set
    # Note: This will fail if there are existing records using the new values!
    op.execute("""
        ALTER TABLE dive_site_edit_requests 
        MODIFY COLUMN edit_type ENUM(
            'site_data', 
            'media_addition', 
            'media_update', 
            'media_deletion', 
            'tag_addition', 
            'tag_removal'
        ) NOT NULL;
    """)
