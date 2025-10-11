import { MapPin, Route, User, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';

import api from '../api';
import { getRouteTypeColor } from '../utils/colorPalette';
import { formatDate } from '../utils/dateHelpers';

const RouteSelection = ({ diveSiteId, selectedRouteId, onRouteSelect, disabled = false }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch routes for the selected dive site
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

  // Find selected route
  const selectedRoute = routes?.find(route => route.id.toString() === selectedRouteId);

  const handleRouteSelect = route => {
    onRouteSelect(route.id.toString());
    setIsDropdownOpen(false);
  };

  const handleClearSelection = () => {
    onRouteSelect('');
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (!event.target.closest('.route-selection-dropdown')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!diveSiteId) {
    return <div className='text-sm text-gray-500'>Select a dive site to choose a route</div>;
  }

  if (isLoading) {
    return (
      <div className='flex items-center text-sm text-gray-600'>
        <Loader2 className='w-4 h-4 animate-spin mr-2' />
        Loading routes...
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center text-sm text-red-600'>
        <AlertCircle className='w-4 h-4 mr-2' />
        Error loading routes
      </div>
    );
  }

  if (!routes || routes.length === 0) {
    return <div className='text-sm text-gray-500'>No routes available for this dive site</div>;
  }

  return (
    <div className='route-selection-dropdown relative'>
      <label className='block text-sm font-medium text-gray-700 mb-2'>Route (Optional)</label>

      <div className='relative'>
        <button
          type='button'
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled}
          className={`w-full text-left border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
          }`}
        >
          {selectedRoute ? (
            <div className='flex items-center'>
              <div
                className='w-3 h-3 rounded-full mr-2'
                style={{ backgroundColor: getRouteTypeColor(selectedRoute.route_type) }}
              />
              <span className='text-gray-900'>{selectedRoute.name}</span>
            </div>
          ) : (
            <span className='text-gray-500'>Select a route...</span>
          )}
        </button>

        {isDropdownOpen && (
          <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
            <div className='py-1'>
              {/* Clear selection option */}
              <button
                type='button'
                onClick={handleClearSelection}
                className='w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-100'
              >
                No route selected
              </button>

              {/* Route options */}
              {routes.map(route => (
                <button
                  key={route.id}
                  type='button'
                  onClick={() => handleRouteSelect(route)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                    selectedRouteId === route.id.toString() ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className='flex items-start'>
                    <div
                      className='w-3 h-3 rounded-full mr-3 mt-1 flex-shrink-0'
                      style={{ backgroundColor: getRouteTypeColor(route.route_type) }}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center'>
                        <span className='font-medium text-gray-900 truncate'>{route.name}</span>
                        <span className='ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full'>
                          {route.route_type}
                        </span>
                      </div>
                      {route.description && (
                        <p className='text-xs text-gray-600 mt-1 line-clamp-2'>
                          {route.description}
                        </p>
                      )}
                      <div className='flex items-center text-xs text-gray-500 mt-1'>
                        <User className='w-3 h-3 mr-1' />
                        <span className='mr-3'>{route.creator_username}</span>
                        <Calendar className='w-3 h-3 mr-1' />
                        <span>{formatDate(route.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Selected route preview */}
      {selectedRoute && (
        <div className='mt-3 p-3 bg-gray-50 rounded-md'>
          <div className='flex items-start'>
            <div
              className='w-4 h-4 rounded-full mr-3 mt-1 flex-shrink-0'
              style={{ backgroundColor: getRouteTypeColor(selectedRoute.route_type) }}
            />
            <div className='flex-1'>
              <div className='flex items-center'>
                <Route className='w-4 h-4 text-gray-500 mr-2' />
                <span className='font-medium text-gray-900'>{selectedRoute.name}</span>
                <span className='ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full'>
                  {selectedRoute.route_type}
                </span>
              </div>
              {selectedRoute.description && (
                <p className='text-sm text-gray-600 mt-1'>{selectedRoute.description}</p>
              )}
              <div className='flex items-center text-xs text-gray-500 mt-2'>
                <User className='w-3 h-3 mr-1' />
                <span className='mr-3'>Created by {selectedRoute.creator_username}</span>
                <Calendar className='w-3 h-3 mr-1' />
                <span>{formatDate(selectedRoute.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteSelection;
