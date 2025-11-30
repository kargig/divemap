# Overpass API Example for Coastline Detection

## Basic Query

```bash
# Query coastline segments within 1000 meters of dive site coordinates
curl -X POST "https://overpass-api.de/api/interpreter" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d '[out:json][timeout:25];
(
  way["natural"="coastline"](around:1000,27.9158,34.3296);
);
out geom;'
```

## Query Explanation

- `[out:json][timeout:25]` - Output format and timeout
- `way["natural"="coastline"]` - Find ways tagged with natural=coastline
- `(around:1000,27.9158,34.3296)` - Within 1000 meters of lat/lon
- `out geom;` - Include geometry (coordinates) in response

## Example Response Structure

```json
{
  "version": 0.6,
  "generator": "Overpass API",
  "elements": [
    {
      "type": "way",
      "id": 893884354,
      "geometry": [
        { "lat": 27.9077129, "lon": 34.3285216 },
        { "lat": 27.9077532, "lon": 34.3285505 },
        { "lat": 27.9077452, "lon": 34.3285709 },
        ...
      ],
      "tags": {
        "natural": "coastline"
      }
    }
  ]
}
```

## Processing Logic

1. **Find nearest coastline segment**: Calculate distance from dive site to each segment
2. **Get segment endpoints**: Use first and last points of the nearest segment
3. **Calculate coastline bearing**: 
   ```python
   from math import atan2, degrees
   
   def calculate_bearing(lat1, lon1, lat2, lon2):
       # Convert to radians
       lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
       
       # Calculate bearing
       dlon = lon2 - lon1
       bearing = atan2(
           sin(dlon) * cos(lat2),
           cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
       )
       
       # Convert to degrees and normalize to 0-360
       bearing = degrees(bearing)
       return (bearing + 360) % 360
   ```
4. **Calculate shore direction**: 
   - Coastline bearing + 90° (perpendicular, facing seaward)
   - OSM coastlines are oriented with land on left, water on right
   - Shore direction = direction you face when looking out to sea

## Python Implementation Example

```python
import requests
import math
from typing import Optional, Dict

def detect_shore_direction(latitude: float, longitude: float, radius: int = 1000) -> Optional[Dict]:
    """
    Detect shore direction using OpenStreetMap coastline data.
    
    Returns:
        {
            "shore_direction": <degrees 0-360>,
            "confidence": "high|medium|low",
            "method": "osm_coastline"
        }
    """
    # Overpass API query
    query = f'''
    [out:json][timeout:25];
    (
      way["natural"="coastline"](around:{radius},{latitude},{longitude});
    );
    out geom;
    '''
    
    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        if not data.get("elements"):
            return None  # No coastline found
        
        # Find nearest coastline segment
        dive_site = (latitude, longitude)
        nearest_segment = None
        min_distance = float('inf')
        
        for element in data["elements"]:
            if element["type"] != "way" or "geometry" not in element:
                continue
                
            geometry = element["geometry"]
            if len(geometry) < 2:
                continue
            
            # Calculate distance to segment
            for i in range(len(geometry) - 1):
                p1 = (geometry[i]["lat"], geometry[i]["lon"])
                p2 = (geometry[i+1]["lat"], geometry[i+1]["lon"])
                
                # Distance to line segment
                dist = point_to_segment_distance(dive_site, p1, p2)
                
                if dist < min_distance:
                    min_distance = dist
                    nearest_segment = (p1, p2)
        
        if not nearest_segment:
            return None
        
        # Calculate coastline bearing
        p1, p2 = nearest_segment
        coastline_bearing = calculate_bearing(p1[0], p1[1], p2[0], p2[1])
        
        # Shore direction = perpendicular to coastline (facing seaward)
        shore_direction = (coastline_bearing + 90) % 360
        
        # Determine confidence based on distance
        if min_distance < 100:
            confidence = "high"
        elif min_distance < 500:
            confidence = "medium"
        else:
            confidence = "low"
        
        return {
            "shore_direction": round(shore_direction, 1),
            "confidence": confidence,
            "method": "osm_coastline",
            "distance_to_coastline_m": round(min_distance, 1)
        }
        
    except Exception as e:
        print(f"Error detecting shore direction: {e}")
        return None

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate bearing between two points in degrees (0-360)."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    dlon = lon2 - lon1
    bearing = math.atan2(
        math.sin(dlon) * math.cos(lat2),
        math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    )
    
    bearing = math.degrees(bearing)
    return (bearing + 360) % 360

def point_to_segment_distance(point: tuple, seg_start: tuple, seg_end: tuple) -> float:
    """Calculate distance from point to line segment in meters."""
    # Using Haversine formula for great-circle distance
    R = 6371000  # Earth radius in meters
    
    def haversine(p1, p2):
        lat1, lon1 = map(math.radians, p1)
        lat2, lon2 = map(math.radians, p2)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    # Simplified: use distance to midpoint of segment
    # For production, use proper point-to-segment distance calculation
    mid_lat = (seg_start[0] + seg_end[0]) / 2
    mid_lon = (seg_start[1] + seg_end[1]) / 2
    return haversine(point, (mid_lat, mid_lon))
```

## Test Example

```bash
# Test with Red Sea coordinates (Sharm El Sheikh)
python3 -c "
from overpass_example import detect_shore_direction
result = detect_shore_direction(27.9158, 34.3296)
print(result)
"

# Expected output:
# {
#   'shore_direction': 90.0,  # Example: facing east
#   'confidence': 'high',
#   'method': 'osm_coastline',
#   'distance_to_coastline_m': 45.2
# }
```

## Notes

- **OSM Coastline Orientation**: Coastlines are oriented with land on the left, water on the right
- **Shore Direction**: Direction you face when standing on shore looking out to sea
- **Calculation**: Shore direction = coastline bearing + 90° (perpendicular)
- **Confidence**: Based on distance to coastline (closer = higher confidence)
- **Fallback**: If no coastline found within radius, return None (manual entry required)

