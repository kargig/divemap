import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Euro,
  Filter,
  Calendar as CalendarIcon,
  Map,
  Building,
  LogIn,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getParsedTrips } from '../api';
import DiveMap from '../components/DiveMap';

const DiveTrips = () => {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    diving_center_id: '',
    dive_site_id: '',
    trip_status: '',
  });
  const [showDateFilterMessage, setShowDateFilterMessage] = useState(false);

  // Query for parsed trips
  const {
    data: trips,
    isLoading,
    error,
  } = useQuery(
    ['parsedTrips', filters],
    () => {
      // Only include filters that have actual values
      const validFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          validFilters[key] = value;
        }
      });
      return getParsedTrips(validFilters);
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Sort trips by date (newest/future first)
  const sortedTrips = trips
    ? [...trips].sort((a, b) => {
        const dateA = new Date(a.trip_date);
        const dateB = new Date(b.trip_date);
        return dateB - dateA; // Descending order (newest first)
      })
    : [];

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      diving_center_id: '',
      dive_site_id: '',
      trip_status: '',
    });
  };

  const handleDateClick = dateString => {
    // Convert the date to YYYY-MM-DD format for the filter
    const date = new Date(dateString);
    const formattedDate = date.toISOString().split('T')[0];

    // Set both start and end date to the same date to filter for that specific date
    setFilters(prev => ({
      ...prev,
      start_date: formattedDate,
      end_date: formattedDate,
    }));

    // Show confirmation message
    setShowDateFilterMessage(true);
    setTimeout(() => setShowDateFilterMessage(false), 3000); // Hide after 3 seconds
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const formattedDate = date.toLocaleDateString('en-US', options);
    const shortDate = date.toLocaleDateString('en-GB');
    return `${formattedDate} (${shortDate})`;
  };

  const formatTime = timeString => {
    if (!timeString) return 'N/A';
    return timeString.substring(0, 5); // Extract HH:MM from HH:MM:SS
  };

  const formatCurrency = (price, currency = 'EUR') => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const getStatusColor = status => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Function to determine the display status based on trip date
  const getDisplayStatus = trip => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    const tripDate = new Date(trip.trip_date);
    tripDate.setHours(0, 0, 0, 0);

    // If the trip date is in the past and status is 'scheduled', show 'completed'
    if (tripDate < today && trip.trip_status === 'scheduled') {
      return 'completed';
    }

    return trip.trip_status;
  };

  // Prepare map data for dive trips
  const mapData =
    sortedTrips?.map(trip => ({
      id: trip.id,
      name: trip.diving_center_name || 'Unknown Center',
      description: trip.trip_description || '',
      latitude: trip.diving_center?.latitude || 0,
      longitude: trip.diving_center?.longitude || 0,
      type: 'diving_center',
      trip_date: trip.trip_date,
      trip_time: trip.trip_time,
      trip_price: trip.trip_price,
      trip_currency: trip.trip_currency,
      trip_status: getDisplayStatus(trip),
    })) || [];

  // Check if error is a 403 Forbidden (authentication required)
  const isAuthError = error?.response?.status === 403;

  return (
    <div className='max-w-6xl mx-auto p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Dive Trips</h1>
        <p className='text-gray-600 mt-2'>Discover upcoming dive trips from local diving centers</p>
      </div>

      {/* Authentication Required Message */}
      {isAuthError && (
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6'>
          <div className='flex items-center'>
            <LogIn className='h-8 w-8 text-blue-600 mr-4' />
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-blue-900 mb-2'>Login Required</h3>
              <p className='text-blue-700 mb-4'>
                To view dive trips and discover upcoming diving adventures, please log in to your
                account.
              </p>
              <div className='flex space-x-3'>
                <Link
                  to='/login'
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter Confirmation Message */}
      {showDateFilterMessage && (
        <div className='mb-4 bg-green-50 border border-green-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <Calendar className='h-5 w-5 text-green-600 mr-2' />
            <span className='text-green-800'>
              Date filter applied! Showing trips for the selected date.
            </span>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className='flex justify-between items-center mb-6'>
        <div className='flex space-x-2'>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center px-4 py-2 rounded-md ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CalendarIcon className='h-4 w-4 mr-2' />
            List View
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center px-4 py-2 rounded-md ${
              viewMode === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Map className='h-4 w-4 mr-2' />
            Map View
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center mb-4'>
          <Filter className='h-5 w-5 text-gray-600 mr-2' />
          <h3 className='text-lg font-semibold text-gray-900'>Filters</h3>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          <div>
            <label htmlFor='start-date' className='block text-sm font-medium text-gray-700 mb-1'>
              Start Date
            </label>
            <input
              id='start-date'
              type='date'
              value={filters.start_date}
              onChange={e => handleFilterChange('start_date', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label htmlFor='end-date' className='block text-sm font-medium text-gray-700 mb-1'>
              End Date
            </label>
            <input
              id='end-date'
              type='date'
              value={filters.end_date}
              onChange={e => handleFilterChange('end_date', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label htmlFor='trip-status' className='block text-sm font-medium text-gray-700 mb-1'>
              Status
            </label>
            <select
              id='trip-status'
              value={filters.trip_status}
              onChange={e => handleFilterChange('trip_status', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Statuses</option>
              <option value='scheduled'>Scheduled</option>
              <option value='confirmed'>Confirmed</option>
              <option value='cancelled'>Cancelled</option>
              <option value='completed'>Completed</option>
            </select>
          </div>
        </div>

        <div className='mt-4 flex items-center justify-between'>
          <button
            onClick={clearFilters}
            className='px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md'
          >
            Clear Filters
          </button>
          {(filters.start_date || filters.end_date) && (
            <div className='flex items-center text-sm text-blue-600'>
              <Calendar className='h-4 w-4 mr-1' />
              <span>
                Filtered by date:{' '}
                {filters.start_date === filters.end_date
                  ? new Date(filters.start_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : `${filters.start_date} to ${filters.end_date}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className='text-center py-12'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='text-gray-600 mt-2'>Loading dive trips...</p>
        </div>
      )}

      {error && !isAuthError && (
        <div className='text-center py-12'>
          <p className='text-red-600'>Error loading dive trips</p>
        </div>
      )}

      {sortedTrips && sortedTrips.length === 0 && !isAuthError && (
        <div className='text-center py-12'>
          <Calendar className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <p className='text-gray-600'>No dive trips found</p>
        </div>
      )}

      {viewMode === 'list' && sortedTrips && sortedTrips.length > 0 && !isAuthError && (
        <div className='space-y-4'>
          {sortedTrips.map(trip => (
            <div
              key={trip.id}
              className='bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow'
            >
              <div className='flex justify-between items-start mb-4'>
                <div>
                  <div className='flex items-center space-x-2 mb-2'>
                    <Building className='h-4 w-4 text-blue-600' />
                    {trip.diving_center_id ? (
                      <Link
                        to={`/diving-centers/${trip.diving_center_id}`}
                        className='text-xl font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors'
                      >
                        {trip.diving_center_name || 'Unknown Center'}
                      </Link>
                    ) : (
                      <h3 className='text-xl font-semibold text-gray-900'>
                        {trip.diving_center_name || 'Unknown Center'}
                      </h3>
                    )}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-sm rounded-full ${getStatusColor(getDisplayStatus(trip))}`}
                >
                  {getDisplayStatus(trip)}
                </span>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
                <div className='flex items-center text-gray-600'>
                  <Calendar className='h-4 w-4 mr-2' />
                  <button
                    onClick={() => handleDateClick(trip.trip_date)}
                    className='text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors border border-transparent hover:border-blue-300 rounded px-1 py-0.5 flex items-center'
                    title='Click to filter by this date'
                  >
                    {formatDate(trip.trip_date)}
                    <Filter className='h-3 w-3 ml-1 opacity-60' />
                  </button>
                </div>

                <div className='flex items-center text-gray-600'>
                  <Clock className='h-4 w-4 mr-2' />
                  <span>{formatTime(trip.trip_time)}</span>
                </div>

                {trip.trip_duration && (
                  <div className='flex items-center text-gray-600'>
                    <Clock className='h-4 w-4 mr-2' />
                    <span>{trip.trip_duration} min</span>
                  </div>
                )}

                {trip.trip_price && (
                  <div className='flex items-center text-gray-600'>
                    <Euro className='h-4 w-4 mr-2' />
                    <span>{formatCurrency(trip.trip_price, trip.trip_currency)}</span>
                  </div>
                )}

                {trip.group_size_limit && (
                  <div className='flex items-center text-gray-600'>
                    <Users className='h-4 w-4 mr-2' />
                    <span>Max {trip.group_size_limit} people</span>
                  </div>
                )}
              </div>

              {/* Display multiple dives */}
              {trip.dives && trip.dives.length > 0 && (
                <div className='mb-4'>
                  <h4 className='text-sm font-medium text-gray-700 mb-2'>Dives:</h4>
                  <div className='space-y-2'>
                    {trip.dives.map((dive, index) => (
                      <div
                        key={dive.id}
                        className='flex items-center space-x-3 p-3 bg-blue-50 rounded'
                      >
                        <div className='flex items-center'>
                          <MapPin className='h-4 w-4 mr-2 text-blue-600' />
                          <span className='text-sm font-medium text-gray-700'>
                            Dive {dive.dive_number}:
                          </span>
                        </div>
                        <div className='flex-1'>
                          <span className='text-sm text-gray-600'>
                            {dive.dive_site_name ? (
                              dive.dive_site_id ? (
                                <Link
                                  to={`/dive-sites/${dive.dive_site_id}`}
                                  className='hover:text-blue-600 hover:underline transition-colors'
                                >
                                  {dive.dive_site_name}
                                </Link>
                              ) : (
                                dive.dive_site_name
                              )
                            ) : (
                              'No dive site specified'
                            )}
                          </span>
                          {dive.dive_time && (
                            <span className='text-sm text-gray-500 ml-2'>
                              at {formatTime(dive.dive_time)}
                            </span>
                          )}
                          {dive.dive_duration && (
                            <span className='text-sm text-gray-500 ml-2'>
                              ({dive.dive_duration} min)
                            </span>
                          )}
                        </div>
                        {dive.dive_description && (
                          <div className='text-xs text-gray-500 mt-1'>{dive.dive_description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback for old single dive site display */}
              {(!trip.dives || trip.dives.length === 0) && trip.dive_site_name && (
                <div className='mb-4'>
                  <div className='flex items-center space-x-3 p-3 bg-green-50 rounded'>
                    <MapPin className='h-4 w-4 text-green-600' />
                    <span className='text-sm font-medium text-gray-700'>Dive Site:</span>
                    <div className='flex-1'>
                      {trip.dive_site_id ? (
                        <Link
                          to={`/dive-sites/${trip.dive_site_id}`}
                          className='text-sm text-gray-600 hover:text-green-600 hover:underline transition-colors'
                        >
                          {trip.dive_site_name}
                        </Link>
                      ) : (
                        <span className='text-sm text-gray-600'>{trip.dive_site_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {trip.trip_description && (
                <p className='text-gray-700 mb-4'>{trip.trip_description}</p>
              )}

              {trip.special_requirements && (
                <div className='p-3 bg-yellow-50 rounded-md'>
                  <p className='text-sm text-yellow-800'>{trip.special_requirements}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'map' && sortedTrips && sortedTrips.length > 0 && !isAuthError && (
        <div className='bg-white rounded-lg shadow-md'>
          <DiveMap diveSites={[]} divingCenters={mapData} height='600px' showTripInfo={true} />
        </div>
      )}
    </div>
  );
};

export default DiveTrips;
