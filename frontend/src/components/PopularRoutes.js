import { TrendingUp, MapPin, Users, Calendar } from 'lucide-react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { formatDate } from '../utils/dateHelpers';
import { getRouteTypeLabel } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';

const PopularRoutes = ({ limit = 10 }) => {
  const navigate = useNavigate();

  const {
    data: popularRoutes,
    isLoading,
    error,
  } = useQuery(
    ['popular-routes', limit],
    () => api.get(`/api/v1/dive-routes/popular?limit=${limit}`),
    {
      select: response => response.data.routes,
    }
  );

  const handleRouteClick = route => {
    navigate(`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`);
  };

  if (isLoading) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-md'>
        <div className='flex items-center justify-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <span className='ml-2 text-gray-600'>Loading popular routes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-md'>
        <div className='text-center py-8 text-red-600'>
          <p className='text-lg font-medium mb-2'>Error loading popular routes</p>
          <p className='text-sm'>Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (!popularRoutes || popularRoutes.length === 0) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-md'>
        <h2 className='text-xl font-semibold mb-4 flex items-center'>
          <TrendingUp className='w-5 h-5 mr-2 text-orange-500' />
          Popular Routes
        </h2>
        <div className='text-center py-8 text-gray-500'>
          <p>No popular routes available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white p-6 rounded-lg shadow-md'>
      <h2 className='text-xl font-semibold mb-4 flex items-center'>
        <TrendingUp className='w-5 h-5 mr-2 text-orange-500' />
        Popular Routes
      </h2>
      <div className='space-y-3'>
        {popularRoutes.map((route, index) => (
          <div
            key={route.id}
            className='border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors'
            onClick={() => handleRouteClick(route)}
          >
            <div className='flex items-start justify-between'>
              <div className='flex-1'>
                <div className='flex items-center gap-2 mb-2'>
                  <span className='text-sm font-medium text-gray-500'>#{index + 1}</span>
                  <h3 className='font-medium text-gray-900 truncate'>{route.name}</h3>
                  <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                    {getRouteTypeLabel(route.route_type, null, route.route_data)}
                  </span>
                </div>

                <div className='flex items-center gap-4 text-sm text-gray-600 mb-2'>
                  <div className='flex items-center gap-1'>
                    <MapPin className='w-3 h-3' />
                    <span>{route.dive_site?.name || 'Unknown Site'}</span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Calendar className='w-3 h-3' />
                    <span>{formatDate(route.created_at)}</span>
                  </div>
                </div>

                {route.description && (
                  <p className='text-sm text-gray-600 line-clamp-2'>{route.description}</p>
                )}
              </div>

              <div className='flex items-center gap-2 ml-4'>
                <div className='text-center'>
                  <div className='text-lg font-bold text-blue-600'>
                    {route.community_stats?.total_dives_using_route || 0}
                  </div>
                  <div className='text-xs text-gray-500'>dives</div>
                </div>
                <div className='text-center'>
                  <div className='text-lg font-bold text-green-600'>
                    {route.community_stats?.unique_users_used_route || 0}
                  </div>
                  <div className='text-xs text-gray-500'>users</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PopularRoutes;
