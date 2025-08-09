# Subsurface XML Import Script

This document describes how to use the `import_subsurface_xml.py` script to import dive data from Subsurface XML files into the Divemap backend.

## Overview

The script parses Subsurface XML files and imports dive information into the Divemap database via the backend API. It handles:

- **Dive site matching**: Links dives to existing dive sites using import IDs
- **Dive information parsing**: Extracts all dive data from XML format
- **Cylinder information**: Parses gas tank data and includes it in dive information
- **Weight systems**: Extracts weight system information
- **Dive computer data**: Extracts dive computer information (keeping only "Deco model" from extradata)
- **Conflict resolution**: Handles existing dives with interactive prompts

## Features

### XML Parsing
- Direct parsing of Subsurface XML format
- Extracts dive sites from `<divesites>` section
- Parses dive information from `<dive>` elements
- Handles `<cylinder>` information for gas tanks
- Processes `<weightsystem>` data
- Extracts dive computer data from `<divecomputer>` (keeping only "Deco model" from extradata)

### Data Mapping
- Converts Subsurface ratings (1-5) to Divemap ratings (1-10)
- Maps suit types to Divemap format (wet_suit, dry_suit, shortie)
- Parses duration formats (e.g., "53:00 min" → 53 minutes)
- Extracts depth information from dive computer data
- Builds comprehensive dive information text

### Conflict Resolution
- Checks for existing dives based on date, time, and duration
- Calculates similarity scores for dive matching
- Interactive prompts for conflict resolution
- Force mode for batch processing
- Skip existing dives option

## Usage

### Basic Usage

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

### Command Line Options

| Option | Description |
|--------|-------------|
| `xml_file` | Path to the Subsurface XML file to import |
| `-f, --force` | Skip confirmation prompts |
| `--dry-run` | Show what would be imported without actually importing |
| `--skip-existing` | Skip all dives that already exist |
| `--update-existing` | Update all existing dives with conflicts |
| `--user-id ID` | Specify user ID for imported dives (default: admin user) |

### Examples

```bash
# Test with sample file
python import_subsurface_xml.py samples/dive1.xml --dry-run

# Import actual dive file
python import_subsurface_xml.py my_dives.xml

# Batch import with force mode
python import_subsurface_xml.py my_dives.xml -f --skip-existing
```

## XML Format Support

The script supports the standard Subsurface XML format with the following structure:

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
      <suit>DrySuit Rofos</suit>
      <cylinder size='15.0 l' workpressure='232.0 bar' description='15ℓ 232 bar' 
                o2='31.0%' start='210.0 bar' end='80.0 bar' depth='41.454 m' />
      <weightsystem weight='6.2 kg' description='weight' />
      <divecomputer model='Shearwater Perdix AI' deviceid='8a66df8d' diveid='232b0017'>
        <depth max='28.7 m' mean='16.849 m' />
        <temperature water='15.0 C' />
        <extradata key='Deco model' value='GF 30/85' />
        <!-- Other extradata is ignored -->
      </divecomputer>
    </dive>
  </dives>
</divelog>
```

## Data Mapping

### Dive Site Matching
- Uses the `divesiteid` attribute to match with existing dive sites
- Searches for dive sites with matching import IDs as aliases
- Falls back to name matching if no alias found

### Dive Information
The script builds comprehensive dive information including:
- Buddy information
- SAC (Surface Air Consumption)
- OTU (Oxygen Toxicity Units)
- CNS (Central Nervous System) toxicity
- Water temperature
- Surface pressure
- Water salinity
- Deco model (from dive computer extradata)
- Weight system information

### Gas Tanks
Cylinder information is formatted as:
```
Size | O2: XX% | Start→End bar | Description
```

Example: `15.0 l | O2: 31.0% | 210.0 bar→80.0 bar bar | 15ℓ 232 bar`

### Ratings
- Converts Subsurface ratings (1-5) to Divemap ratings (1-10)
- Maps visibility ratings similarly
- Defaults to 5 (10 in Divemap) for invalid ratings

### Suit Types
Maps Subsurface suit types to Divemap format:
- `wet`, `wetsuit`, `wet suit` → `wet_suit`
- `dry`, `drysuit`, `rofos` → `dry_suit`
- `shortie`, `shorty` → `shortie`

## Error Handling

The script includes comprehensive error handling:

- **File not found**: Graceful handling of missing files
- **Invalid XML**: Clear error messages for malformed XML
- **API errors**: Detailed error reporting for backend issues
- **Data validation**: Warnings for invalid data formats
- **Missing dive sites**: Continues import with warnings

## Output

The script provides detailed output including:

- Login status
- File processing progress
- Dive parsing results
- Conflict resolution prompts
- Import summary with success/error counts

Example output:
```
🚀 Starting Subsurface XML Import
✅ Successfully logged in as admin

📁 Processing XML file: samples/dive1.xml
⚠️  Dive site not found: Attiki - Makronissos - Portugal bow (ID: 31db931b)
📊 Found 1 dives in XML file

🔍 Processing dive 1/1
🆕 Creating new dive
✅ Successfully created dive ID: 123

📈 Import Summary:
   ✅ Successfully processed: 1
   ⏭️  Skipped: 0
   ❌ Errors: 0
```

## Requirements

- Python 3.7+
- `requests` library
- Backend API running on `http://localhost:8000`
- Admin credentials in `local_testme` file

## Troubleshooting

### Common Issues

1. **Login failed**: Check admin credentials in `local_testme` file
2. **Backend not running**: Ensure backend is running on port 8000
3. **XML parsing errors**: Verify XML file format is valid Subsurface format
4. **Dive site not found**: Import dive sites first using `import_subsurface_divesite.py`

### Debug Mode

Use `--dry-run` to see exactly what data would be imported without making changes.

## Related Scripts

- `import_subsurface_dives.py`: Import dives from Subsurface repository structure
- `import_subsurface_divesite.py`: Import dive sites from Subsurface format
- `subsurface_dive_parser.py`: Core parsing functionality for Subsurface data
