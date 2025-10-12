import L from 'leaflet';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Copy,
  Share2,
  MapPin,
  Calendar,
  User,
  Route,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { CHART_COLORS, getRouteTypeColor } from '../utils/colorPalette';
import { formatDate } from '../utils/dateHelpers';
import { getRouteTypeLabel } from '../utils/routeUtils';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Route layer component that uses useMap hook
const RouteLayer = ({ route, diveSite }) => {
  const map = useMap();
  const routeLayerRef = useRef();

  useEffect(() => {
    if (!route?.route_data) return;

    // Clear existing route layer
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

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

    // Center map on dive site instead of fitting to route bounds
    // This ensures the dive site marker is always visible and centered
    if (diveSite?.latitude && diveSite?.longitude) {
      const diveSiteLat = parseFloat(diveSite.latitude);
      const diveSiteLng = parseFloat(diveSite.longitude);
      map.setView([diveSiteLat, diveSiteLng], 15);
    }

    return () => {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }
    };
  }, [map, route, diveSite]);

  return null; // This component doesn't render anything
};

// Route display component
const RouteDisplay = ({ route, diveSite }) => {
  return (
    <div className='w-full h-96 rounded-lg overflow-hidden border border-gray-200'>
      <MapContainer
        center={[diveSite?.latitude || 0, diveSite?.longitude || 0]}
        zoom={15}
        className='w-full h-full'
        style={{ height: '100%' }}
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

        {/* Route layer component */}
        <RouteLayer route={route} diveSite={diveSite} />
      </MapContainer>
    </div>
  );
};

const RouteDetail = () => {
  const { diveSiteId, routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Copy route mutation
  const copyRouteMutation = useMutation(
    async () => {
      const copyData = {
        dive_site_id: parseInt(diveSiteId),
        name: `${route.name} (Copy)`,
        description: route.description,
        route_data: route.route_data,
        route_type: route.route_type,
      };

      return api.post('/api/v1/dive-routes/', copyData);
    },
    {
      onSuccess: () => {
        toast.success('Route copied successfully');
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
    copyRouteMutation.mutate();
  };

  const handleShareRoute = () => {
    const routeUrl = window.location.href;
    navigator.clipboard
      .writeText(routeUrl)
      .then(() => {
        toast.success('Route link copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy link');
      });
  };

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
                onClick={() => navigate(`/dive-sites/${diveSiteId}`)}
                className='text-gray-600 hover:text-gray-800 p-1'
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
                <p className='text-sm text-gray-600'>
                  Route for {diveSite?.name || 'Unknown Dive Site'}
                </p>
              </div>
            </div>

            <div className='flex gap-2 flex-wrap'>
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
                    onClick={handleShareRoute}
                    className='flex items-center px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
                  >
                    <Share2 className='w-4 h-4 mr-1' />
                    Share
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
            <p className='text-gray-700'>{route.description}</p>
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
          <RouteDisplay route={route} diveSite={diveSite} />
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
      {showDeleteConfirm && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full'>
            <div className='flex items-center mb-4'>
              <AlertCircle className='w-6 h-6 text-red-600 mr-3' />
              <h3 className='text-lg font-semibold text-gray-900'>Delete Route</h3>
            </div>

            <p className='text-gray-600 mb-6'>
              Are you sure you want to hide this route? This action can be undone by restoring the
              route later.
            </p>

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
          </div>
        </div>
      )}
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
