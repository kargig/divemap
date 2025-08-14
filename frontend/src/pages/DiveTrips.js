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
  List,
  Grid,
  Eye,
  TrendingUp,
  DollarSign,
  Star,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getParsedTrips, getDivingCenters, getDiveSites } from '../api';
import EnhancedMobileSortingControls from '../components/EnhancedMobileSortingControls';
import RateLimitError from '../components/RateLimitError';
import TripMap from '../components/TripMap';
import { useAuth } from '../contexts/AuthContext';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getSortOptions } from '../utils/sortOptions';
import { generateTripName } from '../utils/tripNameGenerator';

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

const DiveTrips = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading } = useAuth();

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const viewMode = params.get('view');
    return viewMode === 'map' ? 'map' : viewMode === 'grid' ? 'grid' : 'list';
  });
  const [showThumbnails, setShowThumbnails] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('show_thumbnails') === 'true';
  });
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compact_layout') !== 'false'; // Default to true (compact)
  });

  // Add viewport state for map functionality
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [mappedTripsCount, setMappedTripsCount] = useState(0);
  const [statusToggles, setStatusToggles] = useState({
    scheduled: true,
    confirmed: true,
    completed: true,
    cancelled: true,
  });
  const [clustering, setClustering] = useState(false);
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Helper function to change view mode and update URL
  const changeViewMode = mode => {
    setViewMode(mode);

    // Update URL with new view mode
    const urlParams = new URLSearchParams(window.location.search);
    if (mode === 'list') {
      urlParams.delete('view'); // Default view, no need for parameter
    } else {
      urlParams.set('view', mode);
    }

    // Update URL without triggering a page reload
    navigate(`?${urlParams.toString()}`, { replace: true });
  };

  const handleDisplayOptionChange = option => {
    if (option === 'thumbnails') {
      const newShowThumbnails = !showThumbnails;
      setShowThumbnails(newShowThumbnails);

      // Update URL
      const urlParams = new URLSearchParams(window.location.search);
      if (newShowThumbnails) {
        urlParams.set('show_thumbnails', 'true');
      } else {
        urlParams.delete('show_thumbnails');
      }
      navigate(`?${urlParams.toString()}`, { replace: true });
    } else if (option === 'compact') {
      const newCompactLayout = !compactLayout;
      setCompactLayout(newCompactLayout);

      // Update URL
      const urlParams = new URLSearchParams(window.location.search);
      if (!newCompactLayout) {
        urlParams.set('compact_layout', 'false');
      } else {
        urlParams.delete('compact_layout');
      }
      navigate(`?${urlParams.toString()}`, { replace: true });
    }
  };

  const handleViewModeChange = newViewMode => {
    setViewMode(newViewMode);

    // Update URL with new view mode
    const urlParams = new URLSearchParams(window.location.search);
    if (newViewMode === 'map') {
      urlParams.set('view', 'map');
    } else if (newViewMode === 'grid') {
      urlParams.set('view', 'grid');
    } else {
      urlParams.delete('view'); // Default to list view
    }

    // Update URL without triggering a page reload
    navigate(`?${urlParams.toString()}`, { replace: true });
  };

  // Get user location on component mount (only for authenticated users)
  useEffect(() => {
    if (user && !loading) {
      // User is authenticated, get their location
      getUserLocation();
    } else if (!loading) {
      // User is not authenticated, set default location without geolocation
      setUserLocation({
        latitude: 37.9838,
        longitude: 23.7275,
      });
    }
  }, [user, loading]);

  // Mobile detection and responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
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

  // Helper function to intelligently route search terms
  const routeSearchTerms = searchQuery => {
    if (!searchQuery || !searchQuery.trim()) return { search_query: '', location_query: '' };

    const query = searchQuery.trim().toLowerCase();

    // Common country and region keywords that indicate location searches
    const locationKeywords = [
      'greece',
      'spain',
      'italy',
      'france',
      'croatia',
      'turkey',
      'egypt',
      'thailand',
      'indonesia',
      'philippines',
      'mediterranean',
      'aegean',
      'ionian',
      'adriatic',
      'caribbean',
      'red sea',
      'pacific',
      'atlantic',
      'athens',
      'barcelona',
      'rome',
      'paris',
      'venice',
      'santorini',
      'mykonos',
      'crete',
      'rhodes',
      'costa brava',
      'amalfi coast',
      'french riviera',
      'dubrovnik',
      'antalya',
      'sharm el sheikh',
      'koh samui',
      'bali',
      'phuket',
      'boracay',
      'palawan',
    ];

    // Check if the search query contains location keywords
    const isLocationSearch = locationKeywords.some(
      keyword =>
        query.includes(keyword) ||
        query.includes('country') ||
        query.includes('region') ||
        query.includes('location') ||
        query.includes('area')
    );

    if (isLocationSearch) {
      return { search_query: '', location_query: searchQuery.trim() };
    } else {
      return { search_query: searchQuery.trim(), location_query: '' };
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
      // Route search terms intelligently
      const { search_query, location_query } = routeSearchTerms(filters.search_query);

      // Only include filters that have actual values
      const validFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'search_query') {
          // Handle search_query separately since we're routing it
          if (search_query) validFilters.search_query = search_query;
          if (location_query) validFilters.location_query = location_query;
        } else if (value && value.trim() !== '') {
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
  const { data: divingCentersData, error: divingCentersError } = useQuery(
    ['diving-centers'],
    () => getDivingCenters({ page_size: 100 }),
    {
      staleTime: 300000, // 5 minutes
    }
  );

  const { data: diveSitesData, error: diveSitesError } = useQuery(
    ['dive-sites'],
    () => getDiveSites({ page_size: 100 }),
    {
      staleTime: 300000, // 5 minutes
    }
  );

  // Ensure we always have arrays for the filter data
  // Handle different possible response structures from the API
  const divingCenters = (() => {
    if (Array.isArray(divingCentersData)) return divingCentersData;
    if (divingCentersData && Array.isArray(divingCentersData.items)) return divingCentersData.items;
    if (divingCentersData && Array.isArray(divingCentersData.data)) return divingCentersData.data;
    if (divingCentersData && Array.isArray(divingCentersData.results))
      return divingCentersData.results;
    return [];
  })();

  const diveSites = (() => {
    if (Array.isArray(diveSitesData)) return diveSitesData;
    if (diveSitesData && Array.isArray(diveSitesData.items)) return diveSitesData.items;
    if (diveSitesData && Array.isArray(diveSitesData.data)) return diveSitesData.data;
    if (diveSitesData && Array.isArray(diveSitesData.results)) return diveSitesData.results;
    return [];
  })();

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

      trip_status: '',
      min_price: '',
      max_price: '',
      difficulty_level: '',
      search_query: '',
    });
  };

  // Callback to handle mapped trips count from TripMap component
  const handleMappedTripsCountChange = count => {
    setMappedTripsCount(count);
  };

  // Helper function to get dive site rating
  const getDiveSiteRating = diveSiteId => {
    if (!diveSiteId || !diveSites) return null;
    const diveSite = diveSites.find(site => site.id === diveSiteId);
    return diveSite?.average_rating || null;
  };

  // Helper function to render dive site name with rating
  const renderDiveSiteWithRating = (diveSiteId, diveSiteName) => {
    if (!diveSiteName) return null;

    const rating = getDiveSiteRating(diveSiteId);

    return (
      <div className='flex items-center gap-2'>
        {diveSiteId ? (
          <Link
            to={`/dive-sites/${diveSiteId}`}
            className='text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate'
          >
            {diveSiteName}
          </Link>
        ) : (
          <span className='text-sm font-medium text-gray-700 truncate'>{diveSiteName}</span>
        )}
        {rating && (
          <div className='flex items-center gap-1 bg-yellow-100 rounded-full px-2 py-1'>
            <Star className='w-3 h-3 text-yellow-500 fill-current' />
            <span className='text-xs font-medium text-yellow-800'>{rating}/10</span>
          </div>
        )}
      </div>
    );
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

      {/* Filter Data Loading State */}
      {(!divingCentersData || !diveSitesData) && (
        <div className='mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2'></div>
            <span className='text-yellow-800 text-sm'>
              Loading filter data... Please wait while we prepare the diving centers and dive sites
              for filtering.
            </span>
          </div>
        </div>
      )}

      {/* Enhanced Filters */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex items-center mb-4'>
          <Filter className='h-5 w-5 text-gray-600 mr-2' />
          <h3 className='text-lg font-semibold text-gray-900'>Filters</h3>
        </div>

        {/* Unified Search */}
        <div className='mb-4'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search trips, dive sites, diving centers, locations, or requirements...'
              value={filters.search_query}
              onChange={e => handleFilterChange('search_query', e.target.value)}
              className='w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base'
            />
          </div>

          {/* Search Tips */}
          <div className='mt-2 text-sm text-gray-500'>
            💡 Search for anything: &quot;Spain beginner diving&quot;, &quot;Mediterranean
            advanced&quot;, &quot;PADI center Athens&quot;, &quot;Greece location&quot;
          </div>

          {/* Mobile Filter Toggle */}
          {isMobile && (
            <div className='mt-4'>
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md touch-manipulation'
              >
                <Filter className='h-5 w-5' />
                {showMobileFilters ? 'Hide Filters' : 'Show All Filters'}
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Mobile Filter Status Indicator */}
              {showMobileFilters && (
                <div className='mt-2 text-xs text-blue-600 text-center'>
                  📱 Filters are now visible
                </div>
              )}
            </div>
          )}

          {/* Smart Filter Suggestions */}
          {filters.search_query && (
            <div className='mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200'>
              <div className='flex items-center mb-2'>
                <TrendingUp className='h-4 w-4 text-blue-600 mr-2' />
                <span className='text-sm font-medium text-blue-800'>
                  Smart suggestions for &quot;{filters.search_query}&quot;
                </span>
              </div>
              <div className='flex flex-wrap gap-2'>
                {/* Location-based suggestions */}
                {filters.search_query.toLowerCase().includes('greece') && (
                  <>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Athens')}
                      className='px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-full hover:bg-blue-200 active:bg-blue-300 transition-colors touch-manipulation min-h-[44px]'
                    >
                      🏛️ Athens
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Santorini')}
                      className='px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-full hover:bg-blue-200 active:bg-blue-300 transition-colors touch-manipulation min-h-[44px]'
                    >
                      🌅 Santorini
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Crete')}
                      className='px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-full hover:bg-blue-200 active:bg-blue-300 transition-colors touch-manipulation min-h-[44px]'
                    >
                      🏝️ Crete
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Mediterranean')}
                      className='px-3 py-2 bg-blue-100 text-blue-700 text-sm rounded-full hover:bg-blue-200 active:bg-blue-300 transition-colors touch-manipulation min-h-[44px]'
                    >
                      🌊 Mediterranean
                    </button>
                  </>
                )}

                {filters.search_query.toLowerCase().includes('spain') && (
                  <>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Barcelona')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🏰 Barcelona
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Costa Brava')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🏖️ Costa Brava
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Mediterranean')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🌊 Mediterranean
                    </button>
                  </>
                )}

                {filters.search_query.toLowerCase().includes('mediterranean') && (
                  <>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Greece')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🇬🇷 Greece
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Spain')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🇪🇸 Spain
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Italy')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🇮🇹 Italy
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'Croatia')}
                      className='px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors'
                    >
                      🇭🇷 Croatia
                    </button>
                  </>
                )}

                {/* Difficulty-based suggestions */}
                {filters.search_query.toLowerCase().includes('beginner') && (
                  <>
                    <button
                      onClick={() => handleFilterChange('difficulty_level', 'beginner')}
                      className='px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full hover:bg-green-200 transition-colors'
                    >
                      🟢 Set Beginner Level
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'PADI Open Water')}
                      className='px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full hover:bg-green-200 transition-colors'
                    >
                      🎓 PADI Open Water
                    </button>
                  </>
                )}

                {filters.search_query.toLowerCase().includes('advanced') && (
                  <>
                    <button
                      onClick={() => handleFilterChange('difficulty_level', 'advanced')}
                      className='px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full hover:bg-orange-200 transition-colors'
                    >
                      🟠 Set Advanced Level
                    </button>
                    <button
                      onClick={() => handleFilterChange('search_query', 'PADI Open Water')}
                      className='px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full hover:bg-orange-200 transition-colors'
                    >
                      🌊 Deep Diving
                    </button>
                  </>
                )}

                {/* Generic suggestions */}
                <button
                  onClick={() => handleFilterChange('trip_status', 'scheduled')}
                  className='px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full hover:bg-purple-200 transition-colors'
                >
                  📅 Show Scheduled
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                    handleFilterChange('start_date', today.toISOString().split('T')[0]);
                    handleFilterChange('end_date', nextWeek.toISOString().split('T')[0]);
                  }}
                  className='px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full hover:bg-purple-200 transition-colors'
                >
                  📅 Next 7 Days
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Essential Filters - Mobile Responsive */}
        <div className={`${isMobile && !showMobileFilters ? 'hidden' : 'block'}`}>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
            {/* Date Range */}
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
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className='mb-4'>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className='flex items-center text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors'
          >
            <Filter className='h-4 w-4 mr-2' />
            {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            <ChevronDown
              className={`h-4 w-4 ml-1 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Advanced Filters - Collapsible and Mobile Responsive */}
        {showAdvancedFilters && (
          <div className={`${isMobile && !showMobileFilters ? 'hidden' : 'block'}`}>
            <div className='space-y-4 mb-4'>
              {/* User Location for Distance Sorting */}
              <div className='p-4 bg-gray-50 rounded-lg border border-gray-200'>
                <div className='flex items-center justify-between mb-2'>
                  <label
                    htmlFor='user-location-label'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Your Location (for distance sorting)
                  </label>
                  {user ? (
                    <button
                      onClick={getUserLocation}
                      className='text-sm text-blue-600 hover:text-blue-800 underline'
                    >
                      Use Current Location
                    </button>
                  ) : (
                    <span className='text-sm text-gray-500 italic'>
                      Login required for location access
                    </span>
                  )}
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
                  📍 Set your location to enable distance-based sorting.
                  {user ? (
                    <>
                      Click &quot;Use Current Location&quot; to automatically detect your position.
                    </>
                  ) : (
                    <>Login to automatically detect your position, or manually enter coordinates.</>
                  )}
                </div>
              </div>

              {/* Advanced Filter Grid */}
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
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
                    disabled={!Array.isArray(divingCenters) || divingCenters.length === 0}
                  >
                    <option value=''>
                      {!Array.isArray(divingCenters) || divingCenters.length === 0
                        ? 'Loading centers...'
                        : 'All Centers'}
                    </option>
                    {Array.isArray(divingCenters) &&
                      divingCenters.map(center => (
                        <option key={center.id} value={center.id}>
                          {center.name}
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
            </div>
          </div>
        )}

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

      {/* Mobile Floating Action Button */}
      {isMobile && (
        <div className='fixed bottom-6 right-6 z-50'>
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className='w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 flex items-center justify-center touch-manipulation'
            aria-label='Toggle Filters'
          >
            <Filter className='h-6 w-6' />
          </button>
        </div>
      )}

      {/* Sorting Controls */}
      <div className='mb-6'>
        <EnhancedMobileSortingControls
          sortBy={sortOptions.sort_by}
          sortOrder={sortOptions.sort_order}
          sortOptions={getAvailableSortOptions()}
          onSortChange={(sortBy, sortOrder) =>
            setSortOptions(prev => ({ ...prev, sort_by: sortBy, sort_order: sortOrder }))
          }
          onSortApply={() => {}} // No separate apply needed for DiveTrips
          onReset={() => setSortOptions({ sort_by: 'trip_date', sort_order: 'desc' })}
          entityType='dive-trips'
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          showFilters={false} // Hide filters in this section for now
          onToggleFilters={() => {}}
          showQuickActions={true}
          showFAB={true}
          showTabs={true}
          showThumbnails={showThumbnails}
          compactLayout={compactLayout}
          onDisplayOptionChange={handleDisplayOptionChange}
        />
      </div>

      {/* Mobile View Mode Quick Access */}
      {isMobile && (
        <div className='mb-4 flex gap-2 justify-center'>
          <button
            onClick={() => changeViewMode('list')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } touch-manipulation min-h-[44px]`}
          >
            <List className='h-5 w-5 inline mr-2' />
            List
          </button>
          <button
            onClick={() => changeViewMode('grid')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } touch-manipulation min-h-[44px]`}
          >
            <Grid className='h-5 w-5 inline mr-2' />
            Grid
          </button>
          <button
            onClick={() => changeViewMode('map')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            } touch-manipulation min-h-[44px]`}
          >
            <Map className='h-5 w-5 inline mr-2' />
            Map
          </button>
        </div>
      )}

      {/* Mobile Gesture Hints */}
      {isMobile && (
        <div className='mb-4 text-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg'>
          💡 <strong>Mobile Tips:</strong> Swipe left/right on trip cards, tap filters button for
          quick access
        </div>
      )}

      {/* Map View Info */}
      {viewMode === 'map' && (
        <div className='mb-6 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200'>
          <div className='flex items-center space-x-2'>
            <Map className='h-4 w-4 text-blue-600' />
            <span>
              <strong>Map View:</strong> Click on trip markers to view details and navigate to trip
              pages
            </span>
          </div>
        </div>
      )}

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
                {filters.start_date && filters.end_date && <p>• Expand your date range</p>}
                {filters.min_price && filters.max_price && <p>• Adjust your price range</p>}
                {filters.diving_center_id && <p>• Try a different diving center</p>}

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

      {/* Map View No Results */}
      {viewMode === 'map' && sortedTrips && sortedTrips.length === 0 && (
        <div className='bg-white rounded-lg shadow-md p-8 text-center'>
          <Map className='h-16 w-16 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>No trips to display on map</h3>
          <p className='text-gray-600 mb-4'>
            {Object.values(filters).some(value => value && value.trim() !== '')
              ? 'No trips match your current filters. Try adjusting your search criteria or switch to list view to see all available trips.'
              : 'There are currently no dive trips available with location data. Switch to list view to see all trips.'}
          </p>
          <div className='flex justify-center space-x-3'>
            <button
              onClick={() => changeViewMode('list')}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            >
              Switch to List View
            </button>
            {Object.values(filters).some(value => value && value.trim() !== '') && (
              <button
                onClick={clearFilters}
                className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map View with Trips */}
      {viewMode === 'map' && sortedTrips && sortedTrips.length > 0 && (
        <div className='bg-white rounded-lg shadow-md'>
          {/* Map View Summary */}
          <div className='p-4 bg-gray-50 border-b border-gray-200'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <Map className='h-5 w-5 text-gray-600' />
                <span className='text-sm text-gray-600'>
                  <strong>Map View:</strong> Showing {mappedTripsCount} dive site
                  {mappedTripsCount !== 1 ? 's' : ''}
                  {mappedTripsCount !== sortedTrips.length && (
                    <span className='text-gray-500 ml-1'>(from {sortedTrips.length} trips)</span>
                  )}
                </span>
              </div>
              <div className='text-xs text-gray-500'>
                Click markers for trip details • Use filters to refine results
                {mappedTripsCount !== sortedTrips.length && (
                  <div className='mt-1 text-orange-600'>
                    ⚠️ {sortedTrips.length - mappedTripsCount} dive site
                    {sortedTrips.length - mappedTripsCount !== 1 ? 's' : ''} belonging to{' '}
                    {sortedTrips.length} dive trips not shown (no dive site coordinates)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Toggle Controls */}
          <div className='p-4 bg-white border-b border-gray-200'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-4'>
                <span className='text-sm font-medium text-gray-700'>Show Status:</span>
                {Object.entries(statusToggles).map(([status, enabled]) => (
                  <label key={status} className='flex items-center space-x-2'>
                    <input
                      type='checkbox'
                      checked={enabled}
                      onChange={e => {
                        setStatusToggles(prev => ({
                          ...prev,
                          [status]: e.target.checked,
                        }));
                      }}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    <span className='text-sm text-gray-600 capitalize'>{status}</span>
                  </label>
                ))}
              </div>
              <div className='flex items-center space-x-4'>
                <label className='flex items-center space-x-2'>
                  <input
                    type='checkbox'
                    checked={clustering}
                    onChange={e => setClustering(e.target.checked)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                  <span className='text-sm text-gray-600'>Clustering</span>
                </label>
              </div>
            </div>
          </div>

          <TripMap
            trips={sortedTrips}
            filters={filters}
            onTripSelect={trip => {
              // Navigate to trip detail when trip is selected on map
              navigate(`/dive-trips/${trip.id}`);
            }}
            height='600px'
            clustering={clustering}
            divingCenters={divingCenters}
            diveSites={diveSites}
            onMappedTripsCountChange={handleMappedTripsCountChange}
            statusToggles={statusToggles}
          />
        </div>
      )}

      {/* Dive Trips List */}
      {viewMode === 'list' && (
        <div
          className={`space-y-4 ${compactLayout ? 'view-mode-compact' : ''} ${isMobile ? 'px-2' : ''}`}
        >
          {sortedTrips?.map(trip => (
            <div
              key={trip.id}
              className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${
                compactLayout ? 'p-4' : 'p-6'
              }`}
            >
              <div className='flex items-start justify-between mb-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-3 mb-2'>
                    {showThumbnails && (
                      <div className='dive-thumbnail'>
                        <Calendar className='w-8 h-8' />
                      </div>
                    )}
                    <div>
                      <h3
                        className={`font-semibold text-gray-900 ${compactLayout ? 'text-base' : 'text-lg'}`}
                      >
                        <Link
                          to={`/dive-trips/${trip.id}`}
                          className='hover:text-blue-600 transition-colors'
                        >
                          {generateTripName(trip)}
                        </Link>
                      </h3>
                      <p className={`text-gray-600 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                        {trip.trip_date
                          ? new Date(trip.trip_date).toLocaleDateString('en-GB')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <Link
                  to={`/dive-trips/${trip.id}`}
                  className='inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors'
                >
                  <Eye className='w-4 h-4' />
                  View Trip
                </Link>
              </div>

              <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
                <div className='flex items-center gap-2'>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(trip.difficulty_level)}`}
                  >
                    {getDifficultyLabel(trip.difficulty_level)}
                  </span>
                </div>
                {trip.max_depth && (
                  <div className='flex items-center gap-2'>
                    <TrendingUp className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-600'>{trip.max_depth}m max</span>
                  </div>
                )}
                {trip.trip_price && (
                  <div className='flex items-center gap-2'>
                    <DollarSign className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-600'>
                      {formatCurrency(trip.trip_price, trip.trip_currency)}
                    </span>
                  </div>
                )}
                <div className='flex items-center gap-2'>
                  <MapPin className='w-4 h-4 text-gray-400' />
                  <span className='text-sm text-gray-600'>
                    {trip.diving_center_id && trip.diving_center_name ? (
                      <Link
                        to={`/diving-centers/${trip.diving_center_id}`}
                        className='text-blue-600 hover:text-blue-800 hover:underline transition-colors'
                      >
                        {trip.diving_center_name}
                      </Link>
                    ) : (
                      trip.diving_center_name || 'Unknown Location'
                    )}
                  </span>
                </div>
              </div>

              <p className='text-gray-700 text-sm leading-relaxed mb-3 line-clamp-3'>
                {trip.trip_description || 'No description available.'}
              </p>

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
                      {trip.trip_date
                        ? new Date(trip.trip_date).toLocaleDateString('en-GB')
                        : 'N/A'}
                    </button>
                  </div>
                </div>

                <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                  <Clock className='h-4 w-4 mr-3 text-green-600 flex-shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-xs text-gray-500 uppercase tracking-wide'>Time</div>
                    <span className='font-medium text-sm'>
                      {trip.trip_time ? formatTime(trip.trip_time) : 'N/A'}
                    </span>
                  </div>
                </div>

                {trip.trip_duration && (
                  <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                    <Clock className='h-4 w-4 mr-3 text-purple-600 flex-shrink-0' />
                    <div className='min-w-0'>
                      <div className='text-xs text-gray-500 uppercase tracking-wide'>Duration</div>
                      <span className='font-medium text-sm'>{trip.trip_duration} min</span>
                    </div>
                  </div>
                )}

                {trip.trip_price && (
                  <div className='flex items-center text-gray-600 p-3 bg-gray-50 rounded-lg'>
                    <Euro className='h-4 w-4 mr-3 text-green-600 flex-shrink-0' />
                    <div className='min-w-0'>
                      <div className='text-xs text-gray-500 uppercase tracking-wide'>Price</div>
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
                      <div className='text-xs text-gray-500 uppercase tracking-wide'>Type</div>
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
                            <span className='text-sm font-bold text-blue-700'>{index + 1}</span>
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1'>
                              <span className='text-sm font-medium text-gray-700'>
                                Dive {dive.dive_number || index + 1}:
                              </span>
                              {dive.dive_site_name ? (
                                renderDiveSiteWithRating(dive.dive_site_id, dive.dive_site_name)
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
                      {renderDiveSiteWithRating(trip.dive_site_id, trip.dive_site_name)}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dive Trips Grid */}
      {viewMode === 'grid' && (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''} ${isMobile ? 'px-2 gap-4' : ''}`}
        >
          {sortedTrips?.map(trip => (
            <div
              key={trip.id}
              className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                compactLayout ? 'p-4' : 'p-6'
              }`}
            >
              {showThumbnails && (
                <div className='dive-thumbnail bg-gray-100 p-4 flex items-center justify-center'>
                  <Calendar className='w-12 h-12 text-gray-400' />
                </div>
              )}

              <div className='p-4'>
                <h3
                  className={`font-semibold text-gray-900 mb-2 ${compactLayout ? 'text-base' : 'text-lg'}`}
                >
                  <Link
                    to={`/dive-trips/${trip.id}`}
                    className='hover:text-blue-600 transition-colors'
                  >
                    {generateTripName(trip)}
                  </Link>
                </h3>

                <p className={`text-gray-600 mb-3 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                  {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-GB') : 'N/A'}
                </p>

                <div className='space-y-2 mb-4'>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(trip.difficulty_level)}`}
                    >
                      {getDifficultyLabel(trip.difficulty_level)}
                    </span>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-3 mb-4'>
                  {trip.max_depth && (
                    <div className='flex items-center gap-2'>
                      <TrendingUp className='w-4 h-4 text-gray-400' />
                      <span className='text-sm text-gray-600'>{trip.max_depth}m</span>
                    </div>
                  )}
                  {trip.trip_price && (
                    <div className='flex items-center gap-2'>
                      <DollarSign className='w-4 h-4 text-gray-400' />
                      <span className='text-sm text-gray-600'>
                        {formatCurrency(trip.trip_price, trip.trip_currency)}
                      </span>
                    </div>
                  )}
                  <div className='flex items-center gap-2'>
                    <MapPin className='w-4 h-4 text-gray-400' />
                    <span className='text-sm text-gray-600'>
                      {trip.diving_center_id && trip.diving_center_name ? (
                        <Link
                          to={`/diving-centers/${trip.diving_center_id}`}
                          className='text-blue-600 hover:text-blue-800 hover:underline transition-colors'
                        >
                          {trip.diving_center_name}
                        </Link>
                      ) : (
                        trip.diving_center_name || 'Unknown Location'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiveTrips;
