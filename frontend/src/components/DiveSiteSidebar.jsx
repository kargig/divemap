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
      {/* Weather Conditions - Collapsible */}
      <div className='bg-white rounded-lg shadow-md overflow-hidden'>
        <Collapse
          ghost
          onChange={keys => setIsMarineExpanded(keys.includes('weather'))}
          items={[
            {
              key: 'weather',
              label: (
                <span className='text-lg font-semibold text-gray-900'>
                  Current Weather Conditions
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
        <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4'>Diving Centers</h3>
          <div className='space-y-4'>
            {divingCenters.map(center => (
              <div key={center.id} className='border rounded-lg p-3'>
                <div className='flex flex-col gap-1 mb-2'>
                  <h4 className='font-medium text-gray-900 text-sm'>{center.name}</h4>
                  {center.dive_cost && (
                    <span className='text-green-600 font-medium text-xs'>
                      {formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)}
                    </span>
                  )}
                </div>
                {center.description && (
                  <p className='text-gray-600 text-xs mb-2 line-clamp-2'>
                    {decodeHtmlEntities(center.description)}
                  </p>
                )}
                <div className='flex flex-wrap gap-2 text-xs'>
                  {center.email && (
                    <a
                      href={`mailto:${center.email}`}
                      className='flex items-center text-blue-600 hover:text-blue-700'
                      title='Email'
                    >
                      <Link className='h-3 w-3 mr-1' />
                      Email
                    </a>
                  )}
                  {center.phone && (
                    <a
                      href={`tel:${center.phone}`}
                      className='flex items-center text-blue-600 hover:text-blue-700'
                      title='Phone'
                    >
                      <Link className='h-3 w-3 mr-1' />
                      Phone
                    </a>
                  )}
                  {center.website && (
                    <a
                      href={center.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center text-blue-600 hover:text-blue-700'
                      title='Website'
                    >
                      <Link className='h-3 w-3 mr-1' />
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
        <div className='hidden lg:block bg-white rounded-lg shadow-md overflow-hidden'>
          <Collapse
            ghost
            onChange={keys => setIsNearbyExpanded(keys.includes('nearby-desktop'))}
            items={[
              {
                key: 'nearby-desktop',
                label: (
                  <span className='text-lg font-semibold text-gray-900'>Nearby Dive Sites</span>
                ),
                children: (
                  <div className='space-y-2'>
                    {isNearbyLoading ? (
                      <div className='text-center py-4 text-gray-500'>Loading nearby sites...</div>
                    ) : nearbyDiveSites && nearbyDiveSites.length > 0 ? (
                      nearbyDiveSites.slice(0, 6).map(site => (
                        <button
                          key={site.id}
                          onClick={() => navigate(`/dive-sites/${site.id}/${slugify(site.name)}`)}
                          className='flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full'
                        >
                          <MapPin className='w-4 h-4 mr-2 flex-shrink-0 text-blue-600' />
                          <div className='min-w-0 flex-1'>
                            <div className='font-medium text-gray-900 text-sm truncate'>
                              {site.name}
                            </div>
                            <div className='text-xs text-gray-500'>{site.distance_km} km away</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className='text-center py-4 text-gray-500'>
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
