import { MapPin, Loader2, Star } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getDiveSite } from '../../services/diveSites';
import { slugify } from '../../utils/slugify';

const LinkPreview = ({ url }) => {
  // Extract dive site id from URL
  // Matches /dive-sites/:id or /dive-sites/:id/slug
  const match = url.match(/\/dive-sites\/(\d+)/);
  const diveSiteId = match ? parseInt(match[1], 10) : null;

  const {
    data: diveSite,
    isLoading,
    error,
  } = useQuery(['dive-site-preview', diveSiteId], () => getDiveSite(diveSiteId), {
    enabled: !!diveSiteId,
    staleTime: 600000, // 10 minutes
    retry: 1,
  });

  if (!match) return null;

  if (isLoading) {
    return (
      <div className='mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center'>
        <Loader2 className='animate-spin text-blue-500' size={20} />
      </div>
    );
  }

  if (error || !diveSite) return null;

  const thumbnail = diveSite.thumbnail || diveSite.primary_image_url;
  const rating = diveSite.average_rating;

  return (
    <Link
      to={`/dive-sites/${diveSiteId}/${slugify(diveSite.name)}`}
      className='block mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors no-underline'
    >
      <div className='flex items-start'>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={diveSite.name}
            className='w-16 h-16 object-cover rounded shadow-sm mr-3'
          />
        ) : (
          <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center mr-3 text-blue-500 shrink-0'>
            <MapPin size={24} />
          </div>
        )}
        <div className='flex-1 min-w-0'>
          <div className='flex justify-between items-start gap-2'>
            <h4 className='font-semibold text-gray-900 dark:text-gray-100 text-sm truncate'>
              {diveSite.name}
            </h4>
            {rating && (
              <div className='flex items-center gap-0.5 text-yellow-500 shrink-0'>
                <Star size={12} fill='currentColor' />
                <span className='text-xs font-bold'>{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <p className='text-xs text-gray-500 dark:text-gray-400 truncate mt-1'>
            {diveSite.region ? `${diveSite.region}, ` : ''}
            {diveSite.country}
          </p>
          {diveSite.max_depth && (
            <p className='text-[10px] text-gray-400 mt-1 uppercase tracking-wide'>
              Max Depth: {diveSite.max_depth}m
            </p>
          )}
        </div>
      </div>
    </Link>
  );
};

LinkPreview.propTypes = {
  url: PropTypes.string.isRequired,
};

export default LinkPreview;
