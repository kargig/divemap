import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link, useLocation } from 'react-router-dom';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to track zoom changes
const MapZoomTracker = ({ onZoomChange, onClusteringChange }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const onZoom = () => {
      const zoom = map.getZoom();
      onZoomChange(zoom);
      // Enable clustering at zoom <= 11, disable at zoom > 11
      const shouldUseClustering = zoom <= 11;
      onClusteringChange(shouldUseClustering);
    };
    map.on('zoomend', onZoom);
    onZoom(); // Call immediately to set initial zoom
    return () => map.off('zoomend', onZoom);
  }, [map, onZoomChange, onClusteringChange]);
  return null;
};

// Helper component to fit map to bounds
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
};

// Helper component to manage marker clustering
const MarkerClusterGroup = ({ markers, createIcon, onClusterClick }) => {
  const map = useMap();
  const clusterGroupRef = useRef();

  useEffect(() => {
    if (!map) return;

    // Create cluster group
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50, // Same as OpenLayers distance
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: cluster => {
        const childCount = cluster.getChildCount();
        const size = Math.min(childCount * 3 + 10, 25); // Same sizing as OpenLayers

        return L.divIcon({
          html: `<div style="
            background-color: #dc2626;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
          ">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    // Add markers to cluster group
    markers.forEach(marker => {
      const leafletMarker = L.marker(marker.position, {
        icon: createIcon(),
        markerData: marker, // Store marker data for cluster popup
      });

      // Add popup
      leafletMarker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-900 mb-1">${marker.name}</h3>
          ${marker.description ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${marker.description}</p>` : ''}
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-1 text-xs font-medium rounded-full             ${getDifficultyColorClasses(marker.difficulty_code)}">
              ${marker.difficulty_label || getDifficultyLabel(marker.difficulty_code)}
            </span>
            ${
              marker.average_rating
                ? `
              <div class="flex items-center">
                <span class="text-sm text-gray-700">${marker.average_rating.toFixed(1)}</span>
              </div>
            `
                : ''
            }
          </div>
          <a href="/dive-sites/${marker.id}" class="block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm" style="color: white !important;">
            View Details
          </a>
        </div>
      `);

      clusterGroup.addLayer(leafletMarker);
    });

    // Add cluster group to map
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Handle cluster click
    clusterGroup.on('clusterclick', e => {
      if (onClusterClick) {
        onClusterClick();
      }

      // Generate cluster popup
      const cluster = e.layer;
      const childMarkers = cluster.getAllChildMarkers();
      const childCount = childMarkers.length;

      // Create cluster popup content
      const clusterPopupContent = `
        <div class="p-2">
          <h3 class="font-semibold text-gray-900 mb-2">${childCount} Dive Sites</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${childMarkers
              .map(marker => {
                const markerData = marker.options.markerData || {};
                return `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900">${markerData.name || 'Unnamed Site'}</h4>
                    ${markerData.description ? `<p class="text-xs text-gray-600 line-clamp-1">${markerData.description}</p>` : ''}
                  </div>
                  <div class="flex items-center space-x-2">
                    ${
                      markerData.difficulty_code
                        ? `
                      <span class="px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(markerData.difficulty_code)}">
                        ${markerData.difficulty_label || getDifficultyLabel(markerData.difficulty_code)}
                      </span>
                    `
                        : ''
                    }
                    <a href="/dive-sites/${markerData.id}" class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" style="color: white !important;">
                      View
                    </a>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;

      // Create and show cluster popup
      const clusterPopup = L.popup()
        .setLatLng(cluster.getLatLng())
        .setContent(clusterPopupContent)
        .openOn(map);
    });

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, markers, createIcon, onClusterClick]);

  return null;
};

const DiveSitesMap = ({ diveSites, onViewportChange }) => {
  const location = useLocation();
  const [currentZoom, setCurrentZoom] = useState(10);
  const [maxZoom] = useState(18);
  const [useClustering, setUseClustering] = useState(true);
  const [mapCenter, setMapCenter] = useState([0, 0]);

  // Create custom dive site icon
  const createDiveSiteIcon = () => {
    const size = 24;

    // Create SVG scuba flag (diver down flag) - red rectangle with white diagonal stripe
    const svg = `
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

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return new Icon({
      iconUrl: dataUrl,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  // Process dive sites data
  const processedDiveSites = useMemo(() => {
    if (!diveSites || !Array.isArray(diveSites)) return [];

    return diveSites
      .filter(
        site => site && typeof site.latitude === 'number' && typeof site.longitude === 'number'
      )
      .map(site => ({
        ...site,
        position: [site.latitude, site.longitude],
      }));
  }, [diveSites]);

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    if (processedDiveSites.length === 0) return null;

    const lats = processedDiveSites.map(site => site.position[0]);
    const lngs = processedDiveSites.map(site => site.position[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [processedDiveSites]);

  // Calculate map center
  const calculatedCenter = useMemo(() => {
    if (processedDiveSites.length === 0) return [0, 0];

    const lats = processedDiveSites.map(site => site.position[0]);
    const lngs = processedDiveSites.map(site => site.position[1]);

    const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const avgLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;

    return [avgLat, avgLng];
  }, [processedDiveSites]);

  // Handle zoom changes
  const handleZoomChange = zoom => {
    setCurrentZoom(zoom);
  };

  // Handle clustering changes
  const handleClusteringChange = shouldUseClustering => {
    setUseClustering(shouldUseClustering);
  };

  // Handle cluster clicks
  const handleClusterClick = () => {
    // Leaflet automatically handles cluster expansion
    // This is just for any additional custom behavior if needed
  };

  // Handle map viewport changes
  const handleViewportChange = () => {
    // Intentionally no-op to avoid render loops with parent state
  };

  return (
    <div className='w-full h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden shadow-md relative'>
      <MapContainer
        center={calculatedCenter}
        zoom={currentZoom}
        maxZoom={maxZoom}
        className='w-full h-full'
        style={{ zIndex: 1 }}
        whenReady={() => {
          setMapCenter(calculatedCenter);
          handleViewportChange();
        }}
      >
        <TileLayer attribution='' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        <MapZoomTracker
          onZoomChange={handleZoomChange}
          onClusteringChange={handleClusteringChange}
        />
        {mapBounds && <FitBounds bounds={mapBounds} />}

        {/* Use clustering when enabled, individual markers when disabled */}
        {useClustering ? (
          <MarkerClusterGroup
            markers={processedDiveSites}
            createIcon={createDiveSiteIcon}
            onClusterClick={handleClusterClick}
          />
        ) : (
          processedDiveSites.map(site => (
            <Marker key={site.id} position={site.position} icon={createDiveSiteIcon()}>
              <Popup>
                <div className='p-2'>
                  <h3 className='font-semibold text-gray-900 mb-1'>{site.name}</h3>
                  {site.description && (
                    <p className='text-sm text-gray-600 mb-2 line-clamp-2'>
                      {renderTextWithLinks(site.description)}
                    </p>
                  )}
                  <div className='flex items-center justify-between mb-2'>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(site.difficulty_code)}`}
                    >
                      {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                    </span>
                    {site.average_rating && (
                      <div className='flex items-center'>
                        <span className='text-sm text-gray-700'>
                          {site.average_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Link
                    to={`/dive-sites/${site.id}`}
                    state={{ from: window.location.pathname + window.location.search }}
                    className='block w-full text-center px-3 py-2 bg-blue-600 text-white !text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm'
                  >
                    View Details
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>

      {/* Info overlays */}
      <div className='absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        {processedDiveSites.length} dive sites loaded
      </div>

      <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
        Zoom: {currentZoom.toFixed(1)}
      </div>
    </div>
  );
};

DiveSitesMap.propTypes = {
  diveSites: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      difficulty_code: PropTypes.string,
      description: PropTypes.string,
      average_rating: PropTypes.number,
    })
  ).isRequired,
  onViewportChange: PropTypes.func,
};

// Prop-types for helper components
MapZoomTracker.propTypes = {
  onZoomChange: PropTypes.func.isRequired,
  onClusteringChange: PropTypes.func.isRequired,
};

FitBounds.propTypes = {
  bounds: PropTypes.array.isRequired,
};

MarkerClusterGroup.propTypes = {
  markers: PropTypes.array.isRequired,
  createIcon: PropTypes.func.isRequired,
  onClusterClick: PropTypes.func,
};

export default DiveSitesMap;
