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

### Difficulty Level System

The difficulty level system has been converted from ENUM strings to integers for better performance and consistency:

- **1** = beginner
- **2** = intermediate (default)
- **3** = advanced  
- **4** = expert

This conversion was implemented in migration 0024 and provides:
- Better database performance for sorting and filtering
- Consistent integer-based operations
- Human-readable string conversion in API responses
- Backward compatibility through helper functions

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
    difficulty_level INTEGER DEFAULT 2, -- 1=beginner, 2=intermediate, 3=advanced, 4=expert
    marine_life TEXT,
    safety_information TEXT,
    max_depth DECIMAL(5, 2),
    alternative_names TEXT, -- DEPRECATED: This field has been replaced by the dive_site_aliases table
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

#### Diving Organizations Table
```sql
CREATE TABLE diving_organizations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    acronym VARCHAR(20) UNIQUE NOT NULL,
    website VARCHAR(255),
    logo_url VARCHAR(500),
    description TEXT,
    country VARCHAR(100),
    founded_year INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### User Certifications Table
```sql
CREATE TABLE user_certifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    diving_organization_id INT NOT NULL,
    certification_level VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (diving_organization_id) REFERENCES diving_organizations(id)
);
```

#### Diving Center Organizations Table
```sql
CREATE TABLE diving_center_organizations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    diving_center_id INT NOT NULL,
    diving_organization_id INT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id),
    FOREIGN KEY (diving_organization_id) REFERENCES diving_organizations(id),
    UNIQUE KEY unique_center_org (diving_center_id, diving_organization_id)
);
```

#### Dives Table
```sql
CREATE TABLE dives (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    dive_site_id INT,
    diving_center_id INT,
    dive_information TEXT,
    max_depth DECIMAL(5, 2),
    average_depth DECIMAL(5, 2),
    gas_bottles_used TEXT,
    suit_type ENUM('wet_suit', 'dry_suit', 'shortie'),
    difficulty_level INTEGER DEFAULT 2, -- 1=beginner, 2=intermediate, 3=advanced, 4=expert
    visibility_rating INT CHECK (visibility_rating >= 1 AND visibility_rating <= 10),
    user_rating INT CHECK (user_rating >= 1 AND user_rating <= 10),
    dive_date DATE NOT NULL,
    dive_time TIME,
    duration INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id),
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id)
);
```

**Dive-Diving Center Relationship**: The `diving_center_id` field allows dives to be associated with the diving center that organized or facilitated the dive. This relationship is optional and provides a complete record of the diving experience, including which diving center was involved.

#### Dive Media Table
```sql
CREATE TABLE dive_media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dive_id INT NOT NULL,
    media_type ENUM('photo', 'video', 'dive_plan', 'external_link') NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    title VARCHAR(255),
    thumbnail_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_id) REFERENCES dives(id)
);
```

#### Dive Tags Table
```sql
CREATE TABLE dive_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dive_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_id) REFERENCES dives(id),
    FOREIGN KEY (tag_id) REFERENCES available_tags(id)
);
```

#### Parsed Dive Trips Table
```sql
CREATE TABLE parsed_dive_trips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    diving_center_id INT,
    trip_date DATE NOT NULL,
    trip_time TIME,
    trip_duration INT,
    trip_difficulty_level INTEGER NULL, -- 1=beginner, 2=intermediate, 3=advanced, 4=expert (nullable since migration 0027)
    trip_price DECIMAL(10, 2),
    trip_currency VARCHAR(3) DEFAULT 'EUR',
    group_size_limit INT,
    current_bookings INT DEFAULT 0,
    trip_description TEXT,
    special_requirements TEXT,
    trip_status ENUM('scheduled', 'confirmed', 'cancelled', 'completed') DEFAULT 'scheduled',
    source_newsletter_id INT,
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (diving_center_id) REFERENCES diving_centers(id),
    FOREIGN KEY (source_newsletter_id) REFERENCES newsletters(id)
);
```

**Note**: The `trip_difficulty_level` field was made nullable in migration 0027 to handle cases where the newsletter parsing logic cannot determine the difficulty level. This allows for more flexible trip creation while maintaining data integrity.

#### Parsed Dives Table
```sql
CREATE TABLE parsed_dives (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trip_id INT NOT NULL,
    dive_site_id INT,
    dive_number INT NOT NULL,
    dive_time TIME,
    dive_duration INT,
    dive_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES parsed_dive_trips(id),
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id)
);
```



#### Dive Site Aliases Table
```sql
CREATE TABLE dive_site_aliases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    dive_site_id INT NOT NULL,
    alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dive_site_id) REFERENCES dive_sites(id),
    UNIQUE KEY _dive_site_alias_uc (dive_site_id, alias)
);
```

**Purpose**: Stores alternative names/aliases for dive sites, used for improved search and matching during newsletter parsing.

#### Newsletters Table
```sql
CREATE TABLE newsletters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content TEXT NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
- **diving_organizations**: Diving organizations (PADI, SSI, etc.)
- **user_certifications**: User diving certifications
- **diving_center_organizations**: Association between centers and organizations
- **dive_site_tags**: Association between dive sites and tags
- **dive_site_aliases**: Alternative names/aliases for dive sites
- **dives**: User dive logs with comprehensive details
- **dive_media**: Media files for dives (photos, videos, plans, external links)
- **dive_tags**: Association between dives and tags
- **parsed_dive_trips**: Extracted dive trip information
- **parsed_dives**: Individual dives within parsed trips
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
- `0002_add_max_depth_and_alternative_names.py` - Added max_depth and alternative_names fields (alternative_names later deprecated)
- `29fac01eff2e_add_dive_site_aliases_table_for_.py` - Added dive_site_aliases table
- `75b96c8832aa_deprecate_alternative_names_column.py` - Removed alternative_names column
- `0003_add_country_region_fields.py` - Added country and region fields with indexes
- `0004_add_view_count_fields.py` - Added view count tracking
- `0005_add_user_diving_fields.py` - Added user diving certification and dive count
- `c85d7af66778_add_diving_organizations_and_user_.py` - Added diving organizations and user certifications
- `9002229c2a67_remove_unnecessary_certification_fields_.py` - Cleaned up certification fields

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

## Data Population

### Diving Organizations Population

After running migrations, populate the database with initial diving organization data:

```bash
cd backend
source divemap_venv/bin/activate

# Populate diving organizations
python populate_diving_organizations.py

# List all diving organizations
python populate_diving_organizations.py list
```

The script populates the database with the top 10 diving organizations:
- **PADI** - Professional Association of Diving Instructors
- **SSI** - Scuba Schools International
- **GUE** - Global Underwater Explorers
- **RAID** - Rebreather Association of International Divers
- **CMAS** - Confédération Mondiale des Activités Subaquatiques
- **TDI** - Technical Diving International
- **NAUI** - National Association of Underwater Instructors
- **BSAC** - British Sub-Aqua Club
- **SDI** - Scuba Diving International
- **IANTD** - International Association of Nitrox and Technical Divers

### Population Script Features

- **Duplicate Prevention**: Checks for existing organizations before adding
- **Comprehensive Data**: Includes websites, descriptions, and founding years
- **Error Handling**: Graceful error handling with rollback on failure
- **Visual Feedback**: Clear progress indicators and status messages

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