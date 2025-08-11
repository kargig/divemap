import { Maximize2, X } from 'lucide-react';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MiniMap = ({ latitude, longitude, name, onMaximize, isMaximized = false, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const mapRef = useRef();
  const mapInstance = useRef();

  const position = [longitude, latitude];

  useEffect(() => {
    if (!mapRef.current) return;

    try {
      // Create map
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat(position),
          zoom: isExpanded ? 12 : 10,
        }),
      });

      mapInstance.current = map;

      // Create and add marker
      const feature = new Feature({
        geometry: new Point(fromLonLat(position)),
      });

      const vectorSource = new VectorSource({
        features: [feature],
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({
              color: '#2563ea',
            }),
            stroke: new Stroke({
              color: 'white',
              width: 2,
            }),
          }),
        }),
      });

      map.addLayer(vectorLayer);
    } catch (error) {
      // Error creating map
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
      }
    };
  }, [longitude, latitude, isExpanded]);

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
            <div ref={mapRef} className='w-full h-full rounded-b-lg' />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className={`relative ${isExpanded ? 'h-64' : 'h-32'} transition-all duration-300`}>
      <div className='absolute top-2 right-2 z-10'>
        <button
          onClick={handleMaximize}
          className='bg-white p-2 rounded-md shadow-md hover:bg-gray-50 transition-colors'
          title='Maximize map'
        >
          <Maximize2 className='w-4 h-4' />
        </button>
      </div>
      <div ref={mapRef} className='w-full h-full rounded-lg' />
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
