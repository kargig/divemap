import L from 'leaflet';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Copy,
  Download,
  MapPin,
  Calendar,
  User,
  Route,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';

import api from '../api';
import MapLayersPanel from '../components/MapLayersPanel';
import ShareButton from '../components/ShareButton';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { CHART_COLORS, getRouteTypeColor } from '../utils/colorPalette';
import { formatDate } from '../utils/dateHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { getRouteTypeLabel, calculateRouteBearings, formatBearing } from '../utils/routeUtils';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom zoom control component for route detail page
const ZoomControl = ({ currentZoom }) => {
  return (
    <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
      Zoom: {currentZoom.toFixed(1)}
    </div>
  );
};

// Custom zoom tracking component for route detail page
const ZoomTracker = ({ onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);

    // Set initial zoom
    onZoomChange(map.getZoom());

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoomChange]);

  return null;
};

// Route layer component that uses useMap hook
const RouteLayer = ({ route, diveSite, showBearings = true }) => {
  const map = useMap();
  const routeLayerRef = useRef();
  const bearingMarkersRef = useRef([]);
  const bearingsDataRef = useRef([]);

  // Function to update bearing markers visibility based on zoom and toggle state
  const updateBearingMarkersVisibility = useCallback(() => {
    const currentZoom = map.getZoom();
    const shouldShow = showBearings && currentZoom >= 16 && currentZoom <= 18;

    bearingMarkersRef.current.forEach(marker => {
      if (shouldShow) {
        if (!map.hasLayer(marker)) {
          map.addLayer(marker);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }, [map, showBearings]);

  // Track if we've set the initial view to prevent resetting zoom on updates
  const hasSetInitialViewRef = useRef(false);
  const lastRouteIdRef = useRef(null);

  useEffect(() => {
    // Reset initial view flag when route changes
    if (route?.id !== lastRouteIdRef.current) {
      hasSetInitialViewRef.current = false;
      lastRouteIdRef.current = route?.id;
    }

    if (!route?.route_data) return;

    // Clear existing route layer and bearing markers
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }
    bearingMarkersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    bearingMarkersRef.current = [];
    bearingsDataRef.current = [];

    // Create new route layer
    const routeLayer = L.geoJSON(route.route_data, {
      style: feature => {
        const geometry = feature.geometry;

        // For multi-segment routes, use individual segment colors
        // For single-segment routes, use the route type color
        let routeColor;
        if (feature.properties?.color) {
          // Multi-segment route with individual segment colors
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          // Multi-segment route with segment type
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          // Single-segment route
          routeColor = getRouteTypeColor(route.route_type);
        }

        if (geometry.type === 'LineString') {
          return {
            color: routeColor,
            weight: 4,
            opacity: 0.8,
          };
        } else if (geometry.type === 'Polygon') {
          return {
            color: routeColor,
            weight: 3,
            opacity: 0.6,
            fillOpacity: 0.2,
          };
        } else if (geometry.type === 'Point') {
          return {
            color: routeColor,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6,
          };
        }

        return {
          color: routeColor,
          weight: 3,
          opacity: 0.8,
        };
      },
      pointToLayer: (feature, latlng) => {
        // For multi-segment routes, use individual segment colors
        // For single-segment routes, use the route type color
        let routeColor;
        if (feature.properties?.color) {
          // Multi-segment route with individual segment colors
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          // Multi-segment route with segment type
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          // Single-segment route
          routeColor = getRouteTypeColor(route.route_type);
        }

        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: routeColor,
          color: routeColor,
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6,
        });
      },
    });

    // Add route layer to map
    map.addLayer(routeLayer);
    routeLayerRef.current = routeLayer;

    // Calculate bearings and create markers (but don't add to map yet)
    const bearings = calculateRouteBearings(route.route_data);
    bearingsDataRef.current = bearings;

    bearings.forEach(({ position, bearing }) => {
      const bearingLabel = formatBearing(bearing, true);

      // Create a custom icon with bearing text
      const bearingIcon = L.divIcon({
        className: 'bearing-label',
        html: `
          <div style="
            background-color: rgba(255, 255, 255, 0.9);
            border: 2px solid #2563eb;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            color: #1e40af;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
          ">
            ${bearingLabel}
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10],
      });

      const bearingMarker = L.marker(position, {
        icon: bearingIcon,
        interactive: false,
        zIndexOffset: 500,
      });

      // Store marker but don't add to map yet
      bearingMarkersRef.current.push(bearingMarker);
    });

    // Update visibility based on initial zoom
    updateBearingMarkersVisibility();

    // Center map on dive site only on initial load, not on subsequent updates
    // This ensures the dive site marker is always visible and centered
    if (diveSite?.latitude && diveSite?.longitude && !hasSetInitialViewRef.current) {
      const diveSiteLat = parseFloat(diveSite.latitude);
      const diveSiteLng = parseFloat(diveSite.longitude);
      map.setView([diveSiteLat, diveSiteLng], 15);
      hasSetInitialViewRef.current = true;
    }

    return () => {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }
      bearingMarkersRef.current.forEach(marker => {
        map.removeLayer(marker);
      });
      bearingMarkersRef.current = [];
      bearingsDataRef.current = [];
    };
  }, [map, route, diveSite]);

  // Set up zoom event listener separately to ensure it always uses the latest callback
  useEffect(() => {
    if (!map) return;

    map.on('zoomend', updateBearingMarkersVisibility);

    return () => {
      map.off('zoomend', updateBearingMarkersVisibility);
    };
  }, [map, updateBearingMarkersVisibility]);

  // Update bearing markers visibility when showBearings changes or zoom changes
  useEffect(() => {
    updateBearingMarkersVisibility();
  }, [updateBearingMarkersVisibility]);

  return null; // This component doesn't render anything
};

// Route display component
const RouteDisplay = ({ route, diveSite, showBearings, onToggleBearings }) => {
  const [currentZoom, setCurrentZoom] = useState(15);
  const [showLayers, setShowLayers] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState({
    id: 'satellite',
    name: 'Satellite',
    description: 'Satellite imagery view',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  });

  return (
    <div className='w-full h-96 rounded-lg overflow-hidden border border-gray-200 relative'>
      <MapContainer
        center={[diveSite?.latitude || 0, diveSite?.longitude || 0]}
        zoom={15}
        className='w-full h-full'
        style={{ height: '100%' }}
      >
        <TileLayer attribution={selectedLayer?.attribution || ''} url={selectedLayer?.url} />

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

        {/* Route layer component */}
        <RouteLayer route={route} diveSite={diveSite} showBearings={showBearings} />
        <ZoomTracker onZoomChange={setCurrentZoom} />
      </MapContainer>
      <ZoomControl currentZoom={currentZoom} />
      {/* Map Control Buttons */}
      <div className='absolute top-2 right-2 z-[1000] flex gap-2 pointer-events-none'>
        {/* Map Layers Toggle Button */}
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
          title='Map layers'
        >
          <Layers className='w-3.5 h-3.5' />
          <span>Layers</span>
        </button>
        {/* Bearing Toggle Button */}
        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBearings();
          }}
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className='bg-white rounded px-3 py-1.5 text-xs font-medium shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1.5 pointer-events-auto'
          title={showBearings ? 'Hide bearing icons' : 'Show bearing icons'}
        >
          {showBearings ? (
            <>
              <Eye className='w-3.5 h-3.5' />
              <span>Bearings</span>
            </>
          ) : (
            <>
              <EyeOff className='w-3.5 h-3.5' />
              <span>Bearings</span>
            </>
          )}
        </button>
      </div>
      {/* Map Layers Panel */}
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

const RouteDetail = () => {
  const { diveSiteId, routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormats, setExportFormats] = useState([]);
  const [showBearings, setShowBearings] = useState(true);

  // Intelligent back navigation
  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate(`/dive-sites/${diveSiteId}`);
    }
  };

  usePageTitle('Route Details');

  // Fetch route details
  const {
    data: route,
    isLoading,
    error,
  } = useQuery(['route', routeId], () => api.get(`/api/v1/dive-routes/${routeId}`), {
    select: response => response.data,
    enabled: !!routeId,
  });

  // Fetch dive site details
  const { data: diveSite } = useQuery(
    ['dive-site', diveSiteId],
    () => api.get(`/api/v1/dive-sites/${diveSiteId}`),
    {
      select: response => response.data,
      enabled: !!diveSiteId,
    }
  );

  // Fetch route analytics
  const { data: analytics } = useQuery(
    ['route-analytics', routeId],
    () => api.get(`/api/v1/dive-routes/${routeId}/community-stats`),
    {
      select: response => response.data,
      enabled: !!routeId,
    }
  );

  // Fetch export formats
  useEffect(() => {
    api
      .get('/api/v1/dive-routes/export-formats')
      .then(response => setExportFormats(response.data))
      .catch(() => setExportFormats([]));
  }, []);

  // Delete route mutation
  const deleteRouteMutation = useMutation(
    async () => {
      // First check if route can be deleted
      const deletionCheck = await api.get(`/api/v1/dive-routes/${routeId}/deletion-check`);

      if (!deletionCheck.data.can_delete) {
        throw new Error(deletionCheck.data.reason);
      }

      // Perform soft delete (hide route)
      return api.post(`/api/v1/dive-routes/${routeId}/hide`);
    },
    {
      onSuccess: () => {
        toast.success('Route hidden successfully');
        queryClient.invalidateQueries(['dive-site-routes', diveSiteId]);
        queryClient.invalidateQueries(['dive-routes']);
        navigate(`/dive-sites/${diveSiteId}`);
      },
      onError: error => {
        console.error('Error deleting route:', error);
        toast.error(error.response?.data?.detail || error.message || 'Failed to delete route');
        setShowDeleteConfirm(false);
      },
    }
  );

  // Copy route mutation using new backend endpoint
  const copyRouteMutation = useMutation(
    async newName => {
      return api.post(
        `/api/v1/dive-routes/${routeId}/copy?new_name=${encodeURIComponent(newName)}`
      );
    },
    {
      onSuccess: data => {
        toast.success(`Route copied successfully! New route ID: ${data.new_route_id}`);
        queryClient.invalidateQueries(['dive-site-routes', diveSiteId]);
        queryClient.invalidateQueries(['dive-routes']);
      },
      onError: error => {
        console.error('Error copying route:', error);
        toast.error(error.response?.data?.detail || 'Failed to copy route');
      },
    }
  );

  const handleEditRoute = () => {
    navigate(`/dive-sites/${diveSiteId}/route/${routeId}/edit`);
  };

  const handleCopyRoute = () => {
    const newName = window.prompt('Enter name for copied route:', `${route.name} (Copy)`);
    if (newName) {
      copyRouteMutation.mutate(newName);
    }
  };

  // Share functionality is now handled by ShareButton component
  // Keeping this function for backward compatibility if needed elsewhere
  const handleShareRoute = async () => {
    // This is now handled by ShareButton component
  };

  const handleExportRoute = async format => {
    try {
      const response = await api.get(`/api/v1/dive-routes/${routeId}/export/${format}`, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new window.Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${route.name.replace(' ', '_')}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${format.toUpperCase()} file downloaded successfully!`);
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to export route');
    }
  };

  // Track route view
  useEffect(() => {
    if (route) {
      api.post(`/api/v1/dive-routes/${routeId}/view`).catch(() => {
        // Silently fail if tracking fails
      });
    }
  }, [route, routeId]);

  const handleDeleteRoute = () => {
    deleteRouteMutation.mutate();
  };

  const getRouteTypeIcon = routeType => {
    switch (routeType) {
      case 'walk':
        return <MapPin className='w-5 h-5' />;
      case 'swim':
        return <MapPin className='w-5 h-5' />;
      case 'scuba':
        return <MapPin className='w-5 h-5' />;
      case 'line':
        return <Route className='w-5 h-5' />;
      default:
        return <Route className='w-5 h-5' />;
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 className='w-8 h-8 animate-spin text-blue-600 mx-auto mb-4' />
          <p className='text-gray-600'>Loading route...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='w-8 h-8 text-red-600 mx-auto mb-4' />
          <p className='text-red-600 mb-4'>Failed to load route</p>
          <button
            onClick={() => navigate(`/dive-sites/${diveSiteId}`)}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Back to Dive Site
          </button>
        </div>
      </div>
    );
  }

  // Only show "Route not found" if we're not loading and there's no error but no route data
  if (!isLoading && !error && !route) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-600 mb-4'>Route not found</p>
          <button
            onClick={() => navigate(`/dive-sites/${diveSiteId}`)}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Back to Dive Site
          </button>
        </div>
      </div>
    );
  }

  const canEdit = user && (route.created_by === user.id || user.is_admin);

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-6'>
        {/* Header */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4'>
            <div className='flex items-center gap-3'>
              <button
                onClick={handleBack}
                className='text-gray-600 hover:text-gray-800 p-1'
                title={location.state?.from ? 'Back' : 'Back to Dive Site'}
              >
                <ArrowLeft size={20} />
              </button>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2 mb-2'>
                  {getRouteTypeIcon(route.route_type)}
                  <h1 className='text-xl sm:text-2xl font-bold text-gray-900 truncate'>
                    {route.name}
                  </h1>
                  <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                    {getRouteTypeLabel(route.route_type, null, route.route_data)}
                  </span>
                </div>
                <p className='text-sm text-gray-600 flex items-center gap-1'>
                  Route for
                  <Link
                    to={`/dive-sites/${diveSiteId}`}
                    className='text-blue-600 hover:underline font-medium'
                  >
                    {diveSite?.name || 'Unknown Dive Site'}
                  </Link>
                </p>
              </div>
            </div>

            <div className='flex gap-2 flex-wrap'>
              {/* Share button - available for all users (authenticated and unauthenticated) */}
              {route && (
                <ShareButton
                  entityType='route'
                  entityData={{
                    ...route,
                    dive_site_id: diveSiteId,
                    dive_site: diveSite,
                  }}
                  className='flex items-center'
                />
              )}

              {/* Actions that require authentication */}
              {user && (
                <>
                  <button
                    onClick={handleCopyRoute}
                    disabled={copyRouteMutation.isLoading}
                    className='flex items-center px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50'
                  >
                    <Copy className='w-4 h-4 mr-1' />
                    Copy
                  </button>

                  <button
                    onClick={() => setShowExportModal(true)}
                    className='flex items-center px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
                  >
                    <Download className='w-4 h-4 mr-1' />
                    Export
                  </button>

                  {canEdit && (
                    <>
                      <button
                        onClick={handleEditRoute}
                        className='flex items-center px-3 py-2 text-white bg-yellow-600 hover:bg-yellow-700 rounded-md transition-colors'
                      >
                        <Edit className='w-4 h-4 mr-1' />
                        Edit
                      </button>

                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className='flex items-center px-3 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors'
                      >
                        <Trash2 className='w-4 h-4 mr-1' />
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Route Info */}
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200'>
            <div className='flex items-center text-sm text-gray-600'>
              <User className='w-4 h-4 mr-2' />
              <span>Created by {route.creator?.username || 'Unknown'}</span>
            </div>
            <div className='flex items-center text-sm text-gray-600'>
              <Calendar className='w-4 h-4 mr-2' />
              <span>{formatDate(route.created_at)}</span>
            </div>
            <div className='flex items-center text-sm text-gray-600'>
              <MapPin className='w-4 h-4 mr-2' />
              <span>
                {diveSite?.region}, {diveSite?.country}
              </span>
            </div>
          </div>
        </div>

        {/* Route Description */}
        {route.description && (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>Description</h2>
            <p className='text-gray-700'>{decodeHtmlEntities(route.description)}</p>
          </div>
        )}

        {/* Route Analytics */}
        {analytics && (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>Community Statistics</h2>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm'>
              <div className='text-center p-3 bg-gray-50 rounded-lg'>
                <div className='text-2xl font-bold text-blue-600'>
                  {analytics.community_stats?.total_dives_using_route || 0}
                </div>
                <div className='text-gray-600'>Total Dives</div>
              </div>
              <div className='text-center p-3 bg-gray-50 rounded-lg'>
                <div className='text-2xl font-bold text-green-600'>
                  {analytics.community_stats?.unique_users_used_route || 0}
                </div>
                <div className='text-gray-600'>Unique Users</div>
              </div>
              <div className='text-center p-3 bg-gray-50 rounded-lg'>
                <div className='text-2xl font-bold text-orange-600'>
                  {analytics.community_stats?.recent_dives_7_days || 0}
                </div>
                <div className='text-gray-600'>Recent (7 days)</div>
              </div>
              <div className='text-center p-3 bg-gray-50 rounded-lg'>
                <div className='text-2xl font-bold text-purple-600'>
                  {analytics.community_stats?.waypoint_count || 0}
                </div>
                <div className='text-gray-600'>Waypoints</div>
              </div>
            </div>
          </div>
        )}

        {/* Route Map */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4'>
            <h2 className='text-lg font-semibold text-gray-900'>Route Map</h2>

            {/* Color Legend for Multi-Segment Routes */}
            {route.route_data?.type === 'FeatureCollection' &&
              route.route_data?.features &&
              route.route_data?.features.length > 0 &&
              route.route_data?.features.some(
                feature =>
                  feature.properties &&
                  feature.properties.segmentType &&
                  ['walk', 'swim', 'scuba'].includes(feature.properties.segmentType)
              ) && (
                <div className='flex flex-wrap gap-3 text-sm'>
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-4 h-4 rounded border border-gray-300'
                      style={{ backgroundColor: getRouteTypeColor('walk') }}
                    ></div>
                    <span className='text-gray-700'>Walk</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-4 h-4 rounded border border-gray-300'
                      style={{ backgroundColor: getRouteTypeColor('swim') }}
                    ></div>
                    <span className='text-gray-700'>Swim</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-4 h-4 rounded border border-gray-300'
                      style={{ backgroundColor: getRouteTypeColor('scuba') }}
                    ></div>
                    <span className='text-gray-700'>Scuba</span>
                  </div>
                </div>
              )}
          </div>
          <RouteDisplay
            route={route}
            diveSite={diveSite}
            showBearings={showBearings}
            onToggleBearings={() => setShowBearings(!showBearings)}
          />
        </div>

        {/* Route Data Info */}
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>Route Information</h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='font-medium text-gray-700'>Route Type:</span>
              <span className='ml-2'>
                {getRouteTypeLabel(route.route_type, route.drawing_type, route.route_data)}
              </span>
            </div>
            <div>
              <span className='font-medium text-gray-700'>Created:</span>
              <span className='ml-2'>{formatDate(route.created_at)}</span>
            </div>
            <div>
              <span className='font-medium text-gray-700'>Last Updated:</span>
              <span className='ml-2'>{formatDate(route.updated_at)}</span>
            </div>
            <div>
              <span className='font-medium text-gray-700'>Dive Site:</span>
              <span className='ml-2'>{diveSite?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title='Delete Route'
        className='max-w-md'
      >
        <div className='flex items-start mb-4'>
          <AlertCircle className='w-6 h-6 text-red-600 mr-3 mt-0.5' />
          <p className='text-gray-600'>
            Are you sure you want to hide this route? This action can be undone by restoring the
            route later.
          </p>
        </div>

        <div className='flex justify-end gap-3'>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className='px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteRoute}
            disabled={deleteRouteMutation.isLoading}
            className='px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center'
          >
            {deleteRouteMutation.isLoading ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Deleting...
              </>
            ) : (
              'Hide Route'
            )}
          </button>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title='Export Route'
        className='max-w-md'
      >
        <p className='text-gray-600 mb-4'>Choose a format to download your route:</p>

        <div className='space-y-2'>
          {exportFormats.map(format => (
            <button
              key={format.format}
              onClick={() => handleExportRoute(format.format)}
              className='w-full text-left p-3 border rounded hover:bg-gray-50 transition-colors'
            >
              <div className='font-medium text-gray-900'>{format.name}</div>
              <div className='text-sm text-gray-600'>{format.description}</div>
            </button>
          ))}
        </div>

        <div className='flex justify-end mt-6'>
          <button
            onClick={() => setShowExportModal(false)}
            className='px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

// Helper functions for route type display
const getRouteTypeIcon = routeType => {
  switch (routeType) {
    case 'walk':
      return <Route className='w-5 h-5 text-green-600' />;
    case 'swim':
      return <Route className='w-5 h-5 text-blue-600' />;
    case 'scuba':
      return <Route className='w-5 h-5 text-orange-600' />;
    case 'line':
      return <Route className='w-5 h-5 text-purple-600' />;
    default:
      return <Route className='w-5 h-5 text-gray-600' />;
  }
};

export default RouteDetail;
