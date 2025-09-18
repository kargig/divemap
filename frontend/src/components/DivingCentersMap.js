import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';

import MaskedEmail from './MaskedEmail';

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
    onZoom();
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
            background-color: #2563eb;
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
      const leafletMarker = L.marker(marker.position, { icon: createIcon() });

      // Add popup
      leafletMarker.bindPopup(`
        <div class="p-2">
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-semibold text-gray-900 pr-2">${marker.name}</h3>
            ${
              marker.average_rating
                ? `
              <span class="text-sm font-semibold text-gray-700">
                ${marker.average_rating.toFixed(1)}/10
              </span>
            `
                : ''
            }
          </div>
          ${marker.description ? `<p class="text-sm text-gray-600 mb-3 line-clamp-2">${marker.description}</p>` : ''}
          <div class="space-y-1 mb-3">
            ${
              marker.email
                ? `
              <div class="text-xs text-gray-500">
                📧 <span class="masked-email">${marker.email.replace(/(.{2}).*(@.*)/, '$1***$2')}</span>
              </div>
            `
                : ''
            }
            ${marker.phone ? `<div class="text-xs text-gray-500">📞 ${marker.phone}</div>` : ''}
            ${marker.website ? `<div class="text-xs text-gray-500">🌐 ${marker.website}</div>` : ''}
          </div>
          <a href="/diving-centers/${marker.id}" class="block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm" style="color: white !important;">
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
    clusterGroup.on('clusterclick', () => {
      if (onClusterClick) {
        onClusterClick();
      }
    });

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, markers, createIcon, onClusterClick]);

  return null;
};

const DivingCentersMap = ({ divingCenters, onViewportChange }) => {
  const [currentZoom, setCurrentZoom] = useState(10);
  const [maxZoom] = useState(18);
  const [useClustering, setUseClustering] = useState(true);
  const [mapCenter, setMapCenter] = useState([0, 0]);

  // Create custom diving center icon
  const createDivingCenterIcon = () => {
    const size = 24;

    // Create SVG diving center icon - blue circle with white anchor
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Blue circle background -->
        <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="white" stroke-width="1"/>
        <!-- White anchor symbol -->
        <path d="M12 4 L12 8 M10 6 L14 6 M12 8 L9 11 L12 14 L15 11 L12 8 M12 14 L12 20 M10 18 L14 18"
              stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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

  // Process diving centers data
  const processedDivingCenters = useMemo(() => {
    if (!divingCenters || !Array.isArray(divingCenters)) return [];

    return divingCenters
      .filter(
        center =>
          center && typeof center.latitude === 'number' && typeof center.longitude === 'number'
      )
      .map(center => ({
        ...center,
        position: [center.latitude, center.longitude],
      }));
  }, [divingCenters]);

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    if (processedDivingCenters.length === 0) return null;

    const lats = processedDivingCenters.map(center => center.position[0]);
    const lngs = processedDivingCenters.map(center => center.position[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [processedDivingCenters]);

  // Calculate map center
  const calculatedCenter = useMemo(() => {
    if (processedDivingCenters.length === 0) return [0, 0];

    const lats = processedDivingCenters.map(center => center.position[0]);
    const lngs = processedDivingCenters.map(center => center.position[1]);

    const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const avgLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;

    return [avgLat, avgLng];
  }, [processedDivingCenters]);

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
    <div className='relative'>
      <MapContainer
        center={calculatedCenter}
        zoom={currentZoom}
        maxZoom={maxZoom}
        className='w-full h-96 sm:h-[500px] lg:h-[600px] rounded-lg shadow-lg'
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
            markers={processedDivingCenters}
            createIcon={createDivingCenterIcon}
            onClusterClick={handleClusterClick}
          />
        ) : (
          processedDivingCenters.map(center => (
            <Marker key={center.id} position={center.position} icon={createDivingCenterIcon()}>
              <Popup>
                <div className='p-2'>
                  <div className='flex justify-between items-start mb-2'>
                    <h3 className='text-lg font-semibold text-gray-900 pr-2'>{center.name}</h3>
                    {center.average_rating && (
                      <span className='text-sm font-semibold text-gray-700'>
                        {center.average_rating.toFixed(1)}/10
                      </span>
                    )}
                  </div>

                  {center.description && (
                    <p className='text-sm text-gray-600 mb-3 line-clamp-2'>{center.description}</p>
                  )}

                  <div className='space-y-1 mb-3'>
                    {center.email && (
                      <div className='text-xs text-gray-500'>
                        📧 <MaskedEmail email={center.email} />
                      </div>
                    )}
                    {center.phone && <div className='text-xs text-gray-500'>📞 {center.phone}</div>}
                    {center.website && (
                      <div className='text-xs text-gray-500'>🌐 {center.website}</div>
                    )}
                  </div>

                  <Link
                    to={`/diving-centers/${center.id}`}
                    className='block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm'
                    style={{ color: 'white !important' }}
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
        {processedDivingCenters.length} diving centers loaded
      </div>

      <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
        Zoom: {currentZoom.toFixed(1)}
      </div>
    </div>
  );
};

DivingCentersMap.propTypes = {
  divingCenters: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      description: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
      website: PropTypes.string,
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

export default DivingCentersMap;
