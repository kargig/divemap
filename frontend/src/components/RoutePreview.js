import { MapPin, Route, Calendar, User, Eye, Edit, Trash2, Clock, Layers } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { getRouteTypeColor } from '../utils/colorPalette';
import { formatDate } from '../utils/dateHelpers';
import { getSmartRouteColor, getRouteTypeLabel } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';

import Modal from './ui/Modal';

const RoutePreview = ({
  route,
  diveSiteId,
  diveSiteName,
  showActions = true,
  compact = false,
  onRouteClick,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Delete route mutation
  const deleteRouteMutation = useMutation(
    async () => {
      // First check if route can be deleted
      const deletionCheck = await api.get(`/api/v1/dive-routes/${route.id}/deletion-check`);

      if (!deletionCheck.data.can_delete) {
        throw new Error(deletionCheck.data.reason);
      }

      // Perform soft delete (hide route)
      return api.post(`/api/v1/dive-routes/${route.id}/hide`);
    },
    {
      onSuccess: () => {
        toast.success('Route hidden successfully');
        queryClient.invalidateQueries(['dive-site-routes', diveSiteId]);
        queryClient.invalidateQueries(['dive-routes']);
        setShowDeleteConfirm(false);
      },
      onError: error => {
        console.error('Error deleting route:', error);
        toast.error(error.response?.data?.detail || error.message || 'Failed to delete route');
        setShowDeleteConfirm(false);
      },
    }
  );

  const handleViewRoute = () => {
    // Track route view
    api.post(`/api/v1/dive-routes/${route.id}/view`).catch(() => {
      // Silently fail if tracking fails
    });

    if (onRouteClick) {
      onRouteClick(route);
    } else {
      navigate(`/dive-sites/${diveSiteId}/route/${route.id}/${slugify(route.name)}`);
    }
  };

  const handleEditRoute = () => {
    navigate(`/dive-sites/${diveSiteId}/route/${route.id}/edit`);
  };

  const handleDeleteRoute = () => {
    deleteRouteMutation.mutate();
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

  const getRouteColor = (routeType, routeData) => {
    // Use smart route color detection for consistent coloring
    return getSmartRouteColor({ route_type: routeType, route_data: routeData });
  };

  const canEdit = user && (route.created_by === user.id || user.is_admin);

  if (compact) {
    return (
      <div
        className='border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer'
        onClick={handleViewRoute}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2 min-w-0 flex-1'>
            <div
              className='w-3 h-3 rounded-full flex-shrink-0'
              style={{
                backgroundColor: getRouteColor(route.route_type, route.route_data),
              }}
            />
            <span className='font-medium text-gray-900 truncate text-sm'>{route.name}</span>
            <span className='px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full flex-shrink-0'>
              {getRouteTypeLabel(route.route_type, null, route.route_data)}
            </span>
          </div>
          {showActions && user && (
            <div className='flex items-center gap-1 ml-2'>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleViewRoute();
                }}
                className='p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors'
                title='View Route'
              >
                <Eye className='w-3 h-3' />
              </button>
              {canEdit && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleEditRoute();
                  }}
                  className='p-1 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors'
                  title='Edit Route'
                >
                  <Edit className='w-3 h-3' />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className='border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-2'>
              <div
                className='w-4 h-4 rounded-full flex-shrink-0'
                style={{ backgroundColor: getRouteColor(route.route_type, route.route_data) }}
              />
              {getRouteTypeIcon(route.route_type)}
              <h3 className='font-medium text-gray-900 truncate'>{route.name}</h3>
              <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                {getRouteTypeLabel(route.route_type, null, route.route_data)}
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
              {route.route_data?.features?.length > 1 && (
                <div className='flex items-center gap-1'>
                  <Layers className='w-3 h-3' />
                  <span>{route.route_data.features.length} segments</span>
                </div>
              )}
            </div>
          </div>

          {showActions && (
            <div className='flex items-center gap-1 ml-4'>
              <button
                onClick={handleViewRoute}
                className='p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                title='View Route'
              >
                <Eye className='w-4 h-4' />
              </button>

              {canEdit && (
                <>
                  <button
                    onClick={handleEditRoute}
                    className='p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors'
                    title='Edit Route'
                  >
                    <Edit className='w-4 h-4' />
                  </button>

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className='p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors'
                    title='Delete Route'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </>
              )}
            </div>
          )}
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
          <Trash2 className='w-6 h-6 text-red-600 mr-3 mt-0.5' />
          <p className='text-gray-600'>
            Are you sure you want to hide "{route.name}"? This action can be undone by restoring the
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
                <Clock className='w-4 h-4 mr-2 animate-spin' />
                Deleting...
              </>
            ) : (
              'Hide Route'
            )}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default RoutePreview;
