import L, { Icon } from 'leaflet';
import { Calendar, Clock, Thermometer, Star } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link, useLocation } from 'react-router-dom';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';

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
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-gray-900">
              ${marker.name || marker.dive_site?.name || 'Unnamed Dive'}
            </h3>
            <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Dive
            </span>
          </div>
          <div class="space-y-2 mb-3">
            <div class="flex items-center text-sm text-gray-600">
              <span class="mr-2">📅</span>
              <span>${new Date(marker.dive_date).toLocaleDateString()}</span>
              ${
                marker.dive_time
                  ? `
                <span class="ml-2 mr-1">🕐</span>
                <span>${new Date(`2000-01-01T${marker.dive_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              `
                  : ''
              }
            </div>
            ${
              marker.difficulty_code
                ? `
              <div class="flex items-center">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(marker.difficulty_code)}">
                  ${marker.difficulty_label || getDifficultyLabel(marker.difficulty_code)}
                </span>
              </div>
            `
                : ''
            }
            <div class="flex items-center gap-4 text-sm text-gray-600">
              ${
                marker.max_depth
                  ? `
                <div class="flex items-center gap-1">
                  <span>🌡️</span>
                  <span>${marker.max_depth}m max</span>
                </div>
              `
                  : ''
              }
              ${
                marker.duration
                  ? `
                <div class="flex items-center gap-1">
                  <span>🕐</span>
                  <span>${marker.duration}min</span>
                </div>
              `
                  : ''
              }
              ${
                marker.user_rating
                  ? `
                <div class="flex items-center gap-1">
                  <span>⭐</span>
                  <span>${marker.user_rating}/10</span>
                </div>
              `
                  : ''
              }
            </div>
            ${
              marker.dive_information
                ? `
              <p class="text-sm text-gray-700 line-clamp-2">${marker.dive_information}</p>
            `
                : ''
            }
            ${
              marker.tags && marker.tags.length > 0
                ? `
              <div class="flex flex-wrap gap-1">
                ${marker.tags
                  .map(
                    tag => `
                  <span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    ${tag.name}
                  </span>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>
          <a href="/dives/${marker.id}" class="block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm" style="color: white !important;">
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
          <h3 class="font-semibold text-gray-900 mb-2">${childCount} Dives</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${childMarkers
              .map(marker => {
                const markerData = marker.options.markerData || {};
                return `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900">${markerData.name || markerData.dive_site?.name || 'Unnamed Dive'}</h4>
                    ${markerData.dive_site?.description ? `<p class="text-xs text-gray-600 line-clamp-1">${markerData.dive_site.description}</p>` : ''}
                  </div>
                  <div class="flex items-center space-x-2">
                    ${
                      markerData.difficulty_code
                        ? `
                      <span class="px-1 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ${markerData.difficulty_label || getDifficultyLabel(markerData.difficulty_code)}
                      </span>
                    `
                        : ''
                    }
                    <a href="/dives/${markerData.id}" class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" style="color: white !important;">
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

const DivesMap = ({ dives = [], onViewportChange }) => {
  const location = useLocation();
  const [currentZoom, setCurrentZoom] = useState(10);
  const [maxZoom] = useState(18);
  const [useClustering, setUseClustering] = useState(true);
  const [mapCenter, setMapCenter] = useState([0, 0]);

  // Create custom dive icon
  const createDiveIcon = () => {
    const size = 24;

    // Create SVG dive icon - green circle with white dive mask
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Green circle background -->
        <circle cx="12" cy="12" r="10" fill="#16a34a" stroke="white" stroke-width="1"/>
        <!-- White dive mask symbol -->
        <path d="M8 8 L16 8 M8 8 L8 12 M16 8 L16 12 M8 12 L16 12 M10 10 L14 10 M10 11 L14 11" 
              stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Small bubbles -->
        <circle cx="9" cy="6" r="1" fill="white" opacity="0.8"/>
        <circle cx="15" cy="6" r="1" fill="white" opacity="0.8"/>
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

  // Process dives data
  const processedDives = useMemo(() => {
    if (!dives || !Array.isArray(dives)) return [];

    return dives
      .filter(
        dive =>
          dive &&
          dive.dive_site &&
          typeof dive.dive_site.latitude === 'number' &&
          typeof dive.dive_site.longitude === 'number'
      )
      .map(dive => ({
        ...dive,
        position: [dive.dive_site.latitude, dive.dive_site.longitude],
      }));
  }, [dives]);

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    if (processedDives.length === 0) return null;

    const lats = processedDives.map(dive => dive.position[0]);
    const lngs = processedDives.map(dive => dive.position[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [processedDives]);

  // Calculate map center
  const calculatedCenter = useMemo(() => {
    if (processedDives.length === 0) return [0, 0];

    const lats = processedDives.map(dive => dive.position[0]);
    const lngs = processedDives.map(dive => dive.position[1]);

    const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const avgLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;

    return [avgLat, avgLng];
  }, [processedDives]);

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

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, // Use 24-hour format
    });
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
            markers={processedDives}
            createIcon={createDiveIcon}
            onClusterClick={handleClusterClick}
          />
        ) : (
          processedDives.map(dive => (
            <Marker key={dive.id} position={dive.position} icon={createDiveIcon()}>
              <Popup>
                <div className='p-2'>
                  <div className='flex items-center justify-between mb-2'>
                    <h3 className='font-semibold text-gray-900'>
                      {dive.name || dive.dive_site?.name || 'Unnamed Dive'}
                    </h3>
                    <span className='px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800'>
                      Dive
                    </span>
                  </div>

                  <div className='space-y-2 mb-3'>
                    <div className='flex items-center text-sm text-gray-600'>
                      <Calendar className='h-4 w-4 mr-1' />
                      <span>{formatDate(dive.dive_date)}</span>
                      {dive.dive_time && (
                        <>
                          <Clock className='h-4 w-4 mr-1 ml-2' />
                          <span>{formatTime(dive.dive_time)}</span>
                        </>
                      )}
                    </div>

                    {dive.difficulty_code && (
                      <div className='flex items-center'>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                        >
                          {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                        </span>
                      </div>
                    )}

                    <div className='flex items-center gap-4 text-sm text-gray-600'>
                      {dive.max_depth && (
                        <div className='flex items-center gap-1'>
                          <Thermometer size={14} />
                          <span>{dive.max_depth}m max</span>
                        </div>
                      )}
                      {dive.duration && (
                        <div className='flex items-center gap-1'>
                          <Clock size={14} />
                          <span>{dive.duration}min</span>
                        </div>
                      )}
                      {dive.user_rating && (
                        <div className='flex items-center gap-1'>
                          <Star size={14} className='text-yellow-500' />
                          <span>{dive.user_rating}/10</span>
                        </div>
                      )}
                    </div>

                    {dive.dive_information && (
                      <p className='text-sm text-gray-700 line-clamp-2'>{dive.dive_information}</p>
                    )}

                    {dive.tags && dive.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1'>
                        {dive.tags.map(tag => (
                          <span
                            key={tag.id}
                            className='px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full'
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/dives/${dive.id}`}
                    state={{ from: location.pathname + location.search }}
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
        {processedDives.length} dives loaded
      </div>

      <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
        Zoom: {currentZoom.toFixed(1)}
      </div>
    </div>
  );
};

DivesMap.propTypes = {
  dives: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string,
      dive_date: PropTypes.string.isRequired,
      dive_time: PropTypes.string,
      max_depth: PropTypes.number,
      duration: PropTypes.number,
      user_rating: PropTypes.number,
      difficulty_code: PropTypes.string,
      dive_information: PropTypes.string,
      dive_site: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        name: PropTypes.string.isRequired,
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
      }).isRequired,
      tags: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
          name: PropTypes.string.isRequired,
        })
      ),
    })
  ),
  viewport: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
  }),
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

export default DivesMap;
