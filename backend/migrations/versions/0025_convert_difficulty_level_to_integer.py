"""Convert difficulty_level field from ENUM strings to INTEGER values

This migration converts the difficulty_level field in the dive_sites table
from ENUM('beginner','intermediate','advanced','expert') to INTEGER values
where 1=beginner, 2=intermediate, 3=advanced, 4=expert.

Revision ID: 0025
Revises: 0024
Create Date: 2025-01-11 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade():
    """Convert difficulty_level from ENUM strings to INTEGER values."""
    
    # Get database connection
    connection = op.get_bind()
    
    # Check if the difficulty_level column exists
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('dive_sites')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column is None:
        # Column doesn't exist, add it as integer
        print("difficulty_level column doesn't exist, adding as integer...")
        op.add_column('dive_sites', sa.Column('difficulty_level', sa.Integer(), nullable=False, server_default='2'))
        op.create_index('idx_dive_sites_difficulty_level', 'dive_sites', ['difficulty_level'])
        return
    
    # Check if the column is already an integer type
    if isinstance(difficulty_column['type'], sa.Integer):
        # Column is already an integer, just ensure it has the right constraints
        print("difficulty_level column is already an integer type, ensuring constraints...")
        
        # Ensure index exists
        try:
            op.create_index('idx_dive_sites_difficulty_level', 'dive_sites', ['difficulty_level'])
        except Exception:
            pass  # Index might already exist
        
        return
    
    # Column is not an integer, need to convert it
    print("Converting difficulty_level from ENUM to INTEGER...")
    
    # Step 1: Add a new integer column for difficulty level
    op.add_column('dive_sites', sa.Column('difficulty_level_new', sa.Integer(), nullable=False, server_default='2'))
    
    # Step 2: Convert existing string values to integers
    # Use raw SQL for the conversion since we need to map specific string values
    connection.execute(sa.text("""
        UPDATE dive_sites 
        SET difficulty_level_new = CASE 
            WHEN difficulty_level = 'beginner' THEN 1
            WHEN difficulty_level = 'intermediate' THEN 2
            WHEN difficulty_level = 'advanced' THEN 3
            WHEN difficulty_level = 'expert' THEN 4
            ELSE 2  -- Default to intermediate for any unexpected values
        END
    """))
    
    # Step 3: Drop the old ENUM column
    op.drop_column('dive_sites', 'difficulty_level')
    
    # Step 4: Rename the new integer column to the original name using raw SQL
    connection.execute(sa.text("ALTER TABLE dive_sites CHANGE difficulty_level_new difficulty_level INT NOT NULL DEFAULT 2"))
    
    # Step 5: Add index for the new integer column
    op.create_index('idx_dive_sites_difficulty_level', 'dive_sites', ['difficulty_level'])


def downgrade():
    """Revert difficulty_level back to ENUM strings."""
    
    # Get database connection
    connection = op.get_bind()
    
    # Check if the difficulty_level column exists
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('dive_sites')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column is None:
        # Column doesn't exist, add it as ENUM
        print("difficulty_level column doesn't exist, adding as ENUM...")
        op.add_column('dive_sites', sa.Column('difficulty_level', 
                                            mysql.ENUM('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), 
                                            nullable=False, server_default="'intermediate'"))
        return
    
    # Check if the column is already an ENUM type
    if isinstance(difficulty_column['type'], mysql.ENUM):
        # Column is already an ENUM, just ensure it has the right constraints
        print("difficulty_level column is already an ENUM type, ensuring constraints...")
        
        # Ensure index is dropped
        try:
            op.drop_index('idx_dive_sites_difficulty_level', table_name='dive_sites')
        except Exception:
            pass  # Index might not exist
        
        return
    
    # Column is not an ENUM, need to convert it back
    print("Converting difficulty_level from INTEGER back to ENUM...")
    
    # Step 1: Add a new ENUM column
    op.add_column('dive_sites', sa.Column('difficulty_level_enum', 
                                        mysql.ENUM('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), 
                                        nullable=False, server_default="'intermediate'"))
    
    # Step 2: Convert integer values back to strings
    connection.execute(sa.text("""
        UPDATE dive_sites 
        SET difficulty_level_enum = CASE 
            WHEN difficulty_level = 1 THEN 'beginner'
            WHEN difficulty_level = 2 THEN 'intermediate'
            WHEN difficulty_level = 3 THEN 'advanced'
            WHEN difficulty_level = 4 THEN 'expert'
            ELSE 'intermediate'  -- Default for any unexpected values
        END
    """))
    
    # Step 3: Drop the integer column
    op.drop_column('dive_sites', 'difficulty_level')
    
    # Step 4: Rename the ENUM column to the original name using raw SQL
    connection.execute(sa.text("ALTER TABLE dive_sites CHANGE difficulty_level_enum difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate'"))
    
    # Step 5: Drop the index
    op.drop_index('idx_dive_sites_difficulty_level', table_name='dive_sites')
