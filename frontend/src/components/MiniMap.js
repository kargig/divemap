import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Fix default marker icons (so they appear without bundler asset config)
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

const MiniMap = ({ latitude, longitude, name, onMaximize, isMaximized = false, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMaximize = () => {
    if (onMaximize) {
      onMaximize();
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  // Auto-expand when maximized
  useEffect(() => {
    if (isMaximized) {
      setIsExpanded(true);
    }
  }, [isMaximized]);

  if (isMaximized) {
    return createPortal(
      <div className='fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4'>
        <div className='bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] relative'>
          <div className='flex items-center justify-between p-4 border-b'>
            <h3 className='text-lg font-semibold'>{name} - Location</h3>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-100 rounded-md transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
          <div className='h-full'>
            <div className='w-full h-full rounded-b-lg'>
              <MapContainer
                center={[latitude, longitude]}
                zoom={12}
                className='w-full h-full rounded-b-lg'
                style={{ zIndex: 1 }}
              >
                <TileLayer
                  attribution=''
                  url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                />
                <Recenter lat={latitude} lng={longitude} zoom={12} />
                <Marker position={[latitude, longitude]} />
              </MapContainer>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div
      className={`relative ${
        isExpanded ? 'h-64 md:h-96' : 'h-32 md:h-48'
      } transition-all duration-300`}
    >
      <div className='absolute top-2 right-2 z-10'>
        <button
          onClick={handleMaximize}
          className='bg-white p-2 rounded-md shadow-md hover:bg-gray-50 transition-colors'
          title='Maximize map'
        >
          <Maximize2 className='w-4 h-4' />
        </button>
      </div>
      <div className='w-full h-full rounded-lg'>
        <MapContainer
          center={[latitude, longitude]}
          zoom={isExpanded ? 12 : 10}
          className='w-full h-full rounded-lg'
          style={{ zIndex: 1 }}
        >
          <TileLayer attribution='' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
          <Recenter lat={latitude} lng={longitude} zoom={isExpanded ? 12 : 10} />
          <Marker position={[latitude, longitude]} />
        </MapContainer>
      </div>
    </div>
  );
};

MiniMap.propTypes = {
  latitude: PropTypes.number.isRequired,
  longitude: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  onMaximize: PropTypes.func,
  isMaximized: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

export default MiniMap;
