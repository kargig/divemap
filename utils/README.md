# Utils Directory

This directory contains utility scripts for the Divemap project.

## Database Management Scripts

### Database Export/Import

**`export_import_diving_data.py`** - Main export/import script
- Exports diving centers, dive sites, and related tables from local database
- Imports data to fly.io database, overwriting existing data
- Creates full backups before operations
- Handles foreign key relationships properly

**`test_database_connections.py`** - Connection test script
- Tests connectivity to both local and fly.io databases
- Verifies table access and permissions
- Use before running the main export/import script

**`run_export_import.sh`** - Shell wrapper script
- Runs the export/import process from within docker container
- Handles MySQL client installation
- Provides colored output and error handling

### Usage

```bash
# Test database connections first
docker exec -it divemap_backend bash -c 'cd /app && python utils/test_database_connections.py'

# Run the export/import process
docker exec -it divemap_backend bash -c 'cd /app && python utils/export_import_diving_data.py'

# Or use the shell wrapper
docker exec -it divemap_backend bash -c 'cd /app && ./utils/run_export_import.sh'
```

## Data Import Scripts

### Dive Site Import

**`import_subsurface_divesite.py`** - Import dive sites from text files
- Smart conflict resolution with existing sites
- Proximity-based duplicate detection
- Interactive, batch, and merge file modes
- Preserves existing data not in import files

**`import_kml_dive_sites.py`** - Import dive sites from KML files
- Automatic tag assignment based on icons
- Batch processing of KML files
- Geographic coordinate handling

### Dive Import

**`import_subsurface_dives.py`** - Import dives from Subsurface XML
- Parses Subsurface dive log XML files
- Creates dive records with site associations
- Handles dive metadata and statistics

**`import_subsurface_xml.py`** - Comprehensive Subsurface import
- Imports both dive sites and dives
- Handles complex XML structures
- Batch processing capabilities

## Data Export Scripts

**`export_database_data.py`** - General database export
- Exports specific tables or entire database
- Configurable output formats
- Backup and restore functionality

## Testing and Validation Scripts

**`test_import_script.py`** - Test import functionality
- Validates import script behavior
- Tests with sample data
- Error handling verification

**`validate_frontend.js`** - Frontend validation
- Tests React component functionality
- Validates API integration
- Performance testing

**`test_regressions.js`** - Regression testing
- Automated regression test suite
- Frontend functionality validation
- API endpoint testing

**`run_frontend_tests.js`** - Frontend test runner
- Executes all frontend tests
- Generates test reports
- Coverage analysis

**`run_all_tests.js`** - Complete test suite
- Runs all tests (frontend and backend)
- Comprehensive validation
- Test result aggregation

## Code Quality Scripts

**`check_whitespace.sh`** - Whitespace validation
- Checks for trailing whitespace
- Validates code formatting
- Pre-commit validation

**`fix_whitespace.sh`** - Whitespace correction
- Removes trailing whitespace
- Fixes formatting issues
- Batch file processing

**`lint_code.sh`** - Code linting
- Runs linting tools
- Code style validation
- Quality checks

**`run_tests.sh`** - Test execution
- Runs backend tests
- Executes test suites
- Generates reports

## Documentation

For detailed information about database export/import procedures, see:
- [Database Export/Import Guide](../docs/maintenance/database-export-import.md)

For import script usage and maintenance, see:
- [Maintenance Guide](../docs/maintenance/README.md)

## Prerequisites

- MySQL client tools (`mysqldump`, `mysql`)
- Python 3.11+ with required packages
- Docker environment running
- Access to fly.io deployment

## Security Notes

- Database credentials are stored in scripts
- Backup files contain sensitive data
- Log files may contain sensitive information
- Store backups securely
- Use appropriate file permissions

## Support

For issues with utility scripts:
1. Check the relevant documentation
2. Review log files for errors
3. Test with small datasets first
4. Verify database connectivity
5. Contact development team
