# Importing Data into Divemap

This document describes the import scripts available for importing dive sites and dives from Subsurface data.

## Overview

Two main import scripts are available:

1. **`import_subsurface_divesite.py`** - Import dive sites from Subsurface text files
2. **`import_subsurface_dives.py`** - Import dives from Subsurface dive files

## Import Scripts

### 1. Dive Site Import (`import_subsurface_divesite.py`)

Imports dive sites from Subsurface text files with smart conflict resolution.

#### Basic Usage
```bash
# Interactive mode with conflict resolution
python utils/import_subsurface_divesite.py

# Force mode (no confirmations)
python utils/import_subsurface_divesite.py -f

# Dry run (show what would be imported)
python utils/import_subsurface_divesite.py --dry-run
```

#### Batch Processing
```bash
# Skip all sites with conflicts
python utils/import_subsurface_divesite.py --skip-all

# Update all existing sites with conflicts
python utils/import_subsurface_divesite.py --update-all

# Create merge files for all sites that can be updated
python utils/import_subsurface_divesite.py --create-merge-all
```

#### Specific File Import
```bash
# Import a specific dive site file
python utils/import_subsurface_divesite.py --file Site-12345
```

### 2. Dive Import (`import_subsurface_dives.py`)

Imports dives from Subsurface dive files with dive site matching.

#### Basic Usage
```bash
# Interactive mode with conflict resolution
python utils/import_subsurface_dives.py --dry-run

# Force mode (no confirmations)
python utils/import_subsurface_dives.py -f

# Dry run with limit
python utils/import_subsurface_dives.py --dry-run --max-dives=10
```

#### Batch Processing
```bash
# Skip all dives with conflicts
python utils/import_subsurface_dives.py --skip-existing

# Update all existing dives with conflicts
python utils/import_subsurface_dives.py --update-existing

# Create merge files for all dives that can be updated
python utils/import_subsurface_dives.py --create-merge-all
```

#### Processing Control
```bash
# Limit number of dives processed
python utils/import_subsurface_dives.py --max-dives=50

# Specify custom repository path
python utils/import_subsurface_dives.py --repo-path utils/Subsurface
```

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

# Step 2: Review and apply merge files
for file in merge_*.txt; do
  python utils/import_subsurface_divesite.py --import-merge "$file"
done

# Step 3: Import dives with limit
python utils/import_subsurface_dives.py --dry-run --max-dives=200
```

### Workflow 3: Update Existing Data
```bash
# Step 1: Update all existing dive sites
python utils/import_subsurface_divesite.py -f --update-all

# Step 2: Update all existing dives
python utils/import_subsurface_dives.py -f --update-existing
```

## Interactive Options

When the scripts find conflicts, they offer these options:

### Dive Site Conflicts
- **Similar Name Found**:
  - `y`: Skip the similar site
  - `n`: Continue with creation
  - `m`: Create a merge file for manual editing

- **Nearby Site Found**:
  - `u`: Update the existing site
  - `c`: Create a new site
  - `s`: Skip this site
  - `m`: Create a merge file for manual editing

### Dive Conflicts
- **Existing Dive Found**:
  - `s`: Skip existing dive
  - `u`: Update existing dive
  - `c`: Create new dive
  - `m`: Create merge file for manual editing

## Configuration

Both scripts use these default settings:

- **Backend URL**: `http://localhost:8000`
- **Admin Credentials**: From `local_testme` file
- **Distance Threshold**: 200 meters (dive sites), 500 meters (dives)
- **Similarity Threshold**: 0.8 (80%)

## Prerequisites

1. **Backend Running**: Ensure the backend is running via Docker:
   ```bash
   docker-compose up backend
   ```

2. **Data Structure**: Ensure Subsurface data is in the expected format:
   ```
   utils/Subsurface/
   ├── 01-Divesites/
   │   ├── Site-12345
   │   └── Site-67890
   └── YYYY/MM/DD-Day-HH=mm=SS/
       └── Dive-Number
   ```

## Troubleshooting

### Common Issues

1. **Backend Not Running**:
   ```
   ❌ Cannot connect to backend at http://localhost:8000
   Make sure the backend is running: docker-compose up backend
   ```

2. **Authentication Failed**:
   ```
   ❌ Failed to login: 401 Unauthorized
   ```
   Check that admin credentials are correct in the script.

3. **Rate Limiting**:
   ```
   ⏳ Rate limited, waiting 2 seconds...
   ```
   The scripts automatically handle rate limiting.

4. **Missing Dive Sites**:
   ```
   ❌ ERROR: No dive site found for import ID: xxx
   Import this dive site with: python utils/import_subsurface_divesite.py --file Site-xxx
   ```
   Import the missing dive site first, then retry the dive import.

### Debug Mode

For debugging, you can:

```bash
# Check backend connectivity
curl http://localhost:8000/api/v1/dive-sites

# Check backend logs
docker-compose logs backend

# Test with a single file
python utils/import_subsurface_divesite.py --dry-run

# Test dive import with limit
python utils/import_subsurface_dives.py --dry-run --max-dives=5
```

## Advanced Usage

### Custom Similarity Threshold

Edit the dive site script to change the similarity threshold:
```python
SIMILARITY_THRESHOLD = 0.7  # More strict matching
```

### Custom Distance Threshold

Edit the scripts to change the proximity threshold:
```python
DISTANCE_THRESHOLD = 500  # 500 meters instead of 200
```

### Processing Large Datasets

For large imports, use these strategies:

1. **Start Small**: Use `--max-dives=10` to test with a small sample
2. **Dry Run First**: Always use `--dry-run` to preview changes
3. **Batch Processing**: Use merge files for complex conflicts
4. **Monitor Progress**: Check the summary output for progress

## File Formats

### Dive Site Files (Site-*)
```
name "Site Name"
description "Site description"
notes "Additional notes"
gps 36.970309 25.124448
geo cat 2 origin 2 "Country"
```

### Dive Files (Dive-*)
```
duration 42:30 min
rating 4
visibility 3
tags "Canyon", "wall"
divesiteid 12345
buddy "Dive buddy name"
suit "Wet Aqualung"
cylinder vol=14.0l workpressure=220.0bar description="D7 220 bar" o2=31.0% start=200.0bar end=60.0bar
weightsystem weight=4.2kg description="weight"
```

## Error Handling

The scripts handle various error conditions:

- **Backend Connection**: Checks if backend is running
- **Authentication**: Validates admin credentials
- **File Parsing**: Handles malformed files gracefully
- **API Errors**: Retries on rate limits
- **Invalid Data**: Skips files with missing required fields
- **Missing Dependencies**: Provides clear error messages for missing dive sites