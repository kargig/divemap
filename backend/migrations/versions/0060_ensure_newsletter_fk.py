"""final_schema_sync

Revision ID: 0060
Revises: 0059
Create Date: 2026-01-10 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = '0060'
down_revision = '0059'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    # ==========================================
    # 1. DATA CLEANUP (Critical for Prod)
    # ==========================================
    # Fix orphaned source_newsletter_id references to prevent IntegrityError 1452
    op.execute("""
        UPDATE parsed_dive_trips pdt
        LEFT JOIN newsletters n ON pdt.source_newsletter_id = n.id
        SET pdt.source_newsletter_id = NULL
        WHERE pdt.source_newsletter_id IS NOT NULL 
        AND n.id IS NULL
    """)

    # ==========================================
    # 2. INDEX NORMALIZATION (API Keys)
    # ==========================================
    # Prod has index named 'key_hash', Models expect 'ix_api_keys_key_hash'
    # Check what exists
    indexes = inspector.get_indexes('api_keys')
    index_names = [idx['name'] for idx in indexes]
    
    # If old prod index exists, drop it
    if 'key_hash' in index_names:
        print("Dropping legacy index 'key_hash' on api_keys")
        op.drop_index('key_hash', table_name='api_keys')
    
    # If new standard index doesn't exist, create it
    if 'ix_api_keys_key_hash' not in index_names:
        print("Creating standard index 'ix_api_keys_key_hash'")
        op.create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)

    # ==========================================
    # 3. FOREIGN KEY STANDARDIZATION
    # ==========================================
    # We want to strictly enforce the models.py definition (ON DELETE CASCADE/SET NULL).
    # Prod has duplicates (some Restrict, some Cascade). Local has single correct ones (usually).
    # Strategy: Drop ALL relevant FKs for the affected columns and recreate THE correct one.
    
    def safe_recreate_fk(table_name, fk_name_base, local_cols, remote_table, remote_cols, ondelete=None):
        # 1. Find existing FKs on this column
        existing_fks = inspector.get_foreign_keys(table_name)
        fks_to_drop = []
        for fk in existing_fks:
            # Check if this FK covers the same local columns
            if fk['constrained_columns'] == local_cols:
                fks_to_drop.append(fk['name'])
        
        # 2. Drop them all
        for fk_name in fks_to_drop:
            print(f"Dropping existing FK {fk_name} on {table_name}")
            op.drop_constraint(fk_name, table_name, type_='foreignkey')
            
        # 3. Create the correct one
        print(f"Creating standardized FK on {table_name}.{local_cols} -> {remote_table}")
        # Let Alembic name it automatically or assume standard naming to match future autogens
        op.create_foreign_key(None, table_name, remote_table, local_cols, remote_cols, ondelete=ondelete)

    # --- Re-apply Constraints ---
    
    # Refresh Tokens: user_id -> CASCADE
    safe_recreate_fk('refresh_tokens', 'refresh_tokens_ibfk', ['user_id'], 'users', ['id'], ondelete='CASCADE')

    # Site Comments: dive_site_id -> CASCADE
    # Note: user_id is standard (restrict/no action) in models, but let's ensure it exists too.
    safe_recreate_fk('site_comments', 'site_comments_ibfk', ['dive_site_id'], 'dive_sites', ['id'], ondelete='CASCADE')
    # We generally leave the user_id FK alone if it's standard, but to be safe vs duplicates in prod:
    safe_recreate_fk('site_comments', 'site_comments_ibfk', ['user_id'], 'users', ['id'], ondelete=None)

    # Site Ratings: dive_site_id -> CASCADE, user_id -> CASCADE
    safe_recreate_fk('site_ratings', 'site_ratings_ibfk', ['dive_site_id'], 'dive_sites', ['id'], ondelete='CASCADE')
    safe_recreate_fk('site_ratings', 'site_ratings_ibfk', ['user_id'], 'users', ['id'], ondelete='CASCADE')

    # Parsed Dive Trips: source_newsletter_id -> SET NULL
    # (This covers the missing FK in both Prod and Local if missing)
    safe_recreate_fk('parsed_dive_trips', 'parsed_dive_trips_ibfk', ['source_newsletter_id'], 'newsletters', ['id'], ondelete='SET NULL')


def downgrade() -> None:
    # Downgrade logic implies rolling back to state at 0059.
    # However, since we destroyed "duplicate" FKs which were arguably valid (just redundant),
    # restoring the exact mess of Prod is hard. We will restore to a "Standard Non-Cascade" state
    # or just remove the added things.
    
    op.drop_constraint(None, 'parsed_dive_trips', type_='foreignkey')
    
    # We don't try to revert index names or duplicate constraints as that was 'drift' we fixed.
