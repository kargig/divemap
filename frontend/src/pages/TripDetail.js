import { MapPin, Phone, Mail, Globe, Navigation, Eye, Heart, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';

import Breadcrumbs from '../components/Breadcrumbs';
import MaskedEmail from '../components/MaskedEmail';
import SEO from '../components/SEO';
import TripHeader from '../components/TripHeader';
import { useAuth } from '../contexts/AuthContext';
import { getDiveSite } from '../services/diveSites';
import { getDivingCenter } from '../services/divingCenters';
import { getParsedTrip } from '../services/newsletters';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

import NotFound from './NotFound';

const TripDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dive-sites');
  // Fetch trip data
  const {
    data: trip,
    isLoading: tripLoading,
    error: tripError,
  } = useQuery(['parsedTrip', id], () => getParsedTrip(id), {
    enabled: !!id,
    retry: (failureCount, error) => {
      if (error.response?.status === 404) return false;
      return failureCount < 1;
    },
  });

  // Redirect to canonical URL with slug
  useEffect(() => {
    if (trip) {
      const name = generateTripName(trip);
      const expectedSlug = slugify(name);
      if (!slug || slug !== expectedSlug) {
        navigate(`/dive-trips/${id}/${expectedSlug}${location.search}`, { replace: true });
      }
    }
  }, [trip, id, slug, navigate, location.search]);

  // Fetch dive site data if trip has dive sites
  const { data: diveSite } = useQuery(
    ['diveSite', trip?.dive_site_id],
    () => getDiveSite(trip?.dive_site_id),
    {
      enabled: !!trip?.dive_site_id,
      retry: (failureCount, error) => {
        if (error.response?.status === 404) return false;
        return failureCount < 1;
      },
    }
  );
  // Fetch diving center data
  const { data: divingCenter } = useQuery(
    ['divingCenter', trip?.diving_center_id],
    () => getDivingCenter(trip?.diving_center_id),
    {
      enabled: !!trip?.diving_center_id,
      retry: (failureCount, error) => {
        if (error.response?.status === 404) return false;
        return failureCount < 1;
      },
    }
  );

  const getMetaDescription = () => {
    if (!trip) return '';

    const tripName = generateTripName(trip);
    const date = new Date(trip.trip_date).toLocaleDateString();

    let desc = `Join the ${tripName} dive trip on ${date}.`;

    if (divingCenter) {
      desc += ` Organized by ${divingCenter.name}.`;
    }

    if (trip.dives && trip.dives.length > 0) {
      desc += ` Includes ${trip.dives.length} dives.`;
    }

    return desc;
  };

  const getSchema = () => {
    if (!trip) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: generateTripName(trip),
      startDate: trip.trip_date,
      description: decodeHtmlEntities(trip.trip_description) || getMetaDescription(),
      eventStatus: 'https://schema.org/EventScheduled',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: window.location.origin,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Dive Trips',
            item: `${window.location.origin}/dive-trips`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: generateTripName(trip),
            item: window.location.href,
          },
        ],
      },
    };

    if (divingCenter) {
      schema.organizer = {
        '@type': 'Organization',
        name: divingCenter.name,
        url: divingCenter.website,
      };
    }

    if (trip.dives && trip.dives.length > 0) {
      // If single location/site, use it. If multiple, maybe just pick first or generic
      // Schema.org Event location is usually singular.
      const firstLocation = trip.dives[0];
      if (firstLocation.dive_site_name) {
        schema.location = {
          '@type': 'Place',
          name: firstLocation.dive_site_name,
          address: {
            '@type': 'PostalAddress',
            addressCountry: firstLocation.country, // Assuming these fields exist or we'd need to fetch
          },
        };
      }
    }

    return schema;
  };

  if (tripLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }
  // Check if error is an authentication error (401 or 403)
  const isAuthError =
    tripError &&
    (tripError?.response?.status === 401 ||
      tripError?.response?.status === 403 ||
      tripError?.response?.data?.detail?.toLowerCase().includes('not authenticated') ||
      tripError?.response?.data?.detail?.toLowerCase().includes('authentication') ||
      tripError?.message?.includes('401') ||
      tripError?.message?.includes('403') ||
      tripError?.message?.toLowerCase().includes('not authenticated'));

  if (tripError && isAuthError) {
    return (
      <div className='max-w-6xl mx-auto px-4 py-12'>
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-8 shadow-lg'>
          <div className='flex items-start'>
            <LogIn className='h-8 w-8 text-blue-600 mr-4 flex-shrink-0 mt-1' />
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-blue-900 mb-2'>Login Required</h3>
              <p className='text-blue-700 mb-4'>
                To view dive trip details and access all information, please log in to your account.
              </p>
              <div className='flex space-x-3'>
                <Link
                  to='/login'
                  state={{ from: location.pathname }}
                  className='inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                >
                  <LogIn className='h-4 w-4 mr-2' />
                  Login
                </Link>
                <Link
                  to='/register'
                  className='inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
                >
                  Register
                </Link>
                <button
                  onClick={() => navigate('/dive-trips')}
                  className='inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors'
                >
                  Back to Trips
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tripError) {
    if (tripError.response?.status === 404) {
      return <NotFound />;
    }
    return (
      <div className='text-center py-8'>
        <div className='text-red-600 text-lg mb-4'>Error loading trip details</div>
        <button
          onClick={() => navigate('/dive-trips')}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
        >
          Back to Trips
        </button>
      </div>
    );
  }
  if (!trip) {
    return <NotFound />;
  }
  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {trip && (
        <SEO
          title={`Dive Trip - ${generateTripName(trip)}`}
          description={getMetaDescription()}
          type='event'
          siteName='Divemap'
          schema={getSchema()}
        />
      )}
      {trip && (
        <Breadcrumbs
          items={[{ label: 'Dive Trips', to: '/dive-trips' }, { label: generateTripName(trip) }]}
        />
      )}
      <TripHeader trip={trip} />
      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>
            {[
              { id: 'dive-sites', label: 'Dive Sites', icon: MapPin },
              { id: 'overview', label: 'Additional Info', icon: Eye },
              { id: 'diving-center', label: 'Diving Center', icon: Navigation },
              { id: 'booking', label: 'Booking', icon: Heart },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {/* Tab Content */}
        <div className='p-6'>
          {activeTab === 'overview' && (
            <div className='space-y-6'>
              {trip.special_requirements && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>Special Requirements</h3>
                  <p className='text-gray-700 leading-relaxed'>
                    {decodeHtmlEntities(trip.special_requirements)}
                  </p>
                </div>
              )}

              {trip.trip_duration && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>Trip Duration</h3>
                  <p className='text-gray-700 leading-relaxed'>
                    {Math.floor(trip.trip_duration / 60)} hours {trip.trip_duration % 60} minutes
                  </p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'dive-sites' && (
            <div className='space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Dive Sites</h3>
              {trip.dives && trip.dives.length > 0 ? (
                <div className='space-y-4'>
                  {trip.dives.map((dive, index) => (
                    <div
                      key={`dive-${trip.id}-${dive.dive_site_id || index}`}
                      className='bg-gray-50 rounded-lg p-4'
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <h4 className='font-medium text-gray-900'>
                          Dive {index + 1}:{' '}
                          {dive.dive_site_id ? (
                            <Link
                              to={`/dive-sites/${dive.dive_site_id}`}
                              state={{ from: window.location.pathname + window.location.search }}
                              className='text-blue-600 hover:text-blue-800 hover:underline transition-colors'
                            >
                              {dive.dive_site_name || 'Unnamed Site'}
                            </Link>
                          ) : (
                            dive.dive_site_name || 'Unnamed Site'
                          )}
                        </h4>
                        <span className='text-sm text-gray-500'>
                          {dive.depth ? `${dive.depth}m` : 'Depth TBD'}
                        </span>
                      </div>
                      {dive.dive_site_id && diveSite && (
                        <div className='text-sm text-gray-600'>
                          <p className='mb-2'>
                            {diveSite.description
                              ? renderTextWithLinks(decodeHtmlEntities(diveSite.description))
                              : 'No description available'}
                          </p>
                          {dive.dive_description && (
                            <p className='mb-2 text-gray-700'>
                              <strong>Dive Description:</strong>{' '}
                              {decodeHtmlEntities(dive.dive_description)}
                            </p>
                          )}
                          {dive.dive_duration && (
                            <p className='mb-2 text-gray-700'>
                              <strong>Duration:</strong> {dive.dive_duration} minutes
                            </p>
                          )}
                          <div className='flex items-center space-x-4 text-xs text-gray-500'>
                            {diveSite.country && <span>📍 {diveSite.country}</span>}
                            {diveSite.region && <span>🏛️ {diveSite.region}</span>}
                            {diveSite.max_depth && <span>🌊 {diveSite.max_depth}m</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-gray-500'>No dive sites information available for this trip.</p>
              )}
            </div>
          )}
          {activeTab === 'diving-center' && (
            <div className='space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Diving Center</h3>
              {divingCenter ? (
                <div className='bg-gray-50 rounded-lg p-6'>
                  <div className='flex items-start space-x-4'>
                    <div className='flex-1'>
                      <h4 className='text-xl font-semibold text-gray-900 mb-2'>
                        {divingCenter.name}
                      </h4>
                      <p className='text-gray-600 mb-4'>
                        {decodeHtmlEntities(divingCenter.description) ||
                          'Professional diving center'}
                      </p>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                        {divingCenter.phone && (
                          <div className='flex items-center space-x-2'>
                            <Phone className='w-4 h-4 text-gray-500' />
                            <span className='text-gray-700'>{divingCenter.phone}</span>
                          </div>
                        )}
                        {divingCenter.email && (
                          <div className='flex items-center space-x-2'>
                            <Mail className='w-4 h-4 text-gray-500' />
                            <MaskedEmail email={divingCenter.email} className='text-gray-700' />
                          </div>
                        )}
                        {divingCenter.website && (
                          <div className='flex items-center space-x-2'>
                            <Globe className='w-4 h-4 text-gray-500' />
                            <a
                              href={divingCenter.website}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-600 hover:text-blue-800'
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                        {divingCenter.address && (
                          <div className='flex items-start space-x-2'>
                            <MapPin className='w-4 h-4 text-gray-500 mt-0.5' />
                            <span className='text-gray-700'>{divingCenter.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {divingCenter.logo_url && (
                      <div className='w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0'>
                        <img
                          src={divingCenter.logo_url}
                          alt={divingCenter.name}
                          className='w-full h-full object-cover rounded-lg'
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className='text-gray-500'>Diving center information not available.</p>
              )}
            </div>
          )}
          {activeTab === 'booking' && (
            <div className='space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Book This Trip</h3>
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-6'>
                <div className='text-center'>
                  <h4 className='text-lg font-medium text-blue-900 mb-2'>Ready to Book?</h4>
                  <p className='text-blue-700 mb-4'>
                    Contact the diving center directly to book this trip and get more information.
                  </p>
                  {divingCenter ? (
                    <div className='space-y-3'>
                      {divingCenter.phone && (
                        <a
                          href={`tel:${divingCenter.phone}`}
                          className='inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors'
                        >
                          <Phone className='w-4 h-4' />
                          <span>Call {divingCenter.name}</span>
                        </a>
                      )}
                      {divingCenter.email && (
                        <a
                          href={`mailto:${divingCenter.email}?subject=Booking Inquiry: ${generateTripName(trip)}`}
                          className='inline-flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors'
                        >
                          <Mail className='w-4 h-4' />
                          <span>Email Inquiry</span>
                        </a>
                      )}
                      {divingCenter.website && (
                        <a
                          href={divingCenter.website}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors'
                        >
                          <Globe className='w-4 h-4' />
                          <span>Visit Website</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className='text-blue-600'>
                      Please contact the diving center for booking information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Related Trips Section */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4'>Related Trips</h3>
        <p className='text-gray-600 mb-4'>
          Discover more diving adventures from this center or similar destinations.
        </p>
        <button
          onClick={() => navigate('/dive-trips')}
          className='bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors'
        >
          Browse All Trips
        </button>
      </div>
    </div>
  );
};
export default TripDetail;
