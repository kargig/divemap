import { Globe, User, TrendingUp, Fish, ChevronRight, Route } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

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
  return (
    <div
      className={`dive-item bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative ${compactLayout ? 'p-4' : 'p-6'}`}
    >
      <div className='flex gap-4 sm:gap-6'>
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
        <div className='flex flex-col space-y-3 sm:space-y-4 flex-1 min-w-0'>
          {/* HEADER ROW */}
          <div className='flex items-start justify-between gap-4'>
            <div className='flex-1 min-w-0'>
              {/* Kicker: Location */}
              {(site.country || site.region) && (
                <div className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1.5'>
                  <Globe className='w-3 h-3' />
                  {site.country && (
                    <button
                      onClick={e => {
                        e.preventDefault();
                        handleFilterChange('country', site.country);
                      }}
                      className='hover:underline hover:text-blue-800 transition-colors'
                    >
                      {site.country}
                    </button>
                  )}
                  {site.country && site.region && <span className='mx-1'>&rsaquo;</span>}
                  {site.region && (
                    <button
                      onClick={e => {
                        e.preventDefault();
                        handleFilterChange('region', site.region);
                      }}
                      className='hover:underline hover:text-blue-800 transition-colors'
                    >
                      {site.region}
                    </button>
                  )}
                </div>
              )}

              {/* Title: Site Name */}
              <h3
                className={`font-semibold text-gray-900 leading-snug flex items-center gap-2 flex-wrap ${compactLayout ? 'text-lg' : 'text-xl'}`}
              >
                <Link
                  to={`/dive-sites/${site.id}/${slugify(site.name)}`}
                  state={{
                    from: window.location.pathname + window.location.search,
                  }}
                  className='hover:text-blue-600 transition-colors'
                >
                  {site.name}
                </Link>
                {site.route_count > 0 && (
                  <span className='inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider'>
                    <Route className='w-2.5 h-2.5' />
                    {site.route_count} Route{site.route_count > 1 ? 's' : ''}
                  </span>
                )}
              </h3>
            </div>

            {/* Top Right: Rating */}
            {site.average_rating !== undefined && site.average_rating !== null && (
              <div className='flex flex-col items-end gap-1'>
                <div className='flex items-center gap-1.5 text-yellow-500'>
                  <img
                    src='/arts/divemap_shell.png'
                    alt='Rating'
                    className='w-5 h-5 object-contain'
                  />
                  <span className='text-lg font-bold text-gray-900'>
                    {Number(site.average_rating).toFixed(1)}
                    <span className='text-xs font-normal text-gray-400 ml-0.5'>/10</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Content Row: Byline, Description, and Mobile Thumbnail */}
          <div className='flex gap-4 items-start'>
            <div className='flex-1 min-w-0'>
              {/* Meta Byline (Creator) */}
              {site.created_by_username && (
                <div className='text-xs text-gray-500 flex items-center gap-1.5 mb-2'>
                  <div className='flex items-center gap-1'>
                    <User className='w-3.5 h-3.5' />
                    <span>{site.created_by_username}</span>
                  </div>
                </div>
              )}

              {/* BODY: Description */}
              {site.description && (
                <div
                  className={`text-gray-600 leading-relaxed line-clamp-3 ${compactLayout ? 'text-xs' : 'text-sm'}`}
                >
                  {renderTextWithLinks(decodeHtmlEntities(site.description), {
                    shorten: false,
                    isUGC: true,
                  })}
                </div>
              )}
            </div>

            {/* Mobile Thumbnail */}
            {site.thumbnail && (
              <Link
                to={getMediaLink(site)}
                className='sm:hidden shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100'
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

          {/* STATS STRIP (De-boxed) */}
          <div className='flex flex-wrap gap-x-8 gap-y-3 py-3 border-y border-gray-50'>
            {site.max_depth !== undefined && site.max_depth !== null && (
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Max Depth
                </span>
                <div className='flex items-center gap-1.5'>
                  <TrendingUp className='w-4 h-4 text-gray-400' />
                  <span className='text-sm font-bold text-gray-900'>
                    {site.max_depth}
                    <span className='text-xs font-normal text-gray-400 ml-0.5'>m</span>
                  </span>
                </div>
              </div>
            )}
            {site.difficulty_code && site.difficulty_code !== 'unspecified' && (
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Level
                </span>
                <div className='flex items-center mt-0.5'>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColorClasses(site.difficulty_code)}`}
                  >
                    {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                  </span>
                </div>
              </div>
            )}
            {site.marine_life && (
              <div className='flex flex-col flex-1 min-w-[150px]'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Marine Life
                </span>
                <div className='flex items-center gap-1.5'>
                  <Fish className='w-4 h-4 text-blue-400' />
                  <span
                    className='text-sm text-gray-700 truncate max-w-[200px]'
                    title={site.marine_life}
                  >
                    {site.marine_life}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER: Tags & Actions */}
          <div className='flex items-center justify-between gap-4 mt-auto'>
            <div className='flex flex-wrap items-center gap-3'>
              {/* Tags */}
              {site.tags && site.tags.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {site.tags.slice(0, 3).map((tag, index) => {
                    const tagName = tag.name || tag;
                    return (
                      <span
                        key={index}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${getTagColor(tagName)}`}
                      >
                        {tagName}
                      </span>
                    );
                  })}
                  {site.tags.length > 3 && (
                    <span className='text-xs font-medium text-gray-400'>
                      +{site.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            <Link
              to={`/dive-sites/${site.id}/${slugify(site.name)}`}
              className='inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors group'
            >
              View Details
              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5' />
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
    <div className='dive-item bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden'>
      {site.thumbnail && (
        <Link
          to={getMediaLink(site)}
          className='block w-full aspect-video overflow-hidden bg-gray-100'
        >
          <img
            src={getThumbnailUrl(site)}
            alt={site.name}
            className='w-full h-full object-cover transition-transform duration-300 hover:scale-105'
            loading='lazy'
          />
        </Link>
      )}
      <div className={`flex flex-col h-full ${compactLayout ? 'p-4' : 'p-6'}`}>
        {/* Header: Kicker & Title */}
        <div className='mb-3'>
          {(site.country || site.region) && (
            <div className='text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1 flex items-center gap-1'>
              <Globe className='w-2.5 h-2.5' />
              {site.country && (
                <button
                  onClick={e => {
                    e.preventDefault();
                    handleFilterChange('country', site.country);
                  }}
                  className='hover:underline hover:text-blue-800 transition-colors'
                >
                  {site.country}
                </button>
              )}
              {site.country && site.region && <span className='mx-1'>&rsaquo;</span>}
              {site.region && (
                <button
                  onClick={e => {
                    e.preventDefault();
                    handleFilterChange('region', site.region);
                  }}
                  className='hover:underline hover:text-blue-800 transition-colors'
                >
                  {site.region}
                </button>
              )}
            </div>
          )}
          <div className='flex items-start justify-between gap-2'>
            <h3 className='font-semibold text-gray-900 leading-snug line-clamp-1 flex-1'>
              <Link
                to={`/dive-sites/${site.id}/${slugify(site.name)}`}
                className='hover:text-blue-600 transition-colors'
              >
                {site.name}
              </Link>
            </h3>
          </div>
        </div>

        {/* Meta Byline (Creator) */}
        {site.created_by_username && (
          <div className='text-xs text-gray-500 flex items-center gap-1.5 mb-2'>
            <div className='flex items-center gap-1'>
              <User className='w-3.5 h-3.5' />
              <span>{site.created_by_username}</span>
            </div>
          </div>
        )}

        {/* Body: Description */}
        {site.description && (
          <div className='text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4'>
            {renderTextWithLinks(decodeHtmlEntities(site.description), {
              shorten: false,
              isUGC: true,
            })}
          </div>
        )}

        {/* Stats Strip (Simplified for Grid) */}
        {((site.average_rating !== undefined && site.average_rating !== null) ||
          (site.max_depth !== undefined && site.max_depth !== null)) && (
          <div className='grid grid-cols-2 gap-4 py-3 border-y border-gray-50 mb-4'>
            {site.average_rating !== undefined && site.average_rating !== null && (
              <div className='flex items-center gap-2'>
                <img
                  src='/arts/divemap_shell.png'
                  alt='Rating'
                  className='w-4 h-4 object-contain'
                />
                <div>
                  <p className='text-[10px] text-gray-400 uppercase font-medium leading-none mb-0.5'>
                    Rating
                  </p>
                  <p className='text-sm font-bold text-gray-900 leading-none'>
                    {Number(site.average_rating).toFixed(1)}
                  </p>
                </div>
              </div>
            )}
            {site.max_depth !== undefined && site.max_depth !== null && (
              <div className='flex items-center gap-2'>
                <TrendingUp className='w-4 h-4 text-gray-400' />
                <div>
                  <p className='text-[10px] text-gray-400 uppercase font-medium leading-none mb-0.5'>
                    Max Depth
                  </p>
                  <p className='text-sm font-bold text-gray-900 leading-none'>{site.max_depth}m</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className='mt-auto flex items-center justify-between pt-2'>
          <div className='flex gap-1'>
            {site.tags &&
              site.tags.slice(0, 2).map((tag, idx) => {
                const tagName = tag.name || tag;
                return (
                  <span
                    key={idx}
                    className={`w-2 h-2 rounded-full ${getTagColor(tagName, true)}`}
                    title={tagName}
                  />
                );
              })}
          </div>
          <Link
            to={`/dive-sites/${site.id}/${slugify(site.name)}`}
            className='inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 group'
          >
            Details
            <ChevronRight className='w-3 h-3 ml-0.5 transition-transform group-hover:translate-x-0.5' />
          </Link>
        </div>
      </div>
    </div>
  );
};
