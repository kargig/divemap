# Importing Data into Divemap

This comprehensive guide covers all methods for importing dive data into the Divemap platform, including Subsurface text files, XML files, and implementation planning.

## Table of Contents

1. [Overview](#overview)
2. [Import Methods](#import-methods)
   - [Subsurface Text Files](#subsurface-text-files)
   - [Subsurface XML Files](#subsurface-xml-files)
3. [Implementation Status](#implementation-status)
4. [Common Workflows](#common-workflows)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Features](#advanced-features)

## Overview

Divemap supports multiple import methods for bringing dive data into the platform:

- **Subsurface Text Files**: Import dive sites and dives from Subsurface text format
- **Subsurface XML Files**: Import comprehensive dive data from Subsurface XML format
- **Smart Conflict Resolution**: Automatic detection and resolution of duplicate data
- **Batch Processing**: Support for large-scale data imports

## Import Methods

### Subsurface Text Files

#### Dive Site Import (`import_subsurface_divesite.py`)

Imports dive sites from Subsurface text files with smart conflict resolution.

##### Basic Usage
```bash
# Interactive mode with conflict resolution
python utils/import_subsurface_divesite.py

# Force mode (no confirmations)
python utils/import_subsurface_divesite.py -f

# Dry run (show what would be imported)
python utils/import_subsurface_divesite.py --dry-run
```

##### Batch Processing
```bash
# Skip all sites with conflicts
python utils/import_subsurface_divesite.py --skip-all

# Update all existing sites with conflicts
python utils/import_subsurface_divesite.py --update-all

# Create merge files for all sites that can be updated
python utils/import_subsurface_divesite.py --create-merge-all
```

##### Specific File Import
```bash
# Import a specific dive site file
python utils/import_subsurface_divesite.py --file Site-12345
```

#### Dive Import (`import_subsurface_dives.py`)

Imports dives from Subsurface dive files with dive site matching.

##### Basic Usage
```bash
# Interactive mode with conflict resolution
python utils/import_subsurface_dives.py --dry-run

# Force mode (no confirmations)
python utils/import_subsurface_dives.py -f

# Dry run with limit
python utils/import_subsurface_dives.py --dry-run --max-dives=10
```

##### Batch Processing
```bash
# Skip all dives with conflicts
python utils/import_subsurface_dives.py --skip-existing

# Update all existing dives with conflicts
python utils/import_subsurface_dives.py --update-existing

# Create merge files for all dives that can be updated
python utils/import_subsurface_dives.py --create-merge-all
```

##### Processing Control
```bash
# Limit number of dives processed
python utils/import_subsurface_dives.py --max-dives=50

# Specify custom repository path
python utils/import_subsurface_dives.py --repo-path utils/Subsurface
```

### Subsurface XML Files

#### XML Import Script (`import_subsurface_xml.py`)

The XML import script parses Subsurface XML files and imports dive information via the backend API.

##### Features

- **Dive site matching**: Links dives to existing dive sites using import IDs
- **Dive information parsing**: Extracts all dive data from XML format
- **Cylinder information**: Parses gas tank data and includes it in dive information
- **Weight systems**: Extracts weight system information
- **Dive computer data**: Extracts dive computer information (keeping only "Deco model" from extradata)
- **Conflict resolution**: Handles existing dives with interactive prompts

##### XML Parsing Capabilities

- Direct parsing of Subsurface XML format
- Extracts dive sites from `<divesites>` section
- Parses dive information from `<dive>` elements
- Handles `<cylinder>` information for gas tanks
- Processes `<weightsystem>` data
- Extracts dive computer data from `<divecomputer>`

##### Data Mapping

- Converts Subsurface ratings (1-5) to Divemap ratings (1-10)
- Maps suit types to Divemap format (wet_suit, dry_suit, shortie)
- Parses duration formats (e.g., "53:00 min" → 53 minutes)
- Extracts depth information from dive computer data
- Builds comprehensive dive information text

##### Usage

```bash
# Import a single XML file
python import_subsurface_xml.py path/to/dive_file.xml

# Dry run to see what would be imported
python import_subsurface_xml.py path/to/dive_file.xml --dry-run

# Force mode (skip all prompts)
python import_subsurface_xml.py path/to/dive_file.xml -f

# Skip existing dives
python import_subsurface_xml.py path/to/dive_file.xml --skip-existing

# Update existing dives
python import_subsurface_xml.py path/to/dive_file.xml --update-existing
```

##### Command Line Options

| Option | Description |
|--------|-------------|
| `xml_file` | Path to the Subsurface XML file to import |
| `-f, --force` | Skip confirmation prompts |
| `--dry-run` | Show what would be imported without actually importing |
| `--skip-existing` | Skip all dives that already exist |
| `--update-existing` | Update all existing dives with conflicts |
| `--user-id ID` | Specify user ID for imported dives (default: admin user) |

##### XML Format Support

The script supports the standard Subsurface XML format:

```xml
<divelog program='subsurface' version='3'>
  <divesites>
    <site uuid='31db931b' name='Site Name' gps='37.727840 24.121380'>
      <geo cat='2' origin='2' value='Country'/>
    </site>
  </divesites>
  <dives>
    <dive number='321' rating='3' visibility='3' sac='12.844 l/min'
          otu='38' cns='16%' tags='Scubalife, Wreck' divesiteid='31db931b'
          date='2025-04-12' time='15:00:14' duration='53:00 min'>
      <buddy>Diver Name</buddy>
      <cylinder vol='14.0l' workpressure='220.0bar' description='D7 220 bar' 
                start='200.0bar' end='60.0bar' depth='66.019m'/>
      <weightsystem weight='4.2kg' description='weight'/>
    </dive>
  </dives>
</divelog>
```

## Implementation Status

### ✅ Completed Features

#### Backend Infrastructure
- Database models: `ParsedDiveTrip`, `ParsedDive`, `Newsletter`
- Newsletter upload and parsing API endpoints
- AI-powered newsletter content extraction using OpenAI
- Parsed dive trip CRUD operations
- Trip filtering and search capabilities
- Relationship mapping between trips, dives, and dive sites
- Trip status management (scheduled, confirmed, cancelled, completed)

#### Import Scripts
- `import_subsurface_divesite.py` - Dive site import with conflict resolution
- `import_subsurface_dives.py` - Dive import with site matching
- `import_subsurface_xml.py` - XML format import
- Smart conflict resolution and batch processing
- Interactive and force modes for different use cases

#### Data Mapping
- Subsurface ratings (1-5) → Divemap ratings (1-10)
- Suit type mapping (wet_suit, dry_suit, shortie)
- Duration format parsing
- Depth information extraction
- Comprehensive dive information building

### 🔄 Partially Implemented

#### Frontend Integration
- Basic import script execution
- Import progress tracking
- Error handling and user feedback

### ❌ Planned Features

#### Enhanced Import Interface
- Web-based import interface
- Drag-and-drop file uploads
- Real-time import progress
- Import history and rollback
- Bulk import management

#### Advanced Data Processing
- Automatic dive site geocoding
- Photo and media import
- Tag system integration
- User preference mapping

## Common Workflows

### Workflow 1: Import New Dive Sites Only
```bash
# Step 1: Import only new dive sites (skip conflicts)
python utils/import_subsurface_divesite.py -f --skip-all

# Step 2: Import dives (they will find the newly imported sites)
python utils/import_subsurface_dives.py --dry-run --max-dives=100
```

### Workflow 2: Review and Import Everything
```bash
# Step 1: Create merge files for all dive site conflicts
python utils/import_subsurface_divesite.py --create-merge-all

# Step 2: Review merge files and resolve conflicts
# Step 3: Import with resolved conflicts
python utils/import_subsurface_divesite.py -f

# Step 4: Import dives
python utils/import_subsurface_dives.py -f
```

### Workflow 3: XML Import with Conflict Resolution
```bash
# Step 1: Dry run to see what would be imported
python import_subsurface_xml.py my_dives.xml --dry-run

# Step 2: Import with conflict resolution
python import_subsurface_xml.py my_dives.xml

# Step 3: Batch import with force mode
python import_subsurface_xml.py my_dives.xml -f --skip-existing
```

### Workflow 4: Large Dataset Import
```bash
# Step 1: Import dive sites in batches
python utils/import_subsurface_divesite.py -f --skip-all

# Step 2: Import dives in batches
python utils/import_subsurface_dives.py -f --max-dives=1000 --skip-existing

# Step 3: Continue with remaining dives
python utils/import_subsurface_dives.py -f --max-dives=1000 --skip-existing
```

## Troubleshooting

### Common Issues

#### 1. Import Scripts Not Found
```bash
# Ensure you're in the correct directory
cd /home/kargig/src/divemap

# Check if scripts exist
ls -la utils/import_*.py
```

#### 2. Database Connection Issues
```bash
# Ensure backend is running
docker-compose ps

# Check database connectivity
docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

#### 3. Permission Issues
```bash
# Make scripts executable
chmod +x utils/import_*.py

# Check file permissions
ls -la utils/import_*.py
```

#### 4. Import Conflicts
```bash
# Use dry-run mode to preview conflicts
python utils/import_subsurface_divesite.py --dry-run

# Use force mode to skip all conflicts
python utils/import_subsurface_divesite.py -f --skip-all
```

### Debug Commands

```bash
# Check import script help
python utils/import_subsurface_divesite.py --help
python utils/import_subsurface_dives.py --help
python import_subsurface_xml.py --help

# Test with sample data
python utils/import_subsurface_divesite.py --dry-run --file Site-12345

# Check import logs
docker-compose logs backend
```

## Advanced Features

### Smart Conflict Resolution

The import system automatically detects and resolves conflicts:

- **Dive Site Conflicts**: Name, location, and description matching
- **Dive Conflicts**: Date, time, duration, and site matching
- **Data Merging**: Intelligent combination of existing and new data
- **User Control**: Interactive prompts for conflict resolution

### Batch Processing

Support for large-scale imports:

- **Skip Mode**: Skip all conflicts automatically
- **Update Mode**: Update existing records with new data
- **Merge Mode**: Create merge files for manual review
- **Progress Tracking**: Monitor import progress for large datasets

### Data Validation

Comprehensive validation of imported data:

- **Format Validation**: Check data format and structure
- **Data Integrity**: Validate relationships between entities
- **Error Reporting**: Detailed error messages for troubleshooting
- **Rollback Support**: Ability to undo failed imports

### Performance Optimization

Optimized for large datasets:

- **Batch Processing**: Process multiple records efficiently
- **Database Optimization**: Use of database transactions and bulk operations
- **Memory Management**: Efficient memory usage for large files
- **Progress Feedback**: Real-time progress updates during import

## Related Documentation

- [Development Guide](./README.md) - General development setup
- [Database Guide](./database.md) - Database schema and migrations
- [API Documentation](./api.md) - Import-related API endpoints
- [Testing Guide](./testing.md) - Testing import functionality

## Support

For issues with data import:

1. **Check this troubleshooting guide**
2. **Review import script help**: `python script.py --help`
3. **Use dry-run mode** to preview imports
4. **Check backend logs** for detailed error information
5. **Verify database connectivity** before importing

For additional help, refer to the development documentation or contact the development team.
