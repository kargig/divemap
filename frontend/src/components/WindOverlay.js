import L, { Icon } from 'leaflet';
import PropTypes from 'prop-types';
import React, { useMemo, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * WindOverlay Component
 * Displays wind arrows on a Leaflet map showing wind speed and direction
 * Only visible at zoom levels 13-18 to avoid excessive API calls
 */
const WindOverlay = ({ windData = null, enabled = false, maxArrows = 100 }) => {
  const map = useMap();
  const markersRef = useRef([]);
  const layerGroupRef = useRef(null);

  // Filter and limit wind data points
  const displayData = useMemo(() => {
    if (!windData || !windData.points || !Array.isArray(windData.points)) {
      return [];
    }

    // Filter out invalid points and limit to maxArrows
    const validPoints = windData.points.filter(point => {
      const lat = typeof point.lat === 'number' && !isNaN(point.lat);
      const lon = typeof point.lon === 'number' && !isNaN(point.lon);
      return (
        lat && lon && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
      );
    });

    // Limit to maxArrows to prevent performance issues
    return validPoints.slice(0, maxArrows);
  }, [windData, maxArrows]);

  // Create wind arrow icon
  const createWindArrowIcon = useMemo(() => {
    return (windSpeed, windDirection) => {
      // Calculate arrow size based on wind speed (40px base + 10px per 5 m/s)
      // Made larger for better visibility
      const baseSize = 40;
      const sizeIncrement = 10;
      const speedIncrement = 5; // m/s
      const arrowSize = Math.min(
        baseSize + Math.floor(windSpeed / speedIncrement) * sizeIncrement,
        80
      );

      // Determine color based on wind speed
      let color;
      if (windSpeed < 5) {
        // Light winds: Light blue/green (good conditions)
        color = '#60a5fa'; // light blue
      } else if (windSpeed < 7.7) {
        // Moderate winds: Blue (caution)
        color = '#3b82f6'; // blue
      } else if (windSpeed < 10) {
        // Strong winds: Orange (difficult conditions)
        color = '#f97316'; // orange
      } else {
        // Very strong winds: Red (dangerous, avoid)
        color = '#dc2626'; // red
      }

      // Create SVG arrow pointing in wind direction
      // Wind direction is where wind is coming FROM (meteorological convention)
      // For display, we want to show where the wind is GOING (opposite direction)
      //
      // Coordinate systems:
      // - Compass: 0° = north, 90° = east, 180° = south, 270° = west
      // - SVG rotation: 0° = right (east), 90° = down (south), 180° = left (west), 270° = up (north)
      // - Arrow path: M12 2 L12 18 - from top to bottom, arrowhead at bottom
      //   So arrow points DOWN (compass 180° / SVG 90°) by default
      //
      // Calculation:
      // 1. Convert wind direction (where wind comes FROM) to target direction (where wind goes TO)
      // 2. Convert target compass direction to SVG rotation angle
      // 3. Rotate arrow from default down position to target direction
      //
      // Example: Wind 272° (west) → going 92° (east-southeast)
      // targetDirection = (272 + 180) % 360 = 92° (compass)
      // arrowDirection = (360 - 92) % 360 = 268° (SVG rotation from down to east)
      const targetDirection = (windDirection + 180) % 360; // Compass direction wind is going TOWARD
      const arrowDirection = (360 - targetDirection) % 360; // SVG rotation from down (90°) to target direction

      // Increase stroke width for better visibility on larger arrows
      const strokeWidth = Math.max(3, Math.floor(arrowSize / 15));

      // Add a white outline/shadow for better visibility against water
      // Use a unique filter ID to avoid conflicts
      const filterId = `wind-arrow-shadow-${Math.random().toString(36).substr(2, 9)}`;
      const svg = `
        <svg width="${arrowSize}" height="${arrowSize}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="white" flood-opacity="0.9"/>
            </filter>
          </defs>
          <g transform="rotate(${arrowDirection} 12 12)">
            <!-- White outline for visibility -->
            <path
              d="M12 2 L12 18 M8 14 L12 18 L16 14"
              stroke="white"
              stroke-width="${strokeWidth + 3}"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              opacity="0.95"
            />
            <!-- Colored arrow on top -->
            <path
              d="M12 2 L12 18 M8 14 L12 18 L16 14"
              stroke="${color}"
              stroke-width="${strokeWidth}"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              filter="url(#${filterId})"
            />
          </g>
        </svg>
      `;

      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      return new Icon({
        iconUrl: dataUrl,
        iconSize: [arrowSize, arrowSize],
        iconAnchor: [arrowSize / 2, arrowSize / 2],
        className: 'wind-arrow-icon',
      });
    };
  }, []);

  // Format wind speed for display
  const formatWindSpeed = speed => {
    if (!speed) return 'N/A';
    const knots = (speed * 1.94384).toFixed(1); // Convert m/s to knots
    return `${speed.toFixed(1)} m/s (${knots} knots)`;
  };

  // Format wind direction for display
  const formatWindDirection = direction => {
    if (direction === null || direction === undefined) return 'N/A';
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const index = Math.round(direction / 22.5) % 16;
    return `${directions[index]} (${Math.round(direction)}°)`;
  };

  // Update wind arrows on map
  useEffect(() => {
    if (!map || !enabled) {
      // Remove all markers if disabled
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
        markersRef.current = [];
      }
      return;
    }

    // Only update if we have data - don't clear markers if data is temporarily missing
    if (displayData.length === 0) {
      // Keep existing markers if data is temporarily unavailable (during refetch)
      return;
    }

    // Clear existing markers only when we have new data to display
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      markersRef.current = [];
    }

    // Create layer group for wind arrows
    const layerGroup = L.layerGroup();

    // Create markers for each wind data point
    displayData.forEach(point => {
      // Validate coordinates - must be valid numbers
      const lat = typeof point.lat === 'number' && !isNaN(point.lat) ? point.lat : null;
      const lon = typeof point.lon === 'number' && !isNaN(point.lon) ? point.lon : null;

      if (lat === null || lon === null) {
        console.warn('WindOverlay: Invalid coordinates', point);
        return;
      }

      // Validate coordinate ranges
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.warn('WindOverlay: Coordinates out of range', { lat, lon });
        return;
      }

      const windSpeed = point.wind_speed_10m || 0;
      const windDirection = point.wind_direction_10m || 0;
      const windGusts = point.wind_gusts_10m;

      // Create icon
      const icon = createWindArrowIcon(windSpeed, windDirection);

      // Create marker with validated coordinates
      const marker = L.marker([lat, lon], {
        icon: icon,
        zIndexOffset: 100, // Above map tiles but below markers/popups
      });

      // Create popup with wind information
      const popupContent = `
        <div class="p-2">
          <h4 class="font-semibold text-sm mb-1">Wind Conditions</h4>
          <div class="text-xs space-y-1">
            <div><strong>Speed:</strong> ${formatWindSpeed(windSpeed)}</div>
            <div><strong>Direction:</strong> ${formatWindDirection(windDirection)}</div>
            ${windGusts ? `<div><strong>Gusts:</strong> ${formatWindSpeed(windGusts)}</div>` : ''}
            ${point.timestamp ? `<div class="text-gray-500 text-xs mt-1">${new Date(point.timestamp).toLocaleString()}</div>` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Add to layer group
      layerGroup.addLayer(marker);
      markersRef.current.push(marker);
    });

    // Add layer group to map
    map.addLayer(layerGroup);
    layerGroupRef.current = layerGroup;

    // Cleanup function - always remove markers when component unmounts or enabled becomes false
    return () => {
      if (layerGroupRef.current) {
        try {
          map.removeLayer(layerGroupRef.current);
          layerGroupRef.current = null;
          markersRef.current = [];
        } catch (error) {
          // Ignore errors during cleanup (e.g., if map is already destroyed)
          console.warn('WindOverlay: Error during cleanup', error);
        }
      }
    };
  }, [map, enabled, displayData, createWindArrowIcon]);

  // This component doesn't render anything directly
  return null;
};

WindOverlay.propTypes = {
  windData: PropTypes.shape({
    points: PropTypes.arrayOf(
      PropTypes.shape({
        lat: PropTypes.number.isRequired,
        lon: PropTypes.number.isRequired,
        wind_speed_10m: PropTypes.number,
        wind_direction_10m: PropTypes.number,
        wind_gusts_10m: PropTypes.number,
        timestamp: PropTypes.string,
      })
    ),
    data_age_seconds: PropTypes.number,
    grid_resolution: PropTypes.string,
    point_count: PropTypes.number,
  }),
  enabled: PropTypes.bool,
  maxArrows: PropTypes.number,
};

export default WindOverlay;
