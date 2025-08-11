import { MapPin, Phone, Mail, Globe, Navigation, Eye, Heart } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { getParsedTrip, getDiveSite, getDivingCenter } from '../api';
import MaskedEmail from '../components/MaskedEmail';
import TripHeader from '../components/TripHeader';
const TripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  // Fetch trip data
  const {
    data: trip,
    isLoading: tripLoading,
    error: tripError,
  } = useQuery(['parsedTrip', id], () => getParsedTrip(id), {
    enabled: !!id,
    retry: 1,
  });
  // Fetch dive site data if trip has dive sites
  const { data: diveSite } = useQuery(
    ['diveSite', trip?.dive_site_id],
    () => getDiveSite(trip?.dive_site_id),
    {
      enabled: !!trip?.dive_site_id,
      retry: 1,
    }
  );
  // Fetch diving center data
  const { data: divingCenter } = useQuery(
    ['divingCenter', trip?.diving_center_id],
    () => getDivingCenter(trip?.diving_center_id),
    {
      enabled: !!trip?.diving_center_id,
      retry: 1,
    }
  );
  if (tripLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }
  if (tripError) {
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
    return (
      <div className='text-center py-8'>
        <div className='text-gray-600 text-lg mb-4'>Trip not found</div>
        <button
          onClick={() => navigate('/dive-trips')}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
        >
          Back to Trips
        </button>
      </div>
    );
  }
  return (
    <div className='max-w-6xl mx-auto'>
      <TripHeader trip={trip} />
      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>
            {[
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'dive-sites', label: 'Dive Sites', icon: MapPin },
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
              <div>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>Trip Description</h3>
                <p className='text-gray-700 leading-relaxed'>
                  {trip.description || 'Detailed trip description will be available soon.'}
                </p>
              </div>
              {trip.requirements && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>Requirements</h3>
                  <p className='text-gray-700 leading-relaxed'>{trip.requirements}</p>
                </div>
              )}
              {trip.included_services && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>What&apos;s Included</h3>
                  <p className='text-gray-700 leading-relaxed'>{trip.included_services}</p>
                </div>
              )}
              {trip.additional_info && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                    Additional Information
                  </h3>
                  <p className='text-gray-700 leading-relaxed'>{trip.additional_info}</p>
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
                            {diveSite.description || 'No description available'}
                          </p>
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
                        {divingCenter.description || 'Professional diving center'}
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
                          href={`mailto:${divingCenter.email}?subject=Booking Inquiry: ${trip.trip_name || 'Dive Trip'}`}
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
