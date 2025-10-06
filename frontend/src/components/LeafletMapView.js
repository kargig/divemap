import L, { Icon } from 'leaflet';
import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';

// Helper: convert URLs in plain text to clickable links (for HTML string popups)
const linkifyText = text => {
  if (!text || typeof text !== 'string') return text;
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
  );
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
  const hasAutoFittedRef = useRef(false);
  const userHasZoomedRef = useRef(false);
  const [mapMetadata, setMapMetadata] = useState(null);
  const onViewportChangeRef = useRef(onViewportChange);

  // Update ref when function changes
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

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

      // Create new cluster group
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

      // Add markers to cluster group with error handling
      markers.forEach(marker => {
        try {
          // Validate marker position
          if (!marker.position || !Array.isArray(marker.position) || marker.position.length !== 2) {
            console.warn('Invalid marker position:', marker);
            return;
          }

          const [lat, lng] = marker.position;
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            console.warn('Invalid marker coordinates:', marker);
            return;
          }

          const leafletMarker = L.marker([lat, lng], { icon: marker.icon });

          // Add popup with clickable title
          const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold text-lg mb-2">
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
                ${marker.entityType === 'dive_site' ? marker.data.name : ''}
                ${marker.entityType === 'diving_center' ? marker.data.name : ''}
                ${marker.entityType === 'dive' ? `Dive #${marker.data.id}` : ''}
                ${marker.entityType === 'dive_trip' ? `Trip #${marker.data.id}` : ''}
              </a>
            </h3>
            <p class="text-sm text-gray-600">
              ${marker.entityType === 'dive_site' ? linkifyText(marker.data.description) : ''}
              ${marker.entityType === 'diving_center' ? linkifyText(marker.data.description) : ''}
              ${marker.entityType === 'dive' ? `Dive at ${marker.data.dive_site?.name || 'Unknown Site'}` : ''}
              ${marker.entityType === 'dive_trip' ? `Trip on ${new Date(marker.data.trip_date).toLocaleDateString()} - ${marker.data.diving_center_name || 'Unknown Center'}` : ''}
              ${marker.entityType === 'dive_trip' && marker.data.trip_description ? `<br/><span class="text-xs text-gray-500">${linkifyText(marker.data.trip_description.substring(0, 100))}${marker.data.trip_description.length > 100 ? '...' : ''}</span>` : ''}
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
                      ${marker.data.difficulty_level ? `<div class="text-sm text-gray-700"><span class="mr-1">🏷️</span>Difficulty: <span class="font-medium">${marker.data.difficulty_level}</span></div>` : ''}
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

          leafletMarker.bindPopup(popupContent);
          clusterGroup.addLayer(leafletMarker);
        } catch (error) {
          console.warn('Error creating marker:', error, marker);
        }
      });

      // Add cluster group to map
      try {
        map.addLayer(clusterGroup);
        clusterRef.current = clusterGroup;
      } catch (error) {
        console.warn('Error adding cluster group to map:', error);
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
  }, [markers, map]);

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
}) => {
  const [mapMetadata, setMapMetadata] = useState(null);
  // Create custom icons for different entity types
  const createEntityIcon = useCallback((entityType, isCluster = false, count = 1) => {
    const size = isCluster ? Math.min(24 + count * 2, 48) : 24;

    let svg = '';

    switch (entityType) {
      case 'dive_site':
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
  }, []);

  // Process data into markers
  const markers = useMemo(() => {
    if (!data) return [];

    const allMarkers = [];

    // Process dive sites
    if (data.dive_sites && selectedEntityType === 'dive-sites') {
      data.dive_sites.forEach(site => {
        if (site.latitude && site.longitude) {
          allMarkers.push({
            id: `dive-site-${site.id}`,
            position: [site.latitude, site.longitude],
            entityType: 'dive_site',
            data: site,
            icon: createEntityIcon('dive_site'),
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
  }, [data, selectedEntityType, createEntityIcon]);

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
      </MapContainer>

      {/* Map controls overlay */}
      <div className='absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-sm space-y-2 max-w-xs'>
        <div className='flex items-center space-x-2'>
          <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          <span>{markers.length} points</span>
        </div>
        <div className='flex items-center space-x-2'>
          <div className='w-3 h-3 bg-blue-500 rounded-full'></div>
          <span>Zoom: {mapMetadata?.zoom || viewport?.zoom || 8}</span>
        </div>
        {mapMetadata?.center && (
          <div className='flex items-center space-x-2'>
            <div className='w-3 h-3 bg-purple-500 rounded-full'></div>
            <span>Lat: {mapMetadata.center.lat}</span>
          </div>
        )}
        {mapMetadata?.center && (
          <div className='flex items-center space-x-2'>
            <div className='w-3 h-3 bg-purple-500 rounded-full'></div>
            <span>Lng: {mapMetadata.center.lng}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeafletMapView;
