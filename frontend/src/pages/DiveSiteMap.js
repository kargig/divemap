import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Route, Layers } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';
import MapLayersPanel from '../components/MapLayersPanel';
import usePageTitle from '../hooks/usePageTitle';
import { getRouteTypeColor } from '../utils/colorPalette';
import { getSmartRouteColor } from '../utils/routeUtils';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Recenter = ({ lat, lng, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.setView([lat, lng], zoom, { animate: false });
  }, [map, lat, lng, zoom]);
  return null;
};

// Route layer component that displays all routes for the dive site
const RouteLayer = ({ routes, diveSiteId }) => {
  const map = useMap();
  const routeLayersRef = useRef([]);

  useEffect(() => {
    if (!routes || routes.length === 0) return;

    // Clear existing route layers
    routeLayersRef.current.forEach(layer => {
      map.removeLayer(layer);
    });
    routeLayersRef.current = [];

    // Add each route as a layer
    routes.forEach(route => {
      if (!route.route_data) return;

      const routeLayer = L.geoJSON(route.route_data, {
        style: feature => {
          // Use smart route color detection for consistent coloring
          const routeColor = getSmartRouteColor(route);

          return {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
            fillOpacity: 0.3,
          };
        },
        pointToLayer: (feature, latlng) => {
          // Use smart route color detection for consistent coloring
          const routeColor = getSmartRouteColor(route);

          return L.circleMarker(latlng, {
            radius: 5,
            fillColor: routeColor,
            color: routeColor,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6,
          });
        },
      });

      // Add click handler to route
      routeLayer.on('click', () => {
        // Navigate to route detail page
        window.open(`/dive-sites/${diveSiteId}/route/${route.id}`, '_blank');
      });

      // Add popup to route
      routeLayer.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-800 mb-1">${route.name}</h3>
          <p class="text-sm text-gray-600 mb-2">${route.description || 'No description'}</p>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <span class="px-2 py-1 bg-gray-100 rounded">${route.route_type}</span>
            <span>by ${route.creator?.username || 'Unknown'}</span>
          </div>
          <button 
            onclick="window.open('/dive-sites/${diveSiteId}/route/${route.id}', '_blank')"
            class="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            View Details
          </button>
        </div>
      `);

      map.addLayer(routeLayer);
      routeLayersRef.current.push(routeLayer);
    });

    return () => {
      routeLayersRef.current.forEach(layer => {
        map.removeLayer(layer);
      });
    };
  }, [map, routes, diveSiteId]);

  return null;
};

const DiveSiteMap = () => {
  // Set page title
  usePageTitle('Divemap - Map');

  const { id } = useParams();
  const navigate = useNavigate();
  const [currentZoom, setCurrentZoom] = useState(16);
  const [showLayers, setShowLayers] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState({
    id: 'street',
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const mapContainerRef = useRef();
  const [showRoutes, setShowRoutes] = useState(true);

  const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

  // Fetch current dive site
  const { data: diveSite, isLoading: isLoadingDiveSite } = useQuery(
    ['dive-site', id],
    () => api.get(`/api/v1/dive-sites/${id}`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Fetch nearby dive sites
  const { data: nearbyDiveSites, isLoading: isLoadingNearby } = useQuery(
    ['dive-site-nearby', id],
    () => api.get(`/api/v1/dive-sites/${id}/nearby`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Fetch routes for this dive site
  const { data: routes, isLoading: isLoadingRoutes } = useQuery(
    ['dive-site-routes', id],
    () => api.get(`/api/v1/dive-sites/${id}/routes`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Create custom Leaflet icon (SVG diver flag)
  const createDiveSiteIcon = (isMain = false) => {
    const size = isMain ? 32 : 24;
    const border = isMain
      ? '<rect x="1.5" y="1.5" width="21" height="21" fill="none" stroke="#f59e0b" stroke-width="3" rx="3" ry="3"/>'
      : '';
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${border}
        <rect x="2" y="2" width="20" height="20" fill="#dc2626" stroke="white" stroke-width="1.5" rx="2" ry="2"/>
        <path d="M2 2 L22 22" stroke="white" stroke-width="3" stroke-linecap="round"/>
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

  // (Cluster styling removed; simple markers are used for main and nearby sites)

  // Track zoom from Leaflet map
  const MapZoomTracker = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      const onZoom = () => setCurrentZoom(map.getZoom());
      map.on('zoomend', onZoom);
      onZoom();
      return () => map.off('zoomend', onZoom);
    }, [map]);
    return null;
  };

  // Compute markers
  const markers = useMemo(() => {
    if (!diveSite) return [];
    const list = [];
    if (isFiniteNumber(diveSite.latitude) && isFiniteNumber(diveSite.longitude)) {
      list.push({
        id: `site-${diveSite.id}`,
        position: [diveSite.latitude, diveSite.longitude],
        data: diveSite,
        isMain: true,
      });
    }
    const nearbyArray = Array.isArray(nearbyDiveSites)
      ? nearbyDiveSites
      : nearbyDiveSites?.results ||
        nearbyDiveSites?.items ||
        nearbyDiveSites?.data ||
        nearbyDiveSites?.nearby_sites ||
        [];
    nearbyArray.forEach(site => {
      if (site && site.latitude && site.longitude) {
        list.push({
          id: `nearby-${site.id}`,
          position: [site.latitude, site.longitude],
          data: site,
        });
      }
    });
    return list;
  }, [diveSite, nearbyDiveSites]);

  if (isLoadingDiveSite || isLoadingNearby || isLoadingRoutes || !diveSite) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return createPortal(
    <div className='fixed inset-0 z-50 bg-white'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b bg-white'>
        <div className='flex items-center space-x-4'>
          <button
            onClick={() => navigate(`/dive-sites/${id}`)}
            className='p-2 hover:bg-gray-100 rounded-md transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>
          <div>
            <h1 className='text-xl font-semibold'>
              {diveSite?.name || 'Loading...'} - Full Map View
            </h1>
            {isFiniteNumber(diveSite?.latitude) && isFiniteNumber(diveSite?.longitude) ? (
              <p className='text-sm text-gray-600'>
                {Number(diveSite.latitude).toFixed(4)}, {Number(diveSite.longitude).toFixed(4)}
              </p>
            ) : (
              <p className='text-sm text-gray-600'>No coordinates</p>
            )}
          </div>
        </div>
        <div className='flex items-center space-x-3'>
          <button
            onClick={() => setShowLayers(!showLayers)}
            className={`p-2 rounded-lg border transition-colors ${
              showLayers
                ? 'bg-blue-100 text-blue-600 border-blue-200'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title='Map layers'
            aria-label='Map layers'
          >
            <Layers className='w-4 h-4' />
          </button>
          <span className='text-sm text-gray-600'>Zoom: {currentZoom.toFixed(1)}</span>
          {routes && routes.length > 0 && (
            <button
              onClick={() => setShowRoutes(!showRoutes)}
              className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                showRoutes
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={showRoutes ? 'Hide Routes' : 'Show Routes'}
            >
              <Layers className='w-4 h-4 mr-1' />
              Routes ({routes.length})
            </button>
          )}
          <button
            onClick={() => navigate(`/dive-sites/${id}`)}
            className='p-2 hover:bg-gray-100 rounded-md transition-colors'
            aria-label='Close full map view'
            title='Close'
          >
            ×
          </button>
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} className='h-full relative'>
        <div className='absolute top-4 right-4 z-50 flex gap-2'>
          <button
            onClick={() => setShowLayers(true)}
            className='bg-white text-gray-700 hover:text-gray-900 rounded-full w-9 h-9 shadow-md flex items-center justify-center border border-gray-200'
            aria-label='Map layers'
            title='Map layers'
          >
            <Layers className='w-4 h-4' />
          </button>
          <button
            onClick={() => navigate(`/dive-sites/${id}`)}
            className='bg-white text-gray-700 hover:text-gray-900 rounded-full w-9 h-9 shadow-md flex items-center justify-center border border-gray-200'
            aria-label='Close full map view'
            title='Close'
          >
            ×
          </button>
        </div>
        <MapContainer
          center={
            isFiniteNumber(diveSite.latitude) && isFiniteNumber(diveSite.longitude)
              ? [diveSite.latitude, diveSite.longitude]
              : [37.9838, 23.7275]
          }
          zoom={16}
          className='w-full h-full'
          style={{ zIndex: 1 }}
        >
          <TileLayer attribution={selectedLayer?.attribution || ''} url={selectedLayer?.url} />
          <MapZoomTracker />
          {isFiniteNumber(diveSite.latitude) && isFiniteNumber(diveSite.longitude) && (
            <Recenter lat={diveSite.latitude} lng={diveSite.longitude} zoom={16} />
          )}
          {markers.map(m => (
            <Marker key={m.id} position={m.position} icon={createDiveSiteIcon(m.isMain)}>
              <Popup>
                <div className='p-3'>
                  <h3 className='font-semibold text-gray-900 mb-2'>
                    {m.data.name || `Dive Site #${m.data.id}`}
                  </h3>
                  <div className='text-xs text-gray-600 mb-3'>
                    {Array.isArray(m.position) && m.position.length === 2
                      ? `${Number(m.position[0]).toFixed(4)}, ${Number(m.position[1]).toFixed(4)}`
                      : 'N/A'}
                  </div>
                  <a
                    href={`/dive-sites/${m.data.id}`}
                    className='block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm'
                    style={{ color: 'white !important' }}
                  >
                    View Details
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
          {/* Route Layer */}
          {showRoutes && routes && routes.length > 0 && (
            <RouteLayer routes={routes} diveSiteId={id} />
          )}
        </MapContainer>
        <MapLayersPanel
          isOpen={showLayers}
          onClose={() => setShowLayers(false)}
          selectedLayer={selectedLayer}
          onLayerChange={layer => {
            setSelectedLayer(layer);
            setShowLayers(false);
          }}
        />
        <div className='absolute top-4 left-16 z-50 bg-white/90 text-gray-800 text-xs px-2 py-1 rounded shadow border border-gray-200'>
          Zoom: {currentZoom.toFixed(1)}
        </div>

        {/* Route Legend */}
        {showRoutes && routes && routes.length > 0 && (
          <div className='absolute bottom-4 left-4 z-50 bg-white/90 rounded-lg shadow border border-gray-200 p-3'>
            <div className='flex items-center mb-2'>
              <Route className='w-4 h-4 mr-2 text-gray-600' />
              <span className='text-sm font-medium text-gray-800'>Route Types</span>
            </div>
            <div className='space-y-1 text-xs'>
              <div className='flex items-center gap-2'>
                <div
                  className='w-3 h-3 rounded-full'
                  style={{ backgroundColor: getRouteTypeColor('walk') }}
                ></div>
                <span className='text-gray-700'>Walk Route</span>
              </div>
              <div className='flex items-center gap-2'>
                <div
                  className='w-3 h-3 rounded-full'
                  style={{ backgroundColor: getRouteTypeColor('swim') }}
                ></div>
                <span className='text-gray-700'>Swim Route</span>
              </div>
              <div className='flex items-center gap-2'>
                <div
                  className='w-3 h-3 rounded-full'
                  style={{ backgroundColor: getRouteTypeColor('scuba') }}
                ></div>
                <span className='text-gray-700'>Scuba Route</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popup replaced by native Leaflet popups when needed in future */}
    </div>,
    document.body
  );
};

export default DiveSiteMap;
