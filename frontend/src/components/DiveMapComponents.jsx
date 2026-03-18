import DOMPurify from 'dompurify';
import L from 'leaflet';
import escape from 'lodash/escape';
import React, { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';

import { getRouteTypeColor } from '../utils/colorPalette';
import { calculateRouteBearings, formatBearing } from '../utils/routeUtils';

// Custom zoom control component for dive detail page
export const ZoomControl = ({ currentZoom }) => {
  return (
    <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
      Zoom: {currentZoom.toFixed(1)}
    </div>
  );
};

// Custom zoom tracking component for dive detail page
export const ZoomTracker = ({ onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);

    // Set initial zoom
    onZoomChange(map.getZoom());

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoomChange]);

  return null;
};

// Custom route layer component for dive detail page
export const MapViewUpdater = ({ viewport }) => {
  const map = useMap();

  useEffect(() => {
    if (viewport && viewport.center && viewport.zoom) {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [map, viewport?.center, viewport?.zoom]);

  return null;
};

export const DiveRouteLayer = ({ route, diveSiteId, diveSite }) => {
  const map = useMap();
  const routeLayerRef = useRef(null);
  const diveSiteMarkerRef = useRef(null);
  const bearingMarkersRef = useRef([]);
  const hasRenderedRef = useRef(false);
  const lastRouteIdRef = useRef(null);

  // Function to update bearing markers visibility based on zoom
  const updateBearingMarkersVisibility = useCallback(() => {
    const currentZoom = map.getZoom();
    const shouldShow = currentZoom >= 16 && currentZoom <= 18;

    bearingMarkersRef.current.forEach(marker => {
      if (shouldShow) {
        if (!map.hasLayer(marker)) {
          map.addLayer(marker);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }, [map]);

  useEffect(() => {
    if (!route?.route_data) {
      return;
    }

    // Check if this is the same route as before
    const isSameRoute = lastRouteIdRef.current === route?.id;

    // Prevent duplicate rendering for the same route
    if (hasRenderedRef.current && routeLayerRef.current && isSameRoute) {
      // Still update bearing visibility on zoom even if route hasn't changed
      updateBearingMarkersVisibility();
      return;
    }

    // Clear existing layers and bearing markers
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }
    if (diveSiteMarkerRef.current) {
      map.removeLayer(diveSiteMarkerRef.current);
    }
    bearingMarkersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    bearingMarkersRef.current = [];

    // Add dive site marker
    if (diveSite && diveSite.latitude && diveSite.longitude) {
      const diveSiteMarker = L.marker([diveSite.latitude, diveSite.longitude], {
        icon: L.divIcon({
          className: 'dive-site-marker',
          html: '<div style="background-color: #dc2626; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      });

      diveSiteMarker.bindPopup(
        DOMPurify.sanitize(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-800 mb-1">${escape(diveSite.name)}</h3>
          <p class="text-sm text-gray-600">Dive Site</p>
        </div>
      `)
      );

      map.addLayer(diveSiteMarker);
      diveSiteMarkerRef.current = diveSiteMarker;
    }

    // Add route layer
    const routeLayer = L.geoJSON(route.route_data, {
      style: feature => {
        // Determine color based on route type and segment type
        let routeColor;
        if (feature.properties?.color) {
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          routeColor = getRouteTypeColor(route.route_type);
        }

        return {
          color: routeColor,
          weight: 6, // Increased weight for better visibility
          opacity: 0.9,
          fillOpacity: 0.3,
        };
      },
      pointToLayer: (feature, latlng) => {
        let routeColor;
        if (feature.properties?.color) {
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          routeColor = getRouteTypeColor(route.route_type);
        }

        return L.circleMarker(latlng, {
          radius: 8, // Increased radius for better visibility
          fillColor: routeColor,
          color: routeColor,
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.7,
        });
      },
    });

    // Add popup to route
    routeLayer.bindPopup(
      DOMPurify.sanitize(`
      <div class="p-2">
        <h3 class="font-semibold text-gray-800 mb-1">${escape(route.name)}</h3>
        <p class="text-sm text-gray-600 mb-2">${escape(route.description || 'No description')}</p>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="px-2 py-1 bg-gray-100 rounded">${escape(route.route_type)}</span>
          <span>by ${escape(route.creator_username || 'Unknown')}</span>
        </div>
      </div>
    `)
    );

    map.addLayer(routeLayer);
    routeLayerRef.current = routeLayer;

    // Calculate bearings and create markers (but don't add to map yet)
    const bearings = calculateRouteBearings(route.route_data);
    bearings.forEach(({ position, bearing }) => {
      const bearingLabel = formatBearing(bearing, true);

      // Create a custom icon with bearing text
      const bearingIcon = L.divIcon({
        className: 'bearing-label',
        html: `
          <div style="
            background-color: rgba(255, 255, 255, 0.9);
            border: 2px solid #2563eb;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            color: #1e40af;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
          ">
            ${bearingLabel}
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10],
      });

      const bearingMarker = L.marker(position, {
        icon: bearingIcon,
        interactive: false,
        zIndexOffset: 500,
      });

      // Store marker but don't add to map yet
      bearingMarkersRef.current.push(bearingMarker);
    });

    // Update visibility based on initial zoom
    updateBearingMarkersVisibility();

    // Mark as rendered and track route ID
    hasRenderedRef.current = true;
    lastRouteIdRef.current = route?.id;

    // Listen for zoom changes
    map.on('zoomend', updateBearingMarkersVisibility);

    return () => {
      map.off('zoomend', updateBearingMarkersVisibility);

      // Only cleanup if we're not about to re-render with the same route
      const isSameRoute = lastRouteIdRef.current === route?.id;

      if (routeLayerRef.current && !isSameRoute) {
        map.removeLayer(routeLayerRef.current);
      }

      if (diveSiteMarkerRef.current && !isSameRoute) {
        map.removeLayer(diveSiteMarkerRef.current);
      }

      if (!isSameRoute) {
        bearingMarkersRef.current.forEach(marker => {
          map.removeLayer(marker);
        });
        bearingMarkersRef.current = [];
      }
    };
  }, [map, route?.id, route?.route_data, diveSite?.id, updateBearingMarkersVisibility]);

  return null;
};
