# Database Export/Import for Diving Centers and Dive Sites

This document describes how to export diving centers and dive sites data from the local development database and import it to the fly.io production database.

## Overview

The export/import process allows you to:
- Create full backups of both local and fly.io databases
- Export only the relevant tables (diving centers, dive sites, and related data)
- Import the data to fly.io database, overwriting existing data
- Maintain data integrity and foreign key relationships

## Prerequisites

1. **MySQL Client Tools**: Ensure `mysqldump` and `mysql` are available
2. **Database Access**: Access to both local and fly.io databases
3. **Docker Environment**: Local development environment running
4. **Fly.io CLI**: Access to fly.io deployment

## Tables Exported

The script exports the following tables in dependency order:

### Core Tables
- `diving_organizations` - Diving organizations (PADI, SSI, etc.)
- `available_tags` - Available tags for dive sites
- `dive_sites` - Dive site information
- `dive_site_aliases` - Alternative names for dive sites
- `diving_centers` - Diving center information

### Relationship Tables
- `center_dive_sites` - Association between centers and dive sites
- `diving_center_organizations` - Association between centers and organizations
- `dive_site_tags` - Association between dive sites and tags

### Media and Content Tables
- `site_media` - Media files for dive sites
- `gear_rental_costs` - Gear rental pricing

### Rating and Comment Tables
- `site_ratings` - User ratings for dive sites
- `site_comments` - User comments for dive sites
- `center_ratings` - User ratings for diving centers
- `center_comments` - User comments for diving centers

### Trip and Dive Tables
- `parsed_dive_trips` - Parsed dive trips from newsletters
- `parsed_dives` - Individual dives within trips

## Usage

### Method 1: Run from Docker Container (Recommended)

```bash
# Start the local development environment
docker-compose up -d

# Run the export/import script from within the backend container
docker exec -it divemap_backend bash -c 'cd /app && python utils/export_import_diving_data.py'
```

### Method 2: Run the Shell Script Wrapper

```bash
# Make the script executable
chmod +x utils/run_export_import.sh

# Run the wrapper script
docker exec -it divemap_backend bash -c 'cd /app && ./utils/run_export_import.sh'
```

### Method 3: Manual Execution

If you need to run the script manually:

```bash
# Enter the backend container
docker exec -it divemap_backend bash

# Install MySQL client tools if needed
apt-get update && apt-get install -y default-mysql-client

# Set environment variables
export MYSQL_USER=divemap_user
export MYSQL_PASSWORD=divemap_password

# Run the script
cd /app
python utils/export_import_diving_data.py
```

## Process Steps

The script performs the following steps:

1. **Create Full Backups**
   - Creates timestamped backups of both local and fly.io databases
   - Stores backups in `database_backups/` directory
   - **Validates backup files** to ensure they contain data and are not empty

2. **Export Selected Tables**
   - **Pre-export validation**: Checks source database has required data
   - Exports only the relevant tables from local database
   - Maintains proper order to handle foreign key dependencies
   - Creates a timestamped export file
   - **Validates export file** to ensure all expected tables and data are present
   - **Enhanced validation**: Verifies actual record counts in key tables

3. **Verify Export**
   - Checks that all expected tables are present in the export file
   - Validates the export file structure and content
   - Ensures data integrity before proceeding
   - **Data validation**: Confirms dive_sites and diving_centers contain records

4. **Clear Existing Data**
   - Removes existing diving centers and dive sites data from fly.io database
   - Clears data in reverse dependency order to avoid foreign key violations
   - Resets auto-increment counters

5. **Import Data**
   - Imports the exported data to fly.io database
   - Maintains data integrity and relationships

## Configuration

### Local Database Configuration

The script reads local database credentials from environment variables:
- `LOCAL_DB_HOST` (default: `localhost`)
- `LOCAL_DB_PORT` (default: `3306`)
- `LOCAL_DB_NAME` (default: `divemap`)
- `LOCAL_DB_USER` (default: `divemap_user`)
- `LOCAL_DB_PASSWORD` (default: `divemap_password`)

These can be set in your environment or in the docker-compose.yml file.

### Fly.io Database Configuration

Fly.io database credentials are loaded from:
1. **Credential file**: `database/FLY_secrets` (preferred)
2. **Environment variables**: `FLY_DB_*` variables

**Environment Variables:**
- `FLY_DB_HOST` (default: `divemap-db.flycast`)
- `FLY_DB_PORT` (default: `3306`)
- `FLY_DB_NAME` (default: `divemap`)
- `FLY_DB_USER` (default: `divemap_user`)
- `FLY_DB_PASSWORD` (required)

**Credential File Format** (`database/FLY_secrets`):
```
MYSQL_USER=divemap_user
MYSQL_PASSWORD=your_password_here
```

**Note**: The script prioritizes the credential file over environment variables for Fly.io credentials.

## Output Files

The script creates the following files:

### Backup Files
- `local_full_backup_YYYYMMDD_HHMMSS.sql` - Full local database backup
- `fly_full_backup_YYYYMMDD_HHMMSS.sql` - Full fly.io database backup

### Export Files
- `local_diving_export_YYYYMMDD_HHMMSS.sql` - Exported diving data

### Log Files
- `export_import_diving_data.log` - Detailed execution log

## Safety Features

1. **Full Backups**: Always creates full backups before any operations
2. **Backup Validation**: Validates that backup files contain data and are not empty
3. **Export Validation**: Ensures export files contain all expected tables and data
4. **Confirmation Prompt**: Asks for user confirmation before proceeding
5. **Error Handling**: Comprehensive error handling and logging
6. **Rollback Capability**: Full backups allow for easy rollback if needed

## Validation Features

The script includes comprehensive validation to ensure data integrity:

### Backup Validation
- **File existence**: Checks that backup files were created successfully
- **File size**: Ensures files are not empty (0 bytes)
- **Content validation**: Verifies files contain valid SQL content
- **MySQL dump format**: Checks for proper MySQL dump headers
- **Table structure**: Validates presence of CREATE TABLE statements
- **Data presence**: Checks for INSERT statements indicating data

### Export Validation
- **Expected tables**: Verifies all 16 expected tables are present
- **Table creation**: Ensures CREATE TABLE statements for each table
- **Data integrity**: Counts INSERT statements to verify data presence
- **Key tables**: Specifically validates dive_sites and diving_centers have data
- **File structure**: Ensures proper SQL dump format
- **Record counting**: Validates actual record counts in key tables
- **Data presence**: Ensures at least 1 dive site and 1 diving center exist

### Validation Failures
If validation fails, the script will:
- Stop execution immediately
- Log detailed error messages with ❌ indicators
- Provide specific information about what failed
- Show record counts and requirements
- Allow you to investigate and fix issues before retrying

### Validation Requirements
The script enforces these minimum requirements:
- **dive_sites**: At least 1 record required
- **diving_centers**: At least 1 record required
- **Source database**: Must contain data before export
- **Export file**: Must contain valid SQL with actual data

## Troubleshooting

### Common Issues

1. **MySQL Client Not Found**
   ```bash
   # Install MySQL client tools
   apt-get update && apt-get install -y default-mysql-client
   ```

2. **Connection Refused**
   - Ensure local database is running: `docker-compose up -d`
   - Check fly.io database is accessible: `fly status -a divemap-db`

3. **Permission Denied**
   - Ensure script is executable: `chmod +x utils/export_import_diving_data.py`
   - Check database user permissions

4. **Foreign Key Violations**
   - The script handles dependencies automatically
   - If issues persist, check the log file for specific errors

5. **Validation Failures**
   - Check that databases contain data before running export
   - Verify database connectivity and permissions
   - Review log files for specific validation error messages

### Log Analysis

Check the log file for detailed information:
```bash
tail -f export_import_diving_data.log
```

### Rollback Procedure

If the import fails or causes issues:

1. **Stop the application** to prevent further data corruption
2. **Restore from backup**:
   ```bash
   mysql -h divemap-db.fly.dev -u divemap_user -p divemap < database_backups/fly_full_backup_YYYYMMDD_HHMMSS.sql
   ```
3. **Restart the application**

## Security Considerations

1. **Credentials**: Database credentials are stored in the script and should be kept secure
2. **Network Access**: Fly.io database should be properly secured
3. **Backup Storage**: Backup files contain sensitive data and should be stored securely
4. **Log Files**: Log files may contain sensitive information

## Related Documentation

- [Database Schema](./database.md)
- [Deployment Guide](../deployment/fly-io.md)
- [Development Setup](../getting-started/README.md)

## Support

If you encounter issues:

1. Check the log file for detailed error messages
2. Verify database connectivity
3. Ensure all prerequisites are met
4. Review the troubleshooting section above
