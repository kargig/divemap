import {
  MapPin,
  Edit,
  Trash2,
  Eye,
  Copy,
  Share2,
  Plus,
  Calendar,
  User,
  Route,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { getRouteTypeColor } from '../utils/colorPalette';
import { formatDate } from '../utils/dateHelpers';

const DiveSiteRoutes = ({ diveSiteId, diveSiteName }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Fetch routes for this dive site
  const {
    data: routes,
    isLoading,
    error,
  } = useQuery(
    ['dive-site-routes', diveSiteId],
    () => api.get(`/api/v1/dive-sites/${diveSiteId}/routes`),
    {
      select: response => response.data,
      enabled: !!diveSiteId,
    }
  );

  // Delete route mutation
  const deleteRouteMutation = useMutation(
    async routeId => {
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
        setShowDeleteConfirm(null);
      },
      onError: error => {
        console.error('Error deleting route:', error);
        toast.error(error.response?.data?.detail || error.message || 'Failed to delete route');
        setShowDeleteConfirm(null);
      },
    }
  );

  // Copy route mutation
  const copyRouteMutation = useMutation(
    async routeId => {
      const response = await api.get(`/api/v1/dive-routes/${routeId}`);
      const originalRoute = response.data;

      // Create a copy with modified name
      const copyData = {
        dive_site_id: diveSiteId,
        name: `${originalRoute.name} (Copy)`,
        description: originalRoute.description,
        route_data: originalRoute.route_data,
        route_type: originalRoute.route_type,
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

  const handleEditRoute = routeId => {
    navigate(`/dive-sites/${diveSiteId}/route/${routeId}/edit`);
  };

  const handleViewRoute = routeId => {
    navigate(`/dive-sites/${diveSiteId}/route/${routeId}`);
  };

  const handleDeleteRoute = routeId => {
    deleteRouteMutation.mutate(routeId);
  };

  const handleCopyRoute = routeId => {
    copyRouteMutation.mutate(routeId);
  };

  const handleShareRoute = routeId => {
    const routeUrl = `${window.location.origin}/dive-sites/${diveSiteId}/route/${routeId}`;
    navigator.clipboard
      .writeText(routeUrl)
      .then(() => {
        toast.success('Route link copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy link');
      });
  };

  const handleDrawNewRoute = () => {
    if (!user) {
      toast.error('Please log in to draw routes');
      navigate('/login');
      return;
    }
    navigate(`/dive-sites/${diveSiteId}/dive-route`);
  };

  const getRouteTypeIcon = routeType => {
    switch (routeType) {
      case 'line':
        return <Route className='w-4 h-4' />;
      case 'polygon':
        return <MapPin className='w-4 h-4' />;
      case 'waypoints':
        return <MapPin className='w-4 h-4' />;
      default:
        return <Route className='w-4 h-4' />;
    }
  };

  const getRouteTypeLabel = (routeType, routeData) => {
    // Check if this is a multi-segment route
    const isMultiSegment =
      routeData?.type === 'FeatureCollection' &&
      routeData?.features &&
      routeData?.features.length > 0 &&
      routeData?.features.some(
        feature =>
          feature.properties &&
          feature.properties.segmentType &&
          ['walk', 'swim', 'scuba'].includes(feature.properties.segmentType)
      );

    if (isMultiSegment) {
      return 'Multi-Segment Route';
    }

    switch (routeType) {
      case 'line':
        return 'Line Route';
      case 'polygon':
        return 'Area Route';
      case 'waypoints':
        return 'Waypoints';
      case 'walk':
        return 'Walk Route';
      case 'swim':
        return 'Swim Route';
      case 'scuba':
        return 'Scuba Route';
      default:
        return 'Route';
    }
  };

  if (isLoading) {
    return (
      <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='w-6 h-6 animate-spin text-blue-600' />
          <span className='ml-2 text-gray-600'>Loading routes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
        <div className='flex items-center justify-center py-8 text-red-600'>
          <AlertCircle className='w-6 h-6 mr-2' />
          <span>Failed to load routes</span>
        </div>
      </div>
    );
  }

  const displayedRoutes = showAllRoutes ? routes : routes?.slice(0, 3);
  const hasMoreRoutes = routes && routes.length > 3;

  return (
    <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-lg sm:text-xl font-semibold text-gray-900'>
          Available Routes ({routes?.length || 0})
        </h2>
        <div className='flex items-center gap-2'>
          {user && (
            <button
              onClick={handleDrawNewRoute}
              className='flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors'
            >
              <Plus className='w-4 h-4 mr-1' />
              Draw Route
            </button>
          )}
          {hasMoreRoutes && (
            <button
              onClick={() => setShowAllRoutes(!showAllRoutes)}
              className='flex items-center text-blue-600 hover:text-blue-700 text-sm'
            >
              {showAllRoutes ? (
                <>
                  <ChevronUp className='h-4 w-4 mr-1' />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className='h-4 w-4 mr-1' />
                  Show All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!routes || routes.length === 0 ? (
        <div className='text-center py-8 text-gray-500'>
          <MapPin className='w-12 h-12 mx-auto mb-4 text-gray-300' />
          <p className='text-lg font-medium mb-2'>No routes available</p>
          <p className='text-sm mb-4'>Be the first to draw a route for this dive site!</p>
          {user && (
            <button
              onClick={handleDrawNewRoute}
              className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors mx-auto'
            >
              <Plus className='w-4 h-4 mr-2' />
              Draw First Route
            </button>
          )}
        </div>
      ) : (
        <div className='space-y-3'>
          {displayedRoutes.map(route => (
            <div
              key={route.id}
              className='border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors'
            >
              <div className='flex items-start justify-between'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-2'>
                    {getRouteTypeIcon(route.route_type)}
                    <h3 className='font-medium text-gray-900 truncate'>{route.name}</h3>
                    <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                      {getRouteTypeLabel(route.route_type, route.route_data)}
                    </span>
                  </div>

                  {route.description && (
                    <p className='text-sm text-gray-600 mb-2 line-clamp-2'>{route.description}</p>
                  )}

                  <div className='flex items-center gap-4 text-xs text-gray-500'>
                    <div className='flex items-center gap-1'>
                      <User className='w-3 h-3' />
                      <span>{route.creator?.username || 'Unknown'}</span>
                    </div>
                    <div className='flex items-center gap-1'>
                      <Calendar className='w-3 h-3' />
                      <span>{formatDate(route.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-1 ml-4'>
                  <button
                    onClick={() => handleViewRoute(route.id)}
                    className='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                    title='View Route'
                  >
                    <Eye className='w-4 h-4' />
                  </button>

                  {user && (
                    <>
                      <button
                        onClick={() => handleCopyRoute(route.id)}
                        disabled={copyRouteMutation.isLoading}
                        className='p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50'
                        title='Copy Route'
                      >
                        <Copy className='w-4 h-4' />
                      </button>

                      <button
                        onClick={() => handleShareRoute(route.id)}
                        className='p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors'
                        title='Share Route'
                      >
                        <Share2 className='w-4 h-4' />
                      </button>

                      {route.created_by === user.id && (
                        <>
                          <button
                            onClick={() => handleEditRoute(route.id)}
                            className='p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors'
                            title='Edit Route'
                          >
                            <Edit className='w-4 h-4' />
                          </button>

                          <button
                            onClick={() => setShowDeleteConfirm(route.id)}
                            className='p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors'
                            title='Delete Route'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
                onClick={() => setShowDeleteConfirm(null)}
                className='px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRoute(showDeleteConfirm)}
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

export default DiveSiteRoutes;
