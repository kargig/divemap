"""create octo core booking models

Revision ID: 0095
Revises: 0094
Create Date: 2026-09-27 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0095'
down_revision = '0094'
branch_labels = None
depends_on = None

def upgrade():
    # 1. DivingCenterBookingSettings
    op.create_table(
        'diving_center_booking_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('is_booking_enabled', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('default_currency', sa.String(length=3), server_default='EUR', nullable=False),
        sa.Column('payment_mode', sa.String(length=30), server_default='PAY_ON_ARRIVAL', nullable=False),
        sa.Column('deposit_percentage', sa.DECIMAL(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('default_agency_bundle', sa.String(length=50), server_default='UNIVERSAL_DMSC', nullable=False),
        sa.Column('preferred_unit_system', sa.String(length=10), server_default='METRIC', nullable=False),
        sa.Column('preferred_shoe_system', sa.String(length=10), server_default='EU', nullable=False),
        sa.Column('hold_duration_minutes', sa.Integer(), server_default='20', nullable=False),
        sa.Column('briefing_lead_hours', sa.Integer(), server_default='24', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('diving_center_id', name='uq_center_booking_settings_center_id')
    )
    op.create_index(op.f('ix_diving_center_booking_settings_id'), 'diving_center_booking_settings', ['id'], unique=False)
    op.create_index(op.f('ix_diving_center_booking_settings_diving_center_id'), 'diving_center_booking_settings', ['diving_center_id'], unique=True)

    # 2. DivingCenterVessel
    op.create_table(
        'diving_center_vessels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('registration_number', sa.String(length=100), nullable=True),
        sa.Column('port_of_registry', sa.String(length=100), nullable=True),
        sa.Column('call_sign', sa.String(length=50), nullable=True),
        sa.Column('licensed_capacity', sa.Integer(), server_default='12', nullable=False),
        sa.Column('has_emergency_oxygen', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('has_first_aid_kit', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('has_vhf_radio', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('has_lifejackets', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('has_liferaft', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_diving_center_vessels_id'), 'diving_center_vessels', ['id'], unique=False)
    op.create_index(op.f('ix_diving_center_vessels_diving_center_id'), 'diving_center_vessels', ['diving_center_id'], unique=False)

    # 3. OctoProduct
    op.create_table(
        'octo_products',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('dive_site_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('product_type', sa.String(length=50), server_default='GUIDED_BOAT_TRIP', nullable=False),
        sa.Column('agency_code', sa.String(length=50), nullable=True),
        sa.Column('waiver_bundle_id', sa.String(length=50), server_default='dmsc_recreational', nullable=False),
        sa.Column('min_certification_level_id', sa.Integer(), nullable=True),
        sa.Column('min_logged_dives', sa.Integer(), server_default='0', nullable=False),
        sa.Column('max_depth_meters', sa.DECIMAL(precision=5, scale=2), nullable=True),
        sa.Column('min_participants', sa.Integer(), server_default='1', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dive_site_id'], ['dive_sites.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['min_certification_level_id'], ['certification_levels.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_octo_products_diving_center_id'), 'octo_products', ['diving_center_id'], unique=False)
    op.create_index(op.f('ix_octo_products_dive_site_id'), 'octo_products', ['dive_site_id'], unique=False)

    # 4. OctoOption
    op.create_table(
        'octo_options',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('meeting_time', sa.Time(), nullable=False),
        sa.Column('departure_time', sa.Time(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), server_default='240', nullable=False),
        sa.Column('max_capacity', sa.Integer(), server_default='12', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['octo_products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_octo_options_product_id'), 'octo_options', ['product_id'], unique=False)

    # 5. OctoUnit
    op.create_table(
        'octo_units',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('unit_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('retail_price', sa.DECIMAL(precision=10, scale=2), nullable=False),
        sa.Column('net_price', sa.DECIMAL(precision=10, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=3), server_default='EUR', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['octo_products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_octo_units_product_id'), 'octo_units', ['product_id'], unique=False)

    # 6. OctoAvailabilitySlot
    op.create_table(
        'octo_availability_slots',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('option_id', sa.String(length=36), nullable=False),
        sa.Column('vessel_id', sa.Integer(), nullable=True),
        sa.Column('assigned_guide_user_ids', sa.JSON(), nullable=True),
        sa.Column('start_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_datetime', sa.DateTime(timezone=True), nullable=False),
        sa.Column('seats_total', sa.Integer(), nullable=False),
        sa.Column('seats_available', sa.Integer(), nullable=False),
        sa.Column('is_closed', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['octo_products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['octo_options.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vessel_id'], ['diving_center_vessels.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_octo_availability_slots_product_id'), 'octo_availability_slots', ['product_id'], unique=False)
    op.create_index(op.f('ix_octo_availability_slots_option_id'), 'octo_availability_slots', ['option_id'], unique=False)
    op.create_index(op.f('ix_octo_availability_slots_start_datetime'), 'octo_availability_slots', ['start_datetime'], unique=False)

    # 7. OctoBooking
    op.create_table(
        'octo_bookings',
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('diving_center_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.String(length=36), nullable=False),
        sa.Column('option_id', sa.String(length=36), nullable=False),
        sa.Column('availability_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('contact_full_name', sa.String(length=255), nullable=True),
        sa.Column('contact_email', sa.String(length=255), nullable=True),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='ON_HOLD', nullable=False),
        sa.Column('utc_hold_expiration', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_mode', sa.String(length=30), server_default='PAY_ON_ARRIVAL', nullable=False),
        sa.Column('payment_status', sa.String(length=30), server_default='PENDING_AT_CHECKIN', nullable=False),
        sa.Column('total_amount', sa.DECIMAL(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='EUR', nullable=False),
        sa.Column('booking_notes', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diving_center_id'], ['diving_centers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['octo_products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['octo_options.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['availability_id'], ['octo_availability_slots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('uuid')
    )
    op.create_index(op.f('ix_octo_bookings_diving_center_id'), 'octo_bookings', ['diving_center_id'], unique=False)
    op.create_index(op.f('ix_octo_bookings_status'), 'octo_bookings', ['status'], unique=False)

    # 8. OctoBookingUnitItem
    op.create_table(
        'octo_booking_unit_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('booking_uuid', sa.String(length=36), nullable=False),
        sa.Column('unit_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('diver_full_name', sa.String(length=255), nullable=False),
        sa.Column('diver_email', sa.String(length=255), nullable=True),
        sa.Column('diver_phone', sa.String(length=50), nullable=True),
        sa.Column('diver_nationality', sa.String(length=100), nullable=True),
        sa.Column('passport_number', sa.String(length=100), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('certification_agency', sa.String(length=50), nullable=True),
        sa.Column('certification_level', sa.String(length=100), nullable=True),
        sa.Column('certification_number', sa.String(length=100), nullable=True),
        sa.Column('total_logged_dives', sa.Integer(), server_default='0', nullable=False),
        sa.Column('date_of_last_dive', sa.Date(), nullable=True),
        sa.Column('selected_tank_id', sa.String(length=20), server_default='12', nullable=True),
        sa.Column('selected_gas_mix_id', sa.String(length=20), server_default='air', nullable=True),
        sa.Column('equipment_sizing', sa.JSON(), nullable=True),
        sa.Column('waiver_id', sa.String(length=100), nullable=True),
        sa.Column('waivers_complete', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('signed_waiver_path', sa.String(length=500), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('onboard_checkin_status', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.ForeignKeyConstraint(['booking_uuid'], ['octo_bookings.uuid'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['unit_id'], ['octo_units.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_octo_booking_unit_items_booking_uuid'), 'octo_booking_unit_items', ['booking_uuid'], unique=False)

    # 9. DiverMedicalRecord
    op.create_table(
        'diver_medical_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_unit_item_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('encrypted_dek', sa.Text(), nullable=False),
        sa.Column('encrypted_answers', sa.LargeBinary(), nullable=False),
        sa.Column('physician_clearance_file_path', sa.String(length=500), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('audit_signature_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['booking_unit_item_id'], ['octo_booking_unit_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('booking_unit_item_id', name='uq_diver_medical_records_item_id')
    )
    op.create_index(op.f('ix_diver_medical_records_id'), 'diver_medical_records', ['id'], unique=False)
    op.create_index(op.f('ix_diver_medical_records_booking_unit_item_id'), 'diver_medical_records', ['booking_unit_item_id'], unique=True)


def downgrade():
    op.drop_table('diver_medical_records')
    op.drop_table('octo_booking_unit_items')
    op.drop_table('octo_bookings')
    op.drop_table('octo_availability_slots')
    op.drop_table('octo_units')
    op.drop_table('octo_options')
    op.drop_table('octo_products')
    op.drop_table('diving_center_vessels')
    op.drop_table('diving_center_booking_settings')
