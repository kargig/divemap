import {
  AlertTriangle,
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
  Search,
  Tag,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getParsedTrips, getDivingCenters, getDiveSites } from '../api';
import DiveMap from '../components/DiveMap';
import RateLimitError from '../components/RateLimitError';
import { useAuth } from '../contexts/AuthContext';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getSortOptions } from '../utils/sortOptions';

// Helper function to determine display status based on trip date
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

// Helper function to prepare map data for dive trips
const prepareMapData = (sortedTrips, getDisplayStatus) => {
  return (
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
    })) || []
  );
};

const DiveTrips = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    diving_center_id: '',
    dive_site_id: '',
    trip_status: '',
    min_price: '',
    max_price: '',
    difficulty_level: '',
    search_query: '',
    location_query: '',
  });
  const [sortOptions, setSortOptions] = useState({
    sort_by: 'trip_date',
    sort_order: 'desc',
  });

  // Get sort options based on user permissions
  const getAvailableSortOptions = () => {
    return getSortOptions('dive-trips', user?.is_admin);
  };
  const [userLocation, setUserLocation] = useState({
    latitude: null,
    longitude: null,
  });
  const [showDateFilterMessage, setShowDateFilterMessage] = useState(false);

  // Get user location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  // Function to get user's current location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          // Set default location (e.g., Athens, Greece)
          setUserLocation({
            latitude: 37.9838,
            longitude: 23.7275,
          });
        }
      );
    } else {
      // Fallback to default location
      setUserLocation({
        latitude: 37.9838,
        longitude: 23.7275,
      });
    }
  };

  // Query for parsed trips
  const {
    data: trips,
    isLoading,
    error,
  } = useQuery(
    ['parsedTrips', filters, sortOptions, userLocation],
    () => {
      // Only include filters that have actual values
      const validFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          validFilters[key] = value;
        }
      });

      // Add sorting parameters
      const params = {
        ...validFilters,
        sort_by: sortOptions.sort_by,
        sort_order: sortOptions.sort_order,
      };

      // Add user location for distance sorting
      if (sortOptions.sort_by === 'distance' && userLocation.latitude && userLocation.longitude) {
        params.user_lat = userLocation.latitude;
        params.user_lon = userLocation.longitude;
      }

      return getParsedTrips(params);
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Query for diving centers and dive sites for filters
  const { data: divingCenters = [], error: divingCentersError } = useQuery(
    ['diving-centers'],
    () => getDivingCenters({ page_size: 100 }),
    {
      staleTime: 300000, // 5 minutes
    }
  );

  const { data: diveSites = [], error: diveSitesError } = useQuery(
    ['dive-sites'],
    () => getDiveSites({ page_size: 100 }),
    {
      staleTime: 300000, // 5 minutes
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    if (error) {
      handleRateLimitError(error, 'dive trips', () => window.location.reload());
    }
  }, [error]);

  useEffect(() => {
    if (divingCentersError) {
      handleRateLimitError(divingCentersError, 'diving centers', () => window.location.reload());
    }
  }, [divingCentersError]);

  useEffect(() => {
    if (diveSitesError) {
      handleRateLimitError(diveSitesError, 'dive sites', () => window.location.reload());
    }
  }, [diveSitesError]);

  // Sort trips by date (newest/future first)
  const sortedTrips = trips
    ? [...trips].sort((a, b) => {
        const dateA = new Date(a.trip_date);
        const dateB = new Date(b.trip_date);
        return dateB - dateA; // Descending order (newest first)
      })
    : [];

  // Group trips by date
  const groupedTrips = sortedTrips.reduce((groups, trip) => {
    const dateKey = trip.trip_date;
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(trip);
    return groups;
  }, {});

  // Sort date groups (newest first)
  const sortedDateGroups = Object.entries(groupedTrips).sort(([dateA], [dateB]) => {
    return new Date(dateB) - new Date(dateA);
  });

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
      min_price: '',
      max_price: '',
      difficulty_level: '',
      search_query: '',
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

  const formatDateHeader = dateString => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const formattedDate = date.toLocaleDateString('en-US', options);

    let headerText = formattedDate;
    if (isToday) {
      headerText += ' (Today)';
    } else if (isTomorrow) {
      headerText += ' (Tomorrow)';
    }

    return headerText;
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
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'today':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // getDifficultyColor function is now replaced by getDifficultyColorClasses from difficultyHelpers

  // Prepare map data for dive trips
  const mapData = prepareMapData(sortedTrips, getDisplayStatus);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className='max-w-6xl mx-auto p-3 sm:p-6'>
        <div className='flex items-center justify-center min-h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p className='text-gray-600'>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show only the login message
  if (!user) {
    return (
      <div className='max-w-6xl mx-auto p-3 sm:p-6'>
        <div className='mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>Dive Trips</h1>
          <p className='text-gray-600 mt-2 text-sm sm:text-base'>
            Discover upcoming dive trips from local diving centers
          </p>
        </div>

        {/* Authentication Required Message */}
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
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto p-3 sm:p-6'>
      <div className='mb-6 sm:mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Dive Trips</h1>
        <p className='text-gray-600 mt-2 text-sm sm:text-base'>
          Discover upcoming dive trips from local diving centers
        </p>
      </div>

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
        <div className='flex space-x-2 w-full sm:w-auto'>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CalendarIcon className='h-4 w-4 mr-2 flex-shrink-0' />
            <span className='hidden sm:inline'>List View</span>
            <span className='sm:hidden'>List</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base ${
              viewMode === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Map className='h-4 w-4 mr-2 flex-shrink-0' />
            <span className='hidden sm:inline'>Map View</span>
            <span className='sm:hidden'>Map</span>
          </button>
        </div>
      </div>

      {/* API Errors for Filter Data */}
      {(divingCentersError || diveSitesError) && (
        <div className='mb-6'>
          {divingCentersError?.isRateLimited && (
            <RateLimitError
              retryAfter={divingCentersError.retryAfter}
              onRetry={() => window.location.reload()}
              className='mb-4'
            />
          )}
          {diveSitesError?.isRateLimited && (
            <RateLimitError
              retryAfter={diveSitesError.retryAfter}
              onRetry={() => window.location.reload()}
            />
          )}
        </div>
      )}

      {/* Enhanced Filters */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center mb-4'>
          <Filter className='h-5 w-5 text-gray-600 mr-2' />
          <h3 className='text-lg font-semibold text-gray-900'>Filters</h3>
        </div>

        {/* Search Query */}
        <div className='mb-4'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search trips by description, dive site, diving center, or special requirements...'
              value={filters.search_query}
              onChange={e => handleFilterChange('search_query', e.target.value)}
              className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'
            />
          </div>

          {/* Search Tips */}
          <div className='mt-2 text-sm text-gray-500'>
            💡 Search tips: Try searching for specific dive sites, diving centers, trip types, or
            requirements
          </div>
        </div>

        {/* Location Search */}
        <div className='mb-4'>
          <div className='relative'>
            <MapPin className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search by location, country, or region...'
              value={filters.location_query}
              onChange={e => handleFilterChange('location_query', e.target.value)}
              className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'
            />
          </div>

          {/* Location Search Tips */}
          <div className='mt-2 text-sm text-gray-500'>
            🌍 Location tips: Search for countries (e.g., &quot;Spain&quot;), regions (e.g.,
            &quot;Mediterranean&quot;), or specific areas
          </div>
        </div>

        {/* User Location for Distance Sorting */}
        <div className='mb-4'>
          <div className='flex items-center justify-between mb-2'>
            <label
              htmlFor='user-location-label'
              className='block text-sm font-medium text-gray-700'
            >
              Your Location (for distance sorting)
            </label>
            <button
              onClick={getUserLocation}
              className='text-sm text-blue-600 hover:text-blue-800 underline'
            >
              Use Current Location
            </button>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label htmlFor='latitude-input' className='block text-xs text-gray-500 mb-1'>
                Latitude
              </label>
              <input
                id='latitude-input'
                type='number'
                step='any'
                placeholder='e.g., 37.9838'
                value={userLocation.latitude || ''}
                onChange={e =>
                  setUserLocation(prev => ({
                    ...prev,
                    latitude: parseFloat(e.target.value) || null,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>
            <div>
              <label htmlFor='longitude-input' className='block text-xs text-gray-500 mb-1'>
                Longitude
              </label>
              <input
                id='longitude-input'
                type='number'
                step='any'
                placeholder='e.g., 23.7275'
                value={userLocation.longitude || ''}
                onChange={e =>
                  setUserLocation(prev => ({
                    ...prev,
                    longitude: parseFloat(e.target.value) || null,
                  }))
                }
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 text-sm'
              />
            </div>
          </div>

          <div className='mt-2 text-sm text-gray-500'>
            📍 Set your location to enable distance-based sorting. Click &quot;Use Current
            Location&quot; to automatically detect your position.
          </div>
        </div>

        {/* Responsive Filter Grid - Better mobile layout */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          <div>
            <label
              htmlFor='start-date-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Start Date
            </label>
            <input
              id='start-date-filter'
              type='date'
              value={filters.start_date}
              onChange={e => handleFilterChange('start_date', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label
              htmlFor='end-date-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              End Date
            </label>
            <input
              id='end-date-filter'
              type='date'
              value={filters.end_date}
              onChange={e => handleFilterChange('end_date', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label
              htmlFor='diving-center-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Diving Center
            </label>
            <select
              id='diving-center-filter'
              value={filters.diving_center_id}
              onChange={e => handleFilterChange('diving_center_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Centers</option>
              {divingCenters.map(center => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor='dive-site-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Dive Site
            </label>
            <select
              id='dive-site-filter'
              value={filters.dive_site_id}
              onChange={e => handleFilterChange('dive_site_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Sites</option>
              {diveSites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor='trip-status-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Status
            </label>
            <select
              id='trip-status-filter'
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

          <div>
            <label
              htmlFor='min-price-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Min Price
            </label>
            <div className='relative'>
              <Euro className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                id='min-price-filter'
                type='number'
                placeholder='0'
                value={filters.min_price}
                onChange={e => handleFilterChange('min_price', e.target.value)}
                className='w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='max-price-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Max Price
            </label>
            <div className='relative'>
              <Euro className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                id='max-price-filter'
                type='number'
                placeholder='1000'
                value={filters.max_price}
                onChange={e => handleFilterChange('max_price', e.target.value)}
                className='w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='difficulty-filter'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Difficulty Level
            </label>
            <select
              id='difficulty-filter'
              value={filters.difficulty_level}
              onChange={e => handleFilterChange('difficulty_level', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All Levels</option>
              <option value='beginner'>Beginner</option>
              <option value='intermediate'>Intermediate</option>
              <option value='advanced'>Advanced</option>
              <option value='expert'>Expert</option>
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

      {/* Sorting Controls */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center mb-4'>
          <Tag className='h-5 w-5 text-gray-600 mr-2' />
          <h3 className='text-lg font-semibold text-gray-900'>Sort & Organize</h3>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
          <div>
            <label
              htmlFor='sort-by-select'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Sort By
            </label>
            <select
              id='sort-by-select'
              value={sortOptions.sort_by}
              onChange={e => setSortOptions(prev => ({ ...prev, sort_by: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {getAvailableSortOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor='sort-order-select'
              className='block text-sm font-medium text-gray-700 mb-1'
            >
              Sort Order
            </label>
            <select
              id='sort-order-select'
              value={sortOptions.sort_order}
              onChange={e => setSortOptions(prev => ({ ...prev, sort_order: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='desc'>Newest/High to Low</option>
              <option value='asc'>Oldest/Low to High</option>
            </select>
          </div>

          <div className='flex items-end'>
            <button
              onClick={() => setSortOptions({ sort_by: 'trip_date', sort_order: 'desc' })}
              className='w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors'
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Sort Description */}
        <div className='mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200'>
          <div className='flex items-center text-sm text-blue-700'>
            <Tag className='h-4 w-4 mr-2 flex-shrink-0' />
            <span>
              Currently sorting by{' '}
              <strong>
                {sortOptions.sort_by === 'popularity'
                  ? 'Popularity'
                  : sortOptions.sort_by === 'distance'
                    ? 'Distance'
                    : sortOptions.sort_by.replace('_', ' ')}
              </strong>{' '}
              in <strong>{sortOptions.sort_order === 'desc' ? 'descending' : 'ascending'}</strong>{' '}
              order
              {sortOptions.sort_by === 'distance' &&
                userLocation.latitude &&
                userLocation.longitude && (
                  <span className='ml-2 text-blue-600'>
                    from your location ({userLocation.latitude.toFixed(4)},{' '}
                    {userLocation.longitude.toFixed(4)})
                  </span>
                )}
            </span>
          </div>
        </div>

        {/* Distance Sorting Warning */}
        {sortOptions.sort_by === 'distance' &&
          (!userLocation.latitude || !userLocation.longitude) && (
            <div className='mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200'>
              <div className='flex items-center text-sm text-yellow-700'>
                <AlertTriangle className='h-4 w-4 mr-2 flex-shrink-0' />
                <span>
                  <strong>Distance sorting selected but no location set.</strong> Please set your
                  location coordinates above to enable distance-based sorting.
                </span>
              </div>
            </div>
          )}
      </div>

      {/* Content */}
      {isLoading && (
        <div className='text-center py-12'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
          <p className='text-gray-600 mt-2'>Loading dive trips...</p>
        </div>
      )}

      {error && (
        <div className='py-6'>
          {error.isRateLimited ? (
            <RateLimitError
              retryAfter={error.retryAfter}
              onRetry={() => {
                // Refetch the query when user clicks retry
                window.location.reload();
              }}
            />
          ) : (
            <div className='text-center py-12'>
              <p className='text-red-600'>Error loading dive trips</p>
              <p className='text-sm text-gray-500 mt-2'>
                {error.response?.data?.detail || error.message || 'An unexpected error occurred'}
              </p>
            </div>
          )}
        </div>
      )}

      {sortedTrips && sortedTrips.length === 0 && (
        <div className='text-center py-12'>
          <Search className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>No dive trips found</h3>

          {/* Check if any filters are active */}
          {Object.values(filters).some(value => value && value.trim() !== '') && (
            <div className='max-w-md mx-auto'>
              <p className='text-gray-600 mb-4'>
                No trips match your current search criteria. Try adjusting your filters:
              </p>
              <div className='space-y-2 text-sm text-gray-500'>
                {filters.search_query && <p>• Try different search terms or check spelling</p>}
                {filters.location_query && <p>• Try a different location or region</p>}
                {filters.start_date && filters.end_date && <p>• Expand your date range</p>}
                {filters.min_price && filters.max_price && <p>• Adjust your price range</p>}
                {filters.diving_center_id && <p>• Try a different diving center</p>}
                {filters.dive_site_id && <p>• Try a different dive site</p>}
                {filters.difficulty_level && <p>• Try a different difficulty level</p>}
              </div>
              <button
                onClick={clearFilters}
                className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* No filters active */}
          {!Object.values(filters).some(value => value && value.trim() !== '') && (
            <p className='text-gray-600'>
              There are currently no dive trips available. Check back later for new trips!
            </p>
          )}
        </div>
      )}

      {viewMode === 'list' && sortedTrips && sortedTrips.length > 0 && (
        <div className='space-y-8'>
          {/* Search Results Summary */}
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center mb-2 sm:mb-0'>
                <Search className='h-5 w-5 text-blue-600 mr-2' />
                <span className='text-blue-800 font-medium'>
                  Found {sortedTrips.length} trip{sortedTrips.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Active Filters Display */}
              <div className='flex flex-wrap gap-2'>
                {filters.search_query && (
                  <span className='inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full'>
                    Search: &quot;{filters.search_query}&quot;
                  </span>
                )}
                {filters.location_query && (
                  <span className='inline-flex items-center px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-full'>
                    Location: &quot;{filters.location_query}&quot;
                  </span>
                )}
                {filters.start_date && (
                  <span className='inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full'>
                    From: {filters.start_date}
                  </span>
                )}
                {filters.end_date && (
                  <span className='inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full'>
                    To: {filters.end_date}
                  </span>
                )}
                {filters.diving_center_id && (
                  <span className='inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full'>
                    Center:{' '}
                    {divingCenters.find(c => c.id == filters.diving_center_id)?.name || 'Unknown'}
                  </span>
                )}
                {filters.dive_site_id && (
                  <span className='inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full'>
                    Site: {diveSites.find(s => s.id == filters.dive_site_id)?.name || 'Unknown'}
                  </span>
                )}
                {filters.min_price && (
                  <span className='inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full'>
                    Min: €{filters.min_price}
                  </span>
                )}
                {filters.max_price && (
                  <span className='inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full'>
                    Max: €{filters.max_price}
                  </span>
                )}
                {filters.difficulty_level && (
                  <span className='inline-flex items-center px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full'>
                    Level: {filters.difficulty_level}
                  </span>
                )}
              </div>
            </div>
          </div>

          {sortedDateGroups.map(([dateKey, tripsForDate]) => (
            <div key={dateKey} className='space-y-4'>
              {/* Date Header */}
              <div className='flex items-center space-x-3'>
                <div className='flex items-center space-x-2'>
                  <Calendar className='h-6 w-6 text-blue-600' />
                  <h2 className='text-xl font-bold text-gray-900'>{formatDateHeader(dateKey)}</h2>
                </div>
                <div className='flex-1 border-t border-gray-300'></div>
                <span className='text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full'>
                  {tripsForDate.length} trip{tripsForDate.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Trips for this date */}
              <div className='space-y-4'>
                {tripsForDate.map(trip => (
                  <div
                    key={trip.id}
                    className='bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 hover:shadow-lg hover:shadow-xl transition-all duration-200 hover:border-blue-300 cursor-pointer hover:scale-[1.02]'
                    onClick={() => navigate(`/dive-trips/${trip.id}`)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/dive-trips/${trip.id}`);
                      }
                    }}
                    tabIndex={0}
                    role='button'
                    aria-label={`View details for ${trip.trip_name || 'dive trip'} from ${trip.diving_center_name || 'diving center'}`}
                  >
                    {/* Trip Header with Enhanced Layout and Image Support */}
                    <div className='flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 gap-4'>
                      {/* Left side with image and basic info */}
                      <div className='flex flex-col sm:flex-row gap-4 flex-1'>
                        {/* Trip Image/Thumbnail */}
                        <div className='flex-shrink-0'>
                          <div className='w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center border border-blue-300'>
                            {trip.trip_image_url ? (
                              <img
                                src={trip.trip_image_url}
                                alt={trip.trip_name || 'Dive Trip'}
                                className='w-full h-full object-cover rounded-lg'
                                onError={e => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className={`flex flex-col items-center justify-center text-blue-600 ${trip.trip_image_url ? 'hidden' : 'flex'}`}
                            >
                              <MapPin className='h-8 w-8 mb-1' />
                              <span className='text-xs text-center font-medium'>Trip</span>
                            </div>
                          </div>
                        </div>

                        {/* Trip Info */}
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center space-x-2 mb-3'>
                            <Building className='h-5 w-5 text-blue-600 flex-shrink-0' />
                            {trip.diving_center_id ? (
                              <Link
                                to={`/diving-centers/${trip.diving_center_id}`}
                                className='text-lg sm:text-xl font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate'
                              >
                                {trip.diving_center_name || 'Unknown Center'}
                              </Link>
                            ) : (
                              <h3 className='text-lg sm:text-xl font-semibold text-gray-900 truncate'>
                                {trip.diving_center_name || 'Unknown Center'}
                              </h3>
                            )}
                          </div>

                          {/* Trip Title and Description */}
                          {trip.trip_name && (
                            <h4 className='text-base sm:text-lg font-medium text-gray-800 mb-2 line-clamp-2'>
                              {trip.trip_name}
                            </h4>
                          )}

                          {trip.trip_description && (
                            <p className='text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3'>
                              {trip.trip_description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status and Difficulty Badges */}
                      <div className='flex flex-col items-start lg:items-end space-y-2 flex-shrink-0'>
                        <span
                          className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(getDisplayStatus(trip))}`}
                        >
                          {getDisplayStatus(trip)}
                        </span>

                        {trip.difficulty_level && (
                          <span
                            className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColorClasses(trip.difficulty_level)}`}
                          >
                            {getDifficultyLabel(trip.difficulty_level)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Trip Details Grid - Mobile Responsive */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6'>
                      <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                        <Calendar className='h-4 w-4 mr-3 text-blue-600 flex-shrink-0' />
                        <div className='min-w-0'>
                          <div className='text-xs text-gray-500 uppercase tracking-wide'>Date</div>
                          <button
                            onClick={() => handleDateClick(trip.trip_date)}
                            className='text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors font-medium text-sm truncate block w-full text-left'
                            title='Click to filter by this date'
                          >
                            {formatDate(trip.trip_date)}
                          </button>
                        </div>
                      </div>

                      <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                        <Clock className='h-4 w-4 mr-3 text-green-600 flex-shrink-0' />
                        <div className='min-w-0'>
                          <div className='text-xs text-gray-500 uppercase tracking-wide'>Time</div>
                          <span className='font-medium text-sm'>{formatTime(trip.trip_time)}</span>
                        </div>
                      </div>

                      {trip.trip_duration && (
                        <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                          <Clock className='h-4 w-4 mr-3 text-purple-600 flex-shrink-0' />
                          <div className='min-w-0'>
                            <div className='text-xs text-gray-500 uppercase tracking-wide'>
                              Duration
                            </div>
                            <span className='font-medium text-sm'>{trip.trip_duration} min</span>
                          </div>
                        </div>
                      )}

                      {trip.trip_price && (
                        <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                          <Euro className='h-4 w-4 mr-3 text-green-600 flex-shrink-0' />
                          <div className='min-w-0'>
                            <div className='text-xs text-gray-500 uppercase tracking-wide'>
                              Price
                            </div>
                            <span className='font-medium text-base sm:text-lg'>
                              {formatCurrency(trip.trip_price, trip.trip_currency)}
                            </span>
                          </div>
                        </div>
                      )}

                      {trip.group_size_limit && (
                        <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                          <Users className='h-4 w-4 mr-3 text-orange-600 flex-shrink-0' />
                          <div className='min-w-0'>
                            <div className='text-xs text-gray-500 uppercase tracking-wide'>
                              Group Size
                            </div>
                            <span className='font-medium text-sm'>
                              Max {trip.group_size_limit} people
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Additional trip details can be added here */}
                      {trip.trip_type && (
                        <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                          <Tag className='h-4 w-4 mr-3 text-indigo-600 flex-shrink-0' />
                          <div className='min-w-0'>
                            <div className='text-xs text-gray-500 uppercase tracking-wide'>
                              Type
                            </div>
                            <span className='font-medium text-sm'>{trip.trip_type}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Dives Display - Mobile Responsive */}
                    {trip.dives && trip.dives.length > 0 && (
                      <div className='mb-6'>
                        <h4 className='text-sm font-semibold text-gray-700 mb-3 flex items-center'>
                          <MapPin className='h-4 w-4 mr-2 text-blue-600 flex-shrink-0' />
                          Dive Sites ({trip.dives.length})
                        </h4>
                        <div className='space-y-3'>
                          {trip.dives.map((dive, index) => (
                            <div
                              key={dive.id}
                              className='flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200'
                            >
                              <div className='flex items-center space-x-3'>
                                <div className='flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full flex-shrink-0'>
                                  <span className='text-sm font-bold text-blue-700'>
                                    {index + 1}
                                  </span>
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1'>
                                    <span className='text-sm font-medium text-gray-700'>
                                      Dive {dive.dive_number || index + 1}:
                                    </span>
                                    {dive.dive_site_name ? (
                                      dive.dive_site_id ? (
                                        <Link
                                          to={`/dive-sites/${dive.dive_site_id}`}
                                          className='text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate'
                                        >
                                          {dive.dive_site_name}
                                        </Link>
                                      ) : (
                                        <span className='text-sm font-medium text-gray-700 truncate'>
                                          {dive.dive_site_name}
                                        </span>
                                      )
                                    ) : (
                                      <span className='text-sm text-gray-500 italic'>
                                        No dive site specified
                                      </span>
                                    )}
                                  </div>

                                  <div className='flex flex-wrap items-center gap-3 text-xs text-gray-500'>
                                    {dive.dive_time && (
                                      <span className='flex items-center'>
                                        <Clock className='h-3 w-3 mr-1 flex-shrink-0' />
                                        {formatTime(dive.dive_time)}
                                      </span>
                                    )}
                                    {dive.dive_duration && (
                                      <span className='flex items-center'>
                                        <Clock className='h-3 w-3 mr-1 flex-shrink-0' />
                                        {dive.dive_duration} min
                                      </span>
                                    )}
                                    {dive.max_depth && (
                                      <span className='flex items-center'>
                                        <MapPin className='h-3 w-3 mr-1 flex-shrink-0' />
                                        Max {dive.max_depth}m
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {dive.dive_description && (
                                <div className='text-xs text-gray-600 p-2 bg-white rounded border sm:ml-8'>
                                  {dive.dive_description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback for old single dive site display */}
                    {(!trip.dives || trip.dives.length === 0) && trip.dive_site_name && (
                      <div className='mb-6'>
                        <div className='flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200'>
                          <MapPin className='h-5 w-5 text-green-600' />
                          <div className='flex-1'>
                            <div className='text-sm font-medium text-gray-700 mb-1'>Dive Site:</div>
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

                    {/* Special Requirements */}
                    {trip.special_requirements && (
                      <div className='p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-4'>
                        <div className='flex items-start'>
                          <div className='flex-shrink-0'>
                            <Tag className='h-5 w-5 text-yellow-600 mt-0.5' />
                          </div>
                          <div className='ml-3'>
                            <h5 className='text-sm font-medium text-yellow-800 mb-1'>
                              Special Requirements
                            </h5>
                            <p className='text-sm text-yellow-700'>{trip.special_requirements}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Trip Actions - Mobile Responsive */}
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-4'>
                      <div className='flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-500'>
                        {trip.created_at && (
                          <span className='flex items-center'>
                            <span>Added {new Date(trip.created_at).toLocaleDateString()}</span>
                          </span>
                        )}
                        {trip.updated_at && trip.updated_at !== trip.created_at && (
                          <span className='flex items-center'>
                            <span>Updated {new Date(trip.updated_at).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>

                      <div className='flex items-center space-x-2'>
                        {/* Add more action buttons here in future phases */}
                        <button
                          className='w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
                          title='Contact for booking'
                        >
                          Contact Center
                        </button>
                        <button
                          className='w-full sm:w-auto px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
                          title='View trip details'
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'map' && sortedTrips && sortedTrips.length > 0 && (
        <div className='bg-white rounded-lg shadow-md'>
          <DiveMap diveSites={[]} divingCenters={mapData} height='600px' showTripInfo={true} />
        </div>
      )}
    </div>
  );
};

export default DiveTrips;
