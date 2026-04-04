import { Globe, User, TrendingUp, Fish, ChevronRight, Route } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { useResponsive } from '../hooks/useResponsive';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

export const DiveSiteListCard = ({
  site,
  compactLayout,
  getMediaLink,
  getThumbnailUrl,
  handleFilterChange,
}) => {
  const { isMobile } = useResponsive();

  return (
    <div
      className={`dive-item bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] p-2.5 sm:p-6 hover:shadow-md transition-all duration-200 relative ${compactLayout ? 'p-2 sm:p-4' : 'p-2.5 sm:p-6'}`}
    >
      <div className='flex gap-2.5 sm:gap-6'>
        {/* Desktop Thumbnail */}
        {site.thumbnail && (
          <Link
            to={getMediaLink(site)}
            className='shrink-0 w-24 h-24 sm:w-40 sm:h-32 rounded-lg overflow-hidden bg-gray-100 hidden sm:block'
          >
            <img
              src={getThumbnailUrl(site)}
              alt={site.name}
              className='w-full h-full object-cover hover:scale-105 transition-transform duration-300'
              loading='lazy'
            />
          </Link>
        )}
        <div className='flex flex-col space-y-1.5 sm:space-y-4 flex-1 min-w-0'>
          {/* HEADER ROW */}
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              {/* Compact Title & Location combo */}
              <h3
                className={`font-semibold text-gray-900 leading-tight ${compactLayout ? 'text-sm sm:text-lg' : 'text-base sm:text-xl'}`}
              >
                <Link
                  to={`/dive-sites/${site.id}/${slugify(site.name)}`}
                  className='hover:text-blue-600 transition-colors'
                >
                  {site.name}
                </Link>
                {site.country && (
                  <span className='text-[10px] sm:text-xs font-medium text-blue-500 ml-1.5 opacity-80'>
                    @ {site.country}
                    {site.region ? `, ${site.region}` : ''}
                  </span>
                )}
              </h3>
            </div>

            {/* Top Right: Rating */}
            {site.average_rating !== undefined && site.average_rating !== null && (
              <div className='flex items-center gap-1 text-yellow-500 flex-shrink-0'>
                <img
                  src='/arts/divemap_shell.png'
                  alt='Rating'
                  className='w-3.5 h-3.5 object-contain'
                />
                <span className='text-sm sm:text-lg font-bold text-gray-900'>
                  {Number(site.average_rating).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Content Row: Description, Stats and Mobile Thumbnail */}
          <div className='flex gap-2.5 items-start'>
            <div className='flex-1 min-w-0 flex flex-col'>
              {/* BODY: Description - More aggressive clamp on mobile */}
              {site.description && (
                <div
                  className={`text-gray-600 leading-snug line-clamp-2 mb-1.5 ${compactLayout ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-sm'}`}
                >
                  {renderTextWithLinks(decodeHtmlEntities(site.description), {
                    shorten: true,
                    isUGC: true,
                  })}
                </div>
              )}

              {/* STATS STRIP - Moved inside to avoid clearance gap with thumbnail */}
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1 py-1 sm:py-1.5 border-t border-gray-50'>
                {site.max_depth && (
                  <div className='flex items-center gap-1'>
                    <TrendingUp className='w-3 h-3 text-gray-400' />
                    <span className='text-[10px] sm:text-sm font-bold text-gray-900'>
                      {site.max_depth}m
                    </span>
                  </div>
                )}
                {site.difficulty_code && site.difficulty_code !== 'unspecified' && (
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0 text-[9px] sm:text-xs font-medium ${getDifficultyColorClasses(site.difficulty_code)}`}
                  >
                    {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                  </span>
                )}
                {site.route_count > 0 && (
                  <div className='flex items-center gap-1'>
                    <Route className='w-3 h-3 text-blue-400' />
                    <span className='text-[10px] font-bold text-gray-700'>{site.route_count}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Thumbnail - smaller */}
            {site.thumbnail && (
              <Link
                to={getMediaLink(site)}
                className='sm:hidden shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 mt-1'
              >
                <img
                  src={getThumbnailUrl(site)}
                  alt={site.name}
                  className='w-full h-full object-cover'
                  loading='lazy'
                />
              </Link>
            )}
          </div>

          {/* FOOTER: Tags & Actions */}
          <div className='flex items-center justify-between gap-2 mt-auto'>
            {/* Tags - Limit even more on mobile */}
            <div className='flex flex-wrap gap-1'>
              {site.tags?.slice(0, isMobile ? 3 : 5).map((tag, index) => (
                <span
                  key={index}
                  className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-medium ${getTagColor(tag.name || tag)}`}
                >
                  {tag.name || tag}
                </span>
              ))}
              {site.tags?.length > (isMobile ? 3 : 5) && (
                <span className='text-[9px] text-gray-400'>
                  +{site.tags.length - (isMobile ? 3 : 5)}
                </span>
              )}
            </div>

            <Link
              to={`/dive-sites/${site.id}/${slugify(site.name)}`}
              className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
              title='View Details'
            >
              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DiveSiteGridCard = ({
  site,
  compactLayout,
  getMediaLink,
  getThumbnailUrl,
  handleFilterChange,
}) => {
  return (
    <div
      className={`dive-item rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-200 bg-white ${compactLayout ? 'h-full' : ''}`}
    >
      {/* Image Header */}
      <div className='relative h-48 overflow-hidden rounded-tr-xl'>
        <Link to={getMediaLink(site)}>
          <img
            src={getThumbnailUrl(site) || '/dive-site-placeholder.jpg'}
            alt={site.name}
            className='w-full h-full object-cover transition-transform duration-500 hover:scale-110'
            loading='lazy'
          />
        </Link>

        {/* Floating Badges */}
        <div className='absolute top-3 left-3 flex flex-wrap gap-2'>
          {site.difficulty_code && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${getDifficultyColorClasses(site.difficulty_code)}`}
            >
              {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
            </span>
          )}
        </div>

        {/* Floating Rating */}
        {site.average_rating !== undefined && site.average_rating !== null && (
          <div className='absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm flex items-center gap-1 border border-gray-100'>
            <img
              src='/arts/divemap_shell.png'
              alt='Rating'
              className='w-3.5 h-3.5 object-contain'
            />
            <span className='text-xs font-bold text-gray-900'>
              {Number(site.average_rating).toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className='p-4 flex flex-col flex-1'>
        {/* Location Kicker */}
        <div className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1'>
          <Globe className='w-2.5 h-2.5' />
          <span className='truncate'>{site.country || 'Global'}</span>
        </div>

        {/* Title */}
        <h3 className='font-semibold text-gray-900 leading-snug mb-2 line-clamp-1'>
          <Link
            to={`/dive-sites/${site.id}/${slugify(site.name)}`}
            className='hover:text-blue-600 transition-colors'
          >
            {site.name}
          </Link>
        </h3>

        {/* Stats Strip */}
        <div className='flex items-center gap-4 mb-3 pb-3 border-b border-gray-50'>
          {site.max_depth && (
            <div className='flex items-center gap-1'>
              <TrendingUp className='w-3.5 h-3.5 text-gray-400' />
              <span className='text-xs font-bold text-gray-700'>{site.max_depth}m</span>
            </div>
          )}
          {site.route_count > 0 && (
            <div className='flex items-center gap-1'>
              <Route className='w-3.5 h-3.5 text-blue-400' />
              <span className='text-xs font-bold text-gray-700'>{site.route_count}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {site.description && (
          <p className='text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed'>
            {decodeHtmlEntities(site.description)}
          </p>
        )}

        {/* Footer */}
        <div className='mt-auto flex items-center justify-between gap-2 pt-2'>
          <div className='flex -space-x-1 overflow-hidden'>
            {site.tags?.slice(0, 3).map((tag, i) => (
              <div
                key={i}
                className='h-5 w-5 rounded-full border-2 border-white bg-gray-50 flex items-center justify-center'
                title={tag.name || tag}
              >
                <div
                  className={`h-full w-full rounded-full opacity-60 ${getTagColor(tag.name || tag)}`}
                />
              </div>
            ))}
          </div>

          <Link
            to={`/dive-sites/${site.id}/${slugify(site.name)}`}
            className='text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 group'
          >
            Explore
            <ChevronRight className='w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5' />
          </Link>
        </div>
      </div>
    </div>
  );
};
