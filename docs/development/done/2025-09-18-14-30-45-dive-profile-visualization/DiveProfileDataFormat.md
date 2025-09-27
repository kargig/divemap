# Dive Profile Data Format Documentation

## Overview

This document describes the data format used for dive profile visualization in the Divemap application. The format supports both XML import from Subsurface and JSON storage for imported profiles.

## Data Structure

### Root Profile Data Object

```typescript
interface DiveProfileData {
  samples: Sample[];
  events: Event[];
  sample_count: number;
  calculated_max_depth: number;
  calculated_avg_depth: number;
  calculated_duration_minutes: number;
  temperature_range: {
    min: number | null;
    max: number | null;
  };
}
```

## Sample Data Format

### Sample Object

Each sample represents a single data point in the dive profile.

```typescript
interface Sample {
  // Time information
  time: string;                    // Original time string (e.g., "10:30 min", "1:15:30 min")
  time_minutes: number;            // Time in minutes as float (e.g., 10.5, 75.5)
  
  // Depth information
  depth: number;                   // Depth in meters (positive values)
  
  // Optional physiological data
  temperature?: number;            // Water temperature in Celsius
  ndl_minutes?: number;           // No Decompression Limit in minutes
  in_deco?: boolean;              // Decompression status (true = in decompression)
  cns_percent?: number;           // Central Nervous System percentage
  stopdepth?: number;             // Decompression ceiling depth in meters (when in_deco=true)
  stoptime?: number;              // Mandatory stop time at ceiling in minutes (when in_deco=true)
  
  // Calculated fields
  averageDepth: number;           // Running average depth in meters
}
```

### Sample Examples

```json
{
  "time": "0:30 min",
  "time_minutes": 0.5,
  "depth": 5.2,
  "temperature": 28.5,
  "ndl_minutes": 60,
  "in_deco": false,
  "cns_percent": 0.1,
  "averageDepth": 5.2
}
```

```json
{
  "time": "45:15 min",
  "time_minutes": 45.25,
  "depth": 32.8,
  "temperature": 24.2,
  "ndl_minutes": 0,
  "in_deco": true,
  "cns_percent": 15.3,
  "stopdepth": 18.0,
  "stoptime": 2.5,
  "averageDepth": 18.7
}
```

## Event Data Format

### Event Object

Events represent significant occurrences during the dive (gas changes, alarms, etc.).

```typescript
interface Event {
  // Time information
  time: string;                    // Original time string (e.g., "36:00 min")
  time_minutes: number;            // Time in minutes as float (e.g., 36.0)
  
  // Event identification
  type: string;                    // Event type code (e.g., "25" for gas change)
  flags: string;                   // Event flags (e.g., "1", "2")
  name: string;                    // Event name (e.g., "gaschange")
  
  // Gas change specific data
  cylinder?: string;               // Cylinder number (e.g., "0", "1")
  o2?: string;                     // O2 percentage (e.g., "49.0%")
}
```

### Event Examples

```json
{
  "time": "36:00 min",
  "time_minutes": 36.0,
  "type": "25",
  "flags": "2",
  "name": "gaschange",
  "cylinder": "1",
  "o2": "49.0%"
}
```

## Time Format Handling

### Supported Time Formats

The system supports multiple time formats from different dive computers:

1. **Minutes:Seconds** (e.g., "10:30 min")
2. **Hours:Minutes:Seconds** (e.g., "1:15:30 min")
3. **Decimal Minutes** (e.g., "45.5 min")

### Time Conversion Rules

- **MM:SS format**: `minutes + (seconds / 60.0)`
- **HH:MM:SS format**: `(hours * 60) + minutes + (seconds / 60.0)`
- **Decimal format**: Used as-is

### Examples

| Input Time | Parsed Minutes | Description |
|------------|----------------|-------------|
| "0:30 min" | 0.5 | 30 seconds |
| "10:30 min" | 10.5 | 10 minutes 30 seconds |
| "1:15:30 min" | 75.5 | 1 hour 15 minutes 30 seconds |
| "45.5 min" | 45.5 | 45.5 minutes |

## Data Validation

### Required Fields

- `time`: Must be a non-empty string
- `time_minutes`: Must be a valid number >= 0
- `depth`: Must be a valid number >= 0
- `averageDepth`: Must be calculated and >= 0

### Optional Fields Validation

- `temperature`: If present, must be a valid number
- `ndl_minutes`: If present, must be >= 0
- `in_deco`: If present, must be boolean
- `cns_percent`: If present, must be >= 0 and <= 100

### Sample Validation Rules

1. **Time Progression**: `time_minutes` should generally increase
2. **Depth Range**: `depth` should be reasonable (0-200m typical)
3. **Temperature Range**: `temperature` should be reasonable (-2°C to 40°C)
4. **NDL Logic**: If `in_deco` is true, `ndl_minutes` should be 0 or undefined
5. **Stopdepth Logic**: If `in_deco` is true, `stopdepth` should be present and > 0
6. **Stopdepth Persistence**: When `in_deco` is true but `stopdepth` is missing, use previous value
7. **Stopdepth Reset**: When `in_deco` is false, `stopdepth` should be 0 or undefined
8. **Stoptime Logic**: If `in_deco` is true, `stoptime` should be present and > 0
9. **Stoptime Persistence**: When `in_deco` is true but `stoptime` is missing, use previous value
10. **Stoptime Reset**: When `in_deco` is false, `stoptime` should be null

## Data Processing

### Smart Sampling

For performance optimization, large datasets (>1000 samples) are automatically sampled:

```typescript
interface SamplingConfig {
  maxSamples: 1000;               // Maximum samples to display
  importantFields: [               // Fields that must be preserved
    'in_deco',
    'ndl_minutes',
    'cns_percent',
    'temp',
    'stopdepth',
    'tts'
  ];
  preserveImportant: true;        // Always include samples with important data
}
```

### Average Depth Calculation

Running average depth is calculated for each sample:

```typescript
function calculateAverageDepth(samples: Sample[]): number[] {
  const averages: number[] = [];
  let sum = 0;
  
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i].depth;
    averages[i] = sum / (i + 1);
  }
  
  return averages;
}
```

### Stopdepth Persistence Logic

Stopdepth values are processed with persistence logic to handle missing values:

```typescript
function processStopdepthData(samples: Sample[]): Sample[] {
  let lastKnownStopdepth = 0; // Initialize to surface (0m)
  
  return samples.map(sample => {
    if (sample.in_deco === true) {
      // When in decompression, use stopdepth if present, otherwise maintain previous value
      if (sample.stopdepth !== null && sample.stopdepth !== undefined) {
        lastKnownStopdepth = sample.stopdepth;
      }
    } else {
      // When not in decompression, reset stopdepth to 0 (surface)
      lastKnownStopdepth = 0;
    }
    
    return {
      ...sample,
      stopdepth: lastKnownStopdepth
    };
  });
}
```

**Key Rules:**
1. **Initial State**: Stopdepth starts at 0 (surface level)
2. **In Decompression**: When `in_deco=true`, use provided `stopdepth` or maintain previous value
3. **Out of Decompression**: When `in_deco=false`, reset `stopdepth` to 0
4. **Persistence**: Missing `stopdepth` values maintain the last known value during decompression

### Stoptime Persistence Logic

Stoptime values are processed with persistence logic similar to stopdepth:

```typescript
function processStoptimeData(samples: Sample[]): Sample[] {
  let lastKnownStoptime = null; // Initialize to null (no stop time at surface)
  
  return samples.map(sample => {
    if (sample.in_deco === true) {
      // When in decompression, use stoptime if present, otherwise maintain previous value
      if (sample.stoptime !== null && sample.stoptime !== undefined) {
        lastKnownStoptime = sample.stoptime;
      }
    } else {
      // When not in decompression, reset stoptime to null (no stop time)
      lastKnownStoptime = null;
    }
    
    return {
      ...sample,
      stoptime: lastKnownStoptime
    };
  });
}
```

**Key Rules:**
1. **Initial State**: Stoptime starts at null (no stop time at surface)
2. **In Decompression**: When `in_deco=true`, use provided `stoptime` or maintain previous value
3. **Out of Decompression**: When `in_deco=false`, reset `stoptime` to null
4. **Persistence**: Missing `stoptime` values maintain the last known value during decompression

## Import/Export Formats

### XML Import (Subsurface Format)

```xml
<dive>
  <computer>
    <sample time="0:30 min" depth="5.2 m" temp="28.5 C" ndl="60:00 min" />
    <sample time="45:15 min" depth="32.8 m" temp="24.2 C" in_deco="1" />
    <event time="36:00 min" type="25" name="gaschange" cylinder="1" o2="49.0%" />
  </computer>
</dive>
```

### JSON Storage Format

```json
{
  "samples": [
    {
      "time": "0:30 min",
      "time_minutes": 0.5,
      "depth": 5.2,
      "temperature": 28.5,
      "ndl_minutes": 60,
      "in_deco": false,
      "averageDepth": 5.2
    }
  ],
  "events": [
    {
      "time": "36:00 min",
      "time_minutes": 36.0,
      "type": "25",
      "name": "gaschange",
      "cylinder": "1",
      "o2": "49.0%"
    }
  ],
  "sample_count": 2962,
  "calculated_max_depth": 36.6,
  "calculated_avg_depth": 16.7,
  "calculated_duration_minutes": 54.0,
  "temperature_range": {
    "min": 24.2,
    "max": 28.5
  }
}
```

## Error Handling

### Common Data Issues

1. **Missing Time Data**: Samples without time are skipped
2. **Invalid Depth**: Negative depths are treated as 0
3. **Malformed Time**: Invalid time strings default to 0 minutes
4. **Missing Required Fields**: Samples without depth are skipped

### Data Correction

The system automatically corrects common data issues:

- Normalizes time formats to minutes
- Calculates missing average depth values
- Validates and corrects depth ranges
- Handles missing optional fields gracefully

## Performance Considerations

### Large Datasets

- **Sampling**: Automatic sampling for datasets >1000 samples
- **Lazy Loading**: Optional lazy loading for very large datasets
- **Memory Management**: Efficient data structures and cleanup

### Optimization Tips

1. Use smart sampling for large datasets
2. Pre-calculate average depth values
3. Validate data before processing
4. Use appropriate data types (numbers vs strings)

## API Integration

### Backend Endpoints

- `GET /api/v1/dives/{dive_id}/profile` - Retrieve profile data
- `POST /api/v1/dives/{dive_id}/profile` - Upload profile data
- `DELETE /api/v1/dives/{dive_id}/profile` - Delete profile data

### Frontend Integration

```typescript
// Fetch profile data
const profileData = await fetch(`/api/v1/dives/${diveId}/profile`).then(r => r.json());

// Use in component
<AdvancedDiveProfileChart profileData={profileData} />
```

## Version History

- **v1.0.0**: Initial data format specification
- **v1.1.0**: Added event support and gas change markers
- **v1.2.0**: Added smart sampling and performance optimizations
- **v1.3.0**: Enhanced validation and error handling
- **v1.4.0**: Added stopdepth field and decompression ceiling visualization support
- **v1.5.0**: Added stoptime field and mandatory stop time tooltip display

