import { Feature } from 'ol';
// import { Extent } from 'ol/extent'; // Not used
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat, toLonLat } from 'ol/proj';
import ClusterSource from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon, Text, Fill, Stroke, Circle } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback } from 'react';

import { getDifficultyLabel } from '../utils/difficultyHelpers';

const UnifiedMapView = ({
  data,
  viewport,
  onViewportChange,
  selectedEntityType,
  isLoading,
  performanceMetrics,
}) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const lastDataKeyRef = useRef(null);

  // State
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [useClustering, setUseClustering] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  // Performance limits
  const MAX_POINTS_PER_VIEWPORT = 1000;
  const CLUSTERING_ZOOM_THRESHOLD = 11;

  // Create custom icons for different entity types
  const createEntityIcon = (entityType, isCluster = false, count = 1) => {
    const size = isCluster ? Math.min(24 + count * 2, 48) : 24;

    let svg = '';

    switch (entityType) {
      case 'dive_site':
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" fill="#dc2626" stroke="white" stroke-width="1"/>
            <path d="M2 2 L22 22" stroke="white" stroke-width="3" stroke-linecap="round"/>
            <circle cx="6" cy="6" r="1" fill="white"/>
            <circle cx="18" cy="18" r="1" fill="white"/>
          </svg>
        `;
        break;
      case 'diving_center':
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="16" height="12" fill="#2563eb" stroke="white" stroke-width="1"/>
            <rect x="6" y="4" width="4" height="4" fill="#2563eb" stroke="white" stroke-width="1"/>
            <rect x="14" y="4" width="4" height="4" fill="#2563eb" stroke="white" stroke-width="1"/>
            <rect x="8" y="12" width="2" height="4" fill="white"/>
            <rect x="14" y="12" width="2" height="4" fill="white"/>
          </svg>
        `;
        break;
      case 'dive':
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#059669" stroke="white" stroke-width="2"/>
            <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="white"/>
          </svg>
        `;
        break;
      default:
        svg = `
          <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#6b7280" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
          </svg>
        `;
    }

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return new Icon({
      src: dataUrl,
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    });
  };

  // Create cluster style
  const createClusterStyle = useCallback(feature => {
    const features = feature.get('features');
    const size = features.length;

    if (size === 1) {
      const singleFeature = features[0];
      const entityType = singleFeature.get('entityType');
      return new Style({
        image: createEntityIcon(entityType, false),
      });
    }

    // Cluster style
    const radius = Math.min(20 + size * 2, 40);
    const color = size > 10 ? '#dc2626' : size > 5 ? '#f59e0b' : '#10b981';

    return new Style({
      image: new Circle({
        radius: radius,
        fill: new Fill({ color: color }),
        stroke: new Stroke({ color: 'white', width: 2 }),
      }),
      text: new Text({
        text: size.toString(),
        fill: new Fill({ color: 'white' }),
        font: 'bold 14px Arial',
        offsetY: 0,
      }),
    });
  }, []);

  // Create dive style for individual dive points - currently unused but kept for future use
  // const createDiveStyle = useCallback(feature => {
  //   const entityType = feature.get('entityType');

  //   // Use simple circle style for dives to ensure visibility
  //   return new Style({
  //     image: new Circle({
  //       radius: 12,
  //       fill: new Fill({ color: '#f59e0b' }),
  //       stroke: new Stroke({ color: 'white', width: 3 }),
  //     }),
  //   });
  // }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([viewport.longitude, viewport.latitude]),
          zoom: viewport.zoom,
        }),
        controls: [], // Remove default controls for custom UI
      });

      mapInstance.current = map;
      setIsMapReady(true);

      // Set up zoom level tracking
      setCurrentZoom(map.getView().getZoom());

      // Listen for zoom changes
      map.getView().on('change:resolution', () => {
        const newZoom = map.getView().getZoom();
        setCurrentZoom(newZoom);
        const newClusteringState = newZoom <= CLUSTERING_ZOOM_THRESHOLD;
        setUseClustering(newClusteringState);
      });

      // Listen for viewport changes
      map.getView().on('change:center', () => {
        if (onViewportChange) {
          const center = map.getView().getCenter();
          const zoom = map.getView().getZoom();
          const extent = map.getView().calculateExtent();
          const bounds = {
            north: extent[3],
            south: extent[1],
            east: extent[2],
            west: extent[0],
          };

          onViewportChange({
            longitude: toLonLat(center)[0],
            latitude: toLonLat(center)[1],
            zoom: zoom,
            bounds: bounds,
          });
        }
      });

      map.getView().on('change:resolution', () => {
        if (onViewportChange) {
          const center = map.getView().getCenter();
          const zoom = map.getView().getZoom();
          const extent = map.getView().calculateExtent();
          const bounds = {
            north: extent[3],
            south: extent[1],
            east: extent[2],
            west: extent[0],
          };

          onViewportChange({
            longitude: toLonLat(center)[0],
            latitude: toLonLat(center)[1],
            zoom: zoom,
            bounds: bounds,
          });
        }
      });

      // Handle feature clicks
      map.on('click', event => {
        const feature = map.forEachFeatureAtPixel(event.pixel, f => f);

        if (feature) {
          const features = feature.get('features');
          if (features && features.length > 0) {
            const singleFeature = features[0];
            const entityType = singleFeature.get('entityType');
            const data = singleFeature.get('data');

            setPopupInfo({
              ...data,
              entityType,
              isCluster: features.length > 1,
              count: features.length,
            });
            setPopupPosition({ x: event.pixel[0], y: event.pixel[1] });
          }
        } else {
          setPopupInfo(null);
          setPopupPosition(null);
        }
      });
    } catch {
      // Silently handle map initialization errors
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
      }
    };
  }, [onViewportChange, viewport.latitude, viewport.longitude, viewport.zoom]);

  // Update map when data changes
  useEffect(() => {
    if (!mapInstance.current || !data || !isMapReady) return;

    // Check if data has actually changed to prevent unnecessary re-renders
    const dataKey = JSON.stringify(data);
    if (dataKey === lastDataKeyRef.current) {
      return;
    }
    lastDataKeyRef.current = dataKey;

    // Remove existing vector layers
    const layers = mapInstance.current.getLayers();
    const existingVectorLayers = layers.getArray().filter(layer => layer instanceof VectorLayer);
    existingVectorLayers.forEach(layer => mapInstance.current.removeLayer(layer));

    // Create features from data
    const allFeatures = [];

    // Process dive sites
    if (data.dive_sites && selectedEntityType === 'dive-sites') {
      data.dive_sites.forEach(site => {
        if (site.latitude && site.longitude) {
          const feature = new Feature({
            geometry: new Point(fromLonLat([site.longitude, site.latitude])),
            entityType: 'dive_site',
            data: site,
          });
          allFeatures.push(feature);
        }
      });
    }

    // Process diving centers
    if (data.diving_centers && selectedEntityType === 'diving-centers') {
      data.diving_centers.forEach(center => {
        if (center.latitude && center.longitude) {
          const feature = new Feature({
            geometry: new Point(fromLonLat([center.longitude, center.latitude])),
            entityType: 'diving_center',
            data: center,
          });
          allFeatures.push(feature);
        }
      });
    }

    // Process dives
    if (data.dives && selectedEntityType === 'dives') {
      data.dives.forEach(dive => {
        if (dive.dive_site?.latitude && dive.dive_site?.longitude) {
          const lonLat = [dive.dive_site.longitude, dive.dive_site.latitude];
          const projected = fromLonLat(lonLat);

          const feature = new Feature({
            geometry: new Point(projected),
            entityType: 'dive',
            data: dive,
          });
          allFeatures.push(feature);
        }
      });

      // Add a test point at Athens center to verify rendering
      const athensCenter = fromLonLat([23.7275, 37.9838]); // Athens center
      const testFeature = new Feature({
        geometry: new Point(athensCenter),
        entityType: 'test',
        data: { id: 'test' },
      });
      allFeatures.push(testFeature);
    }

    // Apply performance limits
    const limitedFeatures = allFeatures.slice(0, MAX_POINTS_PER_VIEWPORT);

    if (limitedFeatures.length === 0) return;

    // Create source with dynamic clustering
    // For dives, use regular VectorSource since clustering is disabled
    const clusterDistance = useClustering ? (selectedEntityType === 'dives' ? 0 : 50) : 0;

    let source;
    if (clusterDistance === 0) {
      // Use regular VectorSource when clustering is disabled
      source = new VectorSource({
        features: limitedFeatures,
      });
    } else {
      // Use ClusterSource when clustering is enabled
      source = new ClusterSource({
        distance: clusterDistance,
        source: new VectorSource({
          features: limitedFeatures,
        }),
      });
    }

    // Create appropriate style based on source type
    // For dives, use a very simple style to ensure visibility
    const styleFunction =
      clusterDistance === 0
        ? () =>
            new Style({
              image: new Circle({
                radius: 15,
                fill: new Fill({ color: 'red' }),
                stroke: new Stroke({ color: 'white', width: 4 }),
              }),
            })
        : createClusterStyle;

    const vectorLayer = new VectorLayer({
      source: source,
      style: styleFunction,
    });

    mapInstance.current.addLayer(vectorLayer);

    // Fit view to show all features if this is the first load
    if (limitedFeatures.length > 0) {
      // Wait a bit for the source to be ready
      setTimeout(() => {
        const extent = source.getExtent();

        // Check if extent is valid and not empty
        if (
          extent &&
          extent.length === 4 &&
          !isNaN(extent[0]) &&
          !isNaN(extent[1]) &&
          !isNaN(extent[2]) &&
          !isNaN(extent[3]) &&
          extent[0] !== extent[2] &&
          extent[1] !== extent[3] &&
          extent[0] !== Infinity &&
          extent[1] !== Infinity &&
          extent[2] !== -Infinity &&
          extent[3] !== -Infinity
        ) {
          // Ensure extent has area and is not infinite
          mapInstance.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: 15,
          });
        }
      }, 100); // Small delay to ensure source is ready
    }
  }, [data, selectedEntityType, useClustering, createClusterStyle, isMapReady]);

  // Calculate popup position
  const calculatePopupPosition = (clickX, clickY) => {
    const mapWidth = mapRef.current?.offsetWidth || 800;
    const mapHeight = mapRef.current?.offsetHeight || 600;
    const popupWidth = 320;
    const popupHeight = 200;
    const margin = 16;

    let left = clickX + margin;
    let top = clickY + margin;

    if (left + popupWidth > mapWidth - margin) {
      left = clickX - popupWidth - margin;
    }

    if (top + popupHeight > mapHeight - margin) {
      top = clickY - popupHeight - margin;
    }

    if (left < margin) left = margin;
    if (top < margin) top = margin;

    return { top, left };
  };

  return (
    <div className='relative w-full h-full'>
      {/* Map container */}
      <div ref={mapRef} className='w-full h-full' />

      {/* Loading overlay */}
      {isLoading && (
        <div className='absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2'></div>
            <div className='text-sm text-gray-600'>Loading map data...</div>
          </div>
        </div>
      )}

      {/* Performance indicator */}
      {performanceMetrics.dataPoints > 0 && (
        <div className='absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow-lg text-xs'>
          <div className='flex items-center space-x-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                performanceMetrics.dataPoints > 800
                  ? 'bg-red-500'
                  : performanceMetrics.dataPoints > 500
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
            ></div>
            <span>{performanceMetrics.dataPoints} points</span>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className='absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow-lg text-xs'>
        <div>Zoom: {currentZoom.toFixed(1)}</div>
        <div>Clustering: {useClustering ? 'On' : 'Off'}</div>
      </div>

      {/* Popup */}
      {popupInfo && popupPosition && (
        <div
          className='absolute bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm z-20'
          style={{
            top: calculatePopupPosition(popupPosition.x, popupPosition.y).top,
            left: calculatePopupPosition(popupPosition.x, popupPosition.y).left,
          }}
        >
          <div className='flex items-start justify-between mb-2'>
            <h3 className='font-semibold text-gray-900'>
              {popupInfo.isCluster ? `${popupInfo.count} items` : popupInfo.name}
            </h3>
            <button
              onClick={() => setPopupInfo(null)}
              className='text-gray-400 hover:text-gray-600'
            >
              ×
            </button>
          </div>

          {!popupInfo.isCluster && (
            <div className='space-y-1 text-sm text-gray-600'>
              <div>Type: {popupInfo.entityType}</div>
              {popupInfo.rating && <div>Rating: {popupInfo.rating}/5</div>}
              {popupInfo.difficulty_level && (
                <div>Difficulty: {getDifficultyLabel(popupInfo.difficulty_level)}</div>
              )}
              {popupInfo.country && <div>Country: {popupInfo.country}</div>}
              {popupInfo.region && <div>Region: {popupInfo.region}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

UnifiedMapView.propTypes = {
  data: PropTypes.object,
  viewport: PropTypes.object.isRequired,
  onViewportChange: PropTypes.func.isRequired,
  selectedEntityType: PropTypes.string.isRequired,
  isLoading: PropTypes.bool,
  performanceMetrics: PropTypes.object,
};

export default UnifiedMapView;
