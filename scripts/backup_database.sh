#!/bin/bash

# Database Backup Script
# Creates a full database backup in database_backups directory
# Uses credentials from .env file or docker-compose.yml defaults

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/database_backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Load environment variables from .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    # Source .env file, but only export variables we need
    export $(grep -E '^MYSQL_(ROOT_PASSWORD|DATABASE|USER|PASSWORD)=' "$PROJECT_ROOT/.env" | xargs)
fi

# Set defaults from docker-compose.yml if not set
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD:-rootpassword}
MYSQL_DATABASE=${MYSQL_DATABASE:-divemap}
MYSQL_USER=${MYSQL_USER:-divemap_user}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-divemap_password}

# Database connection settings
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}

# Generate timestamp for filename (YYYYMMDD_HHMMSS)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/divemap_backup_${TIMESTAMP}.sql"

echo "Creating database backup..."
echo "Database: $MYSQL_DATABASE"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup file: $BACKUP_FILE"

# Check if mysqldump is available
if ! command -v mysqldump &> /dev/null; then
    echo "Error: mysqldump is not installed or not in PATH"
    echo "Please install MySQL client tools:"
    echo "  Ubuntu/Debian: sudo apt-get install mysql-client"
    echo "  macOS: brew install mysql-client"
    exit 1
fi

# Check if database container is running
if ! docker ps --format '{{.Names}}' | grep -q "^divemap_db$"; then
    echo "Warning: divemap_db container is not running"
    echo "Attempting backup anyway (database might be accessible on host)..."
fi

# Create backup using mysqldump
# Using root user for full backup privileges
mysqldump \
    -h "$DB_HOST" \
    -P "$DB_PORT" \
    -u root \
    -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --add-drop-database \
    --databases "$MYSQL_DATABASE" \
    > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup created successfully!"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $BACKUP_SIZE"
    
    # Compress backup (optional - uncomment to enable)
    # echo "Compressing backup..."
    # gzip "$BACKUP_FILE"
    # echo "✅ Compressed backup: ${BACKUP_FILE}.gz"
else
    echo "❌ Backup failed!"
    rm -f "$BACKUP_FILE"  # Remove empty file
    exit 1
fi

