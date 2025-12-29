"""populate_certification_levels

Revision ID: 0052
Revises: 0051
Create Date: 2025-12-29 16:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
import json
import os

# revision identifiers, used by Alembic.
revision = '0052'
down_revision = '0051'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Define tables
    diving_organizations = sa.table('diving_organizations',
        sa.column('id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('acronym', sa.String),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime)
    )

    certification_levels = sa.table('certification_levels',
        sa.column('id', sa.Integer),
        sa.column('diving_organization_id', sa.Integer),
        sa.column('name', sa.String),
        sa.column('category', sa.String),
        sa.column('max_depth', sa.String),
        sa.column('gases', sa.String),
        sa.column('tanks', sa.String),
        sa.column('prerequisites', sa.Text),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime)
    )

    # Load data
    # Path relative to backend/migrations/versions/
    json_path = os.path.join(os.path.dirname(__file__), '../../diving_certifications_data.json')
    
    if not os.path.exists(json_path):
        # Fallback to absolute path in container
        json_path = '/app/diving_certifications_data.json'

    if not os.path.exists(json_path):
        print(f"Warning: Data file not found at {json_path}. Skipping data population.")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    for org_data in data:
        # Check if org exists
        existing_org = session.query(diving_organizations).filter_by(acronym=org_data['acronym']).first()
        
        if existing_org:
            org_id = existing_org.id
        else:
            # Insert org
            result = bind.execute(
                diving_organizations.insert().values(
                    name=org_data['name'],
                    acronym=org_data['acronym'],
                    created_at=sa.func.now(),
                    updated_at=sa.func.now()
                )
            )
            org_id = result.lastrowid

        # Insert certification levels
        for cert in org_data['certifications']:
            # Check if exists to avoid duplicates
            exists = session.query(certification_levels).filter_by(
                diving_organization_id=org_id,
                name=cert['name']
            ).first()

            if not exists:
                bind.execute(
                    certification_levels.insert().values(
                        diving_organization_id=org_id,
                        name=cert['name'],
                        category=cert.get('category'),
                        max_depth=cert.get('max_depth'),
                        gases=cert.get('gases'),
                        tanks=cert.get('tanks'),
                        prerequisites=cert.get('prerequisites'),
                        created_at=sa.func.now(),
                        updated_at=sa.func.now()
                    )
                )
    
    session.commit()


def downgrade() -> None:
    pass