import { Compass, ExternalLink } from 'lucide-react';
import PropTypes from 'prop-types';
import { useQuery } from 'react-query';
import { Link as RouterLink } from 'react-router-dom';

import api from '../api';

const DiveSiteExplorerCard = ({ username }) => {
  const { data: userProfile } = useQuery(
    ['user-public-profile', username],
    () => api.get(`/api/v1/users/${username}/public`).then(res => res.data),
    {
      enabled: !!username,
      staleTime: 1000 * 60 * 30, // 30 minutes
      retry: false,
    }
  );

  if (!username) return null;

  const avatarSrc = userProfile?.avatar_full_url || userProfile?.google_avatar_url || null;
  const diveCount = userProfile?.stats?.total_dives_claimed ?? userProfile?.number_of_dives;
  const sitesMapped = userProfile?.stats?.dive_sites_created;

  return (
    <div className='bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700'>
      <div className='flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3'>
        <Compass className='w-3.5 h-3.5 text-blue-500' />
        <span>Mapped By Explorer</span>
      </div>

      <div className='flex items-center gap-3 mb-3'>
        <RouterLink to={`/users/${username}`} className='shrink-0 group'>
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={username}
              className='w-11 h-11 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm group-hover:ring-2 group-hover:ring-blue-500 transition-all'
            />
          ) : (
            <div className='w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base border-2 border-white dark:border-gray-700 shadow-sm group-hover:ring-2 group-hover:ring-blue-500 transition-all'>
              {username.charAt(0).toUpperCase()}
            </div>
          )}
        </RouterLink>

        <div className='min-w-0 flex-1'>
          <RouterLink
            to={`/users/${username}`}
            className='font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-sm truncate block'
          >
            {username}
          </RouterLink>
          <div className='flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400'>
            {diveCount != null && diveCount > 0 && (
              <span className='inline-flex items-center gap-1 font-medium'>
                <span>🤿</span>
                <span>{diveCount} dives</span>
              </span>
            )}
            {sitesMapped != null && sitesMapped > 0 && (
              <span className='inline-flex items-center gap-1 font-medium'>
                <span>🗺️</span>
                <span>{sitesMapped} sites</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className='pt-2.5 border-t border-gray-100 dark:border-gray-700/60'>
        <RouterLink
          to={`/dive-sites?created_by=${username}`}
          className='text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors inline-flex items-center justify-between w-full'
        >
          <span>See more sites mapped by @{username}</span>
          <ExternalLink className='w-3.5 h-3.5' />
        </RouterLink>
      </div>
    </div>
  );
};

DiveSiteExplorerCard.propTypes = {
  username: PropTypes.string,
};

export default DiveSiteExplorerCard;
