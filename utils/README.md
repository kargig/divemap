# Utils Directory

This directory contains utility scripts for the Divemap project.

## Table of Contents

1. [Database Management Scripts](#database-management-scripts)
2. [Data Import Scripts](#data-import-scripts)
3. [Data Export Scripts](#data-export-scripts)
4. [Dive Site Management Scripts](#dive-site-management-scripts)
5. [Testing and Validation Scripts](#testing-and-validation-scripts)
6. [Code Quality Scripts](#code-quality-scripts)
7. [Troubleshooting](#troubleshooting)
8. [Documentation](#documentation)
9. [Prerequisites](#prerequisites)
10. [Security Notes](#security-notes)
11. [Support](#support)

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

## Dive Site Management Scripts

### Location Updates

**`update_dive_site_locations.py`** - Update dive sites with country/region data
- **Single Site Updates**: Update a specific dive site by ID
- **Batch Updates**: Process all dive sites missing country/region data
- **Dry Run Mode**: Preview changes without applying them
- **Rate Limiting**: Respects API rate limits for external geocoding services
- **Environment Configuration**: Configurable via environment variables
- **Authentication**: Secure API authentication using JWT tokens with auto-refresh
- **Progress Tracking**: Real-time progress updates and summary statistics
- **Error Handling**: Robust error handling with detailed logging and timestamps

#### Features
- **Proactive Rate Limiting**: Prevents hitting backend rate limits
- **Sliding Window Support**: Optimized for slowapi 0.1.9 backend
- **Token Auto-Refresh**: Automatically handles expired JWT tokens
- **Comprehensive Logging**: Timestamps on all operations for debugging
- **Smart Retry Logic**: Intelligent retry with exponential backoff

#### Usage Examples
```bash
# Update all dive sites missing country/region data
python utils/update_dive_site_locations.py

# Update a specific dive site by ID
python utils/update_dive_site_locations.py --dive-site-id 123

# Dry run mode - preview changes without applying
python utils/update_dive_site_locations.py --dry-run

# Conservative rate limiting for production
python utils/update_dive_site_locations.py --max-requests-per-minute 50 --max-retries 5

# Debug mode with detailed logging
python utils/update_dive_site_locations.py --debug --max-requests-per-minute 60
```

#### Configuration
```bash
# Environment variables
export DIVEMAP_BASE_URL="http://localhost:8000"
export DIVEMAP_USERNAME="admin"
export DIVEMAP_PASSWORD="your_admin_password"

# Or use command line options
python utils/update_dive_site_locations.py \
  --base-url "https://api.divemap.com" \
  --username "admin" \
  --password "admin123"
```

#### API Endpoints Used
- `POST /api/v1/auth/login` - Authentication
- `GET /api/v1/dive-sites/` - List all dive sites
- `GET /api/v1/dive-sites/{id}` - Get specific dive site
- `GET /api/v1/dive-sites/reverse-geocode` - Reverse geocoding
- `PUT /api/v1/dive-sites/{id}` - Update dive site

#### Rate Limiting Strategy
- **Backend**: Respects slowapi 0.1.9 sliding window rate limits (75/minute)
- **Proactive**: Waits before approaching limits to prevent 429 errors
- **Recovery**: Waits 3-5 minutes after rate limits to allow sliding window to clear
- **Conservative**: Default limit of 60 requests/minute (75 - 15 buffer)

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

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify username and password are correct
   - Ensure the user has admin privileges
   - Check if the API is accessible

2. **No Dive Sites Found**
   - Verify the API endpoint is correct
   - Check if there are dive sites in the database
   - Ensure proper authentication

3. **Geocoding Failures**
   - Check internet connectivity
   - Verify coordinates are valid
   - Check API rate limits

4. **Update Failures**
   - Ensure user has admin permissions
   - Check API endpoint accessibility
   - Verify dive site exists

### Dive Site Location Updater Issues

5. **Rate Limit Errors (429)**
   - Script automatically handles rate limits with 3-5 minute waits
   - Use `--max-requests-per-minute 50` for conservative limits
   - Monitor backend logs for rate limit warnings

6. **Authentication Token Expired (401)**
   - Script automatically refreshes expired JWT tokens
   - No manual intervention required
   - Check authentication credentials if refresh fails

7. **Slow Performance**
   - Rate limiting is intentional to respect backend limits
   - Use `--dry-run` first to estimate processing time
   - Consider running during low-traffic periods

8. **Geocoding Failures**
   - Check coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
   - Verify internet connectivity for OpenStreetMap Nominatim API
   - Some remote locations may not have detailed geocoding data

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

### Additional Requirements for Dive Site Location Updater

- `requests` library (Python HTTP client)
- Valid admin user credentials for the Divemap API
- Internet connectivity for OpenStreetMap Nominatim geocoding service
- Access to the Divemap backend API endpoints

## Security Notes

- Database credentials are stored in scripts
- Backup files contain sensitive data
- Log files may contain sensitive information
- Store backups securely
- Use appropriate file permissions

### Dive Site Location Updater Security

- **API Credentials**: Never commit admin credentials to version control
- **JWT Tokens**: Tokens are automatically refreshed but should be kept secure
- **Environment Variables**: Use `.env` files for local development (not committed)
- **Admin Access**: Script requires admin privileges to update dive sites
- **Rate Limiting**: Built-in protection against API abuse and external service limits

## Support

For issues with utility scripts:
1. Check the relevant documentation
2. Review log files for errors
3. Test with small datasets first
4. Verify database connectivity
5. Contact development team
