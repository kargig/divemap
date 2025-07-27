# Database Migrations with Alembic

This project uses Alembic for database migrations. Alembic is the official migration tool for SQLAlchemy and provides version control for database schema changes.

## Setup

Alembic is already configured and installed in the virtual environment. The configuration files are:

- `alembic.ini` - Main configuration file
- `migrations/env.py` - Environment configuration
- `migrations/versions/` - Directory containing migration files

## Running Migrations

### Automatic Migration (Recommended)

The application automatically runs migrations before starting:

```bash
# In development
cd backend
source divemap_venv/bin/activate
python run_migrations.py

# In Docker (automatic)
docker-compose up backend
```

### Manual Migration

To manually run migrations:

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

## Creating New Migrations

### Auto-Generate Migration (Recommended)

When you modify the SQLAlchemy models, you can auto-generate a migration:

```bash
cd backend
source divemap_venv/bin/activate

# Auto-generate migration from model changes
python create_migration.py "Add new table"

# Or use alembic directly
alembic revision --autogenerate -m "Add new table"
```

### Manual Migration

For complex migrations that can't be auto-generated:

```bash
cd backend
source divemap_venv/bin/activate

# Create empty migration
alembic revision -m "Complex data migration"

# Edit the generated file in migrations/versions/
```

## Migration Files

Migration files are stored in `migrations/versions/` and follow the naming convention:
- `0001_initial.py` - Initial database schema
- `0002_add_currency_fields.py` - Example migration

Each migration file contains:
- `upgrade()` function - Applied when migrating forward
- `downgrade()` function - Applied when rolling back

## Best Practices

### 1. Always Test Migrations

```bash
# Test on development database first
alembic upgrade head
alembic downgrade -1
```

### 2. Backup Before Production

```bash
# Always backup before running migrations
mysqldump -u user -p database > backup.sql
alembic upgrade head
```

### 3. Use Descriptive Names

```bash
# Good
alembic revision -m "Add currency support to cost tables"

# Bad
alembic revision -m "fix"
```

### 4. Handle Dependencies

```python
# In migration file
revision = '0002'
down_revision = '0001'  # Depends on previous migration
```

## Troubleshooting

### Migration Fails

1. Check database connection:
   ```bash
   python -c "from app.database import engine; print(engine.connect())"
   ```

2. Check migration status:
   ```bash
   alembic current
   alembic history
   ```

3. Check for conflicts:
   ```bash
   alembic heads
   ```

### Database Out of Sync

If the database is out of sync with migrations:

1. Check current state:
   ```bash
   alembic current
   ```

2. Mark as up to date (if safe):
   ```bash
   alembic stamp head
   ```

3. Or reset and reapply:
   ```bash
   alembic downgrade base
   alembic upgrade head
   ```

## Environment Variables

The migration system uses the same database configuration as the application:

- `DATABASE_URL` - Database connection string
- Default: `mysql+pymysql://divemap_user:divemap_password@localhost:3306/divemap`

## Docker Integration

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

## Example Workflow

1. **Modify Models**: Update SQLAlchemy models in `app/models.py`

2. **Generate Migration**:
   ```bash
   python create_migration.py "Add user preferences"
   ```

3. **Review Migration**: Check the generated file in `migrations/versions/`

4. **Test Migration**:
   ```bash
   alembic upgrade head
   # Test application
   alembic downgrade -1
   ```

5. **Apply Migration**:
   ```bash
   alembic upgrade head
   ```

6. **Commit Changes**:
   ```bash
   git add migrations/versions/0002_add_user_preferences.py
   git commit -m "Add user preferences table"
   ``` 