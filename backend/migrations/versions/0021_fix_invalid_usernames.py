"""Fix invalid usernames

Revision ID: 0021
Revises: 0020_add_ownership_requests_table
Create Date: 2025-01-10 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import re


# revision identifiers, used by Alembic.
revision = '0021'
down_revision = '0020_add_ownership_requests_table'
branch_labels = None
depends_on = None


def upgrade():
    """Fix invalid usernames by converting them to valid format"""
    # Get connection
    connection = op.get_bind()
    
    # Get all users with invalid usernames
    result = connection.execute(sa.text("""
        SELECT id, username, email FROM users 
        WHERE username REGEXP '[^a-zA-Z0-9_]'
    """))
    
    users_to_fix = result.fetchall()
    
    for user_id, username, email in users_to_fix:
        # Generate a valid username
        if username and username.strip():
            # Remove special characters and spaces, convert to lowercase
            new_username = re.sub(r'[^a-zA-Z0-9_]', '', username).lower()
            
            # If username is empty after cleaning, use email prefix
            if not new_username:
                new_username = email.split('@')[0].lower()
                new_username = re.sub(r'[^a-zA-Z0-9_]', '', new_username)
            
            # Ensure username is not empty
            if not new_username:
                new_username = f"user_{user_id}"
            
            # Check if username already exists, if so, append user_id
            existing = connection.execute(
                sa.text("SELECT id FROM users WHERE username = :username AND id != :user_id"),
                {"username": new_username, "user_id": user_id}
            ).fetchone()
            
            if existing:
                new_username = f"{new_username}_{user_id}"
            
            # Update the username
            connection.execute(
                sa.text("UPDATE users SET username = :username WHERE id = :user_id"),
                {"username": new_username, "user_id": user_id}
            )
            
            print(f"Fixed username for user {user_id}: '{username}' -> '{new_username}'")


def downgrade():
    """This migration cannot be safely downgraded as it modifies user data"""
    pass 