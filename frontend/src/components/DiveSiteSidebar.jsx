import { Collapse } from 'antd';
import { Clock, MapPin, Star, Plus } from 'lucide-react';
import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { formatDate } from '../utils/dateHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify, getDiveSiteSlug, getDivingCenterSlug } from '../utils/slugify';
import { getTagColor } from '../utils/tagHelpers';

import DiveSiteExplorerCard from './DiveSiteExplorerCard';
import DiveSiteSpecsCard from './DiveSiteSpecsCard';
import WeatherConditionsCard from './MarineConditionsCard';
import Button from './ui/Button';
import DepthIcon from './ui/DepthIcon';
import DifficultyBadge from './ui/DifficultyBadge';

const DiveSiteSidebar = ({
  diveSite,
  windData,
  isWindLoading,
  isMarineExpanded = false,
  setIsMarineExpanded,
  divingCenters,
  recentDives,
  nearbyDiveSites,
  isNearbyLoading,
  isNearbyExpanded,
  setIsNearbyExpanded,
}) => {
  const navigate = useNavigate();

  return (
    <div className='space-y-5'>
      {/* Primary Action Button */}
      {diveSite && !diveSite.deleted_at && (
        <Button
          to={`/dives/create?dive_site_id=${diveSite.id}`}
          variant='primary'
          size='lg'
          icon={<Plus className='w-5 h-5' />}
          className='w-full justify-center shadow-md font-bold text-sm sm:text-base'
        >
          Log a Dive Here
        </Button>
      )}

      {/* Technical Dive Site Specs */}
      <DiveSiteSpecsCard diveSite={diveSite} />

      {/* Explorer Attribution */}
      {diveSite?.created_by_username && (
        <DiveSiteExplorerCard username={diveSite.created_by_username} />
      )}

      {/* Weather Conditions - Collapsible (Desktop Only, Mobile is in main content) */}
      <div className='hidden lg:block bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden'>
        <Collapse
          ghost
          activeKey={isMarineExpanded ? ['weather'] : []}
          onChange={keys => setIsMarineExpanded(keys.includes('weather'))}
          items={[
            {
              key: 'weather',
              label: (
                <span className='text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100'>
                  Weather Conditions
                </span>
              ),
              children: (
                <div className='-m-4'>
                  {/* Negative margin to counteract Collapse padding */}
                  <WeatherConditionsCard windData={windData} loading={isWindLoading} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Associated Diving Centers - Moved to Sidebar */}
      {divingCenters && divingCenters.length > 0 && (
        <div className='bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700'>
          <h3 className='text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4'>
            Diving Centers
          </h3>
          <div className='space-y-3'>
            {divingCenters.map(center => (
              <div
                key={center.id}
                className='border border-gray-100 dark:border-slate-700/60 rounded-xl p-3 bg-gray-50/30 dark:bg-slate-700/30 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors'
              >
                <div className='flex flex-col gap-0.5 mb-1'>
                  <RouterLink
                    to={`/diving-centers/${center.id}/${getDivingCenterSlug(center)}`}
                    className='font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-sm leading-tight'
                  >
                    {center.name}
                  </RouterLink>
                  {center.dive_cost && (
                    <span className='text-green-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider'>
                      {formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)}
                    </span>
                  )}
                </div>
                {center.description && (
                  <p className='text-gray-500 dark:text-slate-400 text-[11px] line-clamp-2 leading-relaxed'>
                    {decodeHtmlEntities(center.description)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Dives - Between Diving Centers and Nearby Dive Sites */}
      {recentDives && recentDives.length > 0 && (
        <div
          id='dives'
          className='bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 scroll-mt-16'
        >
          <h3 className='text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4'>
            Recent Dives
          </h3>
          <div className='space-y-3'>
            {recentDives.slice(0, 5).map(dive => (
              <div
                key={dive.id}
                className='border border-gray-100 dark:border-slate-700/60 rounded-xl p-3 bg-gray-50/30 dark:bg-slate-700/30 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors'
              >
                <div className='flex items-start justify-between gap-1.5 mb-1'>
                  <RouterLink
                    to={`/dives/${dive.id}/${slugify(`${dive.name || dive.dive_site?.name || diveSite?.name || 'dive'}-${dive.dive_date}-dive-${dive.id}`)}`}
                    className='font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline text-xs sm:text-sm leading-tight truncate flex-1'
                  >
                    {dive.name || dive.dive_site?.name || 'Unnamed Dive'}
                  </RouterLink>
                  {dive.user_rating && (
                    <div className='flex items-center bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 shrink-0'>
                      <Star className='h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-500 mr-0.5 fill-current' />
                      <span className='text-[10px] font-bold text-yellow-700'>
                        {dive.user_rating}/5
                      </span>
                    </div>
                  )}
                </div>

                <div className='flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500 mb-2'>
                  <span>{formatDate(dive.dive_date)}</span>
                  {dive.user_username && (
                    <>
                      <span>•</span>
                      <RouterLink
                        to={`/users/${dive.user_username}`}
                        className='text-blue-500 hover:text-blue-700 font-medium'
                      >
                        {dive.user_username}
                      </RouterLink>
                    </>
                  )}
                </div>

                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mb-1.5'>
                  {dive.max_depth && (
                    <div className='flex items-center gap-1'>
                      <DepthIcon className='text-divemap-blue font-bold' size={12} />
                      <span className='text-gray-700 dark:text-slate-200 font-medium'>
                        {dive.max_depth}m
                      </span>
                    </div>
                  )}
                  {dive.duration && (
                    <div className='flex items-center gap-1'>
                      <Clock className='w-3 h-3 text-gray-400 dark:text-slate-500' />
                      <span className='text-gray-700 dark:text-slate-200 font-medium'>
                        {dive.duration}min
                      </span>
                    </div>
                  )}
                  {dive.difficulty_code && (
                    <DifficultyBadge
                      code={dive.difficulty_code}
                      label={dive.difficulty_label}
                      size='xs'
                    />
                  )}
                </div>

                {dive.dive_information && (
                  <p className='text-[11px] text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed border-t border-gray-100 dark:border-slate-700 pt-1.5 mt-1.5'>
                    {decodeHtmlEntities(dive.dive_information)}
                  </p>
                )}

                {dive.tags && dive.tags.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-2'>
                    {dive.tags.map(tag => (
                      <span
                        key={tag.id}
                        className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${getTagColor(tag.name)}`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className='mt-3 sm:mt-4 text-center'>
            <Button
              to={`/dives?dive_site_id=${diveSite.id}`}
              variant='secondary'
              size='sm'
              className='w-full'
            >
              More...
            </Button>
          </div>
        </div>
      )}

      {/* Nearby Dive Sites */}
      {diveSite.latitude && diveSite.longitude && (
        <div
          id='nearby'
          className='bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden scroll-mt-16'
        >
          <Collapse
            ghost
            activeKey={isNearbyExpanded ? ['nearby-sidebar'] : []}
            onChange={keys => setIsNearbyExpanded(keys.includes('nearby-sidebar'))}
            items={[
              {
                key: 'nearby-sidebar',
                label: (
                  <span className='text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100'>
                    Nearby Dive Sites
                  </span>
                ),
                children: (
                  <div className='space-y-1.5'>
                    {isNearbyLoading ? (
                      <div className='text-center py-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider'>
                        Loading nearby sites...
                      </div>
                    ) : nearbyDiveSites && nearbyDiveSites.length > 0 ? (
                      nearbyDiveSites.slice(0, 6).map(site => (
                        <button
                          key={site.id}
                          onClick={() =>
                            navigate(`/dive-sites/${site.id}/${getDiveSiteSlug(site)}`)
                          }
                          className='flex items-center p-2 border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-700/60 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left w-full shadow-sm'
                        >
                          <MapPin className='w-3.5 h-3.5 mr-2 flex-shrink-0 text-blue-500' />
                          <div className='min-w-0 flex-1'>
                            <div className='font-bold text-gray-900 dark:text-slate-100 text-xs truncate leading-tight'>
                              {site.name}
                            </div>
                            <div className='text-[10px] text-gray-400 dark:text-slate-400 font-medium'>
                              {site.distance_km} km away
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className='text-center py-4 text-xs text-gray-500 italic'>
                        No nearby dive sites found.
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default DiveSiteSidebar;
