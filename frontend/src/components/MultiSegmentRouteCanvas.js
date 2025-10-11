import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { X, Save, RotateCcw, MapPin, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

import { useAuth } from '../contexts/AuthContext';
import { CHART_COLORS, getRouteTypeColor } from '../utils/colorPalette';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Map initialization component
const MapInitializer = ({
  diveSite,
  onSave,
  onClear,
  segments,
  setSegments,
  routeType,
  existingRouteData,
}) => {
  const map = useMap();
  const drawnItemsRef = useRef();
  const drawControlRef = useRef();

  // Route snapping function
  const snapToDiveSite = useCallback(
    latlng => {
      if (!diveSite) return latlng;

      const diveSiteLatLng = L.latLng(diveSite.latitude, diveSite.longitude);
      const distance = latlng.distanceTo(diveSiteLatLng);
      const snapDistance = 50; // meters

      if (distance < snapDistance) {
        return diveSiteLatLng;
      }
      return latlng;
    },
    [diveSite]
  );

  // Use ref to store current routeType to prevent callback recreation
  const routeTypeRef = useRef(routeType);
  routeTypeRef.current = routeType;

  // Create onDrawCreated callback that accesses current routeType via ref
  const onDrawCreated = useCallback(
    e => {
      const { layerType, layer } = e;

      // Apply snapping to coordinates
      if (layerType === 'polyline' && layer.getLatLngs) {
        const latlngs = layer.getLatLngs();
        const snappedLatlngs = latlngs.map(latlng => snapToDiveSite(latlng));
        layer.setLatLngs(snappedLatlngs);
      } else if (layerType === 'polygon' && layer.getLatLngs) {
        const latlngs = layer.getLatLngs()[0]; // Polygon has nested array
        const snappedLatlngs = latlngs.map(latlng => snapToDiveSite(latlng));
        layer.setLatLngs([snappedLatlngs]);
      } else if (layerType === 'marker') {
        const snappedLatlng = snapToDiveSite(layer.getLatLng());
        layer.setLatLng(snappedLatlng);
      }

      // Apply the selected route type color to the drawn layer
      const currentRouteType = routeTypeRef.current; // Get current value from ref
      const routeColor = getRouteTypeColor(currentRouteType);
      if (layerType === 'polyline') {
        if (layer.setStyle) {
          layer.setStyle({
            color: routeColor,
            weight: 4,
            opacity: 0.8,
          });
        } else {
          layer.options.color = routeColor;
          layer.options.weight = 4;
          layer.options.opacity = 0.8;
        }
      } else if (layerType === 'polygon') {
        if (layer.setStyle) {
          layer.setStyle({
            color: routeColor,
            weight: 3,
            opacity: 0.6,
            fillOpacity: 0.2,
          });
        } else {
          layer.options.color = routeColor;
          layer.options.weight = 3;
          layer.options.opacity = 0.6;
          layer.options.fillOpacity = 0.2;
        }
      } else if (layerType === 'marker') {
        if (layer.setStyle) {
          layer.setStyle({
            color: routeColor,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6,
          });
        } else {
          layer.options.color = routeColor;
          layer.options.weight = 2;
          layer.options.opacity = 0.8;
          layer.options.fillOpacity = 0.6;
        }
      }

      // Add to drawn items
      drawnItemsRef.current.addLayer(layer);

      // Add the segment to our segments array
      const geoJson = layer.toGeoJSON();
      const newSegment = {
        id: Date.now(), // Simple ID generation
        type: currentRouteType, // Use current value from ref
        geometry: geoJson.geometry,
        properties: {
          name: `${currentRouteType.charAt(0).toUpperCase() + currentRouteType.slice(1)} Segment`,
          color: routeColor,
        },
      };

      setSegments(prev => [...prev, newSegment]);
    },
    [snapToDiveSite, setSegments] // Remove routeType from dependencies
  );

  // Create onDrawEdited callback
  const onDrawEdited = useCallback(
    e => {
      // Feature was edited - apply snapping to edited coordinates
      const { layers } = e;
      layers.eachLayer(layer => {
        if (layer.getLatLngs) {
          const latlngs = layer.getLatLngs();
          if (Array.isArray(latlngs[0])) {
            // Polygon
            const snappedLatlngs = latlngs[0].map(latlng => snapToDiveSite(latlng));
            layer.setLatLngs([snappedLatlngs]);
          } else {
            // Polyline
            const snappedLatlngs = latlngs.map(latlng => snapToDiveSite(latlng));
            layer.setLatLngs(snappedLatlngs);
          }
        } else if (layer.getLatLng) {
          // Marker
          const snappedLatlng = snapToDiveSite(layer.getLatLng());
          layer.setLatLng(snappedLatlng);
        }
      });

      // Update segments state after edit
      const updatedSegments = [];
      drawnItemsRef.current.eachLayer(layer => {
        const geoJson = layer.toGeoJSON();
        // Find the original segment type and color
        const originalSegment = segments.find(s => s.id === layer._leaflet_id);
        updatedSegments.push({
          id: layer._leaflet_id,
          type: originalSegment ? originalSegment.type : 'line', // Fallback to 'line' if not found
          geometry: geoJson.geometry,
          properties: {
            name: originalSegment ? originalSegment.properties.name : 'Edited Segment',
            color: originalSegment ? originalSegment.properties.color : getRouteTypeColor('line'),
          },
        });
      });
      setSegments(updatedSegments);
    },
    [snapToDiveSite, segments, setSegments]
  );

  // Create onDrawDeleted callback
  const onDrawDeleted = useCallback(
    e => {
      // Feature was deleted
      const { layers } = e;
      const deletedIds = new Set();
      layers.eachLayer(layer => deletedIds.add(layer._leaflet_id));
      setSegments(prev => prev.filter(segment => !deletedIds.has(segment.id)));
    },
    [setSegments]
  );

  // Initialize drawing controls ONCE - only when diveSite changes
  useEffect(() => {
    if (!map) return;

    // Create drawn items layer
    drawnItemsRef.current = new L.FeatureGroup();
    map.addLayer(drawnItemsRef.current);

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Drawing control options with mobile optimization
    // NOTE: Colors are NOT baked into the drawing controls - they're applied dynamically in onDrawCreated
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: {
            color: '#0072B2', // Default color - will be overridden in onDrawCreated
            weight: isMobile ? 6 : 4,
            opacity: 0.8,
          },
          allowIntersection: false,
          showLength: true,
          metric: true,
          touchIcon: new L.DivIcon({
            className: 'leaflet-draw-touch-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        },
        polygon: {
          shapeOptions: {
            color: '#0072B2', // Default color - will be overridden in onDrawCreated
            weight: isMobile ? 5 : 3,
            opacity: 0.6,
            fillOpacity: 0.2,
          },
          allowIntersection: false,
          showArea: true,
          showLength: true,
          metric: true,
          touchIcon: new L.DivIcon({
            className: 'leaflet-draw-touch-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        },
        marker: {
          icon: new L.DivIcon({
            className: 'custom-marker',
            html: `<div style="background-color: #0072B2; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`, // Default color - will be overridden in onDrawCreated
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          touchIcon: new L.DivIcon({
            className: 'leaflet-draw-touch-icon',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        },
        circle: false,
        rectangle: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Drawing event handlers
    const onDrawStart = () => {
      // Drawing started
    };

    // Add event listeners
    map.on(L.Draw.Event.DRAWSTART, onDrawStart);
    map.on(L.Draw.Event.CREATED, onDrawCreated);
    map.on(L.Draw.Event.EDITED, onDrawEdited);
    map.on(L.Draw.Event.DELETED, onDrawDeleted);

    return () => {
      map.off(L.Draw.Event.DRAWSTART, onDrawStart);
      map.off(L.Draw.Event.CREATED, onDrawCreated);
      map.off(L.Draw.Event.EDITED, onDrawEdited);
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
      map.removeControl(drawControl);
      map.removeLayer(drawnItemsRef.current);
    };
  }, [map, diveSite, onDrawCreated, onDrawEdited, onDrawDeleted]); // Only depend on diveSite, not routeType

  // Render segments from the segments state (only when segments actually change)
  useEffect(() => {
    if (!map || !drawnItemsRef.current) return;

    // Clear existing layers
    drawnItemsRef.current.clearLayers();

    // Add all segments from the segments state
    segments.forEach(segment => {
      const layer = L.geoJSON(segment.geometry);
      const color = segment.properties?.color || getRouteTypeColor(segment.type);

      layer.setStyle({
        color: color,
        weight: segment.geometry.type === 'Polygon' ? 3 : 4,
        opacity: segment.geometry.type === 'Polygon' ? 0.6 : 0.8,
        fillOpacity: segment.geometry.type === 'Polygon' ? 0.2 : 1,
      });
      drawnItemsRef.current.addLayer(layer);
    });
  }, [map, segments.length]); // Only re-render when the number of segments changes

  // Center map on dive site
  useEffect(() => {
    if (!map || !diveSite) return;

    const diveSiteLat = parseFloat(diveSite.latitude);
    const diveSiteLng = parseFloat(diveSite.longitude);

    if (isNaN(diveSiteLat) || isNaN(diveSiteLng)) {
      console.warn('Invalid dive site coordinates:', diveSite.latitude, diveSite.longitude);
      return;
    }

    map.setView([diveSiteLat, diveSiteLng], 16);
  }, [map, diveSite]);

  // This component doesn't render anything - it just initializes the map
  return null;
};

// Map component with drawing controls
const DrawingMap = ({
  diveSite,
  onSave,
  onClear,
  segments,
  setSegments,
  routeType,
  existingRouteData,
}) => {
  const mapRef = useRef();

  return (
    <div className='w-full h-full relative' style={{ height: '100%' }}>
      <MapContainer
        ref={mapRef}
        center={[diveSite?.latitude || 25.344639, diveSite?.longitude || 34.778111]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />

        {/* Dive site marker */}
        {diveSite && (
          <Marker position={[parseFloat(diveSite.latitude), parseFloat(diveSite.longitude)]}>
            <Popup>
              <div className='text-center'>
                <h3 className='font-semibold text-lg'>{diveSite.name}</h3>
                <p className='text-gray-600'>Dive Site</p>
              </div>
            </Popup>
          </Marker>
        )}

        <MapInitializer
          diveSite={diveSite}
          onSave={onSave}
          onClear={onClear}
          segments={segments}
          setSegments={setSegments}
          routeType={routeType}
          existingRouteData={existingRouteData}
        />
      </MapContainer>
    </div>
  );
};

// Main MultiSegmentRouteCanvas component
const MultiSegmentRouteCanvas = ({
  diveSite,
  onSave,
  onCancel,
  isVisible = false,
  routeName = '',
  setRouteName,
  routeDescription = '',
  setRouteDescription,
  routeType = 'walk',
  showForm = true,
  onSegmentsChange,
  existingRouteData = null,
}) => {
  const { user } = useAuth();

  // Use passed setters if provided, otherwise use local state
  const [localRouteName, setLocalRouteName] = useState(routeName);
  const [localRouteDescription, setLocalRouteDescription] = useState(routeDescription);

  // Use external setters if provided, otherwise use local setters
  const currentRouteName = setRouteName ? routeName : localRouteName;
  const currentRouteDescription = setRouteDescription ? routeDescription : localRouteDescription;

  const handleRouteNameChange = setRouteName || setLocalRouteName;
  const handleRouteDescriptionChange = setRouteDescription || setLocalRouteDescription;

  const [segments, setSegments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveRef = useRef();

  // Restore segments from existing route data when editing (only once)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (
      existingRouteData &&
      existingRouteData.type === 'FeatureCollection' &&
      existingRouteData.features &&
      !hasRestoredRef.current
    ) {
      console.log('Restoring segments from existing route data:', existingRouteData);

      const restoredSegments = existingRouteData.features.map((feature, index) => ({
        id: Date.now() + index, // Simple ID generation
        type: feature.properties?.segmentType || 'walk',
        geometry: feature.geometry,
        properties: {
          name: feature.properties?.name || `${feature.properties?.segmentType || 'walk'} Segment`,
          color:
            feature.properties?.color ||
            getRouteTypeColor(feature.properties?.segmentType || 'walk'),
        },
      }));

      console.log('Restored segments:', restoredSegments);
      setSegments(restoredSegments);
      hasRestoredRef.current = true;
    }
  }, [existingRouteData]);

  // Update parent component when segments change
  useEffect(() => {
    if (onSegmentsChange && segments.length > 0) {
      // Create a FeatureCollection with all segments
      const routeData = {
        type: 'FeatureCollection',
        features: segments.map(segment => ({
          type: 'Feature',
          geometry: segment.geometry,
          properties: {
            segmentType: segment.type,
            name: segment.properties.name,
            color: segment.properties.color,
          },
        })),
      };
      onSegmentsChange(routeData);
    } else if (onSegmentsChange && segments.length === 0) {
      onSegmentsChange(null);
    }
  }, [segments, onSegmentsChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (segments.length === 0) {
      setError('Please add at least one route segment');
      return;
    }

    if (!currentRouteName.trim()) {
      setError('Please enter a route name');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Create a FeatureCollection with all segments
      const routeData = {
        type: 'FeatureCollection',
        features: segments.map(segment => ({
          type: 'Feature',
          geometry: segment.geometry,
          properties: {
            segmentType: segment.type,
            name: segment.properties.name,
            color: segment.properties.color,
          },
        })),
      };

      await onSave(routeData);
    } catch (err) {
      console.error('Error saving route:', err);
      setError(err.message || 'Failed to save route. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentRouteName, currentRouteDescription, segments, onSave]);

  // Handle clear
  const handleClear = useCallback(() => {
    setSegments([]);
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setRouteName('');
    setRouteDescription('');
    setSegments([]);
    setError(null);
    setIsSaving(false);
    onCancel();
  }, [onCancel]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Remove segment
  const removeSegment = useCallback(segmentId => {
    setSegments(prev => prev.filter(segment => segment.id !== segmentId));
  }, []);

  // Authentication check - don't render if user is not logged in
  if (!user) {
    return null;
  }

  if (!isVisible) return null;

  return (
    <div className='w-full h-full relative' style={{ height: 'calc(100vh - 180px)' }}>
      {/* Map */}
      <div style={{ height: '100%' }}>
        <DrawingMap
          diveSite={diveSite}
          onSave={saveRef}
          onClear={handleClear}
          segments={segments}
          setSegments={setSegments}
          routeType={routeType}
          existingRouteData={existingRouteData}
        />
      </div>

      {/* Form Overlay */}
      {showForm && (
        <div className='absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10'>
          <div className='mb-4'>
            <h3 className='text-lg font-semibold text-gray-800 mb-2'>Multi-Segment Route</h3>

            {/* Route Name */}
            <div className='mb-3'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Route Name *</label>
              <input
                type='text'
                value={currentRouteName}
                onChange={e => handleRouteNameChange(e.target.value)}
                placeholder='Enter route name'
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>

            {/* Route Description */}
            <div className='mb-3'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
              <textarea
                value={currentRouteDescription}
                onChange={e => handleRouteDescriptionChange(e.target.value)}
                placeholder='Enter route description'
                rows={2}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>

            {/* Segments List */}
            <div className='mb-4'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Route Segments ({segments.length})
              </label>
              <div className='space-y-2 max-h-32 overflow-y-auto'>
                {segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className='flex items-center justify-between p-2 bg-gray-50 rounded-md'
                  >
                    <div className='flex items-center space-x-2'>
                      <div
                        className='w-3 h-3 rounded-full'
                        style={{ backgroundColor: segment.properties.color }}
                      />
                      <span className='text-sm font-medium'>
                        {index + 1}. {segment.properties.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeSegment(segment.id)}
                      className='text-red-500 hover:text-red-700 p-1'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className='mb-3 p-3 bg-red-50 border border-red-200 rounded-md'>
                <div className='flex items-center'>
                  <AlertCircle className='w-4 h-4 text-red-500 mr-2' />
                  <span className='text-sm text-red-700'>{error}</span>
                  <button onClick={clearError} className='ml-auto text-red-500 hover:text-red-700'>
                    <X className='w-4 h-4' />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className='space-y-2'>
              <button
                onClick={handleClear}
                disabled={segments.length === 0 || isSaving}
                className='w-full flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm touch-manipulation min-h-[36px]'
              >
                <RotateCcw className='w-4 h-4 mr-2' />
                Clear All
              </button>

              <div className='flex space-x-2'>
                <button
                  onClick={onCancel}
                  className='flex-1 px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm touch-manipulation min-h-[36px]'
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={segments.length === 0 || isSaving}
                  className='flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm touch-manipulation min-h-[36px]'
                >
                  {isSaving ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <>
                      <Save className='w-4 h-4 mr-1' />
                      Save Route
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className='absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10'>
        <div className='mb-3'>
          <h3 className='text-lg font-semibold text-gray-800 mb-2'>Drawing Tools</h3>
          <div className='text-xs text-gray-600 space-y-1'>
            <p className='font-medium'>How to create multi-segment routes:</p>
            <ul className='space-y-1'>
              <li>• Select segment type (walk, swim, scuba)</li>
              <li>• Use drawing tools to create segment</li>
              <li>• Change segment type and add more segments</li>
              <li>• Save when all segments are complete</li>
            </ul>
          </div>

          {/* Color Legend */}
          <div className='mt-3 pt-3 border-t border-gray-200'>
            <p className='text-xs font-medium text-gray-700 mb-2'>Route Colors:</p>
            <div className='space-y-1'>
              <div className='flex items-center space-x-2'>
                <div
                  className='w-3 h-3 rounded-full border border-gray-300'
                  style={{ backgroundColor: getRouteTypeColor('walk') }}
                ></div>
                <span className='text-xs text-gray-600'>Walk Route</span>
              </div>
              <div className='flex items-center space-x-2'>
                <div
                  className='w-3 h-3 rounded-full border border-gray-300'
                  style={{ backgroundColor: getRouteTypeColor('swim') }}
                ></div>
                <span className='text-xs text-gray-600'>Swim Route</span>
              </div>
              <div className='flex items-center space-x-2'>
                <div
                  className='w-3 h-3 rounded-full border border-gray-300'
                  style={{ backgroundColor: getRouteTypeColor('scuba') }}
                ></div>
                <span className='text-xs text-gray-600'>Scuba Route</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

MultiSegmentRouteCanvas.propTypes = {
  diveSite: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isVisible: PropTypes.bool,
  routeName: PropTypes.string,
  setRouteName: PropTypes.func,
  routeDescription: PropTypes.string,
  setRouteDescription: PropTypes.func,
  routeType: PropTypes.string,
  showForm: PropTypes.bool,
  onSegmentsChange: PropTypes.func,
  existingRouteData: PropTypes.object,
};

export default MultiSegmentRouteCanvas;
