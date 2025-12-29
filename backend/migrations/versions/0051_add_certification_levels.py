"""add_certification_levels

Revision ID: 0051
Revises: 0050
Create Date: 2025-12-29 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0051'
down_revision = '0050'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create certification_levels table
    op.create_table('certification_levels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diving_organization_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('max_depth', sa.String(length=50), nullable=True),
        sa.Column('gases', sa.String(length=255), nullable=True),
        sa.Column('tanks', sa.String(length=255), nullable=True),
        sa.Column('prerequisites', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['diving_organization_id'], ['diving_organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_certification_levels_diving_organization_id'), 'certification_levels', ['diving_organization_id'], unique=False)
    op.create_index(op.f('ix_certification_levels_id'), 'certification_levels', ['id'], unique=False)
    
    # Update user_certifications table
    op.add_column('user_certifications', sa.Column('certification_level_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_user_certifications_certification_level_id'), 'user_certifications', ['certification_level_id'], unique=False)
    op.create_foreign_key('fk_user_certifications_certification_level_id', 'user_certifications', 'certification_levels', ['certification_level_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_user_certifications_certification_level_id', 'user_certifications', type_='foreignkey')
    op.drop_index(op.f('ix_user_certifications_certification_level_id'), table_name='user_certifications')
    op.drop_column('user_certifications', 'certification_level_id')
    
    op.drop_index(op.f('ix_certification_levels_id'), table_name='certification_levels')
    op.drop_index(op.f('ix_certification_levels_diving_organization_id'), table_name='certification_levels')
    op.drop_table('certification_levels')
