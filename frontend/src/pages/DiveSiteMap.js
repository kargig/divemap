import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';

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

const DiveSiteMap = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentZoom, setCurrentZoom] = useState(16);
  const mapContainerRef = useRef();

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

  if (isLoadingDiveSite || isLoadingNearby || !diveSite) {
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
          <span className='text-sm text-gray-600'>Zoom: {currentZoom.toFixed(1)}</span>
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
        <div className='absolute top-4 right-4 z-50'>
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
          <TileLayer attribution='' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
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
                    className='block w-full text-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm !text-white'
                  >
                    View Details
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <div className='absolute top-4 left-16 z-50 bg-white/90 text-gray-800 text-xs px-2 py-1 rounded shadow border border-gray-200'>
          Zoom: {currentZoom.toFixed(1)}
        </div>
      </div>

      {/* Popup replaced by native Leaflet popups when needed in future */}
    </div>,
    document.body
  );
};

export default DiveSiteMap;
