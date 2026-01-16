import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import {
  X,
  Save,
  RotateCcw,
  AlertCircle,
  Loader2,
  Trash2,
  Layers,
  Magnet,
  MapPin,
  Hexagon,
  Warehouse,
  Anchor,
  Fish,
  AlertTriangle,
  Edit,
  HelpCircle,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

import { useAuth } from '../contexts/AuthContext';
import { getRouteTypeColor } from '../utils/colorPalette';
import { MARKER_TYPES } from '../utils/markerTypes';

import MapLayersPanel from './MapLayersPanel';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Zoom Indicator Component
const ZoomIndicator = () => {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  return (
    <div className='absolute top-[12px] left-[46px] z-[1000] bg-white/90 backdrop-blur-sm text-gray-800 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm border border-gray-200 pointer-events-none'>
      Zoom: {zoom.toFixed(1)}
    </div>
  );
};

// Map initialization component
const MapInitializer = ({
  diveSite,
  onSave,
  onClear,
  segments,
  setSegments,
  routeType,
  existingRouteData,
  enableSnapping,
  onEditMarker,
}) => {
  const map = useMap();
  const drawnItemsRef = useRef();
  const drawControlRef = useRef();
  const callbacksRef = useRef(null);
  const layerIdMapRef = useRef({});

  // Route snapping function
  const snapToDiveSite = useCallback(
    latlng => {
      // Only snap if snapping is enabled
      if (!enableSnapping || !diveSite) return latlng;

      const diveSiteLatLng = L.latLng(diveSite.latitude, diveSite.longitude);
      const distance = latlng.distanceTo(diveSiteLatLng);
      const snapDistance = 50; // meters

      if (distance < snapDistance) {
        return diveSiteLatLng;
      }
      return latlng;
    },
    [diveSite, enableSnapping]
  );

  // Use ref to store current routeType to prevent callback recreation
  const routeTypeRef = useRef(routeType);
  routeTypeRef.current = routeType;

  // Create onDrawCreated callback
  const onDrawCreated = useCallback(
    e => {
      const { layerType, layer } = e;

      // Apply snapping to coordinates if enabled
      let finalGeometry = null;
      if (enableSnapping) {
        if (layerType === 'polyline' && layer.getLatLngs) {
          const latlngs = layer.getLatLngs();
          const snappedLatlngs = latlngs.map(latlng => snapToDiveSite(latlng));
          layer.setLatLngs(snappedLatlngs);
          // Store the snapped geometry
          finalGeometry = layer.toGeoJSON().geometry;
        } else if (layerType === 'polygon' && layer.getLatLngs) {
          const latlngs = layer.getLatLngs()[0]; // Polygon has nested array
          const snappedLatlngs = latlngs.map(latlng => snapToDiveSite(latlng));
          layer.setLatLngs([snappedLatlngs]);
          // Store the snapped geometry
          finalGeometry = layer.toGeoJSON().geometry;
        } else if (layerType === 'marker') {
          const snappedLatlng = snapToDiveSite(layer.getLatLng());
          layer.setLatLng(snappedLatlng);
          // Store the snapped geometry
          finalGeometry = layer.toGeoJSON().geometry;
        }
      }

      // Apply the selected route type color to the drawn layer
      const currentRouteType = routeTypeRef.current; // Get current value from ref
      const routeColor = getRouteTypeColor(currentRouteType);

      if (layerType === 'polyline') {
        if (layer.setStyle) {
          layer.setStyle({ color: routeColor, weight: 4, opacity: 0.8 });
        } else {
          layer.options.color = routeColor;
          layer.options.weight = 4;
          layer.options.opacity = 0.8;
        }
      } else if (layerType === 'polygon') {
        if (layer.setStyle) {
          layer.setStyle({ color: routeColor, weight: 3, opacity: 0.6, fillOpacity: 0.2 });
        } else {
          layer.options.color = routeColor;
          layer.options.weight = 3;
          layer.options.opacity = 0.6;
          layer.options.fillOpacity = 0.2;
        }
      } else if (layerType === 'marker') {
        // Marker styling handled by default or custom icon
      }

      // Add to drawn items
      drawnItemsRef.current.addLayer(layer);

      // Create new segment
      const geoJson = finalGeometry ? { geometry: finalGeometry } : layer.toGeoJSON();
      const newSegment = {
        id: Date.now(),
        type: currentRouteType,
        geometry: geoJson.geometry,
        properties: {
          name: `${currentRouteType.charAt(0).toUpperCase() + currentRouteType.slice(1)} Segment`,
          color: routeColor,
          markerType: 'generic',
          comment: '',
        },
      };

      // Store mapping and attach ID
      if (layer._leaflet_id) {
        layerIdMapRef.current[layer._leaflet_id] = newSegment.id;
      }
      layer.segmentId = newSegment.id;
      if (layer.options) {
        layer.options.segmentId = newSegment.id;
      }

      setSegments(prev => [...prev, newSegment]);

      // If it's a marker, immediately trigger edit
      if (layerType === 'marker' && onEditMarker) {
        onEditMarker(newSegment.id);
      }
    },
    [snapToDiveSite, enableSnapping, setSegments, onEditMarker]
  );

  // Create onDrawEdited callback
  const onDrawEdited = useCallback(
    e => {
      // Apply snapping to edited coordinates if enabled
      const { layers } = e;
      if (enableSnapping) {
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
      }

      // Update segments state after edit
      const updatedSegments = [];
      drawnItemsRef.current.eachLayer(layer => {
        const geoJson = layer.toGeoJSON();

        // Find the original segment type and color
        // Use the map ref to find the segment ID, fallback to direct property or options
        const mappedSegmentId = layerIdMapRef.current[layer._leaflet_id];
        const directSegmentId = layer.segmentId || (layer.options && layer.options.segmentId);
        const segmentId = mappedSegmentId || directSegmentId;

        const originalSegment = segments.find(
          s => s.id === segmentId || s.id === layer._leaflet_id
        );

        updatedSegments.push({
          id: segmentId || layer._leaflet_id,
          type: originalSegment ? originalSegment.type : 'line', // Fallback to 'line' if not found
          geometry: geoJson.geometry,
          properties: {
            name: originalSegment ? originalSegment.properties.name : 'Edited Segment',
            color: originalSegment ? originalSegment.properties.color : getRouteTypeColor('line'),
            markerType: originalSegment ? originalSegment.properties.markerType : 'generic',
            comment: originalSegment ? originalSegment.properties.comment : '',
          },
        });
      });
      setSegments(updatedSegments);
    },
    [snapToDiveSite, enableSnapping, segments, setSegments]
  );

  // Create onDrawDeleted callback
  const onDrawDeleted = useCallback(
    e => {
      // Feature was deleted
      const { layers } = e;
      const deletedIds = new Set();
      layers.eachLayer(layer => {
        // Use the segmentId we attached to the layer, or fallback to _leaflet_id for safety
        if (layer.segmentId) {
          deletedIds.add(layer.segmentId);
        } else {
          deletedIds.add(layer._leaflet_id);
        }
      });
      setSegments(prev => prev.filter(segment => !deletedIds.has(segment.id)));
    },
    [setSegments]
  );

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onDrawCreated, onDrawEdited, onDrawDeleted };
  }, [onDrawCreated, onDrawEdited, onDrawDeleted]);

  // Initialize drawing controls ONCE - only when diveSite changes
  useEffect(() => {
    if (!map) return;

    try {
      // Create drawn items layer
      drawnItemsRef.current = new L.FeatureGroup();
      map.addLayer(drawnItemsRef.current);
    } catch (error) {
      console.warn('Error creating feature group:', error);
      return;
    }

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Drawing control options
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: {
          shapeOptions: {
            color: '#0072B2',
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
            color: '#0072B2',
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
            html: `<div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
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

    try {
      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    } catch (error) {
      console.warn('Error adding draw control:', error);
      return;
    }

    // Drawing event handlers
    const onDrawStart = () => {
      // Drawing started
    };

    // Wrapper functions that use the latest callbacks
    const handleDrawCreated = e => {
      if (callbacksRef.current?.onDrawCreated) {
        callbacksRef.current.onDrawCreated(e);
      }
    };
    const handleDrawEdited = e => {
      if (callbacksRef.current?.onDrawEdited) {
        callbacksRef.current.onDrawEdited(e);
      }
    };
    const handleDrawDeleted = e => {
      if (callbacksRef.current?.onDrawDeleted) {
        callbacksRef.current.onDrawDeleted(e);
      }
    };

    // Add event listeners
    map.on(L.Draw.Event.DRAWSTART, onDrawStart);
    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.EDITED, handleDrawEdited);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);

    return () => {
      try {
        map.off(L.Draw.Event.DRAWSTART, onDrawStart);
        map.off(L.Draw.Event.CREATED, handleDrawCreated);
        map.off(L.Draw.Event.EDITED, handleDrawEdited);
        map.off(L.Draw.Event.DELETED, handleDrawDeleted);
        if (drawControlRef.current) {
          map.removeControl(drawControlRef.current);
        }
        if (drawnItemsRef.current) {
          map.removeLayer(drawnItemsRef.current);
        }
      } catch (error) {
        console.warn('Error cleaning up map controls:', error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, diveSite]);

  // Render segments from the segments state (only when segments actually change)
  useEffect(() => {
    if (!map || !drawnItemsRef.current) return;

    try {
      // Clear existing layers
      drawnItemsRef.current.clearLayers();
      // Clear ID map
      layerIdMapRef.current = {};

      // Add all segments from the segments state
      segments.forEach(segment => {
        let layer;
        // Create appropriate layer type based on geometry
        if (segment.geometry.type === 'Point') {
          // Custom Marker Logic
          const markerType = segment.properties.markerType || 'generic';
          const markerConfig = MARKER_TYPES[markerType] || MARKER_TYPES.generic;
          const IconComponent = markerConfig.icon;

          const iconHtml = renderToStaticMarkup(
            <div
              style={{
                backgroundColor: markerConfig.color,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              }}
            >
              <IconComponent size={16} color='white' />
            </div>
          );

          layer = L.marker([segment.geometry.coordinates[1], segment.geometry.coordinates[0]], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: iconHtml,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              popupAnchor: [0, -14],
            }),
          });

          // Bind Popup with comment and edit button
          if (segment.properties.comment) {
            layer.bindPopup(`
              <div class="text-sm">
                <div class="font-semibold mb-1">${markerConfig.name}</div>
                <div class="mb-2">${segment.properties.comment}</div>
                <button class="text-blue-600 hover:underline text-xs" onclick="window.dispatchEvent(new CustomEvent('edit-marker', { detail: ${segment.id} }))">
                  Edit Marker
                </button>
              </div>
            `);
          } else {
            // Even without comment, allow editing
            layer.bindPopup(`
              <div class="text-sm">
                <div class="font-semibold mb-1">${markerConfig.name}</div>
                <button class="text-blue-600 hover:underline text-xs" onclick="window.dispatchEvent(new CustomEvent('edit-marker', { detail: ${segment.id} }))">
                  Edit Marker
                </button>
              </div>
            `);
          }

          // Handle click to edit (if not dragging)

          layer.on('click', () => {
            // We can trigger edit here too, but popup handles it nicely.
          });
        } else {
          const geoJsonLayer = L.geoJSON(segment.geometry);

          // Unwrap the layer if it's a simple geometry to allow leaflet-draw to work correctly

          const layers = geoJsonLayer.getLayers();

          if (layers.length > 0) {
            layer = layers[0];
          } else {
            // Fallback just in case, though shouldn't happen for valid geometry

            layer = geoJsonLayer;
          }
        }

        // Attach segment ID to the layer for reliable deletion
        layer.segmentId = segment.id;
        if (layer.options) {
          layer.options.segmentId = segment.id;
        }

        const color = segment.properties?.color || getRouteTypeColor(segment.type);

        if (layer.setStyle) {
          layer.setStyle({
            color: color,
            weight: segment.geometry.type === 'Polygon' ? 3 : 4,
            opacity: segment.geometry.type === 'Polygon' ? 0.6 : 0.8,
            fillOpacity: segment.geometry.type === 'Polygon' ? 0.2 : 1,
          });
        }
        drawnItemsRef.current.addLayer(layer);

        // Store mapping from Leaflet ID to Segment ID
        if (layer._leaflet_id) {
          layerIdMapRef.current[layer._leaflet_id] = segment.id;
        }
      });
    } catch (error) {
      console.warn('Error rendering segments:', error);
    }
  }, [map, segments, onEditMarker]); // Re-render when segments change (not just length)

  // Center map on dive site
  useEffect(() => {
    if (!map || !diveSite) return;

    const diveSiteLat = parseFloat(diveSite.latitude);
    const diveSiteLng = parseFloat(diveSite.longitude);

    if (isNaN(diveSiteLat) || isNaN(diveSiteLng)) {
      console.warn('Invalid dive site coordinates:', diveSite.latitude, diveSite.longitude);
      return;
    }

    const timer = setTimeout(() => {
      try {
        if (map.getContainer() && map.getContainer().offsetParent !== null) {
          map.setView([diveSiteLat, diveSiteLng], 16);
        }
      } catch (error) {
        console.warn('Error setting map view:', error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [map, diveSite]);

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
  onEditMarker,
  onToggleInstructions,
  showInstructions,
}) => {
  const mapRef = useRef();
  const [showLayers, setShowLayers] = useState(false);
  const [enableSnapping, setEnableSnapping] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState({
    id: 'satellite',
    name: 'Satellite',
    description: 'Satellite imagery view',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  });

  return (
    <div className='w-full h-full relative' style={{ height: '100%' }}>
      <MapContainer
        ref={mapRef}
        center={[diveSite?.latitude || 25.344639, diveSite?.longitude || 34.778111]}
        zoom={16}
        maxZoom={20}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution={selectedLayer?.attribution || ''}
          url={selectedLayer?.url}
          maxZoom={20}
          maxNativeZoom={selectedLayer?.id === 'satellite' ? 19 : 18}
        />

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

        <ZoomIndicator />

        <MapInitializer
          diveSite={diveSite}
          onSave={onSave}
          onClear={onClear}
          segments={segments}
          setSegments={setSegments}
          routeType={routeType}
          existingRouteData={existingRouteData}
          enableSnapping={enableSnapping}
          onEditMarker={onEditMarker}
        />
      </MapContainer>

      {/* Map Control Buttons - Moved back to Top Right */}
      <div className='absolute top-4 right-4 z-[1000] flex gap-2 pointer-events-none'>
        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onToggleInstructions();
          }}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`rounded px-3 py-1.5 text-xs font-medium shadow-sm border transition-colors flex items-center gap-1.5 pointer-events-auto ${
            showInstructions
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          title='Toggle drawing tools help'
        >
          <HelpCircle className='w-3.5 h-3.5' />
          <span>Help</span>
        </button>
        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setEnableSnapping(!enableSnapping);
          }}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`rounded px-3 py-1.5 text-xs font-medium shadow-sm border transition-colors flex items-center gap-1.5 pointer-events-auto ${
            enableSnapping
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          title={enableSnapping ? 'Disable snapping to dive site' : 'Enable snapping to dive site'}
        >
          <Magnet className='w-3.5 h-3.5' />
          <span>Snap</span>
        </button>
        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setShowLayers(!showLayers);
          }}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className='bg-white rounded px-3 py-1.5 text-xs font-medium shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1.5 pointer-events-auto'
          title='Change map style'
        >
          <Layers className='w-3.5 h-3.5' />
          <span>Map Style</span>
        </button>
      </div>
      <MapLayersPanel
        isOpen={showLayers}
        onClose={() => setShowLayers(false)}
        selectedLayer={selectedLayer}
        onLayerChange={layer => {
          setSelectedLayer(layer);
          setShowLayers(false);
        }}
      />
    </div>
  );
};

// Marker Modal Component
const MarkerModal = ({ isOpen, onClose, markerData, onSave }) => {
  const [type, setType] = useState(markerData?.type || 'generic');
  const [comment, setComment] = useState(markerData?.comment || '');

  useEffect(() => {
    if (isOpen && markerData) {
      setType(markerData.type || 'generic');
      setComment(markerData.comment || '');
    }
  }, [isOpen, markerData]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4 animate-in fade-in zoom-in duration-200'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-lg font-semibold text-gray-900'>Marker Details</h3>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>Marker Type</label>
          <div className='grid grid-cols-3 gap-3'>
            {Object.entries(MARKER_TYPES).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                    type === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className='mb-2' style={{ color: config.color }}>
                    <Icon className='w-6 h-6' />
                  </div>
                  <span className='text-xs font-medium'>{config.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>Comment</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
            rows={3}
            placeholder='Add a note about this location...'
          />
        </div>

        <div className='flex justify-end space-x-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ type, comment })}
            className='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Save Marker
          </button>
        </div>
      </div>
    </div>
  );
};

// Main RouteCanvas component
const RouteCanvas = ({
  diveSite,
  onSave,
  onCancel,
  isVisible = false,
  routeName = '',
  setRouteName,
  routeDescription = '',
  setRouteDescription,
  routeType = 'scuba',
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

  // Marker Edit State
  const [activeMarkerId, setActiveMarkerId] = useState(null);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  const saveRef = useRef();
  const hasRestoredRef = useRef(false);

  // Listen for custom edit-marker events (from popups)
  useEffect(() => {
    const handleEditMarkerEvent = e => {
      const segmentId = e.detail;
      handleEditMarker(segmentId);
    };
    window.addEventListener('edit-marker', handleEditMarkerEvent);
    return () => window.removeEventListener('edit-marker', handleEditMarkerEvent);
  }, []); // Empty dependency since handleEditMarker needs to be stable or accessible

  const handleEditMarker = useCallback(segmentId => {
    setActiveMarkerId(segmentId);
    setShowMarkerModal(true);
  }, []);

  const handleMarkerSave = useCallback(
    data => {
      setSegments(prev =>
        prev.map(segment => {
          if (segment.id === activeMarkerId) {
            return {
              ...segment,
              properties: {
                ...segment.properties,
                markerType: data.type,
                comment: data.comment,
              },
            };
          }
          return segment;
        })
      );
      setShowMarkerModal(false);
      setActiveMarkerId(null);
    },
    [activeMarkerId]
  );

  // Restore segments logic
  useEffect(() => {
    if (
      existingRouteData &&
      existingRouteData.type === 'FeatureCollection' &&
      existingRouteData.features &&
      !hasRestoredRef.current
    ) {
      const restoredSegments = existingRouteData.features.map((feature, index) => ({
        id: Date.now() + index,
        type: feature.properties?.segmentType || 'walk',
        geometry: feature.geometry,
        properties: {
          name: feature.properties?.name || `${feature.properties?.segmentType || 'walk'} Segment`,
          color:
            feature.properties?.color ||
            getRouteTypeColor(feature.properties?.segmentType || 'walk'),
          markerType: feature.properties?.markerType || 'generic',
          comment: feature.properties?.comment || '',
        },
      }));
      setSegments(restoredSegments);
      hasRestoredRef.current = true;
    }
  }, [existingRouteData]);

  // Update parent component when segments change
  useEffect(() => {
    if (onSegmentsChange && segments.length > 0) {
      const routeData = {
        type: 'FeatureCollection',
        features: segments.map(segment => ({
          type: 'Feature',
          geometry: segment.geometry,
          properties: {
            segmentType: segment.type,
            name: segment.properties.name,
            color: segment.properties.color,
            markerType: segment.properties.markerType,
            comment: segment.properties.comment,
          },
        })),
      };
      onSegmentsChange(routeData);
    } else if (onSegmentsChange && segments.length === 0) {
      onSegmentsChange(null);
    }
  }, [segments, onSegmentsChange]);

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

      const routeData = {
        type: 'FeatureCollection',
        features: segments.map(segment => ({
          type: 'Feature',
          geometry: segment.geometry,
          properties: {
            segmentType: segment.type,
            name: segment.properties.name,
            color: segment.properties.color,
            markerType: segment.properties.markerType,
            comment: segment.properties.comment,
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

  const handleClear = useCallback(() => {
    setSegments([]);
  }, []);

  const handleCancel = useCallback(() => {
    setRouteName('');
    setRouteDescription('');
    setSegments([]);
    setError(null);
    setIsSaving(false);
    onCancel();
  }, [onCancel]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const removeSegment = useCallback(segmentId => {
    setSegments(prev => prev.filter(segment => segment.id !== segmentId));
  }, []);

  if (!user) return null;
  if (!isVisible) return null;

  // Find active marker data
  const activeMarker = segments.find(s => s.id === activeMarkerId)?.properties;

  return (
    <div className='w-full h-full relative' style={{ height: 'calc(100vh - 180px)' }}>
      <div style={{ height: '100%' }}>
        <DrawingMap
          diveSite={diveSite}
          onSave={saveRef}
          onClear={handleClear}
          segments={segments}
          setSegments={setSegments}
          routeType={routeType}
          existingRouteData={existingRouteData}
          onEditMarker={handleEditMarker}
          showInstructions={showInstructions}
          onToggleInstructions={() => setShowInstructions(!showInstructions)}
        />
      </div>

      {showForm && (
        <div className='absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10'>
          <div className='mb-4'>
            <h3 className='text-lg font-semibold text-gray-800 mb-2'>Multi-Segment Route</h3>
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
                        className='w-3 h-3 rounded-full flex items-center justify-center'
                        style={{ backgroundColor: segment.properties.color }}
                      >
                        {/* Show icon for markers in list? Too small maybe. */}
                      </div>
                      <span className='text-sm font-medium truncate max-w-[150px]'>
                        {index + 1}. {segment.properties.name}
                        {segment.properties.markerType && ` (${segment.properties.markerType})`}
                      </span>
                    </div>
                    <div className='flex space-x-1'>
                      {segment.geometry.type === 'Point' && (
                        <button
                          onClick={() => handleEditMarker(segment.id)}
                          className='text-blue-500 hover:text-blue-700 p-1'
                          title='Edit Marker'
                        >
                          <Edit className='w-4 h-4' />
                        </button>
                      )}
                      <button
                        onClick={() => removeSegment(segment.id)}
                        className='text-red-500 hover:text-red-700 p-1'
                        title='Remove'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
      {showInstructions && (
        <div className='absolute bottom-8 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10'>
          <button
            onClick={() => setShowInstructions(false)}
            className='absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors'
            title='Close'
          >
            <X className='w-4 h-4' />
          </button>
          <div className='mb-3'>
            <h3 className='text-lg font-semibold text-gray-800 mb-2'>Drawing Tools</h3>
            <div className='text-xs text-gray-600 space-y-1'>
              <p className='font-medium'>How to create multi-segment routes:</p>
              <ul className='space-y-1'>
                <li>• Select segment type (walk, swim, scuba)</li>
                <li>• Use drawing tools to create segment</li>
                <li>• Change segment type and add more segments</li>
                <li>• Use markers to add points of interest</li>
                <li>• Save when all segments are complete</li>
              </ul>
            </div>
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
      )}

      {/* Marker Modal */}
      <MarkerModal
        isOpen={showMarkerModal}
        onClose={() => {
          setShowMarkerModal(false);
          setActiveMarkerId(null);
        }}
        markerData={
          activeMarker ? { type: activeMarker.markerType, comment: activeMarker.comment } : null
        }
        onSave={handleMarkerSave}
      />
    </div>
  );
};

RouteCanvas.propTypes = {
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

export default RouteCanvas;
