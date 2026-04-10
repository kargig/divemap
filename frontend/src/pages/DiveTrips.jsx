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
  TrendingUp,
  DollarSign,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Plus,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import DesktopSearchBar from '../components/DesktopSearchBar';
import FuzzySearchInput from '../components/FuzzySearchInput';
import PageHeader from '../components/PageHeader';
import RateLimitError from '../components/RateLimitError';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import TripCard from '../components/TripCard';
import CurrencyIcon from '../components/ui/CurrencyIcon';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getParsedTrips } from '../services/newsletters';
import { formatCost } from '../utils/currency';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading } = useAuth();

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const viewMode = params.get('view');
    return viewMode === 'grid' ? 'grid' : 'list';
  });

  // Compact layout state management (default: false/non-compact)
  const { compactLayout, handleDisplayOptionChange } = useCompactLayout();

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
    country: '',
    region: '',
  });
  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } =
    useSorting('dive-trips');

  // Wrappers to ensure pagination resets on sort change
  const handleSortChangeWrapper = (newSortBy, newSortOrder) => {
    handleSortChange(newSortBy, newSortOrder);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const resetSortingWrapper = () => {
    resetSorting();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

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
  const { isMobile } = useResponsive();
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

  // Helper function to change view mode and update URL (kept for backward compatibility)
  const changeViewMode = mode => {
    handleViewModeChange(mode);
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

  // Pagination state - match Dives page structure
  const [pagination, setPagination] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      page: parseInt(params.get('page')) || 1,
      per_page: parseInt(params.get('per_page') || params.get('page_size')) || 25,
    };
  });

  // Query for parsed trips with pagination
  const {
    data: tripsResponse,
    isLoading,
    error,
  } = useQuery(
    [
      'parsedTrips',
      filters,
      sortBy,
      sortOrder,
      sortBy === 'distance' ? userLocation : null,
      pagination,
    ],
    () => {
      // Route search terms intelligently (only for authenticated users)
      const { search_query, location_query } = user
        ? routeSearchTerms(filters.search_query)
        : { search_query: '', location_query: '' };

      // Only include filters that have actual values
      const validFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'search_query') {
          // Handle search_query separately since we're routing it
          // Only include search queries for authenticated users
          if (user) {
            if (search_query) validFilters.search_query = search_query;
            if (location_query) validFilters.location_query = location_query;
          }
        } else if (value && value.trim() !== '') {
          validFilters[key] = value;
        }
      });

      // Add sorting parameters and pagination
      const sortParams = getSortParams();
      const params = {
        ...validFilters,
        sort_by: sortParams.sort_by || 'trip_date',
        sort_order: sortParams.sort_order || 'desc',
        page: pagination.page,
        page_size: pagination.per_page,
      };

      // Add user location for distance sorting
      if (sortParams.sort_by === 'distance' && userLocation.latitude && userLocation.longitude) {
        params.user_lat = userLocation.latitude;
        params.user_lon = userLocation.longitude;
      }

      return getParsedTrips(params);
    },
    {
      enabled: !loading, // Only fetch when auth check is complete
    }
  );

  // Set dynamic page title
  const pageTitle = 'Divemap - Dive Trips';
  usePageTitle(pageTitle);

  const trips = tripsResponse?.items || [];
  const paginationData = tripsResponse?.total !== undefined ? tripsResponse : null;

  // Extract unique diving centers and dive sites directly from the loaded trips
  // This completely eliminates the need for separate API queries to /dive-sites and /diving-centers
  const divingCenters = useMemo(() => {
    if (!trips || !Array.isArray(trips)) return [];
    const itemMap = {};
    trips.forEach(trip => {
      if (trip.diving_center_id && trip.diving_center_name) {
        itemMap[trip.diving_center_id] = {
          id: trip.diving_center_id,
          name: trip.diving_center_name,
        };
      }
    });
    return Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips]);

  const diveSites = useMemo(() => {
    if (!trips || !Array.isArray(trips)) return [];
    const itemMap = {};
    trips.forEach(trip => {
      if (trip.dives && Array.isArray(trip.dives)) {
        trip.dives.forEach(dive => {
          if (dive.dive_site_id && dive.dive_site_name) {
            itemMap[dive.dive_site_id] = {
              id: dive.dive_site_id,
              name: dive.dive_site_name,
            };
          }
        });
      }
    });
    return Object.values(itemMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [trips]);

  // State to store additional dive sites that are not in the main list
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);

  // Reset to page 1 when filters or sort options change - REMOVED (handled in handlers)

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    if (error) {
      handleRateLimitError(error, 'dive trips', () => window.location.reload());
    }
  }, [error]);

  // Sort trips by date (newest/future first)
  const sortedTrips = trips
    ? [...trips].sort((a, b) => {
        const dateA = new Date(a.trip_date);
        const dateB = new Date(b.trip_date);
        return dateB - dateA; // Descending order (newest first)
      })
    : [];

  // Backend already restricts unauthenticated users to 2 trips per diving center
  // So we just use sortedTrips directly for display
  const displayTrips = sortedTrips;

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
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
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
      difficulty_code: '',
      exclude_unspecified_difficulty: false,
      search_query: '',
      country: '',
      region: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(prev => ({ ...prev, page: 1, per_page: newPageSize }));
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };
  const handleViewModeChange = newViewMode => {
    if (newViewMode === 'map') {
      navigate('/map?type=dive-trips');
      return;
    }

    setViewMode(newViewMode);
    // Update URL with new view mode
    const urlParams = new URLSearchParams(window.location.search);
    if (newViewMode === 'grid') {
      urlParams.set('view', 'grid');
    } else {
      urlParams.delete('view');
    }

    // Replace URL without triggering reload
    navigate(`?${urlParams.toString()}`, { replace: true });
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
      <div className='flex items-center gap-1.5 sm:gap-2'>
        {diveSiteId ? (
          <Link
            to={`/dive-sites/${diveSiteId}/${slugify(diveSiteName)}`}
            state={{ from: window.location.pathname + window.location.search }}
            className='text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate flex items-center h-full'
          >
            {diveSiteName}
          </Link>
        ) : (
          <span className='text-xs sm:text-sm font-medium text-gray-700 truncate flex items-center h-full'>
            {diveSiteName}
          </span>
        )}
        {rating && (
          <div className='flex items-center gap-0.5 sm:gap-1 bg-yellow-100 rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1'>
            <Star className='w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500 fill-current' />
            <span className='text-[10px] sm:text-[11px] font-medium text-yellow-800 leading-tight'>
              {rating}/10
            </span>
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
    const formattedDate = date.toLocaleDateString(undefined, options);
    const shortDate = date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    const formattedDate = date.toLocaleDateString(undefined, options);

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
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-3 sm:p-6'>
        <div className='flex items-center justify-center min-h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p className='text-gray-600'>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Mobile-First Responsive Container */}
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        <PageHeader
          title='Dive Trips'
          titleIcon={Calendar}
          breadcrumbItems={[{ label: 'Dive Trips' }]}
          actions={[
            {
              label: 'Explore Map',
              icon: Compass,
              onClick: () => navigate('/map?type=dive-trips'),
              variant: 'primary',
            },
            ...(user
              ? [
                  {
                    label: 'Create Trip',
                    icon: Plus,
                    onClick: () => navigate('/dive-trips/create'),
                    variant: 'secondary',
                  },
                ]
              : []),
          ]}
        />

        {/* Desktop Search Bar - Only visible on desktop/tablet and for authenticated users */}
        {!isMobile && user && (
          <DesktopSearchBar
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
            data={trips || []}
            configType='diveTrips'
            placeholder='Search trips, dive sites, diving centers, locations, or requirements...'
          />
        )}

        {/* Mobile Search Bar - Only visible on mobile for authenticated users */}
        {isMobile && user && (
          <div className='bg-white border-b border-gray-200 shadow-sm -mx-4 sm:mx-0 mb-4'>
            <div className='p-3'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
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
                  inputClassName='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  suggestionsClassName='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto'
                  highlightClass='bg-blue-100 font-medium'
                />
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

        {/* Responsive Filter Bar */}
        <ResponsiveFilterBar
          showFilters={showFilters}
          onToggleFilters={toggleFilters}
          onClearFilters={clearFilters}
          activeFiltersCount={getActiveFiltersCount()}
          filters={{
            ...filters,
            availableDivingCenters: divingCenters || [],
            availableDiveSites: diveSites || [],
          }}
          onFilterChange={handleFilterChange}
          variant='inline'
          showQuickFilters={true}
          showAdvancedToggle={true}
          showSearch={false}
          searchQuery={filters.search_query}
          onSearchChange={value => handleFilterChange('search_query', value)}
          onSearchSubmit={() => {}}
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={getAvailableSortOptions()}
          onSortChange={handleSortChangeWrapper}
          onReset={resetSortingWrapper}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          compactLayout={compactLayout}
          onDisplayOptionChange={handleDisplayOptionChange}
          pageType='dive-trips'
          user={user}
        />

        {/* Distance Sorting Warning */}
        {sortBy === 'distance' && (!userLocation.latitude || !userLocation.longitude) && (
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

        {/* Top Pagination Controls */}
        {sortedTrips && sortedTrips.length > 0 && !isLoading && !error && viewMode !== 'map' && (
          <div className='mt-4 mb-4 sm:mt-6 sm:mb-6'>
            <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4'>
              <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
                <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4'>
                  {/* Page Size Selection */}
                  <div className='flex items-center gap-2'>
                    <label className='text-sm font-medium text-gray-700'>Show:</label>
                    <select
                      value={pagination.per_page}
                      onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className='text-sm text-gray-600'>per page</span>
                  </div>

                  {/* Pagination Info */}
                  <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                    Showing {Math.max(1, (pagination.page - 1) * pagination.per_page + 1)} to{' '}
                    {(pagination.page - 1) * pagination.per_page + sortedTrips.length} of{' '}
                    {paginationData
                      ? paginationData.total
                      : (pagination.page - 1) * pagination.per_page + sortedTrips.length}{' '}
                    trips
                  </div>

                  {/* Pagination Navigation */}
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </button>

                    <span className='text-xs sm:text-sm text-gray-700'>
                      Page {pagination.page} of{' '}
                      {paginationData
                        ? Math.max(1, paginationData.pages)
                        : Math.max(
                            1,
                            pagination.page + (sortedTrips.length === pagination.per_page ? 1 : 0)
                          )}
                    </span>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={
                        paginationData
                          ? pagination.page >= paginationData.pages
                          : sortedTrips.length < pagination.per_page
                      }
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </div>
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

        {sortedTrips && sortedTrips.length === 0 && !isLoading && !error && (
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

        {/* Dive Trips List */}
        {viewMode === 'list' && !isLoading && !error && (
          <>
            <div
              className={`space-y-4 ${compactLayout ? 'view-mode-compact' : ''} ${isMobile ? 'px-2' : ''}`}
            >
              {displayTrips?.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  user={user}
                  diveSites={diveSites}
                  compactLayout={compactLayout}
                  viewMode='list'
                />
              ))}
            </div>
            {!user && (
              <div
                className='fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-6xl px-4 mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-lg'
                style={{
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text',
                }}
              >
                <div className='flex items-center'>
                  <LogIn className='h-8 w-8 text-blue-600 mr-4' />
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-blue-900 mb-2'>Login Required</h3>
                    <p className='text-blue-700 mb-4'>
                      To view all dive trips and discover upcoming diving adventures, please log in
                      to your account.
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
          </>
        )}

        {/* Dive Trips Grid */}
        {viewMode === 'grid' && (
          <>
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''} ${isMobile ? 'px-2 gap-4' : ''}`}
            >
              {displayTrips?.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  user={user}
                  diveSites={diveSites}
                  compactLayout={compactLayout}
                  viewMode='grid'
                />
              ))}
            </div>
            {!user && (
              <div
                className='fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-6xl px-4 mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-lg'
                style={{
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                  MozUserSelect: 'text',
                  msUserSelect: 'text',
                }}
              >
                <div className='flex items-center'>
                  <LogIn className='h-8 w-8 text-blue-600 mr-4' />
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-blue-900 mb-2'>Login Required</h3>
                    <p className='text-blue-700 mb-4'>
                      To view all dive trips and discover upcoming diving adventures, please log in
                      to your account.
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
          </>
        )}

        {/* Pagination Controls - Match Dives page style */}
        {sortedTrips && sortedTrips.length > 0 && !isLoading && !error && viewMode !== 'map' && (
          <div className='mb-6 sm:mb-8'>
            <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
              <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
                {/* Pagination Controls */}
                <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4'>
                  {/* Page Size Selection */}
                  <div className='flex items-center gap-2'>
                    <label className='text-sm font-medium text-gray-700'>Show:</label>
                    <select
                      value={pagination.per_page}
                      onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className='text-sm text-gray-600'>per page</span>
                  </div>

                  {/* Pagination Info */}
                  <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                    Showing {Math.max(1, (pagination.page - 1) * pagination.per_page + 1)} to{' '}
                    {(pagination.page - 1) * pagination.per_page + sortedTrips.length} of{' '}
                    {paginationData
                      ? paginationData.total
                      : (pagination.page - 1) * pagination.per_page + sortedTrips.length}{' '}
                    trips
                  </div>

                  {/* Pagination Navigation */}
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </button>

                    <span className='text-xs sm:text-sm text-gray-700'>
                      Page {pagination.page} of{' '}
                      {paginationData
                        ? Math.max(1, paginationData.pages)
                        : Math.max(
                            1,
                            pagination.page + (sortedTrips.length === pagination.per_page ? 1 : 0)
                          )}
                    </span>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={
                        paginationData
                          ? pagination.page >= paginationData.pages
                          : sortedTrips.length < pagination.per_page
                      }
                      className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiveTrips;
