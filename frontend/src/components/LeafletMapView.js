import L, { Icon } from 'leaflet';
import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';

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
    scale: null
  });

  useEffect(() => {
    if (!map) return;

    const updateMetadata = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();
      const bounds = map.getBounds();
      
      // Calculate approximate scale (meters per pixel)
      const scale = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
      
      const newMetadata = {
        zoom: Math.round(zoom * 100) / 100, // Round to 2 decimal places
        center: {
          lat: Math.round(center.lat * 10000) / 10000, // Round to 4 decimal places
          lng: Math.round(center.lng * 10000) / 10000
        },
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        scale: Math.round(scale)
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

const MapContent = ({ markers, selectedEntityType, viewport, onViewportChange }) => {
  const map = useMap();
  const clusterRef = useRef();
  const hasAutoFittedRef = useRef(false);
  const userHasZoomedRef = useRef(false);
  const [mapMetadata, setMapMetadata] = useState(null);

  // Create cluster group
  useEffect(() => {
    if (!map) return;

    // Clear existing cluster group
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
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

    // Add markers to cluster group
    markers.forEach(marker => {
      const leafletMarker = L.marker(marker.position, { icon: marker.icon });

      // Add popup with clickable title
      const popupContent = `
        <div class="p-2">
          <h3 class="font-semibold text-lg mb-2">
            <a href="/${
              marker.entityType === 'dive_site'
                ? 'dive-sites'
                : marker.entityType === 'diving_center'
                  ? 'diving-centers'
                  : 'dives'
            }/${marker.data.id}" 
               class="text-blue-600 hover:text-blue-800 hover:underline">
              ${marker.entityType === 'dive_site' ? marker.data.name : ''}
              ${marker.entityType === 'diving_center' ? marker.data.name : ''}
              ${marker.entityType === 'dive' ? `Dive #${marker.data.id}` : ''}
            </a>
          </h3>
          <p class="text-sm text-gray-600">
            ${marker.entityType === 'dive_site' ? marker.data.description : ''}
            ${marker.entityType === 'diving_center' ? marker.data.description : ''}
            ${marker.entityType === 'dive' ? `Dive at ${marker.data.dive_site?.name || 'Unknown Site'}` : ''}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            ${marker.position[0].toFixed(4)}, ${marker.position[1].toFixed(4)}
          </p>
        </div>
      `;

      leafletMarker.bindPopup(popupContent);
      clusterGroup.addLayer(leafletMarker);
    });

    // Add cluster group to map
    map.addLayer(clusterGroup);
    clusterRef.current = clusterGroup;

    // Handle viewport changes - completely disabled to prevent auto-zoom issue
    const handleMoveEnd = () => {
      // Mark that user has manually interacted with the map
      userHasZoomedRef.current = true;

      // Completely disabled to prevent auto-zoom issue
      // The viewport change callback was causing the parent component to re-fetch data
      // which was triggering the auto-fit again
      // if (onViewportChange) {
      //   const center = map.getCenter();
      //   const zoom = map.getZoom();
      //   const bounds = map.getBounds();
      //
      //   onViewportChange({
      //     latitude: center.lat,
      //     longitude: center.lng,
      //     zoom: zoom,
      //     bounds: {
      //       north: bounds.getNorth(),
      //       south: bounds.getSouth(),
      //       east: bounds.getEast(),
      //       west: bounds.getWest()
      //     }
      //   });
      // }
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }
      map.off('moveend', handleMoveEnd);
    };
  }, [markers, map, onViewportChange]);

  // Separate effect for auto-fit to prevent re-triggering on every marker change
  useEffect(() => {
    // Don't auto-fit if we have a geolocation viewport (user's location)
    if (viewport && viewport.latitude && viewport.longitude) {
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
          map.fitBounds(group.getBounds().pad(0.1));
          hasAutoFittedRef.current = true;
        }
      }, 100);
    }
  }, [map, selectedEntityType, viewport]);

  // Reset auto-fit flag when entity type changes
  useEffect(() => {
    hasAutoFittedRef.current = false;
    userHasZoomedRef.current = false; // Reset user zoom flag when switching entity types
  }, [selectedEntityType]);

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
    <div className='relative w-full h-full' style={{ zIndex: 1 }}>
      <MapContainer
        center={mapCenter}
        zoom={viewport?.zoom || (markers.length > 0 ? 10 : 8)}
        className='w-full h-full'
        style={{ zIndex: 1 }}
      >
        <TileLayer
          attribution=""
          url={selectedLayer?.url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />

        <MapMetadata onMetadataChange={setMapMetadata} />
        <MapContent
          markers={markers}
          selectedEntityType={selectedEntityType}
          viewport={viewport}
          onViewportChange={onViewportChange}
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
