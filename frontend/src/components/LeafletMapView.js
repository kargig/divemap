import L, { Icon } from 'leaflet';
import { Info } from 'lucide-react';
import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery, useQueryClient } from 'react-query';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';

import api from '../api';
import {
  getSuitabilityColor,
  getSuitabilityLabel,
  formatWindSpeed,
  formatWindDirection,
} from '../utils/windSuitabilityHelpers';

import WindDataError from './WindDataError';
import WindOverlay from './WindOverlay';
import WindOverlayLegend from './WindOverlayLegend';
import WindOverlayToggle from './WindOverlayToggle';

// Helper: convert URLs in plain text to clickable links (for HTML string popups)
const linkifyText = text => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
  );
};

// Helper: trim text to maxLen and append a [more] link if exceeded
const trimWithMore = (text, maxLen, moreUrl) => {
  if (!text || typeof text !== 'string') return '';
  const needsTrim = text.length > maxLen;
  const sliced = needsTrim ? text.slice(0, maxLen) : text;
  const linked = linkifyText(sliced);
  if (!needsTrim) return linked;
  const moreLink = moreUrl
    ? ` <a href="${moreUrl}" class="underline" title="View more">[more]</a>`
    : '';
  return `${linked}...${moreLink}`;
};

// Add custom cluster styles
const clusterStyles = `
  .marker-cluster-small {
    background-color: rgba(181, 226, 140, 0.6);
  }
  .marker-cluster-small div {
    background-color: rgba(110, 204, 57, 0.6);
  }
  .marker-cluster-medium {
    background-color: rgba(241, 211, 87, 0.6);
  }
  .marker-cluster-medium div {
    background-color: rgba(240, 194, 12, 0.6);
  }
  .marker-cluster-large {
    background-color: rgba(253, 156, 115, 0.6);
  }
  .marker-cluster-large div {
    background-color: rgba(241, 128, 23, 0.6);
  }
  .marker-cluster {
    background-clip: padding-box;
    border-radius: 20px;
  }
  .marker-cluster div {
    width: 30px;
    height: 30px;
    margin-left: 5px;
    margin-top: 5px;
    text-align: center;
    border-radius: 15px;
    font: 12px "Helvetica Neue", Arial, Helvetica, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
  }
  
  /* Hide attribution completely */
  .leaflet-control-attribution {
    display: none !important;
  }
`;

// Inject cluster styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = clusterStyles;
  document.head.appendChild(style);
}

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle clustering and auto-fit
// Component to display real-time map metadata
const MapMetadata = ({ onMetadataChange }) => {
  const map = useMap();
  const [metadata, setMetadata] = useState({
    zoom: map?.getZoom() || 8,
    center: map?.getCenter() || { lat: 0, lng: 0 },
    bounds: null,
    scale: null,
  });

  useEffect(() => {
    if (!map) return;

    const updateMetadata = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const bounds = map.getBounds();

      // Calculate approximate scale (meters per pixel)
      const scale = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);

      const newMetadata = {
        zoom: Math.round(zoom * 100) / 100, // Round to 2 decimal places
        center: {
          lat: Math.round(center.lat * 10000) / 10000, // Round to 4 decimal places
          lng: Math.round(center.lng * 10000) / 10000,
        },
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        scale: Math.round(scale),
      };

      setMetadata(newMetadata);
      if (onMetadataChange) {
        onMetadataChange(newMetadata);
      }
    };

    // Update metadata on map events
    map.on('zoomend', updateMetadata);
    map.on('moveend', updateMetadata);
    map.on('viewreset', updateMetadata);

    // Initial update
    updateMetadata();

    return () => {
      map.off('zoomend', updateMetadata);
      map.off('moveend', updateMetadata);
      map.off('viewreset', updateMetadata);
    };
  }, [map, onMetadataChange]);

  return null; // This component doesn't render anything
};

// Component to capture map instance and pass it to parent
const MapInstanceCapture = ({ onMapInstance }) => {
  const map = useMap();

  useEffect(() => {
    if (map && onMapInstance) {
      onMapInstance(map);
    }
  }, [map, onMapInstance]);

  return null;
};

const MapContent = ({ markers, selectedEntityType, viewport, onViewportChange, resetTrigger }) => {
  const map = useMap();
  const clusterRef = useRef();
  const individualMarkersRef = useRef([]); // Store individual markers (dive sites at zoom >= 13)
  const hasAutoFittedRef = useRef(false);
  const userHasZoomedRef = useRef(false);
  const [mapMetadata, setMapMetadata] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(map?.getZoom() || 8);
  const onViewportChangeRef = useRef(onViewportChange);

  // Update ref when function changes
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Track zoom changes
  useEffect(() => {
    if (!map) return;
    const updateZoom = () => {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
    };
    map.on('zoomend', updateZoom);
    updateZoom(); // Initial zoom
    return () => {
      map.off('zoomend', updateZoom);
    };
  }, [map]);

  // Prevent popups from closing during auto-pan
  useEffect(() => {
    if (!map) return;
    const openTimeRef = { current: null };
    const isAutoPanningRef = { current: false };
    const currentPopupRef = { current: null };

    // Track when popup opens
    const handlePopupOpen = e => {
      currentPopupRef.current = e.popup;
      openTimeRef.current = Date.now();
      isAutoPanningRef.current = true;
      // Reset auto-panning flag after auto-pan completes
      setTimeout(() => {
        isAutoPanningRef.current = false;
      }, 1000);
    };

    // Prevent popup from closing during auto-pan
    const handlePopupClose = e => {
      if (e.popup === currentPopupRef.current) {
        const timeSinceOpen = Date.now() - (openTimeRef.current || 0);
        // Prevent closing if popup was just opened (within 1.5 seconds) and map is auto-panning
        if (timeSinceOpen < 1500 && isAutoPanningRef.current) {
          // Reopen the popup
          setTimeout(() => {
            if (currentPopupRef.current && !currentPopupRef.current.isOpen()) {
              currentPopupRef.current.openOn(map);
            }
          }, 50);
          return;
        }
        currentPopupRef.current = null;
      }
    };

    // Track map movement (auto-pan)
    const handleMoveStart = () => {
      if (openTimeRef.current && Date.now() - openTimeRef.current < 1500) {
        isAutoPanningRef.current = true;
      }
    };

    const handleMoveEnd = () => {
      // Give a small delay after move ends before allowing popup to close
      setTimeout(() => {
        isAutoPanningRef.current = false;
      }, 300);
    };

    map.on('popupopen', handlePopupOpen);
    map.on('popupclose', handlePopupClose);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('popupopen', handlePopupOpen);
      map.off('popupclose', handlePopupClose);
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
    };
  }, [map]);

  // Create cluster group
  useEffect(() => {
    if (!map) return;

    // Add a small delay to prevent race conditions when switching entity types
    const timeoutId = setTimeout(() => {
      // Clear existing cluster group with proper cleanup
      if (clusterRef.current) {
        try {
          // Clear all markers from the cluster group first
          clusterRef.current.clearLayers();
          // Remove the cluster group from the map
          map.removeLayer(clusterRef.current);
          // Clear the reference
          clusterRef.current = null;
        } catch (error) {
          console.warn('Error clearing cluster group:', error);
        }
      }

      // Only create markers if we have data
      if (markers.length === 0) {
        return;
      }

      // Determine if clustering should be used for dive sites based on current zoom
      const shouldClusterDiveSites = currentZoom <= 12; // Disable clustering for dive sites at zoom >= 13

      // Separate dive sites from other markers
      const diveSiteMarkers = markers.filter(m => m.entityType === 'dive_site');
      const otherMarkers = markers.filter(m => m.entityType !== 'dive_site');

      // Create new cluster group (always used for non-dive-site markers, conditionally for dive sites)
      const clusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: cluster => {
          const childCount = cluster.getChildCount();
          let c = ' marker-cluster-';
          if (childCount < 10) {
            c += 'small';
          } else if (childCount < 100) {
            c += 'medium';
          } else {
            c += 'large';
          }

          return L.divIcon({
            html: `<div><span>${childCount}</span></div>`,
            className: `marker-cluster${c}`,
            iconSize: new L.Point(40, 40),
          });
        },
      });

      // Helper function to create a marker with popup
      const createMarker = marker => {
        try {
          // Validate marker position
          if (!marker.position || !Array.isArray(marker.position) || marker.position.length !== 2) {
            console.warn('Invalid marker position:', marker);
            return null;
          }

          const [lat, lng] = marker.position;
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            console.warn('Invalid marker coordinates:', marker);
            return null;
          }

          const leafletMarker = L.marker([lat, lng], { icon: marker.icon });

          // Add popup with clickable title
          const popupContent = `
          <div class="p-2 max-h-[calc(100vh-160px)] overflow-y-auto">
            <h3 class="font-semibold text-sm sm:text-lg mb-1 sm:mb-2">
              <a href="/${
                marker.entityType === 'dive_site'
                  ? 'dive-sites'
                  : marker.entityType === 'diving_center'
                    ? 'diving-centers'
                    : marker.entityType === 'dive'
                      ? 'dives'
                      : 'dive-trips'
              }/${marker.data.id}" 
                 class="text-blue-600 hover:text-blue-800 hover:underline">
                ${marker.entityType === 'dive_site' ? marker.data.name || `Dive Site #${marker.data.id}` : ''}
                ${marker.entityType === 'diving_center' ? marker.data.name : ''}
                ${marker.entityType === 'dive' ? `Dive #${marker.data.id}` : ''}
                ${marker.entityType === 'dive_trip' ? `Trip #${marker.data.id}` : ''}
              </a>
            </h3>
            <p class="text-xs sm:text-sm text-gray-600 max-w-[200px] sm:max-w-none">
              ${marker.entityType === 'dive_site' && marker.data.description ? trimWithMore(marker.data.description, 150, `/dive-sites/${marker.data.id}`) : ''}
              ${marker.entityType === 'diving_center' ? trimWithMore(marker.data.description || '', 150, `/diving-centers/${marker.data.id}`) : ''}
              ${marker.entityType === 'dive' ? `Dive at ${marker.data.dive_site?.name || 'Unknown Site'}` : ''}
              ${marker.entityType === 'dive_trip' ? `Trip on ${new Date(marker.data.trip_date).toLocaleDateString()} - ${marker.data.diving_center_name || 'Unknown Center'}` : ''}
              ${marker.entityType === 'dive_trip' && marker.data.trip_description ? `<br/><span class="text-xs text-gray-500">${trimWithMore(marker.data.trip_description, 100, `/dive-trips/${marker.data.id}`)}</span>` : ''}
            </p>
            ${
              marker.entityType === 'diving_center'
                ? `
                  <div class="flex items-center space-x-3 mt-1">
                    ${marker.data.phone ? `<a href="tel:${marker.data.phone}" title="Call" class="text-gray-600 hover:text-gray-800">📞</a>` : ''}
                    ${marker.data.email ? `<a href="mailto:${marker.data.email}" title="Email" class="text-gray-600 hover:text-gray-800">📧</a>` : ''}
                    ${marker.data.website ? `<a href="${(marker.data.website || '').startsWith('http') ? marker.data.website : `https://${marker.data.website}`}" target="_blank" rel="noopener" title="Website" class="text-gray-600 hover:text-gray-800">🌐</a>` : ''}
                  </div>
                `
                : marker.entityType === 'dive'
                  ? `
                  <div class="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    ${marker.data.average_depth ? `<div class="flex items-center gap-1" title="Average depth"><span>↕️</span><span>${marker.data.average_depth}m avg</span></div>` : ''}
                    ${marker.data.max_depth ? `<div class="flex items-center gap-1" title="Max depth"><span>📏</span><span>${marker.data.max_depth}m max</span></div>` : ''}
                    ${marker.data.duration ? `<div class="flex items-center gap-1" title="Duration"><span>🕐</span><span>${marker.data.duration}min</span></div>` : ''}
                    ${marker.data.user_rating ? `<div class="flex items-center gap-1" title="Rating"><span>⭐</span><span>${marker.data.user_rating}/10</span></div>` : ''}
                  </div>
                `
                  : marker.entityType === 'dive_site'
                    ? `
                    <div class="space-y-2 mt-1">
                      ${marker.data.difficulty_code ? `<div class="text-sm text-gray-700"><span class="mr-1">🏷️</span>Difficulty: <span class="font-medium">${marker.data.difficulty_label || marker.data.difficulty_code}</span></div>` : ''}
                      ${marker.data.average_rating ? `<div class="text-sm text-gray-700"><span class="mr-1">⭐</span>Rating: <span class="font-medium">${Number(marker.data.average_rating).toFixed(1)}/10</span></div>` : ''}
                      ${
                        marker.data.tags && marker.data.tags.length > 0
                          ? `
                        <div class="flex flex-wrap gap-1 items-center text-xs text-gray-600">
                          ${marker.data.tags.map(tag => `<span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">${tag.name}</span>`).join('')}
                        </div>
                      `
                          : ''
                      }
                      ${
                        marker.recommendation
                          ? (() => {
                              const rec = marker.recommendation;
                              const suitability = rec.suitability || 'unknown';
                              const suitabilityColor = getSuitabilityColor(suitability);
                              const suitabilityLabel = getSuitabilityLabel(suitability);
                              // Wind data is directly on the recommendation object, not nested in wind_data
                              const windSpeed = rec.wind_speed || 0;
                              const windDirection = rec.wind_direction || 0;
                              const windGusts = rec.wind_gusts;

                              const speedFormatted = formatWindSpeed(windSpeed);
                              const directionFormatted = formatWindDirection(windDirection);

                              return `
                        <div class="border-t border-gray-200 pt-1.5 sm:pt-2 mt-1.5 sm:mt-2">
                          <h4 class="font-semibold text-xs sm:text-sm mb-1 sm:mb-2">Wind Conditions</h4>
                          <div class="space-y-1 sm:space-y-1.5">
                            <div class="flex items-center gap-2">
                              <span class="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full" style="background-color: ${suitabilityColor}20; color: ${suitabilityColor}; border: 1px solid ${suitabilityColor}40;">
                                ${suitabilityLabel}
                              </span>
                            </div>
                            <div class="text-[10px] sm:text-xs text-gray-600 space-y-0.5">
                              <div><strong>Speed:</strong> ${speedFormatted.ms} m/s (${speedFormatted.knots} knots)</div>
                              <div><strong>Direction:</strong> ${directionFormatted.full}</div>
                              ${windGusts ? `<div><strong>Gusts:</strong> ${formatWindSpeed(windGusts).ms} m/s (${formatWindSpeed(windGusts).knots} knots)</div>` : ''}
                            </div>
                            ${rec.reasoning ? `<div class="hidden md:block text-xs text-gray-700 mt-1 italic">${rec.reasoning}</div>` : ''}
                            ${suitability === 'unknown' ? `<div class="text-[10px] sm:text-xs text-amber-600 mt-0.5 sm:mt-1 font-medium">⚠️ Warning: Shore direction unknown</div>` : ''}
                          </div>
                        </div>
                      `;
                            })()
                          : ''
                      }
                    </div>
                  `
                    : `
                    <p class="text-xs text-gray-500 mt-1">
                      ${lat.toFixed(4)}, ${lng.toFixed(4)}
                    </p>
                  `
            }
          </div>
        `;

          leafletMarker.bindPopup(popupContent, {
            maxWidth: 240,
            autoPanPadding: [50, 50],
            autoPanPaddingTopLeft: [50, 50],
            autoPanPaddingBottomRight: [50, 50],
          });
          return leafletMarker;
        } catch (error) {
          console.warn('Error creating marker:', error, marker);
          return null;
        }
      };

      // Clear existing individual markers (dive sites at zoom >= 13)
      individualMarkersRef.current.forEach(marker => {
        try {
          map.removeLayer(marker);
        } catch (error) {
          // Marker might already be removed
        }
      });
      individualMarkersRef.current = [];

      // Add dive site markers conditionally based on zoom
      diveSiteMarkers.forEach(marker => {
        const leafletMarker = createMarker(marker);
        if (!leafletMarker) return;

        if (shouldClusterDiveSites) {
          // Add to cluster group at zoom <= 12
          clusterGroup.addLayer(leafletMarker);
        } else {
          // Add directly to map at zoom >= 13 (no clustering)
          map.addLayer(leafletMarker);
          individualMarkersRef.current.push(leafletMarker);
        }
      });

      // Add all other markers to cluster group (always clustered)
      otherMarkers.forEach(marker => {
        const leafletMarker = createMarker(marker);
        if (!leafletMarker) return;
        clusterGroup.addLayer(leafletMarker);
      });

      // Add cluster group to map (only if it has markers)
      if (clusterGroup.getLayers().length > 0) {
        try {
          map.addLayer(clusterGroup);
          clusterRef.current = clusterGroup;
        } catch (error) {
          console.warn('Error adding cluster group to map:', error);
        }
      } else {
        clusterRef.current = null;
      }
    }, 50); // Small delay to prevent race conditions

    // Handle viewport changes - completely disabled to prevent auto-zoom issue
    const handleMoveEnd = () => {
      // Mark that user has manually interacted with the map
      userHasZoomedRef.current = true;

      // Update viewport state for share functionality
      // This doesn't trigger data re-fetching, just updates the viewport state
      if (onViewportChangeRef.current) {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bounds = map.getBounds();

        onViewportChangeRef.current({
          latitude: center.lat,
          longitude: center.lng,
          zoom: zoom,
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
        });
      }
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      clearTimeout(timeoutId);
      if (clusterRef.current) {
        try {
          clusterRef.current.clearLayers();
          map.removeLayer(clusterRef.current);
          clusterRef.current = null;
        } catch (error) {
          console.warn('Error cleaning up cluster group:', error);
        }
      }
      map.off('moveend', handleMoveEnd);
    };
  }, [markers, map, currentZoom, selectedEntityType]);

  // Separate effect for auto-fit to prevent re-triggering on every marker change
  useEffect(() => {
    // Only skip auto-fit if we have a high-zoom geolocation viewport (user's actual location)
    // Low zoom levels (like 2) should still trigger auto-fit
    if (viewport && viewport.latitude && viewport.longitude && viewport.zoom >= 10) {
      // This looks like a geolocation viewport (high zoom level), skip auto-fit
      hasAutoFittedRef.current = true;
      return;
    }

    if (!map || !clusterRef.current || hasAutoFittedRef.current || userHasZoomedRef.current) return;

    // Auto-fit to show all markers ONLY on initial load
    if (markers.length > 0) {
      // Use setTimeout to ensure the cluster group is fully rendered
      setTimeout(() => {
        if (clusterRef.current && !hasAutoFittedRef.current && !userHasZoomedRef.current) {
          const group = new L.featureGroup(clusterRef.current.getLayers());
          const bounds = group.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            // Calculate center and appropriate zoom level
            const center = bounds.getCenter();
            const latRange = bounds.getNorth() - bounds.getSouth();
            const lngRange = bounds.getEast() - bounds.getWest();
            const maxRange = Math.max(latRange, lngRange);

            // Calculate zoom level based on the range
            let zoom = 10; // Default zoom
            if (maxRange > 180) zoom = 2;
            else if (maxRange > 90) zoom = 3;
            else if (maxRange > 45) zoom = 4;
            else if (maxRange > 20) zoom = 5;
            else if (maxRange > 10) zoom = 6;
            else if (maxRange > 5) zoom = 7;
            else if (maxRange > 2) zoom = 8;
            else if (maxRange > 1) zoom = 9;
            else if (maxRange > 0.5) zoom = 10;
            else if (maxRange > 0.2) zoom = 11;
            else if (maxRange > 0.1) zoom = 12;
            else zoom = 13;

            // Set the map view directly
            map.setView(center, zoom);
            hasAutoFittedRef.current = true;
          }
        }
      }, 200); // Increased timeout to ensure everything is ready
    }
  }, [map, selectedEntityType, viewport, markers.length]);

  // Reset auto-fit flag when entity type changes
  useEffect(() => {
    hasAutoFittedRef.current = false;
    userHasZoomedRef.current = false; // Reset user zoom flag when switching entity types
  }, [selectedEntityType]);

  // Handle reset trigger - force auto-fit to bounds
  useEffect(() => {
    if (resetTrigger && map && clusterRef.current && markers.length > 0) {
      // Reset the flags to allow auto-fit
      hasAutoFittedRef.current = false;
      userHasZoomedRef.current = false;

      // Force auto-fit to bounds
      setTimeout(() => {
        if (clusterRef.current) {
          const group = new L.featureGroup(clusterRef.current.getLayers());
          const bounds = group.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            // Calculate center and appropriate zoom level
            const center = bounds.getCenter();
            const latRange = bounds.getNorth() - bounds.getSouth();
            const lngRange = bounds.getEast() - bounds.getWest();
            const maxRange = Math.max(latRange, lngRange);

            // Calculate zoom level based on the range
            let zoom = 10; // Default zoom
            if (maxRange > 180) zoom = 2;
            else if (maxRange > 90) zoom = 3;
            else if (maxRange > 45) zoom = 4;
            else if (maxRange > 20) zoom = 5;
            else if (maxRange > 10) zoom = 6;
            else if (maxRange > 5) zoom = 7;
            else if (maxRange > 2) zoom = 8;
            else if (maxRange > 1) zoom = 9;
            else if (maxRange > 0.5) zoom = 10;
            else if (maxRange > 0.2) zoom = 11;
            else if (maxRange > 0.1) zoom = 12;
            else zoom = 13;

            // Set the map view directly
            map.setView(center, zoom);
            hasAutoFittedRef.current = true;
          }
        }
      }, 100);
    }
  }, [resetTrigger, map, markers.length]);

  return null;
};

const LeafletMapView = ({
  data,
  selectedEntityType,
  viewport,
  onViewportChange,
  popupInfo,
  setPopupInfo,
  popupPosition,
  setPopupPosition,
  isLoading,
  error,
  selectedLayer,
  onLayerChange,
  onMapInstance,
  resetTrigger,
  windOverlayEnabled: externalWindOverlayEnabled,
  setWindOverlayEnabled: externalSetWindOverlayEnabled,
  windDateTime,
  setWindDateTime,
  onWindLoadingChange,
  onWindFetchingChange,
  showWindLegend: externalShowWindLegend,
  setShowWindLegend: externalSetShowWindLegend,
}) => {
  const [mapMetadata, setMapMetadata] = useState(null);
  const [internalWindOverlayEnabled, setInternalWindOverlayEnabled] = useState(false);
  const windOverlayEnabled =
    externalWindOverlayEnabled !== undefined
      ? externalWindOverlayEnabled
      : internalWindOverlayEnabled;
  const setWindOverlayEnabled = externalSetWindOverlayEnabled || setInternalWindOverlayEnabled;
  const [debouncedBounds, setDebouncedBounds] = useState(null);
  const [showMapInfoBox, setShowMapInfoBox] = useState(false);
  const [internalShowWindLegend, setInternalShowWindLegend] = useState(false);
  const showWindLegend =
    externalShowWindLegend !== undefined ? externalShowWindLegend : internalShowWindLegend;
  const setShowWindLegend = externalSetShowWindLegend || setInternalShowWindLegend;
  const queryClient = useQueryClient();

  // Helper function to prefetch wind data for multiple hours ahead
  const prefetchWindHours = useCallback((startDateTime, bounds, zoom, client) => {
    if (!startDateTime || !bounds) return;

    // OPTIMIZATION: Only prefetch one hour per day (not every 3 hours)
    // The backend caches all 24 hours when fetching any hour, so we only need one request per day
    // Prefetch next 2 days (one request per day) - this will cache all 48 hours
    const currentDate = new Date(startDateTime);
    const prefetchDays = [1, 2]; // Days ahead to prefetch (one request per day)

    prefetchDays.forEach(daysAhead => {
      const futureDate = new Date(currentDate);
      futureDate.setDate(futureDate.getDate() + daysAhead);
      // Use noon (12:00) as the representative hour for each day - this will cache all 24 hours for that day
      futureDate.setHours(12, 0, 0, 0);

      // Don't prefetch beyond 2 days from now
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 2);
      if (futureDate > maxDate) return;

      const futureDateTimeStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T${String(futureDate.getHours()).padStart(2, '0')}:00:00`;

      // Prefetch in background (silently, without showing loading indicators)
      client.prefetchQuery(
        [
          'wind-data',
          bounds
            ? {
                north: Math.round(bounds.north * 10) / 10,
                south: Math.round(bounds.south * 10) / 10,
                east: Math.round(bounds.east * 10) / 10,
                west: Math.round(bounds.west * 10) / 10,
              }
            : null,
          zoom,
          futureDateTimeStr,
        ],
        async () => {
          const latMargin = (bounds.north - bounds.south) * 0.025;
          const lonMargin = (bounds.east - bounds.west) * 0.025;

          const params = {
            north: bounds.north + latMargin,
            south: bounds.south - latMargin,
            east: bounds.east + lonMargin,
            west: bounds.west - lonMargin,
            zoom_level: Math.round(zoom),
            datetime_str: futureDateTimeStr,
          };

          const response = await api.get('/api/v1/weather/wind', { params });
          return response.data;
        },
        {
          staleTime: 5 * 60 * 1000,
          cacheTime: 15 * 60 * 1000,
        }
      );
    });
  }, []);

  // Create custom icons for different entity types
  const createEntityIcon = useCallback(
    (entityType, isCluster = false, count = 1, suitability = null) => {
      const size = isCluster ? Math.min(24 + count * 2, 48) : 24;
      const borderWidth = suitability ? 4 : 0; // 4px colored border for suitability - increased for better visibility
      const borderColor = suitability ? getSuitabilityColor(suitability) : null;

      let svg = '';

      switch (entityType) {
        case 'dive_site':
          // Scuba flag (diver down flag) - red rectangle with white diagonal stripe
          // Add colored border if suitability is available
          // Use a white outline around the colored border for better visibility
          svg = `
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${
                borderColor
                  ? `
                <!-- White outline for better contrast -->
                <rect x="0" y="0" width="24" height="24" fill="white" stroke="white" stroke-width="${borderWidth + 1}"/>
                <!-- Colored border -->
                <rect x="0.5" y="0.5" width="23" height="23" fill="${borderColor}" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-opacity="1"/>
              `
                  : ''
              }
              <!-- Red rectangle background -->
              <rect x="${borderColor ? borderWidth + 0.5 : 2}" y="${borderColor ? borderWidth + 0.5 : 2}" width="${borderColor ? 24 - (borderWidth + 0.5) * 2 : 20}" height="${borderColor ? 24 - (borderWidth + 0.5) * 2 : 20}" fill="#dc2626" stroke="white" stroke-width="1"/>
              <!-- White diagonal stripe from top-left to bottom-right -->
              <path d="M${borderColor ? borderWidth + 0.5 : 2} ${borderColor ? borderWidth + 0.5 : 2} L${borderColor ? 24 - (borderWidth + 0.5) : 22} ${borderColor ? 24 - (borderWidth + 0.5) : 22}" stroke="white" stroke-width="3" stroke-linecap="round"/>
              <!-- Optional: Add small white dots for bubbles -->
              <circle cx="${borderColor ? 6 + borderWidth + 0.5 : 6}" cy="${borderColor ? 6 + borderWidth + 0.5 : 6}" r="1" fill="white"/>
              <circle cx="${borderColor ? 18 - (borderWidth + 0.5) : 18}" cy="${borderColor ? 18 - (borderWidth + 0.5) : 18}" r="1" fill="white"/>
            </svg>
          `;
          break;
        case 'dive':
          // Scuba flag (diver down flag) - red rectangle with white diagonal stripe
          svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Red rectangle background -->
            <rect x="2" y="2" width="20" height="20" fill="#dc2626" stroke="white" stroke-width="1"/>
            <!-- White diagonal stripe from top-left to bottom-right -->
            <path d="M2 2 L22 22" stroke="white" stroke-width="3" stroke-linecap="round"/>
            <!-- Optional: Add small white dots for bubbles -->
            <circle cx="6" cy="6" r="1" fill="white"/>
            <circle cx="18" cy="18" r="1" fill="white"/>
          </svg>
        `;
          break;
        case 'diving_center':
          // Blue square with "DC" text for diving centers
          svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Blue rectangle background -->
            <rect x="2" y="2" width="20" height="20" fill="#2563eb" stroke="white" stroke-width="1"/>
            <!-- White "DC" text -->
            <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">DC</text>
          </svg>
        `;
          break;
        case 'dive_trip': {
          // Trip icon with status-based color
          const baseColor = '#3b82f6'; // Default blue for scheduled
          svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Background circle -->
            <circle cx="12" cy="12" r="10" fill="${baseColor}" stroke="white" stroke-width="2"/>
            <!-- Diver silhouette -->
            <circle cx="12" cy="9" r="2" fill="white"/>
            <path d="M8 15 Q12 19 16 15" stroke="white" stroke-width="2" fill="none"/>
            <!-- Flag -->
            <rect x="15" y="7" width="4" height="3" fill="white" rx="1"/>
            <line x1="15" y1="7" x2="15" y2="10" stroke="white" stroke-width="1"/>
          </svg>
        `;
          break;
        }
        default:
          // Default gray circle
          svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#6b7280" stroke="white" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">?</text>
          </svg>
        `;
      }

      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      return new Icon({
        iconUrl: dataUrl,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      });
    },
    []
  );

  // Debounce bounds changes for wind data fetching
  useEffect(() => {
    if (!mapMetadata?.bounds) return;

    const timer = setTimeout(() => {
      setDebouncedBounds(mapMetadata.bounds);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [mapMetadata?.bounds]);

  // Fetch wind data when overlay is enabled and zoom >= 10
  const shouldFetchWindData = !!(
    windOverlayEnabled &&
    mapMetadata?.zoom >= 10 &&
    mapMetadata?.zoom <= 18 &&
    debouncedBounds &&
    selectedEntityType === 'dive-sites'
  );

  const {
    data: windData,
    isLoading: isLoadingWind,
    isFetching: isFetchingWind,
    error: windDataError,
    isError: isWindDataError,
    refetch: refetchWindData,
    dataUpdatedAt: windDataUpdatedAt,
  } = useQuery(
    // OPTIMIZATION #4: Round bounds in query key to match backend cache granularity (0.1°)
    // This reduces unnecessary refetches when bounds change slightly but stay in same cache cell
    [
      'wind-data',
      debouncedBounds
        ? {
            // Round bounds to 0.1° to match backend cache key generation
            north: Math.round(debouncedBounds.north * 10) / 10,
            south: Math.round(debouncedBounds.south * 10) / 10,
            east: Math.round(debouncedBounds.east * 10) / 10,
            west: Math.round(debouncedBounds.west * 10) / 10,
          }
        : null,
      mapMetadata?.zoom,
      windDateTime,
    ],
    async () => {
      if (!debouncedBounds) return null;

      // Add small margin to bounds to ensure arrows appear within viewport, not at edges
      // Margin is approximately 2.5% of the bounds range (reduced from 5% for better coverage)
      const latMargin = (debouncedBounds.north - debouncedBounds.south) * 0.025;
      const lonMargin = (debouncedBounds.east - debouncedBounds.west) * 0.025;

      const params = {
        north: debouncedBounds.north + latMargin,
        south: debouncedBounds.south - latMargin,
        east: debouncedBounds.east + lonMargin,
        west: debouncedBounds.west - lonMargin,
        zoom_level: Math.round(mapMetadata.zoom),
      };

      // Add datetime_str if specified (null means current time, so don't include it)
      if (windDateTime) {
        params.datetime_str = windDateTime;
      }

      const response = await api.get('/api/v1/weather/wind', { params });

      return response.data;
    },
    {
      enabled: shouldFetchWindData,
      staleTime: 5 * 60 * 1000, // 5 minutes - reduced for better responsiveness
      cacheTime: 15 * 60 * 1000, // 15 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      // Keep previous data while refetching to prevent arrows from disappearing
      keepPreviousData: true,
      // Prefetch nearby hours when data is successfully fetched
      onSuccess: data => {
        if (!windDateTime || !debouncedBounds) return;
        prefetchWindHours(windDateTime, debouncedBounds, mapMetadata?.zoom, queryClient);
      },
    }
  );

  // Auto-disable wind overlay when zoom drops below 10
  useEffect(() => {
    if (windOverlayEnabled && mapMetadata?.zoom < 10) {
      setWindOverlayEnabled(false);
    }
  }, [windOverlayEnabled, mapMetadata?.zoom]);

  // Fetch wind recommendations when overlay is enabled and zoom >= 10
  const shouldFetchRecommendations = !!(
    windOverlayEnabled &&
    mapMetadata?.zoom >= 10 &&
    mapMetadata?.zoom <= 18 &&
    debouncedBounds &&
    selectedEntityType === 'dive-sites'
  );

  const {
    data: windRecommendations,
    isLoading: isLoadingRecommendations,
    isFetching: isFetchingRecommendations,
  } = useQuery(
    ['wind-recommendations', debouncedBounds, windDateTime],
    async () => {
      if (!debouncedBounds) return null;

      const params = {
        north: debouncedBounds.north,
        south: debouncedBounds.south,
        east: debouncedBounds.east,
        west: debouncedBounds.west,
        include_unknown: true, // Include sites without shore_direction
      };

      // Add datetime_str if specified (null means current time, so don't include it)
      if (windDateTime) {
        params.datetime_str = windDateTime;
      }

      const response = await api.get('/api/v1/dive-sites/wind-recommendations', { params });
      return response.data;
    },
    {
      enabled: shouldFetchRecommendations,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 15 * 60 * 1000, // 15 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      keepPreviousData: true,
    }
  );

  // Notify parent of loading state changes (include fetching for refetches)
  useEffect(() => {
    if (onWindLoadingChange) {
      onWindLoadingChange(
        isLoadingWind || isLoadingRecommendations || isFetchingWind || isFetchingRecommendations
      );
    }
  }, [
    isLoadingWind,
    isLoadingRecommendations,
    isFetchingWind,
    isFetchingRecommendations,
    onWindLoadingChange,
  ]);

  // Notify parent of wind fetching state specifically (for play/pause functionality)
  useEffect(() => {
    if (onWindFetchingChange) {
      onWindFetchingChange(isFetchingWind);
    }
  }, [isFetchingWind, onWindFetchingChange]);

  // Create a map of dive site ID to recommendation for quick lookup
  const recommendationsMap = useMemo(() => {
    if (!windRecommendations?.recommendations) return {};
    const map = {};
    windRecommendations.recommendations.forEach(rec => {
      map[rec.dive_site_id] = rec;
    });
    return map;
  }, [windRecommendations]);

  // Process data into markers
  const markers = useMemo(() => {
    if (!data) return [];

    const allMarkers = [];

    // Determine if suitability indicators should be shown
    // Only show at zoom 10+ when wind overlay is enabled
    const showSuitability =
      windOverlayEnabled &&
      mapMetadata?.zoom >= 10 &&
      mapMetadata?.zoom <= 18 &&
      selectedEntityType === 'dive-sites' &&
      Object.keys(recommendationsMap).length > 0;

    // Process dive sites
    if (data.dive_sites && selectedEntityType === 'dive-sites') {
      data.dive_sites.forEach(site => {
        if (site.latitude && site.longitude) {
          // Get suitability for this dive site if available
          const recommendation = showSuitability ? recommendationsMap[site.id] : null;
          const suitability = recommendation?.suitability || null;

          allMarkers.push({
            id: `dive-site-${site.id}`,
            position: [site.latitude, site.longitude],
            entityType: 'dive_site',
            data: site,
            icon: createEntityIcon('dive_site', false, 1, suitability),
            recommendation: recommendation, // Store recommendation for popup
          });
        }
      });
    }

    // Process diving centers
    if (data.diving_centers && selectedEntityType === 'diving-centers') {
      data.diving_centers.forEach(center => {
        if (center.latitude && center.longitude) {
          allMarkers.push({
            id: `diving-center-${center.id}`,
            position: [center.latitude, center.longitude],
            entityType: 'diving_center',
            data: center,
            icon: createEntityIcon('diving_center'),
          });
        }
      });
    }

    // Process dives
    if (data.dives && selectedEntityType === 'dives') {
      data.dives.forEach(dive => {
        if (dive.dive_site?.latitude && dive.dive_site?.longitude) {
          allMarkers.push({
            id: `dive-${dive.id}`,
            position: [dive.dive_site.latitude, dive.dive_site.longitude],
            entityType: 'dive',
            data: dive,
            icon: createEntityIcon('dive'),
          });
        }
      });
    }

    // Process dive trips
    if (data.dive_trips && selectedEntityType === 'dive-trips') {
      data.dive_trips.forEach(trip => {
        // For trips, we need to find coordinates from associated dive sites or diving centers
        let latitude, longitude;

        // Priority 1: Look for dive site coordinates from trip's dives
        if (trip.dives && trip.dives.length > 0) {
          const firstDive = trip.dives[0];
          if (firstDive.dive_site_id && data.dive_sites) {
            // Find the dive site by ID in the loaded dive sites data
            const diveSite = data.dive_sites.find(site => site.id === firstDive.dive_site_id);
            if (diveSite && diveSite.latitude && diveSite.longitude) {
              latitude = diveSite.latitude;
              longitude = diveSite.longitude;
            }
          }
        }

        // Priority 2: Look for diving center coordinates
        if ((!latitude || !longitude) && trip.diving_center_id && data.diving_centers) {
          // Find the diving center by ID in the loaded diving centers data
          const divingCenter = data.diving_centers.find(
            center => center.id === trip.diving_center_id
          );
          if (divingCenter && divingCenter.latitude && divingCenter.longitude) {
            latitude = divingCenter.latitude;
            longitude = divingCenter.longitude;
          }
        }

        if (latitude && longitude) {
          allMarkers.push({
            id: `trip-${trip.id}`,
            position: [latitude, longitude],
            entityType: 'dive_trip',
            data: trip,
            icon: createEntityIcon('dive_trip'),
          });
        }
      });
    }

    return allMarkers;
  }, [
    data,
    selectedEntityType,
    createEntityIcon,
    windOverlayEnabled,
    mapMetadata?.zoom,
    recommendationsMap,
  ]);

  // Calculate center and bounds for the map
  const mapCenter = useMemo(() => {
    // Use viewport from parent if available (e.g., from geolocation)
    if (viewport && viewport.latitude && viewport.longitude) {
      return [viewport.latitude, viewport.longitude];
    }

    if (markers.length === 0) {
      return [37.9838, 23.7275]; // Athens center as default
    }

    const latitudes = markers.map(m => m.position[0]);
    const longitudes = markers.map(m => m.position[1]);

    const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;

    return [centerLat, centerLng];
  }, [markers, viewport]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2'></div>
          <p className='text-gray-600'>Loading map data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-full bg-gray-50'>
        <div className='text-center text-red-600'>
          <p>Error loading map data: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='relative w-full h-full map-container' style={{ zIndex: 1 }}>
      <MapContainer
        center={mapCenter}
        zoom={viewport?.zoom || (markers.length > 0 ? 10 : 8)}
        className='w-full h-full'
        style={{
          zIndex: 1,
          touchAction: 'pan-x pan-y',
        }}
      >
        <TileLayer
          attribution=''
          url={selectedLayer?.url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />

        <MapMetadata onMetadataChange={setMapMetadata} />
        <MapInstanceCapture onMapInstance={onMapInstance} />
        <MapContent
          markers={markers}
          selectedEntityType={selectedEntityType}
          viewport={viewport}
          onViewportChange={onViewportChange}
          resetTrigger={resetTrigger}
        />
        {/* Wind Overlay - only show for dive sites */}
        {selectedEntityType === 'dive-sites' &&
          windOverlayEnabled &&
          mapMetadata?.zoom >= 10 &&
          mapMetadata?.zoom <= 18 &&
          windData && (
            <WindOverlay
              windData={windData}
              isWindOverlayEnabled={windOverlayEnabled}
              maxArrows={200}
            />
          )}
      </MapContainer>

      {/* Zoom level indicator - top left (matching DiveSiteMap style) */}
      <div className='absolute top-2 left-12 sm:top-4 sm:left-16 z-50 bg-white/90 backdrop-blur-sm text-gray-800 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm border border-gray-200'>
        Zoom: {(mapMetadata?.zoom || viewport?.zoom || 8).toFixed(1)}
      </div>

      {/* Wind loading indicator - show when fetching wind data (initial load or refetch) */}
      {selectedEntityType === 'dive-sites' &&
        windOverlayEnabled &&
        mapMetadata?.zoom >= 10 &&
        (isLoadingWind || isFetchingWind) && (
          <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white/95 text-gray-800 px-4 py-3 rounded-lg shadow-lg border border-gray-300 flex items-center gap-3'>
            <div className='animate-spin'>
              <svg
                className='w-5 h-5 text-blue-600'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
            </div>
            <span className='text-sm font-medium'>Loading wind data...</span>
          </div>
        )}

      {/* Wind data error indicator */}
      {selectedEntityType === 'dive-sites' &&
        windOverlayEnabled &&
        mapMetadata?.zoom >= 10 &&
        isWindDataError &&
        windDataError && (
          <WindDataError
            error={windDataError}
            onRetry={() => refetchWindData()}
            isUsingCachedData={!!windData && windData.points && windData.points.length > 0}
          />
        )}

      {/* Button to show map info - left side, below zoom buttons */}
      {!showMapInfoBox && (
        <button
          onClick={() => setShowMapInfoBox(true)}
          className='absolute left-2 top-20 sm:left-4 sm:top-24 z-40 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm border border-gray-200 transition-colors flex items-center gap-1'
          title='Show map info'
          aria-label='Show map info'
        >
          <Info className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-gray-600' />
          <span className='hidden sm:inline'>Map Info</span>
          <span className='sm:hidden'>Info</span>
        </button>
      )}

      {/* Button to show wind legend - positioned below Map Info button */}
      {selectedEntityType === 'dive-sites' &&
        windOverlayEnabled &&
        mapMetadata?.zoom >= 10 &&
        !showWindLegend && (
          <button
            onClick={() => setShowWindLegend(true)}
            className='absolute left-2 top-28 sm:left-4 sm:top-32 z-40 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm border border-gray-200 transition-colors flex items-center gap-1'
            title='Show wind overlay legend'
            aria-label='Show wind overlay legend'
          >
            <Info className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-gray-600' />
            Legend
          </button>
        )}

      {/* Wind Overlay Legend - full screen on mobile (below navbar), positioned overlay on desktop */}
      {selectedEntityType === 'dive-sites' &&
        windOverlayEnabled &&
        mapMetadata?.zoom >= 10 &&
        showWindLegend && (
          <>
            {/* Backdrop for mobile - click to close */}
            <div
              className='fixed top-16 left-0 right-0 bottom-0 bg-black/20 sm:hidden z-[9998]'
              onClick={() => setShowWindLegend(false)}
              aria-hidden='true'
            />
            <div
              className='fixed top-16 left-0 right-0 bottom-0 sm:absolute sm:inset-auto sm:left-4 sm:top-[8.5rem] sm:bottom-auto sm:right-auto'
              style={{ zIndex: 99999, position: 'fixed' }}
            >
              <WindOverlayLegend onClose={() => setShowWindLegend(false)} />
            </div>
          </>
        )}

      {/* Map controls overlay - positioned on left, below zoom buttons */}
      {showMapInfoBox && (
        <div className='absolute left-4 top-24 bg-white rounded-lg shadow-lg p-3 text-sm space-y-2 max-w-xs z-40'>
          <div className='flex items-center justify-between mb-1'>
            <span className='font-medium text-gray-700'>Map Info</span>
            <button
              onClick={() => setShowMapInfoBox(false)}
              className='text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100'
              aria-label='Close map info box'
              title='Close'
            >
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
          <div className='flex items-center space-x-2'>
            <div className='w-3 h-3 bg-green-500 rounded-full'></div>
            <span>{markers.length} points</span>
          </div>
          {mapMetadata?.center && (
            <div className='flex items-center space-x-2'>
              <div className='w-3 h-3 bg-purple-500 rounded-full'></div>
              <span>Lat: {mapMetadata.center.lat.toFixed(4)}</span>
            </div>
          )}
          {mapMetadata?.center && (
            <div className='flex items-center space-x-2'>
              <div className='w-3 h-3 bg-purple-500 rounded-full'></div>
              <span>Lng: {mapMetadata.center.lng.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeafletMapView;
