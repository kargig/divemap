import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import ClusterSource from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon, Text, Fill, Stroke, Circle } from 'ol/style';
import View from 'ol/View';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import MaskedEmail from './MaskedEmail';

const DivingCentersMap = ({ divingCenters, viewport, onViewportChange }) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const hasFittedRef = useRef(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [maxZoom, setMaxZoom] = useState(19);
  const [useClustering, setUseClustering] = useState(true);

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
      src: dataUrl,
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    });
  };

  // Create cluster style function
  const createClusterStyle = feature => {
    const features = feature.get('features');
    const size = features.length;

    if (size === 1) {
      // Single feature - show individual diving center icon
      return new Style({
        image: createDivingCenterIcon(),
      });
    } else {
      // Multiple features - show cluster circle
      return new Style({
        image: new Circle({
          radius: Math.min(size * 3 + 10, 25),
          fill: new Fill({
            color: '#2563eb',
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2,
          }),
        }),
        text: new Text({
          text: size.toString(),
          fill: new Fill({
            color: 'white',
          }),
          font: 'bold 14px Arial',
        }),
      });
    }
  };

  // Calculate optimal popup position based on click coordinates
  const calculatePopupPosition = (clickX, clickY, mapWidth, mapHeight) => {
    const popupWidth = 280; // Approximate popup width
    const popupHeight = 180; // Approximate popup height
    const margin = 16;

    // Start with default position (above and centered on click)
    let left = clickX;
    let top = clickY - popupHeight - margin;

    // Check if popup would go off the left edge
    if (left < margin) {
      left = margin;
    }

    // Check if popup would go off the right edge
    if (left + popupWidth > mapWidth - margin) {
      left = mapWidth - popupWidth - margin;
    }

    // Check if popup would go off the top edge
    if (top < margin) {
      top = clickY + margin;
    }

    // Check if popup would go off the bottom edge
    if (top + popupHeight > mapHeight - margin) {
      top = mapHeight - popupHeight - margin;
    }

    return { left, top };
  };

  // Fit map to show all diving centers
  const fitMapToDivingCenters = (features, source, divingCentersData) => {
    if (features.length === 0 || hasFittedRef.current) return;

    const extent = source.getExtent();
    if (extent && extent[0] !== Infinity) {
      mapInstance.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
      });
      hasFittedRef.current = true;
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create vector source for diving centers
    const vectorSource = new VectorSource();

    // Create cluster source
    const clusterSource = new ClusterSource({
      distance: 50,
      source: vectorSource,
    });

    // Create vector layer with clustering
    const vectorLayer = new VectorLayer({
      source: clusterSource,
      style: createClusterStyle,
    });

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    mapInstance.current = map;

    // Add click handler
    map.on('click', event => {
      const feature = map.forEachFeatureAtPixel(event.pixel, feature => feature);
      if (feature) {
        const features = feature.get('features');
        if (features && features.length === 1) {
          const divingCenter = features[0].get('divingCenter');
          if (divingCenter) {
            const coordinate = event.coordinate;
            const pixel = map.getPixelFromCoordinate(coordinate);
            const mapSize = map.getSize();

            setPopupInfo(divingCenter);
            setPopupPosition(calculatePopupPosition(pixel[0], pixel[1], mapSize[0], mapSize[1]));
          }
        } else if (features && features.length > 1) {
          // Zoom to cluster
          const extent = clusterSource.getExtent();
          map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
          });
        }
      } else {
        setPopupInfo(null);
        setPopupPosition(null);
      }
    });

    // Add zoom change handler
    map.getView().on('change:resolution', () => {
      const zoom = map.getView().getZoom();
      setCurrentZoom(zoom);
      setUseClustering(zoom < 10);
    });

    // Cleanup
    return () => {
      if (map) {
        map.setTarget(undefined);
      }
    };
  }, []);

  // Update diving centers on the map
  useEffect(() => {
    if (!mapInstance.current || !divingCenters) return;

    const vectorSource = mapInstance.current.getLayers().getArray()[1].getSource().getSource();
    vectorSource.clear();

    const features = divingCenters
      .filter(center => center.latitude && center.longitude)
      .map(center => {
        const feature = new Feature({
          geometry: new Point(
            fromLonLat([parseFloat(center.longitude), parseFloat(center.latitude)])
          ),
          divingCenter: center,
        });
        return feature;
      });

    vectorSource.addFeatures(features);

    // Fit map to diving centers if this is the first load
    if (features.length > 0 && !hasFittedRef.current) {
      setTimeout(() => {
        fitMapToDivingCenters(features, vectorSource, divingCenters);
      }, 100);
    }
  }, [divingCenters]);

  // Update viewport when map changes
  useEffect(() => {
    if (!mapInstance.current) return;

    const view = mapInstance.current.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();

    if (center && zoom !== undefined) {
      const [longitude, latitude] = center;
      onViewportChange({
        longitude,
        latitude,
        zoom,
      });
    }
  }, [currentZoom, onViewportChange]);

  return (
    <div className='relative'>
      <div ref={mapRef} className='w-full h-96 sm:h-[500px] lg:h-[600px] rounded-lg shadow-lg' />

      {/* Popup */}
      {popupInfo && popupPosition && (
        <div
          className='absolute bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10 max-w-sm'
          style={{
            left: `${popupPosition.left}px`,
            top: `${popupPosition.top}px`,
          }}
        >
          <div className='flex justify-between items-start mb-2'>
            <h3 className='text-lg font-semibold text-gray-900 pr-2'>{popupInfo.name}</h3>
            {popupInfo.average_rating && (
              <span className='text-sm font-semibold text-gray-700'>
                {popupInfo.average_rating.toFixed(1)}/10
              </span>
            )}
          </div>

          {popupInfo.description && (
            <p className='text-sm text-gray-600 mb-3 line-clamp-2'>{popupInfo.description}</p>
          )}

          <div className='space-y-1 mb-3'>
            {popupInfo.email && (
              <div className='text-xs text-gray-500'>
                📧 <MaskedEmail email={popupInfo.email} />
              </div>
            )}
            {popupInfo.phone && <div className='text-xs text-gray-500'>📞 {popupInfo.phone}</div>}
            {popupInfo.website && (
              <div className='text-xs text-gray-500'>🌐 {popupInfo.website}</div>
            )}
          </div>

          <Link
            to={`/diving-centers/${popupInfo.id}`}
            className='block w-full text-center bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm'
          >
            View Details
          </Link>
        </div>
      )}

      {/* Clustering toggle */}
      <div className='absolute top-4 right-4 z-10'>
        <button
          onClick={() => setUseClustering(!useClustering)}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            useClustering ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {useClustering ? 'Clustering On' : 'Clustering Off'}
        </button>
      </div>
    </div>
  );
};

export default DivingCentersMap;
