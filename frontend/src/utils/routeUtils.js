import { getRouteTypeColor, getDrawingTypeColor } from './colorPalette';

/**
 * Smart route type detection function
 * Analyzes route data to determine the actual route type based on segment types
 * @param {string} routeType - The database route_type (fallback)
 * @param {string} drawingType - Deprecated parameter (ignored)
 * @param {Object} routeData - The route's GeoJSON data
 * @returns {string} The detected route type ('mixed', single type, or fallback)
 */
export const getRouteTypeLabel = (routeType, drawingType, routeData) => {
  // Check if route has multiple segment types
  if (routeData?.type === 'FeatureCollection' && routeData?.features) {
    const segmentTypes = routeData.features
      .map(feature => feature.properties?.segmentType)
      .filter(Boolean); // Remove undefined/null values

    const uniqueSegmentTypes = [...new Set(segmentTypes)];

    if (uniqueSegmentTypes.length > 1) {
      // Multiple segment types detected - show "mixed"
      return 'mixed';
    } else if (uniqueSegmentTypes.length === 1) {
      // Single segment type - show that type
      return uniqueSegmentTypes[0];
    }
  }

  // Fallback to the route_type if no segment data
  return routeType;
};

/**
 * Smart route color detection function
 * Determines the appropriate color for a route based on its segment types
 * @param {Object} route - The route object with route_data
 * @returns {string} Hex color code for the route
 */
export const getSmartRouteColor = route => {
  // Check if route has multiple segment types
  if (route.route_data?.type === 'FeatureCollection' && route.route_data?.features) {
    const segmentTypes = route.route_data.features
      .map(feature => feature.properties?.segmentType)
      .filter(Boolean);

    const uniqueSegmentTypes = [...new Set(segmentTypes)];

    if (uniqueSegmentTypes.length > 1) {
      // Multiple segment types - use mixed color
      return getDrawingTypeColor('mixed');
    } else if (uniqueSegmentTypes.length === 1) {
      // Single segment type - use that type's color
      return getRouteTypeColor(uniqueSegmentTypes[0]);
    }
  }

  // Fallback to the route_type color
  return getRouteTypeColor(route.route_type);
};

/**
 * Get route type icon based on detected route type
 * @param {string} detectedType - The detected route type (from getRouteTypeLabel)
 * @returns {string} Icon name for the route type
 */
export const getRouteTypeIcon = detectedType => {
  switch (detectedType) {
    case 'walk':
      return 'walk';
    case 'swim':
      return 'swim';
    case 'scuba':
      return 'scuba';
    case 'mixed':
      return 'mixed';
    default:
      return 'route';
  }
};

/**
 * Get route type description for display
 * @param {string} detectedType - The detected route type
 * @returns {string} Human-readable description
 */
export const getRouteTypeDescription = detectedType => {
  switch (detectedType) {
    case 'walk':
      return 'Walk Route';
    case 'swim':
      return 'Swim Route';
    case 'scuba':
      return 'Scuba Route';
    case 'mixed':
      return 'Mixed Route';
    default:
      return 'Route';
  }
};

/**
 * Calculate bearing (direction) between two points in degrees
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360, where 0 is North)
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = Math.PI / 180;
  const lat1Rad = lat1 * toRad;
  const lat2Rad = lat2 * toRad;
  const deltaLon = (lon2 - lon1) * toRad;

  const x = Math.sin(deltaLon) * Math.cos(lat2Rad);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);

  let bearing = Math.atan2(x, y) * (180 / Math.PI);
  bearing = (bearing + 360) % 360; // Normalize to 0-360

  return Math.round(bearing);
};

/**
 * Convert bearing in degrees to cardinal direction
 * @param {number} bearing - Bearing in degrees (0-360)
 * @returns {string} Cardinal direction abbreviation (N, NE, E, SE, S, SW, W, NW)
 */
export const bearingToCardinal = bearing => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

/**
 * Format bearing for display
 * @param {number} bearing - Bearing in degrees
 * @param {boolean} showCardinal - Whether to show cardinal direction
 * @returns {string} Formatted bearing string
 */
export const formatBearing = (bearing, showCardinal = true) => {
  const cardinal = showCardinal ? bearingToCardinal(bearing) : '';
  return showCardinal ? `${bearing}° ${cardinal}` : `${bearing}°`;
};

/**
 * Extract coordinates from route feature geometry
 * @param {Object} feature - GeoJSON feature
 * @returns {Array} Array of [lng, lat] coordinates
 */
export const extractCoordinates = feature => {
  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates) return [];

  const coords = geometry.coordinates;

  if (geometry.type === 'LineString') {
    return coords;
  } else if (geometry.type === 'Polygon') {
    // For polygons, return the outer ring coordinates
    return coords[0] || [];
  } else if (geometry.type === 'Point') {
    return [coords];
  }

  return [];
};

/**
 * Calculate bearings for all segments in a route
 * @param {Object} routeData - Route GeoJSON data
 * @param {number} interval - Interval for displaying bearings (default: show at each significant point)
 * @returns {Array} Array of bearing objects with position and bearing
 */
export const calculateRouteBearings = (routeData, interval = 1) => {
  const bearings = [];

  if (!routeData) return bearings;

  // Handle FeatureCollection (multi-segment routes)
  if (routeData.type === 'FeatureCollection' && routeData.features) {
    routeData.features.forEach(feature => {
      const coords = extractCoordinates(feature);
      if (coords.length < 2) return;

      // Calculate bearings for each segment
      for (let i = 0; i < coords.length - 1; i++) {
        if (i % interval === 0 || i === coords.length - 2) {
          const [lon1, lat1] = coords[i];
          const [lon2, lat2] = coords[i + 1];

          // Use midpoint for label position
          const midLat = (lat1 + lat2) / 2;
          const midLon = (lon1 + lon2) / 2;

          const bearing = calculateBearing(lat1, lon1, lat2, lon2);
          bearings.push({
            position: [midLat, midLon],
            bearing,
            segmentIndex: i,
          });
        }
      }
    });
  }
  // Handle single Feature
  else if (routeData.type === 'Feature') {
    const coords = extractCoordinates(routeData);
    if (coords.length >= 2) {
      for (let i = 0; i < coords.length - 1; i++) {
        if (i % interval === 0 || i === coords.length - 2) {
          const [lon1, lat1] = coords[i];
          const [lon2, lat2] = coords[i + 1];

          const midLat = (lat1 + lat2) / 2;
          const midLon = (lon1 + lon2) / 2;

          const bearing = calculateBearing(lat1, lon1, lat2, lon2);
          bearings.push({
            position: [midLat, midLon],
            bearing,
            segmentIndex: i,
          });
        }
      }
    }
  }

  return bearings;
};
