import { MapPin, Waves, Gauge } from 'lucide-react';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';

const DiveSidebar = ({ dive, formatDate }) => {
  return (
    <div className='space-y-6'>
      {/* Dive Site Information */}
      {dive.dive_site && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-xl font-semibold mb-4'>Dive Site</h2>
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <MapPin size={15} className='text-gray-500' />
              <span className='font-medium'>
                {dive.dive_site.name}
                {dive.dive_site.deleted_at && ' (Archived)'}
              </span>
            </div>
            {dive.dive_site.description && (
              <p className='text-sm text-gray-600'>
                {renderTextWithLinks(decodeHtmlEntities(dive.dive_site.description))}
              </p>
            )}
            {!dive.dive_site.deleted_at && (
              <RouterLink
                to={`/dive-sites/${dive.dive_site.id}/${slugify(dive.dive_site.name)}`}
                state={{ from: window.location.pathname + window.location.search }}
                className='text-blue-600 hover:text-blue-800 text-sm'
              >
                View dive site details →
              </RouterLink>
            )}
          </div>
        </div>
      )}

      {/* Diving Center Information */}
      {dive.diving_center && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-xl font-semibold mb-4'>Diving Center</h2>
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <MapPin size={15} className='text-gray-500' />
              <span className='font-medium'>{dive.diving_center.name}</span>
            </div>
            {dive.diving_center.description && (
              <p className='text-sm text-gray-600'>
                {renderTextWithLinks(decodeHtmlEntities(dive.diving_center.description))}
              </p>
            )}
            <RouterLink
              to={`/diving-centers/${dive.diving_center.id}/${slugify(dive.diving_center.name)}`}
              state={{ from: window.location.pathname + window.location.search }}
              className='text-blue-600 hover:text-blue-800 text-sm'
            >
              View diving center details →
            </RouterLink>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold mb-4 flex items-center gap-2'>
          <Gauge className='h-5 w-5 text-gray-400' />
          Statistics
        </h2>
        <div className='space-y-3'>
          <div className='flex justify-between items-center'>
            <div className='flex items-center gap-2'>
              <Notebook size={15} className='text-gray-500' />
              <span className='text-gray-600'>Total Dives</span>
            </div>
            <span className='font-medium'>{dive.user?.number_of_dives || 0}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-600'>Dive Date</span>
            <span className='font-medium'>{formatDate(dive.dive_date)}</span>
          </div>
          {dive.created_at && (
            <div className='flex justify-between'>
              <span className='text-gray-600'>Logged</span>
              <span className='font-medium'>{formatDate(dive.created_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiveSidebar;
