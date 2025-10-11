/**
 * Route data compression utilities for performance optimization
 * Reduces GeoJSON data size for better mobile performance
 */

/**
 * Compress GeoJSON coordinates by reducing precision
 * @param {Object} geoJson - GeoJSON object
 * @param {number} precision - Decimal places to keep (default: 6)
 * @returns {Object} Compressed GeoJSON
 */
export const compressGeoJson = (geoJson, precision = 6) => {
  if (!geoJson || !geoJson.features) {
    return geoJson;
  }

  const compressed = {
    ...geoJson,
    features: geoJson.features.map(feature => ({
      ...feature,
      geometry: compressGeometry(feature.geometry, precision),
    })),
  };

  return compressed;
};

/**
 * Compress geometry coordinates
 * @param {Object} geometry - GeoJSON geometry object
 * @param {number} precision - Decimal places to keep
 * @returns {Object} Compressed geometry
 */
const compressGeometry = (geometry, precision) => {
  if (!geometry || !geometry.coordinates) {
    return geometry;
  }

  const roundCoordinate = coord => {
    if (typeof coord === 'number') {
      return Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision);
    }
    if (Array.isArray(coord)) {
      return coord.map(roundCoordinate);
    }
    return coord;
  };

  return {
    ...geometry,
    coordinates: roundCoordinate(geometry.coordinates),
  };
};

/**
 * Decompress GeoJSON coordinates (restore precision)
 * @param {Object} geoJson - Compressed GeoJSON object
 * @returns {Object} Decompressed GeoJSON
 */
export const decompressGeoJson = geoJson => {
  if (!geoJson || !geoJson.features) {
    return geoJson;
  }

  const decompressed = {
    ...geoJson,
    features: geoJson.features.map(feature => ({
      ...feature,
      geometry: decompressGeometry(feature.geometry),
    })),
  };

  return decompressed;
};

/**
 * Decompress geometry coordinates
 * @param {Object} geometry - Compressed geometry object
 * @returns {Object} Decompressed geometry
 */
const decompressGeometry = geometry => {
  if (!geometry || !geometry.coordinates) {
    return geometry;
  }

  // For now, just return as-is since compression is lossy
  // In a real implementation, you might store original precision
  return geometry;
};

/**
 * Calculate compression ratio
 * @param {Object} original - Original GeoJSON
 * @param {Object} compressed - Compressed GeoJSON
 * @returns {number} Compression ratio (0-1, where 0.5 = 50% size)
 */
export const getCompressionRatio = (original, compressed) => {
  const originalSize = JSON.stringify(original).length;
  const compressedSize = JSON.stringify(compressed).length;
  return compressedSize / originalSize;
};

/**
 * Optimize route data for mobile performance
 * @param {Object} routeData - Route data object
 * @returns {Object} Optimized route data
 */
export const optimizeForMobile = routeData => {
  if (!routeData || !routeData.route_data) {
    return routeData;
  }

  // Compress GeoJSON data
  const compressedRouteData = compressGeoJson(routeData.route_data, 5); // 5 decimal places for mobile

  return {
    ...routeData,
    route_data: compressedRouteData,
    _optimized: true,
    _compression_ratio: getCompressionRatio(routeData.route_data, compressedRouteData),
  };
};

/**
 * Restore route data from mobile optimization
 * @param {Object} routeData - Optimized route data object
 * @returns {Object} Restored route data
 */
export const restoreFromMobile = routeData => {
  if (!routeData || !routeData._optimized || !routeData.route_data) {
    return routeData;
  }

  // Decompress GeoJSON data
  const decompressedRouteData = decompressGeoJson(routeData.route_data);

  const { _optimized, _compression_ratio, ...restoredData } = routeData;

  return {
    ...restoredData,
    route_data: decompressedRouteData,
  };
};

/**
 * Validate compressed route data
 * @param {Object} routeData - Route data to validate
 * @returns {Object} Validation result
 */
export const validateCompressedRoute = routeData => {
  const errors = [];
  const warnings = [];

  if (!routeData) {
    errors.push('Route data is required');
    return { valid: false, errors, warnings };
  }

  if (!routeData.route_data) {
    errors.push('Route data must contain route_data field');
    return { valid: false, errors, warnings };
  }

  if (!routeData.route_data.features || !Array.isArray(routeData.route_data.features)) {
    errors.push('Route data must contain valid GeoJSON features array');
    return { valid: false, errors, warnings };
  }

  if (routeData.route_data.features.length === 0) {
    errors.push('Route data must contain at least one feature');
    return { valid: false, errors, warnings };
  }

  // Check for valid geometry types
  const validGeometryTypes = [
    'Point',
    'LineString',
    'Polygon',
    'MultiPoint',
    'MultiLineString',
    'MultiPolygon',
  ];
  routeData.route_data.features.forEach((feature, index) => {
    if (!feature.geometry || !feature.geometry.type) {
      errors.push(`Feature ${index} must have valid geometry`);
      return;
    }

    if (!validGeometryTypes.includes(feature.geometry.type)) {
      errors.push(`Feature ${index} has invalid geometry type: ${feature.geometry.type}`);
    }

    if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
      errors.push(`Feature ${index} must have valid coordinates array`);
    }
  });

  // Check compression ratio if optimized
  if (routeData._optimized && routeData._compression_ratio) {
    if (routeData._compression_ratio > 0.8) {
      warnings.push('Compression ratio is high - consider more aggressive compression');
    }
    if (routeData._compression_ratio < 0.1) {
      warnings.push('Compression ratio is very low - data may be over-compressed');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Get route data size information
 * @param {Object} routeData - Route data object
 * @returns {Object} Size information
 */
export const getRouteDataSize = routeData => {
  if (!routeData) {
    return { size: 0, compressed: false };
  }

  const jsonString = JSON.stringify(routeData);
  const size = new TextEncoder().encode(jsonString).length;

  return {
    size,
    compressed: routeData._optimized || false,
    compressionRatio: routeData._compression_ratio || 1,
    estimatedCompressedSize: routeData._compression_ratio
      ? Math.round(size * routeData._compression_ratio)
      : size,
  };
};
