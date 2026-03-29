import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';

import RoutePreview from './RoutePreview';

const DiveSiteRoutes = ({ diveSiteId, isMobileCollapsed = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showAllRoutes, setShowAllRoutes] = useState(false);

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

  const handleDrawNewRoute = () => {
    if (!user) {
      toast.error('Please log in to draw routes');
      navigate('/login');
      return;
    }
    navigate(`/dive-sites/${diveSiteId}/dive-route`);
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
        <div className='text-center py-8 text-red-600'>
          <AlertCircle className='w-12 h-12 mx-auto mb-4' />
          <p className='text-lg font-medium mb-2'>Error loading routes</p>
          <p className='text-sm'>Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const displayedRoutes = showAllRoutes ? routes : routes?.slice(0, 3);
  const hasMoreRoutes = routes && routes.length > 3;

  return (
    <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
      <div
        className={`flex items-center justify-between gap-2 ${routes && routes.length > 0 ? 'mb-3 sm:mb-4' : ''}`}
      >
        <h2 className='text-base sm:text-xl font-bold text-gray-900 leading-tight'>
          Routes <span className='text-gray-400 text-sm font-medium'>({routes?.length || 0})</span>
        </h2>
        <button
          onClick={handleDrawNewRoute}
          className='flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium shadow-sm shrink-0'
        >
          <Plus className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
          Draw Route
        </button>
      </div>

      {routes && routes.length > 0 && (
        <div className='space-y-3'>
          {displayedRoutes.map(route => (
            <RoutePreview key={route.id} route={route} diveSiteId={diveSiteId} showActions={true} />
          ))}

          {hasMoreRoutes && !showAllRoutes && (
            <button
              onClick={() => setShowAllRoutes(true)}
              className='w-full py-1.5 sm:py-2 text-blue-600 hover:text-blue-800 rounded-md text-xs sm:text-sm font-medium transition-colors'
            >
              Show All Routes ({routes.length})
            </button>
          )}

          {hasMoreRoutes && showAllRoutes && (
            <button
              onClick={() => setShowAllRoutes(false)}
              className='w-full py-1.5 sm:py-2 text-gray-500 hover:text-gray-700 rounded-md text-xs sm:text-sm font-medium transition-colors'
            >
              Show Less
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DiveSiteRoutes;
