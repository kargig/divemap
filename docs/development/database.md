# Database Documentation

This document provides comprehensive information about the Divemap database system, including migrations, connectivity, and management.

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Migrations with Alembic](#migrations-with-alembic)
4. [Database Connectivity](#database-connectivity)
5. [Migration Workflow](#migration-workflow)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

The Divemap application uses MySQL as its primary database with SQLAlchemy ORM and Alembic for database migrations. The system includes robust database connectivity checking and automatic migration execution.

### Key Features

- **Alembic Migrations**: Version-controlled database schema changes
- **Database Health Checks**: Automatic connectivity verification
- **IPv6 Support**: Cloud deployment compatibility
- **Container Optimization**: Pre-compiled wheels for faster builds
- **Automatic Migration**: Migrations run before application startup

## Database Schema

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    is_moderator BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    diving_certification VARCHAR(100),
    number_of_dives INT DEFAULT 0
);
```

#### Dive Sites Table
```sql
CREATE TABLE dive_sites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    access_instructions TEXT,
    dive_plans TEXT,
    gas_tanks_necessary TEXT,
    difficulty_level ENUM('beginner', 'intermediate', 'advanced', 'expert'),
    marine_life TEXT,
    safety_information TEXT,
    max_depth DECIMAL(5, 2),
    alternative_names TEXT,
    country VARCHAR(100),
    region VARCHAR(100),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Diving Centers Table
```sql
CREATE TABLE diving_centers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Related Tables

- **site_media**: Media files for dive sites
- **site_ratings**: User ratings for dive sites
- **site_comments**: User comments for dive sites
- **center_ratings**: User ratings for diving centers
- **center_comments**: User comments for diving centers
- **center_dive_sites**: Association between centers and dive sites
- **gear_rental_costs**: Gear rental pricing
- **available_tags**: Available tags for dive sites
- **dive_site_tags**: Association between dive sites and tags
- **parsed_dive_trips**: Extracted dive trip information
- **newsletters**: Newsletter content for parsing

## Migrations with Alembic

### Setup

Alembic is configured and installed in the virtual environment with these configuration files:

- `alembic.ini` - Main configuration file
- `migrations/env.py` - Environment configuration
- `migrations/versions/` - Directory containing migration files

### Running Migrations

#### Automatic Migration (Recommended)

The application automatically runs migrations before starting:

```bash
# In development
cd backend
source divemap_venv/bin/activate
python run_migrations.py

# In Docker (automatic)
docker-compose up backend
```

#### Manual Migration

```bash
cd backend
source divemap_venv/bin/activate

# Check current migration status
alembic current

# Run all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Rollback to specific migration
alembic downgrade 0001

# Check migration history
alembic history
```

### Creating New Migrations

#### Auto-Generate Migration (Recommended)

When you modify the SQLAlchemy models, auto-generate a migration:

```bash
cd backend
source divemap_venv/bin/activate

# Auto-generate migration from model changes
python create_migration.py "Add new table"

# Or use alembic directly
alembic revision --autogenerate -m "Add new table"
```

#### Manual Migration

For complex migrations that can't be auto-generated:

```bash
cd backend
source divemap_venv/bin/activate

# Create empty migration
alembic revision -m "Complex data migration"

# Edit the generated file in migrations/versions/
```

### Migration Files

Migration files are stored in `migrations/versions/` and follow the naming convention:

- `0001_initial.py` - Initial database schema
- `0002_add_max_depth_and_alternative_names.py` - Added max_depth and alternative_names fields
- `0003_add_country_region_fields.py` - Added country and region fields with indexes
- `0004_add_view_count_fields.py` - Added view count tracking
- `0005_add_user_diving_fields.py` - Added user diving certification and dive count

Each migration file contains:
- `upgrade()` function - Applied when migrating forward
- `downgrade()` function - Applied when rolling back

## Database Connectivity

### Health Check Implementation

The backend container includes a robust database connectivity check during startup:

#### Netcat Version
- Uses `netcat-openbsd` instead of `netcat-traditional`
- Provides better IPv6 support required for fly.io deployment
- Includes timeout handling to prevent hanging connections

#### Retry Logic
- **Maximum attempts**: 10 retries
- **Random sleep**: 1-5 seconds between attempts
- **Timeout**: 5 seconds per connection attempt
- **Error handling**: Exits with error code 1 if all attempts fail

#### Startup Script Features
- Uses `set -e` for strict error handling
- Visual indicators (emojis) for better log readability
- Proper error redirection to suppress netcat error messages
- IPv6-compatible connection testing

### Log Output Example

```
Waiting for database to be ready...
Attempt 1/10: Checking database connectivity...
❌ Database not ready yet. Attempt 1/10 failed.
⏳ Waiting 3 seconds before next attempt...
Attempt 2/10: Checking database connectivity...
✅ Database is ready!
🚀 Starting application...
```

### Fly.io Compatibility

The implementation is specifically designed for fly.io deployment:
- IPv6 support for network connectivity
- Random sleep intervals to prevent thundering herd
- Proper error handling for container orchestration
- Timeout handling for network delays

## Migration Workflow

### 1. Modify SQLAlchemy Models

Edit models in `app/models.py`:

```python
class NewTable(Base):
    __tablename__ = "new_table"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 2. Generate Migration

```bash
python create_migration.py "Add new table"
```

### 3. Review Generated Migration

Check the generated file in `migrations/versions/`:

```python
def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('new_table',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_new_table_id'), 'new_table', ['id'], unique=False)
    # ### end Alembic commands ###
```

### 4. Test Migration

```bash
# Apply migration
alembic upgrade head

# Test application
# Rollback if needed
alembic downgrade -1
```

### 5. Apply Migration

```bash
# Apply to development
alembic upgrade head

# Apply to production (after backup)
alembic upgrade head
```

### 6. Commit Changes

```bash
git add migrations/versions/0002_add_new_table.py
git commit -m "Add new table"
```

## Troubleshooting

### Common Issues

#### 1. Module Not Found Errors

**Problem:** `ModuleNotFoundError: No module named 'sqlalchemy'`

**Solution:** Set PYTHONPATH for asdf environments:
```bash
export PYTHONPATH="/home/kargig/src/divemap/backend/divemap_venv/lib/python3.11/site-packages:$PYTHONPATH"
```

#### 2. Database Connection Failures

**Problem:** Database not available during migration

**Solution:** The script includes automatic retry logic with health checks

#### 3. Table Already Exists

**Problem:** `Table 'users' already exists`

**Solution:** Mark database as up-to-date:
```bash
alembic stamp head
```

#### 4. Migration Template Missing

**Problem:** `FileNotFoundError: script.py.mako`

**Solution:** Ensure `migrations/script.py.mako` exists

### Debugging Commands

#### Check Alembic Status
```bash
alembic current
alembic history
alembic heads
```

#### Check Database Connection
```bash
python -c "from app.database import engine; print(engine.connect())"
```

#### Check Python Path
```bash
python -c "import sys; print('\n'.join(sys.path))"
```

#### Test Netcat IPv6 Support
```bash
# Inside the container
./test_netcat_ipv6.sh

# Or from host
docker exec divemap_backend ./test_netcat_ipv6.sh
```

## Best Practices

### 1. Always Test Migrations

```bash
# Test on development first
alembic upgrade head
# Test application functionality
alembic downgrade -1
```

### 2. Backup Before Production

```bash
# Always backup before production migrations
mysqldump -u user -p database > backup.sql
alembic upgrade head
```

### 3. Use Descriptive Migration Names

```bash
# Good
python create_migration.py "Add currency support to cost tables"

# Bad
python create_migration.py "fix"
```

### 4. Review Generated Migrations

Always review auto-generated migrations before applying them, especially for:
- Data type changes
- Index modifications
- Foreign key changes

### 5. Handle Dependencies

```python
# In migration file
revision = '0002'
down_revision = '0001'  # Depends on previous migration
```

### 6. Environment Variables

The migration system uses the same database configuration as the application:

- `DATABASE_URL` - Database connection string
- Default: `mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap`

### 7. Docker Integration

In Docker, migrations run automatically before the application starts:

```dockerfile
# Dockerfile
CMD ["sh", "-c", "python run_migrations.py && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"]
```

This ensures the database schema is always up to date when the container starts.

## Migration Commands Reference

| Command | Description |
|---------|-------------|
| `alembic current` | Show current migration version |
| `alembic history` | Show migration history |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic downgrade -1` | Rollback one migration |
| `alembic downgrade base` | Rollback all migrations |
| `alembic stamp head` | Mark as up to date without running |
| `alembic revision --autogenerate -m "msg"` | Auto-generate migration |
| `alembic revision -m "msg"` | Create empty migration |

## Security Considerations

### 1. Database Credentials
- Use environment variables for database credentials
- Never hardcode credentials in migration files
- Use different credentials for development and production

### 2. Migration Permissions
- Ensure database user has appropriate permissions
- Test migrations with limited permissions
- Use read-only connections when possible for verification

### 3. Backup Strategy
- Always backup before running migrations
- Test rollback procedures
- Keep migration history for audit purposes

## Performance Considerations

### 1. Large Tables
- Use `IF EXISTS` checks for large tables
- Consider downtime for major schema changes
- Use online DDL when possible

### 2. Index Management
- Drop indexes before bulk operations
- Recreate indexes after data migration
- Monitor index usage and performance

### 3. Transaction Management
- Use appropriate transaction isolation levels
- Consider breaking large migrations into smaller ones
- Test migration performance on production-like data

## Conclusion

This database system provides:

1. **Automatic Migration Execution** - Migrations run before application startup
2. **Database Health Checks** - Ensures database is available before migrations
3. **Environment Compatibility** - Works with asdf Python environments
4. **Comprehensive Documentation** - Clear usage instructions and troubleshooting
5. **Docker Integration** - Seamless deployment with automatic migrations
6. **Error Handling** - Robust error handling and recovery procedures

The system ensures that database schema changes are version-controlled, tested, and applied consistently across all environments. 