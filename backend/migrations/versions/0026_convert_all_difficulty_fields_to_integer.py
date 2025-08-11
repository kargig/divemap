"""Convert all difficulty fields from ENUM strings to INTEGER values

This migration converts difficulty_level fields in all tables from 
ENUM('beginner','intermediate','advanced','expert') to INTEGER values
where 1=beginner, 2=intermediate, 3=advanced, 4=expert.

Tables affected:
- dive_sites.difficulty_level
- dives.difficulty_level  
- parsed_dive_trips.trip_difficulty_level

Revision ID: 0026
Revises: 0025
Create Date: 2025-01-11 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '0026'
down_revision = '0025'
branch_labels = None
depends_on = None


def upgrade():
    """Convert all difficulty fields from ENUM strings to INTEGER values."""
    
    # Get database connection
    connection = op.get_bind()
    
    # 1. Convert dive_sites.difficulty_level if needed
    print("Processing dive_sites.difficulty_level...")
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('dive_sites')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], mysql.ENUM):
        print("Converting dive_sites.difficulty_level from ENUM to INTEGER...")
        
        # Add new integer column
        op.add_column('dive_sites', sa.Column('difficulty_level_int', sa.Integer(), nullable=False, server_default='2'))
        
        # Convert values
        connection.execute(sa.text("""
            UPDATE dive_sites 
            SET difficulty_level_int = CASE 
                WHEN difficulty_level = 'beginner' THEN 1
                WHEN difficulty_level = 'intermediate' THEN 2
                WHEN difficulty_level = 'advanced' THEN 3
                WHEN difficulty_level = 'expert' THEN 4
                ELSE 2
            END
        """))
        
        # Drop old column and rename new one using raw SQL
        op.drop_column('dive_sites', 'difficulty_level')
        connection.execute(sa.text("ALTER TABLE dive_sites CHANGE difficulty_level_int difficulty_level INT NOT NULL DEFAULT 2"))
        
        # Add index
        try:
            op.create_index('idx_dive_sites_difficulty_level', 'dive_sites', ['difficulty_level'])
        except Exception:
            pass
    else:
        print("dive_sites.difficulty_level is already an integer or doesn't exist")
    
    # 2. Convert dives.difficulty_level
    print("Processing dives.difficulty_level...")
    columns = inspector.get_columns('dives')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], mysql.ENUM):
        print("Converting dives.difficulty_level from ENUM to INTEGER...")
        
        # Add new integer column
        op.add_column('dives', sa.Column('difficulty_level_int', sa.Integer(), nullable=False, server_default='2'))
        
        # Convert values
        connection.execute(sa.text("""
            UPDATE dives 
            SET difficulty_level_int = CASE 
                WHEN difficulty_level = 'beginner' THEN 1
                WHEN difficulty_level = 'intermediate' THEN 2
                WHEN difficulty_level = 'advanced' THEN 3
                WHEN difficulty_level = 'expert' THEN 4
                ELSE 2
            END
        """))
        
        # Drop old column and rename new one using raw SQL
        op.drop_column('dives', 'difficulty_level')
        connection.execute(sa.text("ALTER TABLE dives CHANGE difficulty_level_int difficulty_level INT NOT NULL DEFAULT 2"))
        
        # Add index
        try:
            op.create_index('idx_dives_difficulty_level', 'dives', ['difficulty_level'])
        except Exception:
            pass
    else:
        print("dives.difficulty_level is already an integer or doesn't exist")
    
    # 3. Convert parsed_dive_trips.trip_difficulty_level
    print("Processing parsed_dive_trips.trip_difficulty_level...")
    columns = inspector.get_columns('parsed_dive_trips')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'trip_difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], mysql.ENUM):
        print("Converting parsed_dive_trips.trip_difficulty_level from ENUM to INTEGER...")
        
        # Add new integer column
        op.add_column('parsed_dive_trips', sa.Column('trip_difficulty_level_int', sa.Integer(), nullable=True, server_default=None))
        
        # Convert values
        connection.execute(sa.text("""
            UPDATE parsed_dive_trips 
            SET trip_difficulty_level_int = CASE 
                WHEN trip_difficulty_level = 'beginner' THEN 1
                WHEN trip_difficulty_level = 'intermediate' THEN 2
                WHEN trip_difficulty_level = 'advanced' THEN 3
                WHEN trip_difficulty_level = 'expert' THEN 4
                ELSE 2
            END
        """))
        
        # Drop old column and rename new one using raw SQL
        op.drop_column('parsed_dive_trips', 'trip_difficulty_level')
        connection.execute(sa.text("ALTER TABLE parsed_dive_trips CHANGE trip_difficulty_level_int trip_difficulty_level INT NULL"))
        
        # Add index
        try:
            op.create_index('idx_parsed_dive_trips_difficulty_level', 'parsed_dive_trips', ['trip_difficulty_level'])
        except Exception:
            pass
    else:
        print("parsed_dive_trips.trip_difficulty_level is already an integer or doesn't exist")


def downgrade():
    """Revert all difficulty fields back to ENUM strings."""
    
    # Get database connection
    connection = op.get_bind()
    
    # 1. Revert dive_sites.difficulty_level
    print("Reverting dive_sites.difficulty_level...")
    inspector = sa.inspect(connection)
    columns = inspector.get_columns('dive_sites')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], sa.Integer):
        print("Converting dive_sites.difficulty_level back to ENUM...")
        
        # Add new ENUM column
        op.add_column('dive_sites', sa.Column('difficulty_level_enum', 
                                            mysql.ENUM('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), 
                                            nullable=False, server_default="'intermediate'"))
        
        # Convert values back
        connection.execute(sa.text("""
            UPDATE dive_sites 
            SET difficulty_level_enum = CASE 
                WHEN difficulty_level = 1 THEN 'beginner'
                WHEN difficulty_level = 2 THEN 'intermediate'
                WHEN difficulty_level = 3 THEN 'advanced'
                WHEN difficulty_level = 4 THEN 'expert'
                ELSE 'intermediate'
            END
        """))
        
        # Drop integer column and rename ENUM column using raw SQL
        op.drop_column('dive_sites', 'difficulty_level')
        connection.execute(sa.text("ALTER TABLE dive_sites CHANGE difficulty_level_enum difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate'"))
        
        # Drop index
        try:
            op.drop_index('idx_dive_sites_difficulty_level', table_name='dive_sites')
        except Exception:
            pass
    else:
        print("dive_sites.difficulty_level is already an ENUM or doesn't exist")
    
    # 2. Revert dives.difficulty_level
    print("Reverting dives.difficulty_level...")
    columns = inspector.get_columns('dives')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], sa.Integer):
        print("Converting dives.difficulty_level back to ENUM...")
        
        # Add new ENUM column
        op.add_column('dives', sa.Column('difficulty_level_enum', 
                                       mysql.ENUM('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), 
                                       nullable=False, server_default="'intermediate'"))
        
        # Convert values back
        connection.execute(sa.text("""
            UPDATE dives 
            SET difficulty_level_enum = CASE 
                WHEN difficulty_level = 1 THEN 'beginner'
                WHEN difficulty_level = 2 THEN 'intermediate'
                WHEN difficulty_level = 3 THEN 'advanced'
                WHEN difficulty_level = 4 THEN 'expert'
                ELSE 'intermediate'
            END
        """))
        
        # Drop integer column and rename ENUM column using raw SQL
        op.drop_column('dives', 'difficulty_level')
        connection.execute(sa.text("ALTER TABLE dives CHANGE difficulty_level_enum difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') NOT NULL DEFAULT 'intermediate'"))
        
        # Drop index
        try:
            op.drop_index('idx_dives_difficulty_level', table_name='dives')
        except Exception:
            pass
    else:
        print("dives.difficulty_level is already an ENUM or doesn't exist")
    
    # 3. Revert parsed_dive_trips.trip_difficulty_level
    print("Reverting parsed_dive_trips.trip_difficulty_level...")
    columns = inspector.get_columns('parsed_dive_trips')
    
    difficulty_column = None
    for col in columns:
        if col['name'] == 'trip_difficulty_level':
            difficulty_column = col
            break
    
    if difficulty_column and isinstance(difficulty_column['type'], sa.Integer):
        print("Converting parsed_dive_trips.trip_difficulty_level back to ENUM...")
        
        # Add new ENUM column
        op.add_column('parsed_dive_trips', sa.Column('trip_difficulty_level_enum', 
                                                   mysql.ENUM('beginner', 'intermediate', 'advanced', 'expert', name='difficultylevel'), 
                                                   nullable=True, server_default=None))
        
        # Convert values back
        connection.execute(sa.text("""
            UPDATE parsed_dive_trips 
            SET trip_difficulty_level_enum = CASE 
                WHEN trip_difficulty_level = 1 THEN 'beginner'
                WHEN trip_difficulty_level = 3 THEN 'advanced'
                WHEN trip_difficulty_level = 4 THEN 'expert'
                ELSE 'intermediate'
            END
        """))
        
        # Drop integer column and rename ENUM column using raw SQL
        op.drop_column('parsed_dive_trips', 'trip_difficulty_level')
        connection.execute(sa.text("ALTER TABLE parsed_dive_trips CHANGE trip_difficulty_level_enum trip_difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert') NULL"))
        
        # Drop index
        try:
            op.drop_index('idx_parsed_dive_trips_difficulty_level', table_name='parsed_dive_trips')
        except Exception:
            pass
    else:
        print("parsed_dive_trips.trip_difficulty_level is already an ENUM or doesn't exist")
