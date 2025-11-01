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
  Compass,
  Plus,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getParsedTrips, getDivingCenters, getDiveSites } from '../api';
import FuzzySearchInput from '../components/FuzzySearchInput';
import HeroSection from '../components/HeroSection';
import RateLimitError from '../components/RateLimitError';
import StickyFilterBar from '../components/StickyFilterBar';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
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
  // Thumbnails feature removed
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compact_layout') !== 'false'; // Default to true (compact)
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    diving_center_id: '',
    dive_site_id: '',
    trip_status: '',
    min_price: '',
    max_price: '',
    difficulty_code: '',
    exclude_unspecified_difficulty: false,
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

  // Helper function to get active filters count
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search_query) count++;
    if (filters.start_date) count++;
    if (filters.end_date) count++;
    if (filters.diving_center_id) count++;
    if (filters.trip_status) count++;
    if (filters.min_price) count++;
    if (filters.max_price) count++;
    if (filters.difficulty_code) count++;
    if (filters.exclude_unspecified_difficulty) count++;
    return count;
  };

  // Helper function to handle filter changes from StickyFilterBar
  const handleStickyFilterChange = (key, value) => {
    if (key === 'date_range' && value === 'next_week') {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      handleFilterChange('start_date', today.toISOString().split('T')[0]);
      handleFilterChange('end_date', nextWeek.toISOString().split('T')[0]);
    } else if (key === 'location' && value === 'current') {
      if (user && userLocation.latitude && userLocation.longitude) {
        // Already have location
      } else {
        getUserLocation();
      }
    } else {
      handleFilterChange(key, value);
    }
  };

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
    if (option === 'compact') {
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

  // Set dynamic page title
  const pageTitle = 'Divemap - Dive Trips';
  usePageTitle(pageTitle);

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
      difficulty_code: '',
      exclude_unspecified_difficulty: false,
      search_query: '',
    });
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
    <div className='min-h-screen bg-gray-50'>
      {/* Mobile-First Responsive Container */}
      <div className='max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        {/* Hero Section */}
        <HeroSection
          title='Dive Trips'
          subtitle='Discover upcoming dive trips from local diving centers'
          background='ocean'
          size='large'
          showLogo={false}
          logoBackground={true}
          threeColumnLayout={true}
        >
          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
            <button
              onClick={() => {
                navigate('/map?type=dive-trips');
              }}
              className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Compass className='w-5 h-5' />
              Explore Map
            </button>
            {user && (
              <button
                onClick={() => navigate('/dive-trips/create')}
                className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
              >
                <Plus size={20} />
                Create Trip
              </button>
            )}
          </div>
        </HeroSection>
      </div>
      {/* Main Content */}
      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
        {/* Map Section - Redirect to Unified Map */}
        {viewMode === 'map' && (
          <div className='mb-6 bg-white rounded-lg shadow-md p-8 text-center'>
            <Map className='h-16 w-16 text-blue-600 mx-auto mb-4' />
            <h3 className='text-xl font-semibold text-gray-900 mb-2'>Interactive Map View</h3>
            <p className='text-gray-600 mb-6'>
              The map view has been moved to our unified interactive map for a better experience.
            </p>
            <div className='flex flex-col sm:flex-row gap-3 justify-center'>
              <button
                onClick={() => {
                  navigate('/map?type=dive-trips');
                }}
                className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2'
              >
                <Map className='w-5 h-5' />
                Open Interactive Map
              </button>
              <button
                onClick={() => changeViewMode('list')}
                className='bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2'
              >
                <List className='w-5 h-5' />
                Back to List View
              </button>
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
                Loading filter data... Please wait while we prepare the diving centers and dive
                sites for filtering.
              </span>
            </div>
          </div>
        )}

        {/* Sticky Filter Bar - Mobile-First Responsive Design */}
        <div className='sticky-below-navbar bg-white shadow-sm border-b border-gray-200 rounded-t-lg px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4'>
          <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 items-end'>
            {/* Smart Fuzzy Search Input - Enhanced search experience */}
            <div className='flex-1 w-full'>
              <label
                htmlFor='search-query'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Search
              </label>
              <FuzzySearchInput
                data={trips || []}
                searchValue={filters.search_query}
                onSearchChange={value => handleFilterChange('search_query', value)}
                onSearchSelect={selectedItem => {
                  // For dive trips, we need to handle the selected item appropriately
                  // Since dive trips have multiple searchable fields, we'll use the search query
                  handleFilterChange(
                    'search_query',
                    selectedItem.name || selectedItem.trip_description || ''
                  );
                }}
                configType='diveTrips'
                placeholder='Search trips, dive sites, diving centers, locations, or requirements...'
                minQueryLength={2}
                maxSuggestions={8}
                debounceDelay={300}
                showSuggestions={true}
                highlightMatches={true}
                showScore={false}
                showClearButton={true}
                className='w-full'
                inputClassName='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base'
                suggestionsClassName='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto'
                highlightClass='bg-blue-100 font-medium'
              />
            </div>

            {/* Quick Filters */}
            <div className='flex gap-2'>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0 touch-manipulation'
              >
                {showAdvancedFilters ? 'Hide' : 'Show'} Filters
              </button>

              {getActiveFiltersCount() > 0 && (
                <button
                  onClick={clearFilters}
                  className='px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium min-h-[44px] sm:min-h-0 touch-manipulation'
                >
                  Clear All
                </button>
              )}
            </div>
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

        {/* View Controls - Simplified for Map View */}
        {viewMode === 'map' ? (
          <div className='mb-6'>
            <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-medium text-gray-900'>View Mode</h3>
                <div className='flex gap-2'>
                  <button
                    onClick={() => changeViewMode('list')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <List className='h-4 w-4' />
                    List
                  </button>
                  <button
                    onClick={() => changeViewMode('grid')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Grid className='h-4 w-4' />
                    Grid
                  </button>
                  <button
                    onClick={() => changeViewMode('map')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      viewMode === 'map'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Map className='h-4 w-4' />
                    Map
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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

                  {filters.difficulty_code && <p>• Try a different difficulty level</p>}
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
                      {/* Thumbnail removed */}
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
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(trip.trip_difficulty_code)}`}
                    >
                      {trip.trip_difficulty_label || getDifficultyLabel(trip.trip_difficulty_code)}
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
                {/* Thumbnail removed */}

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
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(trip.trip_difficulty_code)}`}
                      >
                        {trip.trip_difficulty_label ||
                          getDifficultyLabel(trip.trip_difficulty_code)}
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
      </div>{' '}
      {/* Close main content div */}
    </div>
  );
};

export default DiveTrips;
