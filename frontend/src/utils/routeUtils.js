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
