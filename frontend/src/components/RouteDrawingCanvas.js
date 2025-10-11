import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { X, Save, RotateCcw, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

import { CHART_COLORS } from '../utils/colorPalette';
import { useAuth } from '../contexts/AuthContext';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Drawing control component
const DrawingControls = ({
  onSave,
  onCancel,
  onClear,
  isDrawing,
  hasDrawnFeatures,
  routeName,
  setRouteName,
  routeDescription,
  setRouteDescription,
  routeType,
  setRouteType,
  isSaving,
  error,
  clearError,
}) => {
  return (
    <div className='absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 sm:p-4 max-h-[90vh] overflow-y-auto'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-lg sm:text-xl font-semibold text-gray-800'>Draw Dive Route</h2>
        <button
          onClick={onCancel}
          className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors touch-manipulation'
        >
          <X size={20} />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
          <div className='flex items-start space-x-2'>
            <AlertCircle className='text-red-600 mt-0.5 flex-shrink-0' size={16} />
            <div className='flex-1'>
              <p className='text-sm text-red-800 font-medium'>Error</p>
              <p className='text-sm text-red-700 mt-1'>{error}</p>
              <button
                onClick={clearError}
                className='text-xs text-red-600 hover:text-red-800 underline mt-1'
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Instructions */}
      <div className='mb-4 p-3 bg-blue-50 rounded-lg'>
        <div className='flex items-start space-x-2'>
          <MapPin className='text-blue-600 mt-0.5 flex-shrink-0' size={16} />
          <div className='text-sm text-blue-800'>
            <p className='font-medium'>How to draw your route:</p>
            <ul className='mt-1 space-y-1 text-xs'>
              <li>
                • <span className='font-medium'>Mobile:</span> Tap tools, then draw with finger
              </li>
              <li>
                • <span className='font-medium'>Desktop:</span> Click tools, then draw with mouse
              </li>
              <li>• Use line tool for continuous routes</li>
              <li>• Use polygon tool for area routes</li>
              <li>• Use marker tool for waypoints</li>
              <li>• Tap/click finish to complete drawing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Route Metadata Form */}
      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Route Name *</label>
          <input
            type='text'
            value={routeName}
            onChange={e => setRouteName(e.target.value)}
            placeholder='e.g., Main Reef Route'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation'
            disabled={isDrawing || isSaving}
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
          <textarea
            value={routeDescription}
            onChange={e => setRouteDescription(e.target.value)}
            placeholder='Describe your route, points of interest, difficulty, etc.'
            rows={3}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base touch-manipulation'
            disabled={isDrawing || isSaving}
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Route Type</label>
          <select
            value={routeType}
            onChange={e => setRouteType(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation'
            disabled={isDrawing || isSaving}
          >
            <option value='line'>Line Route</option>
            <option value='polygon'>Area Route</option>
            <option value='waypoints'>Waypoints</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between mt-6 pt-4 border-t border-gray-200 gap-3'>
        <div className='flex space-x-2'>
          <button
            onClick={onClear}
            disabled={!hasDrawnFeatures || isDrawing || isSaving}
            className='flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation min-h-[44px]'
          >
            <RotateCcw size={16} />
            <span>Clear</span>
          </button>
        </div>

        <div className='flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2'>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className='px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation min-h-[44px]'
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!hasDrawnFeatures || !routeName.trim() || isDrawing || isSaving}
            className='flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation min-h-[44px]'
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className='animate-spin' />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Route</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Map initialization component
const MapInitializer = ({ 
  diveSite,
  onSave, 
  onClear, 
  isDrawing, 
  hasDrawnFeatures,
  routeName,
  setRouteName,
  routeDescription,
  setRouteDescription,
  routeType,
  setRouteType,
  isSaving,
  error,
  clearError
}) => {
  const map = useMap();
  const drawControlRef = useRef();
  const drawnItemsRef = useRef();

  // Initialize drawing controls
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
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: {
            color: CHART_COLORS.depth,
            weight: isMobile ? 6 : 4, // Thicker lines on mobile
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
            color: CHART_COLORS.temperature,
            weight: isMobile ? 5 : 3, // Thicker lines on mobile
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
          icon: new L.Icon.Default(),
          zIndexOffset: 1000,
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
        edit: {
          selectedPathOptions: {
            color: CHART_COLORS.ndl,
            weight: isMobile ? 6 : 4,
            opacity: 0.8,
          },
        },
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Route snapping function
    const snapToDiveSite = latlng => {
      if (!diveSite) return latlng;

      const diveSiteLatLng = L.latLng(diveSite.latitude, diveSite.longitude);
      const distance = latlng.distanceTo(diveSiteLatLng);
      const snapDistance = 50; // meters

      if (distance < snapDistance) {
        return diveSiteLatLng;
      }
      return latlng;
    };

    // Drawing event handlers
    const onDrawStart = () => {
      // Drawing started
    };

    const onDrawCreated = e => {
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

      drawnItemsRef.current.addLayer(layer);

      // Update route type based on what was drawn
      if (layerType === 'polyline' && routeType !== 'line') {
        setRouteType('line');
      } else if (layerType === 'polygon' && routeType !== 'polygon') {
        setRouteType('polygon');
      } else if (layerType === 'marker' && routeType !== 'waypoints') {
        setRouteType('waypoints');
      }
    };

    const onDrawEdited = e => {
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
    };

    const onDrawDeleted = e => {
      // Feature was deleted
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
  }, [routeType, setRouteType]);

  // Get drawn features as GeoJSON
  const getDrawnFeatures = useCallback(() => {
    if (!drawnItemsRef.current) return null;

    const geoJson = drawnItemsRef.current.toGeoJSON();
    
    // Check if geoJson is valid and has features
    if (!geoJson || typeof geoJson !== 'object') return null;
    if (!geoJson.features || !Array.isArray(geoJson.features) || geoJson.features.length === 0) return null;
    
    return geoJson;
  }, []);

  // Clear all drawn features
  const clearDrawnFeatures = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  }, []);

  // Expose methods to parent
  useEffect(() => {
    if (onClear) {
      onClear.current = clearDrawnFeatures;
    }
  }, [onClear, clearDrawnFeatures]);

  // Expose getDrawnFeatures to parent
  useEffect(() => {
    if (onSave) {
      onSave.current = getDrawnFeatures;
    }
  }, [onSave, getDrawnFeatures]);

  // This component doesn't render anything - it just initializes the map
  return null;
};

// Map component with drawing controls
const DrawingMap = ({
  diveSite,
  onSave,
  onCancel,
  onClear,
  isDrawing,
  hasDrawnFeatures,
  routeName,
  setRouteName,
  routeDescription,
  setRouteDescription,
  routeType,
  setRouteType,
  isSaving,
  error,
  clearError,
}) => {
  return (
    <div className='w-full h-full' style={{ height: '100%', minHeight: '400px' }}>
      <MapContainer
        center={[diveSite?.latitude || 0, diveSite?.longitude || 0]}
        zoom={16}
        className='w-full h-full'
        style={{ height: '100%', minHeight: '400px' }}
      >
        <TileLayer
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Dive site marker */}
        {diveSite && (
          <Marker position={[diveSite.latitude, diveSite.longitude]} zIndexOffset={1000}>
            <Popup>
              <div className='text-center'>
                <h3 className='font-semibold text-gray-800'>{diveSite.name}</h3>
                <p className='text-sm text-gray-600 mt-1'>Dive Site</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Map initializer component */}
        <MapInitializer
          diveSite={diveSite}
          onSave={onSave}
          onClear={onClear}
          isDrawing={isDrawing}
          hasDrawnFeatures={hasDrawnFeatures}
          routeName={routeName}
          setRouteName={setRouteName}
          routeDescription={routeDescription}
          setRouteDescription={setRouteDescription}
          routeType={routeType}
          setRouteType={setRouteType}
          isSaving={isSaving}
          error={error}
          clearError={clearError}
        />
      </MapContainer>
    </div>
  );
};

// Main RouteDrawingCanvas component
const RouteDrawingCanvas = ({ 
  diveSite, 
  onSave, 
  onCancel, 
  isVisible = false,
  routeName = '',
  setRouteName,
  routeDescription = '',
  setRouteDescription,
  routeType = 'line',
  setRouteType,
  showForm = true
}) => {
  const { user } = useAuth();
  
  // Authentication check - don't render if user is not logged in
  if (!user) {
    return null;
  }

  // Use passed setters if provided, otherwise use local state
  const [localRouteName, setLocalRouteName] = useState(routeName);
  const [localRouteDescription, setLocalRouteDescription] = useState(routeDescription);
  const [localRouteType, setLocalRouteType] = useState(routeType);
  
  // Use external setters if provided, otherwise use local setters
  const currentRouteName = setRouteName ? routeName : localRouteName;
  const currentRouteDescription = setRouteDescription ? routeDescription : localRouteDescription;
  const currentRouteType = setRouteType ? routeType : localRouteType;
  
  const handleRouteNameChange = setRouteName || setLocalRouteName;
  const handleRouteDescriptionChange = setRouteDescription || setLocalRouteDescription;
  const handleRouteTypeChange = setRouteType || setLocalRouteType;

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnFeatures, setHasDrawnFeatures] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const clearRef = useRef();
  const saveRef = useRef();

  // Handle save
  const handleSave = useCallback(async () => {
    if (!saveRef.current) return;

    const geoJson = saveRef.current();
    if (!geoJson) {
      setError('Please draw a route before saving');
      return;
    }

    if (!currentRouteName.trim()) {
      setError('Please enter a route name');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await onSave(geoJson);
    } catch (err) {
      console.error('Error saving route:', err);
      setError(err.message || 'Failed to save route. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentRouteName, currentRouteDescription, currentRouteType, onSave]);

  // Handle clear
  const handleClear = useCallback(() => {
    if (clearRef.current) {
      clearRef.current();
      setHasDrawnFeatures(false);
    }
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setRouteName('');
    setRouteDescription('');
    setRouteType('line');
    setHasDrawnFeatures(false);
    setError(null);
    setIsSaving(false);
    if (clearRef.current) {
      clearRef.current();
    }
    onCancel();
  }, [onCancel]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update hasDrawnFeatures when features are drawn
  useEffect(() => {
    const checkFeatures = () => {
      if (saveRef.current) {
        const geoJson = saveRef.current();
        // geoJson is null when no features are drawn, so hasDrawnFeatures should be false
        setHasDrawnFeatures(geoJson !== null && geoJson.features && geoJson.features.length > 0);
      }
    };

    const interval = setInterval(checkFeatures, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className='w-full h-full relative'>
      {/* Drawing Map - Full Screen */}
      <DrawingMap
        diveSite={diveSite}
        onSave={saveRef}
        onCancel={handleCancel}
        onClear={clearRef}
        isDrawing={isDrawing}
        hasDrawnFeatures={hasDrawnFeatures}
        routeName={routeName}
        setRouteName={setRouteName}
        routeDescription={routeDescription}
        setRouteDescription={setRouteDescription}
        routeType={routeType}
        setRouteType={setRouteType}
        isSaving={isSaving}
        error={error}
        clearError={clearError}
      />

      {/* Compact Drawing Controls - Top Right */}
      <div className='absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 max-w-xs'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-sm font-semibold text-gray-800'>Drawing Tools</h3>
          <button
            onClick={onCancel}
            className='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className='mb-3 p-2 bg-red-50 border border-red-200 rounded-md'>
            <div className='flex items-center'>
              <AlertCircle className='w-4 h-4 text-red-500 mr-2 flex-shrink-0' />
              <p className='text-sm text-red-700'>{error}</p>
              <button
                onClick={clearError}
                className='ml-auto text-red-500 hover:text-red-700'
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Drawing Instructions */}
        <div className='mb-3 text-xs text-gray-600'>
          <p className='font-medium mb-1'>How to draw:</p>
          <ul className='space-y-1'>
            <li>• Click drawing tools below</li>
            <li>• Draw on the map</li>
            <li>• Click finish when done</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className='space-y-2'>
          <button
            onClick={handleClear}
            disabled={!hasDrawnFeatures || isDrawing || isSaving}
            className='w-full flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm touch-manipulation min-h-[36px]'
          >
            <RotateCcw className='w-4 h-4 mr-2' />
            Clear
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
              disabled={!hasDrawnFeatures || isSaving}
              className='flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm touch-manipulation min-h-[36px]'
            >
              {isSaving ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <>
                  <Save className='w-4 h-4 mr-1' />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

RouteDrawingCanvas.propTypes = {
  diveSite: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isVisible: PropTypes.bool,
  routeName: PropTypes.string,
  setRouteName: PropTypes.func,
  routeDescription: PropTypes.string,
  setRouteDescription: PropTypes.func,
  routeType: PropTypes.string,
  setRouteType: PropTypes.func,
  showForm: PropTypes.bool,
};

export default RouteDrawingCanvas;
