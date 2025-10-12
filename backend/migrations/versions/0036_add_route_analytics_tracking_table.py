"""add route analytics tracking table

Revision ID: 0036
Revises: 0035
Create Date: 2025-10-12 21:11:46.189949

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0036'
down_revision = '0035'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create route_analytics table
    op.create_table('route_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('route_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('interaction_type', sa.String(length=50), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('referrer', sa.String(length=500), nullable=True),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['route_id'], ['dive_routes.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_route_analytics_id'), 'route_analytics', ['id'], unique=False)
    op.create_index(op.f('ix_route_analytics_route_id'), 'route_analytics', ['route_id'], unique=False)
    op.create_index(op.f('ix_route_analytics_user_id'), 'route_analytics', ['user_id'], unique=False)
    op.create_index(op.f('ix_route_analytics_interaction_type'), 'route_analytics', ['interaction_type'], unique=False)
    op.create_index(op.f('ix_route_analytics_session_id'), 'route_analytics', ['session_id'], unique=False)
    op.create_index(op.f('ix_route_analytics_created_at'), 'route_analytics', ['created_at'], unique=False)


def downgrade() -> None:
    # Drop route_analytics table
    op.drop_index(op.f('ix_route_analytics_created_at'), table_name='route_analytics')
    op.drop_index(op.f('ix_route_analytics_session_id'), table_name='route_analytics')
    op.drop_index(op.f('ix_route_analytics_interaction_type'), table_name='route_analytics')
    op.drop_index(op.f('ix_route_analytics_user_id'), table_name='route_analytics')
    op.drop_index(op.f('ix_route_analytics_route_id'), table_name='route_analytics')
    op.drop_index(op.f('ix_route_analytics_id'), table_name='route_analytics')
    op.drop_table('route_analytics') 