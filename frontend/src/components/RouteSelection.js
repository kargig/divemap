import { MapPin, Route, User, Calendar, Loader2, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { useQuery } from 'react-query';

import api from '../api';
import { formatDate } from '../utils/dateHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { getRouteTypeLabel, getSmartRouteColor } from '../utils/routeUtils';

import Combobox from './ui/Combobox';

const RouteSelection = ({ diveSiteId, selectedRouteId, onRouteSelect, disabled = false }) => {
  // Fetch routes for the selected dive site
  const {
    data: routes = [],
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

  const options = useMemo(() => {
    return routes.map(route => ({
      value: route.id.toString(),
      label: route.name,
      route: route,
    }));
  }, [routes]);

  if (!diveSiteId) {
    return (
      <div className='text-sm text-gray-500 py-2 border border-dashed border-gray-300 rounded-md text-center bg-gray-50'>
        Select a dive site to choose a route
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex items-center text-sm text-gray-600 p-2'>
        <Loader2 className='w-4 h-4 animate-spin mr-2' />
        Loading routes...
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center text-sm text-red-600 p-2'>
        <AlertCircle className='w-4 h-4 mr-2' />
        Error loading routes
      </div>
    );
  }

  const renderRouteItem = option => {
    const { route } = option;
    return (
      <div className='flex items-start w-full py-0.5'>
        <div
          className='w-3 h-3 rounded-full mr-3 mt-1.5 flex-shrink-0'
          style={{ backgroundColor: getSmartRouteColor(route) }}
        />
        <div className='flex-1 min-w-0 text-left'>
          <div className='flex items-center'>
            <span className='font-medium text-gray-900 truncate'>{route.name}</span>
            <span className='ml-2 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full flex-shrink-0'>
              {getRouteTypeLabel(route.route_type, null, route.route_data)}
            </span>
          </div>
          {route.description && (
            <p className='text-[11px] text-gray-500 line-clamp-1 mt-0.5'>
              {decodeHtmlEntities(route.description)}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='space-y-3'>
      <Combobox
        label='Route (Optional)'
        placeholder='Select a route...'
        searchPlaceholder='Filter routes...'
        options={options}
        value={selectedRouteId || ''}
        onValueChange={onRouteSelect}
        renderItem={renderRouteItem}
        disabled={disabled || routes.length === 0}
        emptyMessage={routes.length === 0 ? 'No routes available' : 'No routes match search'}
      />

      {/* Selected route preview */}
      {selectedRoute && (
        <div className='p-3 bg-blue-50 border border-blue-100 rounded-md animate-in fade-in slide-in-from-top-1'>
          <div className='flex items-start'>
            <div
              className='w-4 h-4 rounded-full mr-3 mt-1 flex-shrink-0 shadow-sm'
              style={{ backgroundColor: getSmartRouteColor(selectedRoute) }}
            />
            <div className='flex-1'>
              <div className='flex items-center'>
                <Route className='w-4 h-4 text-blue-600 mr-2' />
                <span className='font-medium text-gray-900'>{selectedRoute.name}</span>
                <span className='ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium'>
                  {getRouteTypeLabel(
                    selectedRoute.route_type,
                    selectedRoute.drawing_type,
                    selectedRoute.route_data
                  )}
                </span>
              </div>
              {selectedRoute.description && (
                <p className='text-sm text-gray-600 mt-1 leading-relaxed'>
                  {decodeHtmlEntities(selectedRoute.description)}
                </p>
              )}
              <div className='flex items-center text-[11px] text-gray-500 mt-2 space-x-3'>
                <div className='flex items-center'>
                  <User className='w-3 h-3 mr-1' />
                  <span>{selectedRoute.creator_username}</span>
                </div>
                <div className='flex items-center'>
                  <Calendar className='w-3 h-3 mr-1' />
                  <span>{formatDate(selectedRoute.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

RouteSelection.propTypes = {
  diveSiteId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedRouteId: PropTypes.string,
  onRouteSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default RouteSelection;
