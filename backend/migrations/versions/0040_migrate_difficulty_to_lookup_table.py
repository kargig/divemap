"""Migrate difficulty levels to lookup table

This migration creates a difficulty_levels lookup table and migrates all
difficulty fields from integer columns to foreign keys.

Tables affected:
- dive_sites.difficulty_level → dive_sites.difficulty_id
- dives.difficulty_level → dives.difficulty_id
- parsed_dive_trips.trip_difficulty_level → parsed_dive_trips.trip_difficulty_id

Mapping:
- Integer 1 (beginner) → FK id=1 (OPEN_WATER)
- Integer 2 (intermediate) → FK id=2 (ADVANCED_OPEN_WATER)
- Integer 3 (advanced) → FK id=3 (DEEP_NITROX)
- Integer 4 (expert) → FK id=4 (TECHNICAL_DIVING)

The new columns are nullable to support undefined difficulty.

Revision ID: 0040
Revises: 0039
Create Date: 2025-10-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '0040'
down_revision = '0039'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate difficulty from integer columns to FK lookup table."""
    connection = op.get_bind()
    
    # Step 1: Create difficulty_levels table
    op.create_table(
        'difficulty_levels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('label')
    )
    
    # Step 2: Insert initial rows with IDs 1-4 matching current integer values
    connection.execute(text("""
        INSERT INTO difficulty_levels (id, code, label, order_index) VALUES
        (1, 'OPEN_WATER', 'Open Water', 1),
        (2, 'ADVANCED_OPEN_WATER', 'Advanced Open Water', 2),
        (3, 'DEEP_NITROX', 'Deep/Nitrox', 3),
        (4, 'TECHNICAL_DIVING', 'Technical Diving', 4)
    """))
    
    # Step 3: Add nullable difficulty_id columns (no FK constraint yet)
    # dive_sites
    op.add_column('dive_sites', sa.Column('difficulty_id', sa.Integer(), nullable=True))
    
    # dives
    op.add_column('dives', sa.Column('difficulty_id', sa.Integer(), nullable=True))
    
    # parsed_dive_trips
    op.add_column('parsed_dive_trips', sa.Column('trip_difficulty_id', sa.Integer(), nullable=True))
    
    # Step 4: Backfill FK ids from existing integer values
    # Direct mapping: integer 1→FK id=1, 2→2, 3→3, 4→4
    connection.execute(text("""
        UPDATE dive_sites
        SET difficulty_id = difficulty_level
        WHERE difficulty_level IN (1, 2, 3, 4)
    """))
    
    connection.execute(text("""
        UPDATE dives
        SET difficulty_id = difficulty_level
        WHERE difficulty_level IN (1, 2, 3, 4)
    """))
    
    connection.execute(text("""
        UPDATE parsed_dive_trips
        SET trip_difficulty_id = trip_difficulty_level
        WHERE trip_difficulty_level IN (1, 2, 3, 4)
    """))
    
    # Step 5: Add indexes before FK constraints
    op.create_index('idx_dive_sites_difficulty_id', 'dive_sites', ['difficulty_id'])
    op.create_index('idx_dives_difficulty_id', 'dives', ['difficulty_id'])
    op.create_index('idx_parsed_dive_trips_difficulty_id', 'parsed_dive_trips', ['trip_difficulty_id'])
    
    # Step 6: Add FK constraints (ON DELETE SET NULL to handle cascade gracefully)
    op.create_foreign_key(
        'fk_dive_sites_difficulty_id',
        'dive_sites', 'difficulty_levels',
        ['difficulty_id'], ['id'],
        ondelete='SET NULL'
    )
    
    op.create_foreign_key(
        'fk_dives_difficulty_id',
        'dives', 'difficulty_levels',
        ['difficulty_id'], ['id'],
        ondelete='SET NULL'
    )
    
    op.create_foreign_key(
        'fk_parsed_dive_trips_difficulty_id',
        'parsed_dive_trips', 'difficulty_levels',
        ['trip_difficulty_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Step 7: Drop old integer columns
    # First drop indexes on old columns
    try:
        op.drop_index('idx_dive_sites_difficulty_level', table_name='dive_sites')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_difficulty_level', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_parsed_dive_trips_difficulty_level', table_name='parsed_dive_trips')
    except Exception:
        pass
    
    # Drop the columns
    op.drop_column('dive_sites', 'difficulty_level')
    op.drop_column('dives', 'difficulty_level')
    op.drop_column('parsed_dive_trips', 'trip_difficulty_level')


def downgrade() -> None:
    """Revert difficulty back to integer columns."""
    connection = op.get_bind()
    
    # Step 1: Add back integer columns with NOT NULL and defaults for dive_sites and dives
    op.add_column('dive_sites', sa.Column('difficulty_level', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('dives', sa.Column('difficulty_level', sa.Integer(), nullable=False, server_default='2'))
    op.add_column('parsed_dive_trips', sa.Column('trip_difficulty_level', sa.Integer(), nullable=True))
    
    # Step 2: Backfill integer values from FK ids (1→1, 2→2, 3→3, 4→4)
    connection.execute(text("""
        UPDATE dive_sites
        SET difficulty_level = difficulty_id
        WHERE difficulty_id IN (1, 2, 3, 4)
    """))
    
    # Set default for any NULL values that might exist
    connection.execute(text("""
        UPDATE dive_sites
        SET difficulty_level = 2
        WHERE difficulty_id IS NULL
    """))
    
    connection.execute(text("""
        UPDATE dives
        SET difficulty_level = difficulty_id
        WHERE difficulty_id IN (1, 2, 3, 4)
    """))
    
    connection.execute(text("""
        UPDATE dives
        SET difficulty_level = 2
        WHERE difficulty_id IS NULL
    """))
    
    connection.execute(text("""
        UPDATE parsed_dive_trips
        SET trip_difficulty_level = trip_difficulty_id
        WHERE trip_difficulty_id IN (1, 2, 3, 4)
    """))
    # parsed_dive_trips can remain NULL, so no default needed
    
    # Step 3: Drop FK constraints
    try:
        op.drop_constraint('fk_dive_sites_difficulty_id', 'dive_sites', type_='foreignkey')
    except Exception:
        pass
    
    try:
        op.drop_constraint('fk_dives_difficulty_id', 'dives', type_='foreignkey')
    except Exception:
        pass
    
    try:
        op.drop_constraint('fk_parsed_dive_trips_difficulty_id', 'parsed_dive_trips', type_='foreignkey')
    except Exception:
        pass
    
    # Step 4: Drop indexes on FK columns
    try:
        op.drop_index('idx_dive_sites_difficulty_id', table_name='dive_sites')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_dives_difficulty_id', table_name='dives')
    except Exception:
        pass
    
    try:
        op.drop_index('idx_parsed_dive_trips_difficulty_id', table_name='parsed_dive_trips')
    except Exception:
        pass
    
    # Step 5: Drop FK columns
    op.drop_column('dive_sites', 'difficulty_id')
    op.drop_column('dives', 'difficulty_id')
    op.drop_column('parsed_dive_trips', 'trip_difficulty_id')
    
    # Step 6: Recreate indexes on integer columns
    op.create_index('idx_dive_sites_difficulty_level', 'dive_sites', ['difficulty_level'])
    op.create_index('idx_dives_difficulty_level', 'dives', ['difficulty_level'])
    op.create_index('idx_parsed_dive_trips_difficulty_level', 'parsed_dive_trips', ['trip_difficulty_level'])
    
    # Step 7: Drop difficulty_levels table
    op.drop_table('difficulty_levels')

