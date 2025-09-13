import { X, Map, Satellite, Mountain, Navigation } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const MapLayersPanel = ({ isOpen, onClose, selectedLayer, onLayerChange }) => {
  const layers = [
    {
      id: 'street',
      name: 'Street Map',
      description: 'OpenStreetMap street view',
      icon: <Map className='w-5 h-5' />,
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    {
      id: 'satellite',
      name: 'Satellite',
      description: 'Satellite imagery view',
      icon: <Satellite className='w-5 h-5' />,
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    {
      id: 'terrain',
      name: 'Terrain',
      description: 'Topographic terrain view',
      icon: <Mountain className='w-5 h-5' />,
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
    },
    {
      id: 'navigation',
      name: 'Navigation',
      description: 'Navigation-focused view',
      icon: <Navigation className='w-5 h-5' />,
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className='absolute top-16 right-4 z-[9999] bg-white rounded-lg shadow-lg border border-gray-200 w-64'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-gray-200'>
        <h3 className='text-lg font-semibold text-gray-900'>Map Layers</h3>
        <button onClick={onClose} className='p-1 hover:bg-gray-100 rounded-full transition-colors'>
          <X className='w-5 h-5 text-gray-500' />
        </button>
      </div>

      {/* Layer options */}
      <div className='p-2'>
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => onLayerChange(layer)}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
              selectedLayer?.id === layer.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <div
              className={`flex-shrink-0 ${
                selectedLayer?.id === layer.id ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {layer.icon}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='font-medium'>{layer.name}</div>
              <div className='text-sm text-gray-500'>{layer.description}</div>
            </div>
            {selectedLayer?.id === layer.id && (
              <div className='flex-shrink-0'>
                <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className='px-4 py-2 border-t border-gray-200'>
        <p className='text-xs text-gray-500'>
          Switch between different map views to find the best perspective for your needs.
        </p>
      </div>
    </div>
  );
};

MapLayersPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  selectedLayer: PropTypes.object,
  onLayerChange: PropTypes.func.isRequired,
};

export default MapLayersPanel;
