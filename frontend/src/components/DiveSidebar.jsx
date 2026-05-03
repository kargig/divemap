import { MapPin, Notebook, Gauge } from 'lucide-react';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';

import Avatar from './Avatar';

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
          <div className='space-y-4'>
            <RouterLink
              to={`/diving-centers/${dive.diving_center.id}/${slugify(dive.diving_center.name)}`}
              state={{ from: window.location.pathname + window.location.search }}
              className='flex items-center gap-3 group'
            >
              <Avatar
                src={dive.diving_center.logo_full_url || dive.diving_center.logo_url}
                alt={dive.diving_center.name}
                size='xl'
                shape='rounded'
                fallbackText={dive.diving_center.name}
                className='border border-gray-100 shadow-sm transition-transform duration-200 group-hover:scale-105'
              />
              <span className='font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors'>
                {dive.diving_center.name}
              </span>
            </RouterLink>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiveSidebar;
