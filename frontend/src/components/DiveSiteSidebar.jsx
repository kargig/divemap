import { Collapse } from 'antd';
import { Link, MapPin } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';

import WeatherConditionsCard from './MarineConditionsCard';

const DiveSiteSidebar = ({
  diveSite,
  windData,
  isWindLoading,
  setIsMarineExpanded,
  divingCenters,
  nearbyDiveSites,
  isNearbyLoading,
  setIsNearbyExpanded,
}) => {
  const navigate = useNavigate();

  return (
    <div className='space-y-6'>
      {/* Weather Conditions - Collapsible (Desktop Only, Mobile is in main content) */}
      <div className='hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
        <Collapse
          ghost
          onChange={keys => setIsMarineExpanded(keys.includes('weather'))}
          items={[
            {
              key: 'weather',
              label: (
                <span className='text-base sm:text-lg font-bold text-gray-900'>
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

      {/* Access Instructions - Desktop View Only */}
      {diveSite.access_instructions && (
        <div className='hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow-md'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4'>Access Instructions</h3>
          <p className='text-gray-700 text-sm'>
            {decodeHtmlEntities(diveSite.access_instructions)}
          </p>
        </div>
      )}

      {/* Associated Diving Centers - Moved to Sidebar */}
      {divingCenters && divingCenters.length > 0 && (
        <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
          <h3 className='text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4'>
            Diving Centers
          </h3>
          <div className='space-y-3'>
            {divingCenters.map(center => (
              <div key={center.id} className='border border-gray-100 rounded-xl p-3 bg-gray-50/30'>
                <div className='flex flex-col gap-0.5 mb-2'>
                  <h4 className='font-bold text-gray-900 text-sm leading-tight'>{center.name}</h4>
                  {center.dive_cost && (
                    <span className='text-green-600 font-bold text-[10px] uppercase tracking-wider'>
                      {formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)}
                    </span>
                  )}
                </div>
                {center.description && (
                  <p className='text-gray-500 text-[11px] mb-2 line-clamp-2 leading-relaxed'>
                    {decodeHtmlEntities(center.description)}
                  </p>
                )}
                <div className='flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-tight'>
                  {center.email && (
                    <a
                      href={`mailto:${center.email}`}
                      className='flex items-center text-blue-600 hover:text-blue-800'
                      title='Email'
                    >
                      <Link className='h-3 w-3 mr-1 opacity-70' />
                      Email
                    </a>
                  )}
                  {center.phone && (
                    <a
                      href={`tel:${center.phone}`}
                      className='flex items-center text-blue-600 hover:text-blue-800'
                      title='Phone'
                    >
                      <Link className='h-3 w-3 mr-1 opacity-70' />
                      Phone
                    </a>
                  )}
                  {center.website && (
                    <a
                      href={center.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center text-blue-600 hover:text-blue-800'
                      title='Website'
                    >
                      <Link className='h-3 w-3 mr-1 opacity-70' />
                      Web
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Dive Sites - Desktop View Only */}
      {diveSite.latitude && diveSite.longitude && (
        <div className='hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
          <Collapse
            ghost
            onChange={keys => setIsNearbyExpanded(keys.includes('nearby-desktop'))}
            items={[
              {
                key: 'nearby-desktop',
                label: (
                  <span className='text-base sm:text-lg font-bold text-gray-900'>
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
                          onClick={() => navigate(`/dive-sites/${site.id}/${slugify(site.name)}`)}
                          className='flex items-center p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left w-full shadow-sm'
                        >
                          <MapPin className='w-3.5 h-3.5 mr-2 flex-shrink-0 text-blue-500' />
                          <div className='min-w-0 flex-1'>
                            <div className='font-bold text-gray-900 text-xs truncate leading-tight'>
                              {site.name}
                            </div>
                            <div className='text-[10px] text-gray-400 font-medium'>
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
