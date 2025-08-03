# Enhanced Dive Site Import Script

This script imports dive sites from files in the `utils/01-Divesites/` directory into the Divemap backend via API calls.

## Features

- **Smart Similarity Matching**: Uses multiple algorithms to detect similar dive site names
- **Proximity Checking**: Detects dive sites within 200m of the new site
- **Interactive Merge**: Creates merge files for complex updates
- **Batch Processing**: Multiple flags for different processing modes
- **Dry Run Mode**: Test without making changes
- **Force Mode**: Skip all confirmations

## File Format

The script reads files in the following format:
```
name "Dive Site Name"
description "Description text"
notes "Additional notes"
gps 36.970309 25.124448
```

- `name`: Required dive site name
- `description`: Optional description
- `notes`: Optional notes (merged into description if description is empty)
- `gps`: Required GPS coordinates (latitude longitude)

## Update Behavior

When updating existing dive sites, the script **replaces** these fields with new data:
- **Always updated**: `name`, `description`, `latitude`, `longitude`
- **Preserved if not in new data**: `address`, `access_instructions`, `difficulty_level`, `marine_life`, `safety_information`, `alternative_names`, `country`, `region`

The update is **selective** - it only changes the fields that are present in the new data, preserving existing information for fields not included in the import files.

## Usage

### Basic Usage
```bash
# Interactive mode (asks for confirmation)
python utils/import_dive_sites_enhanced.py

# Force mode (no confirmations)
python utils/import_dive_sites_enhanced.py -f

# Dry run (show what would be imported)
python utils/import_dive_sites_enhanced.py --dry-run
```

### Batch Processing Flags
```bash
# Skip all sites with conflicts
python utils/import_dive_sites_enhanced.py --skip-all

# Update all existing sites with conflicts
python utils/import_dive_sites_enhanced.py --update-all

# Create merge files for all sites that can be updated
python utils/import_dive_sites_enhanced.py --create-merge-all

# Combine flags
python utils/import_dive_sites_enhanced.py -f --update-all
```

### Merge File Usage
```bash
# Import a merge file to apply final changes
python utils/import_dive_sites_enhanced.py --import-merge merge_123_20241201_143022.txt
```

## Interactive Options

When the script finds conflicts, it offers these options:

- **Similar Name Found**:
  - `y`: Skip the similar site
  - `n`: Continue with creation
  - `m`: Create a merge file for manual editing

- **Nearby Site Found**:
  - `u`: Update the existing site
  - `c`: Create a new site
  - `s`: Skip this site
  - `m`: Create a merge file for manual editing

## Batch Processing Modes

### `--skip-all`
Skips all sites that have conflicts (similar names or nearby sites). Useful for importing only completely new sites.

### `--update-all`
Updates all existing sites that have conflicts. **Always updates**: name, description, coordinates. **Preserves**: address, access_instructions, difficulty_level, marine_life, safety_information, alternative_names, country, region.

### `--create-merge-all`
Creates merge files for all sites that have conflicts. This is useful when you want to:
- Review all potential updates before applying them
- Manually edit the merge files to customize the updates
- Process the merge files later in batch

## Merge Files

When you choose to create a merge file, the script generates a file with this structure:

```
# Merge file for dive site update
# Generated on: 2024-12-01 14:30:22
# File: Site-0952159a

--existing--
{
  "id": 123,
  "name": "Existing Site Name",
  "description": "Existing description",
  ...
}

--new--
{
  "name": "New Site Name",
  "description": "New description",
  "latitude": 36.970309,
  "longitude": 25.124448
}

--final--
# Edit the section below with the final merged data
# Then run: python import_dive_sites_enhanced.py --import-merge this_file.txt
{
  "name": "Final Site Name",
  "description": "Final description",
  "latitude": 36.970309,
  "longitude": 25.124448,
  ...
}
```

### Using Merge Files

1. Edit the `--final--` section with your desired merged data
2. Run: `python utils/import_dive_sites_enhanced.py --import-merge filename.txt`
3. The script will update the existing dive site with the final data

### Batch Processing Merge Files

After running with `--create-merge-all`, you can:

1. **Review all merge files**:
   ```bash
   ls merge_*.txt
   ```

2. **Edit merge files** to customize the updates

3. **Apply all merge files**:
   ```bash
   for file in merge_*.txt; do
     python utils/import_dive_sites_enhanced.py --import-merge "$file"
   done
   ```

## Common Workflows

### Workflow 1: Safe Import (Review First)
```bash
# Step 1: Create merge files for all conflicts
python utils/import_dive_sites_enhanced.py --create-merge-all

# Step 2: Review the generated merge files
ls merge_*.txt

# Step 3: Edit any merge files that need customization
# (optional - you can edit the --final-- sections)

# Step 4: Apply all merge files
for file in merge_*.txt; do
  python utils/import_dive_sites_enhanced.py --import-merge "$file"
done

# Step 5: Clean up merge files
rm merge_*.txt
```

### Workflow 2: Import Only New Sites
```bash
# Skip all conflicts, only import completely new sites
python utils/import_dive_sites_enhanced.py -f --skip-all
```

### Workflow 3: Update All Existing Sites
```bash
# Update all existing sites with new data
python utils/import_dive_sites_enhanced.py -f --update-all
```

### Workflow 4: Preview What Would Happen
```bash
# See what would be imported without making changes
python utils/import_dive_sites_enhanced.py --dry-run

# See what merge files would be created
python utils/import_dive_sites_enhanced.py --dry-run --create-merge-all
```

## Configuration

The script uses these default settings:

- **Backend URL**: `http://localhost:8000`
- **Admin Credentials**: From `local_testme` file
- **Distance Threshold**: 200 meters
- **Similarity Threshold**: 0.8 (80%)

## Prerequisites

1. **Backend Running**: Ensure the backend is running via Docker:
   ```bash
   docker-compose up backend
   ```

2. **Admin Access**: The script uses admin credentials from `local_testme`

3. **Python Dependencies**: The script requires:
   - `requests`
   - `pathlib`
   - `json`
   - `math`
   - `re`
   - `datetime`
   - `difflib`

## Example Output

```
🚀 Enhanced Dive Site Import Script
==================================================
✅ Successfully logged in as admin
📁 Found 159 dive site files
📝 CREATE MERGE ALL MODE - Creating merge files for all conflicts

📄 Processing: Site-0952159a
   Name: Antiparos - Panteronisi corner
   Coordinates: 36.970309, 25.124448

⚠️  Found similar dive site: Antiparos Panteronisi (ID: 45, similarity: 0.85)
   📝 Created merge file: merge_45_20241201_143022.txt

📄 Processing: Site-e6dac362
   Name: Moofuschi rock
   Coordinates: 3.882592, 72.730014

⚠️  Found nearby dive site: Moofuschi Reef (ID: 67, 150m away)
   📝 Created merge file: merge_67_20241201_143045.txt

==================================================
📊 Import Summary:
   Processed: 159
   Created: 45
   Updated: 0
   Skipped (similar name): 85
   Skipped (nearby): 15
   Merge files created: 100
   Errors: 0
```

## Error Handling

The script handles various error conditions:

- **Backend Connection**: Checks if backend is running
- **Authentication**: Validates admin credentials
- **File Parsing**: Handles malformed files gracefully
- **API Errors**: Retries on rate limits
- **Invalid Data**: Skips files with missing required fields

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
   The script automatically handles rate limiting.

4. **Invalid GPS Coordinates**:
   ```
   ❌ Invalid GPS coordinates in Site-xxx: invalid_value
   ```
   Check the GPS format in the file.

### Debug Mode

For debugging, you can:

```bash
# Check backend connectivity
curl http://localhost:8000/api/v1/dive-sites

# Check backend logs
docker-compose logs backend

# Test with a single file
python utils/import_dive_sites_enhanced.py --dry-run
```

## Advanced Usage

### Custom Similarity Threshold

Edit the script to change the similarity threshold:
```python
SIMILARITY_THRESHOLD = 0.7  # More strict matching
```

### Custom Distance Threshold

Edit the script to change the proximity threshold:
```python
DISTANCE_THRESHOLD = 500  # 500 meters instead of 200
```

### Batch Processing Workflows

For large imports, here are some recommended workflows:

1. **Review First, Then Import**:
   ```bash
   # Create merge files for all conflicts
   python utils/import_dive_sites_enhanced.py --create-merge-all
   
   # Review and edit merge files
   # Then apply them
   for file in merge_*.txt; do
     python utils/import_dive_sites_enhanced.py --import-merge "$file"
   done
   ```

2. **Import New Sites Only**:
   ```bash
   # Skip all conflicts, only import completely new sites
   python utils/import_dive_sites_enhanced.py -f --skip-all
   ```

3. **Update All Existing Sites**:
   ```bash
   # Update all existing sites with new data
   python utils/import_dive_sites_enhanced.py -f --update-all
   ```

4. **Dry Run to Preview**:
   ```bash
   # See what would happen without making changes
   python utils/import_dive_sites_enhanced.py --dry-run
   ``` 