import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, X, Layers } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

import MapLayersPanel from '../components/MapLayersPanel';
import { useTheme } from '../contexts/ThemeContext';
import { createDiveSiteIcon } from '../utils/mapPins';

import Modal from './ui/Modal';

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

const MiniMap = ({
  latitude,
  longitude,
  name,
  onMaximize,
  isMaximized = false,
  onClose,
  showMaximizeButton = true,
  height = 'h-48 md:h-80', // Default increased heights
}) => {
  const { resolvedTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [userSelectedLayerManually, setUserSelectedLayerManually] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(() => {
    return resolvedTheme === 'dark'
      ? {
          id: 'dark',
          name: 'Dark Canvas',
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap contributors',
        }
      : {
          id: 'street',
          name: 'Street Map',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        };
  });

  useEffect(() => {
    if (!userSelectedLayerManually) {
      setSelectedLayer(
        resolvedTheme === 'dark'
          ? {
              id: 'dark',
              name: 'Dark Canvas',
              url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
              attribution:
                '&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap contributors',
            }
          : {
              id: 'street',
              name: 'Street Map',
              url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }
      );
    }
  }, [resolvedTheme, userSelectedLayerManually]);

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

  const diveSiteIcon = useMemo(() => createDiveSiteIcon(), []);

  if (isMaximized) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={`${name} - Location`}
        className='w-full max-w-4xl h-[90vh] p-0 overflow-hidden'
      >
        <div className='w-full h-full'>
          <MapContainer
            center={[latitude, longitude]}
            zoom={12}
            className='w-full h-full'
            style={{ zIndex: 1 }}
          >
            <TileLayer attribution={selectedLayer?.attribution || ''} url={selectedLayer?.url} />
            <Recenter lat={latitude} lng={longitude} zoom={12} />
            <Marker position={[latitude, longitude]} icon={diveSiteIcon} />
          </MapContainer>
        </div>
      </Modal>
    );
  }

  return (
    <div className={`relative ${isExpanded ? 'h-64 md:h-96' : height} transition-all duration-300`}>
      <div className='absolute top-2 right-2 z-10 flex gap-2'>
        <button
          onClick={() => setShowLayers(!showLayers)}
          className='bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-transparent dark:border-slate-700 p-2 rounded-md shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors'
          title='Map layers'
          aria-label='Map layers'
        >
          <Layers className='w-4 h-4' />
        </button>
        {showMaximizeButton && (
          <button
            onClick={handleMaximize}
            className='bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-transparent dark:border-slate-700 p-2 rounded-md shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors'
            title='Maximize map'
          >
            <Maximize2 className='w-4 h-4' />
          </button>
        )}
      </div>
      <div className='w-full h-full rounded-lg'>
        <MapContainer
          center={[latitude, longitude]}
          zoom={isExpanded ? 12 : 10}
          className='w-full h-full rounded-lg'
          style={{ zIndex: 1 }}
        >
          <TileLayer attribution={selectedLayer?.attribution || ''} url={selectedLayer?.url} />
          <Recenter lat={latitude} lng={longitude} zoom={isExpanded ? 12 : 10} />
          <Marker position={[latitude, longitude]} icon={diveSiteIcon} />
        </MapContainer>
      </div>
      <MapLayersPanel
        isOpen={showLayers}
        onClose={() => setShowLayers(false)}
        selectedLayer={selectedLayer}
        onLayerChange={layer => {
          setSelectedLayer(layer);
          setUserSelectedLayerManually(true);
          setShowLayers(false);
        }}
      />
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
  showMaximizeButton: PropTypes.bool,
  height: PropTypes.string,
};

export default MiniMap;
