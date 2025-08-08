# Database Migrations Guide

This document provides comprehensive information about database migrations in the Divemap application, including procedures, best practices, and troubleshooting.

## Table of Contents

1. [Overview](#overview)
2. [Migration System](#migration-system)
3. [Migration Procedures](#migration-procedures)
4. [Migration Commands](#migration-commands)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Production Migrations](#production-migrations)

## Overview

The Divemap application uses Alembic for database migrations, providing a robust and reliable way to manage database schema changes. Migrations ensure that database changes are version-controlled, reversible, and can be applied consistently across different environments.

### Key Features

- **Version Control**: All database changes are tracked and versioned
- **Reversible**: Migrations can be rolled back if needed
- **Environment Agnostic**: Same migrations work in development and production
- **Automated**: Migrations run automatically during deployment
- **Safe**: Migrations include safety checks and validation

## Migration System

### Alembic Configuration

#### Configuration File (`backend/alembic.ini`)
```ini
[alembic]
script_location = migrations
sqlalchemy.url = mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

#### Environment Configuration (`backend/migrations/env.py`)
```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from app.models import Base
from app.database import DATABASE_URL

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = DATABASE_URL
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Migration Structure

#### Directory Structure
```
backend/migrations/
├── env.py                 # Alembic environment configuration
├── script.py.mako        # Migration template
└── versions/             # Migration files
    ├── 0001_initial.py
    ├── 0002_add_max_depth_and_alternative_names.py (alternative_names later deprecated)
    ├── 29fac01eff2e_add_dive_site_aliases_table_for_.py
    ├── 75b96c8832aa_deprecate_alternative_names_column.py
    ├── 0003_add_country_region_fields.py
    ├── 0004_add_view_count_fields.py
    └── 0005_add_user_diving_fields.py
```

#### Migration File Template
```python
"""Migration description

Revision ID: 0001_initial
Revises: 
Create Date: 2023-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create tables
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('is_admin', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('is_moderator', sa.Boolean(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('google_id'),
        sa.UniqueConstraint('username')
    )

def downgrade() -> None:
    # Drop tables
    op.drop_table('users')
```

## Migration Procedures

### Creating New Migrations

#### Automatic Migration Generation
```bash
# Generate migration from model changes
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Create migration
python create_migration.py "Add new field to users table"
```

#### Manual Migration Creation
```bash
# Create migration file manually
alembic revision -m "Add new field to users table"
```

#### Migration Script (`backend/create_migration.py`)
```python
#!/usr/bin/env python3
"""
Migration creation script for Divemap application.
This script automatically generates migrations based on model changes.
"""

import sys
import os
import subprocess
from datetime import datetime

def create_migration(description):
    """Create a new migration with the given description."""
    
    # Format description for filename
    filename = description.lower().replace(' ', '_').replace('-', '_')
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    migration_name = f"{timestamp}_{filename}"
    
    # Create migration using Alembic
    try:
        result = subprocess.run([
            'alembic', 'revision', 
            '--autogenerate', 
            '-m', description
        ], capture_output=True, text=True, check=True)
        
        print(f"✅ Migration created successfully: {migration_name}")
        print(f"📝 Description: {description}")
        
        # Show the generated migration file
        migration_files = [f for f in os.listdir('migrations/versions') 
                         if f.endswith('.py') and f.startswith(timestamp)]
        
        if migration_files:
            migration_file = migration_files[0]
            print(f"📄 Migration file: migrations/versions/{migration_file}")
            
            # Show migration content
            with open(f'migrations/versions/{migration_file}', 'r') as f:
                content = f.read()
                print(f"\n📋 Migration content preview:")
                print("=" * 50)
                print(content[:500] + "..." if len(content) > 500 else content)
                print("=" * 50)
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error creating migration: {e}")
        print(f"📄 Error output: {e.stderr}")
        return False

def main():
    """Main function to handle migration creation."""
    
    if len(sys.argv) != 2:
        print("Usage: python create_migration.py \"Migration description\"")
        print("Example: python create_migration.py \"Add user profile fields\"")
        sys.exit(1)
    
    description = sys.argv[1]
    
    print(f"🔄 Creating migration: {description}")
    print(f"⏰ Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    success = create_migration(description)
    
    if success:
        print("\n✅ Migration created successfully!")
        print("\n📋 Next steps:")
        print("1. Review the generated migration file")
        print("2. Test the migration locally")
        print("3. Run the migration: python run_migrations.py")
    else:
        print("\n❌ Migration creation failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

### Running Migrations

#### Development Environment
```bash
# Run migrations in development
cd backend
source divemap_venv/bin/activate
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"

# Run all pending migrations
python run_migrations.py
```

#### Production Environment
```bash
# Run migrations in production
fly ssh console -a divemap-backend -C "python run_migrations.py"

# Check migration status
fly ssh console -a divemap-backend -C "alembic current"
```

#### Migration Runner Script (`backend/run_migrations.py`)
```python
#!/usr/bin/env python3
"""
Migration runner script for Divemap application.
This script runs database migrations safely in any environment.
"""

import os
import sys
import subprocess
import time
from datetime import datetime

def check_database_connectivity():
    """Check if database is accessible."""
    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception as e:
        print(f"❌ Database connectivity check failed: {e}")
        return False

def get_current_revision():
    """Get the current migration revision."""
    try:
        result = subprocess.run(['alembic', 'current'], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def get_pending_migrations():
    """Get list of pending migrations."""
    try:
        result = subprocess.run(['alembic', 'show', 'migrations'], 
                              capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError:
        return "Unable to get migration status"

def run_migrations():
    """Run all pending migrations."""
    
    print("🔄 Starting database migration process...")
    print(f"⏰ Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check database connectivity
    print("\n🔍 Checking database connectivity...")
    if not check_database_connectivity():
        print("❌ Cannot connect to database. Exiting.")
        return False
    
    print("✅ Database connectivity confirmed")
    
    # Get current migration status
    print("\n📊 Checking current migration status...")
    current_revision = get_current_revision()
    print(f"📍 Current revision: {current_revision}")
    
    # Show pending migrations
    print("\n📋 Pending migrations:")
    pending_migrations = get_pending_migrations()
    print(pending_migrations)
    
    # Run migrations
    print("\n🚀 Running migrations...")
    try:
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True, check=True)
        
        print("✅ Migrations completed successfully!")
        print(f"📄 Output: {result.stdout}")
        
        # Verify final status
        final_revision = get_current_revision()
        print(f"📍 Final revision: {final_revision}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Migration failed: {e}")
        print(f"📄 Error output: {e.stderr}")
        return False

def main():
    """Main function to handle migration execution."""
    
    print("=" * 60)
    print("🗄️  Divemap Database Migration Runner")
    print("=" * 60)
    
    # Check if we're in the right directory
    if not os.path.exists('alembic.ini'):
        print("❌ Error: alembic.ini not found. Please run from backend directory.")
        sys.exit(1)
    
    # Check if virtual environment is activated
    if 'VIRTUAL_ENV' not in os.environ:
        print("⚠️  Warning: Virtual environment not detected.")
        print("   Consider activating the virtual environment for consistency.")
    
    success = run_migrations()
    
    if success:
        print("\n✅ Migration process completed successfully!")
        print("\n📋 Summary:")
        print("- Database connectivity: ✅")
        print("- Migrations applied: ✅")
        print("- Final status: ✅")
    else:
        print("\n❌ Migration process failed!")
        print("\n🔧 Troubleshooting:")
        print("1. Check database connectivity")
        print("2. Verify database credentials")
        print("3. Check migration files for errors")
        print("4. Review application logs")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Migration Commands

### Basic Commands

#### Check Migration Status
```bash
# Check current migration
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic show migrations
```

#### Create Migrations
```bash
# Create migration from model changes
alembic revision --autogenerate -m "Description"

# Create empty migration
alembic revision -m "Description"
```

#### Run Migrations
```bash
# Run all pending migrations
alembic upgrade head

# Run to specific revision
alembic upgrade 0003_add_country_region_fields

# Run one migration
alembic upgrade +1
```

#### Rollback Migrations
```bash
# Rollback to previous revision
alembic downgrade -1

# Rollback to specific revision
alembic downgrade 0002_add_max_depth_and_alternative_names

# Rollback all migrations
alembic downgrade base
```

### Advanced Commands

#### Migration Information
```bash
# Show migration details
alembic show 0003_add_country_region_fields

# Show migration branches
alembic heads

# Show migration dependencies
alembic branches
```

#### Migration Editing
```bash
# Edit migration file
nano migrations/versions/0003_add_country_region_fields.py

# Mark migration as applied without running
alembic stamp head
```

#### Database Operations
```bash
# Check database URL
alembic show

# Test database connection
alembic check

# Generate SQL without executing
alembic upgrade head --sql
```

## Best Practices

### Migration Design

#### 1. Atomic Changes
```python
# ✅ Good: Single, focused migration
def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'phone')

# ❌ Bad: Multiple unrelated changes
def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('dive_sites', sa.Column('difficulty', sa.String(50), nullable=True))
    op.create_table('new_table', ...)
```

#### 2. Descriptive Names
```python
# ✅ Good: Clear, descriptive names
revision = '0003_add_user_profile_fields'
revision = '0004_add_dive_site_ratings'
revision = '0005_fix_user_email_constraint'

# ❌ Bad: Vague names
revision = '0003_update_tables'
revision = '0004_fixes'
revision = '0005_changes'
```

#### 3. Safe Defaults
```python
# ✅ Good: Safe default values
def upgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), 
                                    server_default='1', nullable=False))

# ❌ Bad: Unsafe defaults
def upgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=True))
```

### Data Migration

#### 1. Data Backfilling
```python
# ✅ Good: Backfill data in migration
def upgrade() -> None:
    # Add column
    op.add_column('users', sa.Column('status', sa.String(20), nullable=True))
    
    # Backfill data
    connection = op.get_bind()
    connection.execute("UPDATE users SET status = 'active' WHERE status IS NULL")
    
    # Make column not null
    op.alter_column('users', 'status', nullable=False)

def downgrade() -> None:
    op.drop_column('users', 'status')
```

#### 2. Batch Processing
```python
# ✅ Good: Process large datasets in batches
def upgrade() -> None:
    connection = op.get_bind()
    
    # Process in batches
    batch_size = 1000
    offset = 0
    
    while True:
        result = connection.execute(
            "SELECT id FROM users WHERE status IS NULL LIMIT %s OFFSET %s",
            (batch_size, offset)
        )
        
        rows = result.fetchall()
        if not rows:
            break
            
        for row in rows:
            connection.execute(
                "UPDATE users SET status = 'active' WHERE id = %s",
                (row[0],)
            )
        
        offset += batch_size
```

### Performance Considerations

#### 1. Index Management
```python
# ✅ Good: Add indexes in separate migration
def upgrade() -> None:
    # Add column first
    op.add_column('dive_sites', sa.Column('rating', sa.Float(), nullable=True))
    
    # Add index in separate step
    op.create_index('idx_dive_sites_rating', 'dive_sites', ['rating'])

def downgrade() -> None:
    op.drop_index('idx_dive_sites_rating', 'dive_sites')
    op.drop_column('dive_sites', 'rating')
```

#### 2. Large Table Operations
```python
# ✅ Good: Use online DDL for large tables
def upgrade() -> None:
    # Use ALGORITHM=INPLACE for large tables
    op.execute("ALTER TABLE dive_sites ADD COLUMN rating FLOAT "
               "ALGORITHM=INPLACE, LOCK=NONE")

def downgrade() -> None:
    op.execute("ALTER TABLE dive_sites DROP COLUMN rating "
               "ALGORITHM=INPLACE, LOCK=NONE")
```

## Troubleshooting

### Common Issues

#### 1. Migration Conflicts

**Problem**: Multiple developers create migrations simultaneously

**Diagnosis**:
```bash
# Check for conflicting revisions
alembic heads

# Show migration branches
alembic branches
```

**Solution**:
```bash
# Merge conflicting branches
alembic merge heads -m "Merge conflicting migrations"

# Apply merged migration
alembic upgrade head
```

#### 2. Database Connection Issues

**Problem**: Cannot connect to database during migration

**Diagnosis**:
```bash
# Test database connection
alembic check

# Check database URL
alembic show
```

**Solution**:
```bash
# Verify database credentials
fly secrets list -a divemap-backend

# Test connection manually
fly ssh console -a divemap-backend -C "python -c 'from app.database import engine; print(engine.connect())'"
```

#### 3. Migration State Mismatch

**Problem**: Migration state doesn't match actual database schema

**Diagnosis**:
```bash
# Check current migration state
alembic current

# Check actual database schema
fly ssh console -a divemap-db -C "mysql -u root -p divemap -e 'SHOW TABLES'"
```

**Solution**:
```bash
# Reset migration state
alembic stamp head

# Or mark specific revision as current
alembic stamp 0003_add_country_region_fields
```

### Debug Commands

#### Migration Debugging
```bash
# Show detailed migration info
alembic show 0003_add_country_region_fields

# Check migration dependencies
alembic heads

# Verify migration files
alembic check
```

#### Database Debugging
```bash
# Check database schema
fly ssh console -a divemap-db -C "mysql -u root -p divemap -e 'SHOW TABLES'"

# Check migration table
fly ssh console -a divemap-db -C "mysql -u root -p divemap -e 'SELECT * FROM alembic_version'"

# Check table structure
fly ssh console -a divemap-db -C "mysql -u root -p divemap -e 'DESCRIBE users'"
```

## Rollback Procedures

### Safe Rollback Process

#### 1. Assessment
```bash
# Check current migration state
alembic current

# Review migration history
alembic history

# Identify target rollback point
alembic show 0003_add_country_region_fields
```

#### 2. Backup
```bash
# Create database backup before rollback
fly ssh console -C "mysqldump -u divemap_user -p divemap > /tmp/pre_rollback_backup.sql"

# Download backup
fly sftp shell
get /tmp/pre_rollback_backup.sql ./backups/
```

#### 3. Rollback Execution
```bash
# Rollback to specific revision
alembic downgrade 0003_add_country_region_fields

# Verify rollback
alembic current

# Test application functionality
curl -f https://divemap-backend.fly.dev/health
```

#### 4. Verification
```bash
# Check database schema
fly ssh console -a divemap-db -C "mysql -u root -p divemap -e 'SHOW TABLES'"

# Test critical functionality
curl -X GET https://divemap-backend.fly.dev/dive-sites

# Monitor application logs
fly logs -f -a divemap-backend
```

### Emergency Rollback

#### Quick Rollback Script
```bash
#!/bin/bash
# Emergency rollback script

echo "🚨 Emergency rollback initiated..."

# Create emergency backup
fly ssh console -C "mysqldump -u divemap_user -p divemap > /tmp/emergency_backup.sql"

# Rollback to previous stable revision
fly ssh console -a divemap-backend -C "alembic downgrade -1"

# Verify rollback
fly ssh console -a divemap-backend -C "alembic current"

# Test application
curl -f https://divemap-backend.fly.dev/health

echo "✅ Emergency rollback completed"
```

## Production Migrations

### Production Migration Checklist

#### Pre-Migration
- [ ] **Backup Database**: Create full database backup
- [ ] **Test Migration**: Run migration in staging environment
- [ ] **Review Changes**: Verify migration logic and impact
- [ ] **Schedule Maintenance**: Plan maintenance window if needed
- [ ] **Notify Team**: Inform stakeholders of migration

#### During Migration
- [ ] **Monitor Logs**: Watch application and database logs
- [ ] **Check Health**: Verify application health during migration
- [ ] **Monitor Performance**: Watch for performance impact
- [ ] **Have Rollback Plan**: Be ready to rollback if issues occur

#### Post-Migration
- [ ] **Verify Schema**: Confirm database schema changes
- [ ] **Test Functionality**: Test critical application features
- [ ] **Monitor Performance**: Watch for performance issues
- [ ] **Update Documentation**: Document migration results

### Production Migration Commands

#### Safe Production Migration
```bash
# 1. Create backup
fly ssh console -C "mysqldump -u divemap_user -p divemap > /tmp/prod_backup_$(date +%Y%m%d_%H%M%S).sql"

# 2. Run migration
fly ssh console -a divemap-backend -C "python run_migrations.py"

# 3. Verify migration
fly ssh console -a divemap-backend -C "alembic current"

# 4. Test application
curl -f https://divemap-backend.fly.dev/health

# 5. Monitor logs
fly logs -f -a divemap-backend
```

#### Rollback Procedure
```bash
# 1. Stop application (if needed)
fly scale count 0 -a divemap-backend

# 2. Rollback migration
fly ssh console -a divemap-backend -C "alembic downgrade -1"

# 3. Restart application
fly scale count 1 -a divemap-backend

# 4. Verify rollback
fly ssh console -a divemap-backend -C "alembic current"
curl -f https://divemap-backend.fly.dev/health
```

### Migration Monitoring

#### Health Checks
```bash
# Monitor application health during migration
while true; do
    curl -f https://divemap-backend.fly.dev/health || echo "Health check failed"
    sleep 30
done
```

#### Performance Monitoring
```bash
# Monitor database performance
fly ssh console -a divemap-db -C "mysql -u root -p -e 'SHOW PROCESSLIST'"

# Monitor application performance
fly logs -f -a divemap-backend | grep -i "slow\|timeout\|error"
```

## Conclusion

This migration guide provides comprehensive procedures for managing database migrations in the Divemap application. Following these best practices ensures safe, reliable, and maintainable database schema changes.

### Key Takeaways

1. **Always Backup**: Create database backups before migrations
2. **Test Thoroughly**: Test migrations in staging before production
3. **Monitor Closely**: Watch application health during migrations
4. **Document Changes**: Keep detailed records of all migrations
5. **Have Rollback Plan**: Always be prepared to rollback if needed

For more detailed information about specific migration scenarios, see the troubleshooting section and individual migration files. 