import {
  Plus,
  Eye,
  Search,
  Star,
  MapPin,
  Building,
  Phone,
  Mail,
  Globe,
  List,
  Map,
  Grid,
  Compass,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api, { extractErrorMessage } from '../api';
import DivingCentersDesktopSearchBar from '../components/DivingCentersDesktopSearchBar';
import DivingCentersMap from '../components/DivingCentersMap';
import DivingCentersResponsiveFilterBar from '../components/DivingCentersResponsiveFilterBar';
import ErrorPage from '../components/ErrorPage';
import HeroSection from '../components/HeroSection';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MaskedEmail from '../components/MaskedEmail';
import MatchTypeBadge from '../components/MatchTypeBadge';
import RateLimitError from '../components/RateLimitError';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive, useResponsiveScroll } from '../hooks/useResponsive';
import { useSetting } from '../hooks/useSettings';
import useSorting from '../hooks/useSorting';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getSortOptions } from '../utils/sortOptions';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

const DivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Diving Centers');

  // Check if reviews are enabled
  const { data: reviewsDisabledSetting } = useSetting('disable_diving_center_reviews');
  const reviewsEnabled = reviewsDisabledSetting?.value === false;

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'list';
  });
  // Compact layout state management
  const { compactLayout, handleDisplayOptionChange } = useCompactLayout();

  // Filter visibility state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState('');
  // Track which center emails are revealed in grid view
  const [revealedEmails, setRevealedEmails] = useState({});
  // Track expanded descriptions per center in grid view
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const maskEmailForTooltip = email => {
    if (!email || !email.includes('@')) return email;
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart.charAt(0)}***@${domain}`;
    } else {
      const firstChar = localPart.charAt(0);
      const lastChar = localPart.charAt(localPart.length - 1);
      const maskedPart = '*'.repeat(localPart.length - 2);
      return `${firstChar}${maskedPart}${lastChar}@${domain}`;
    }
  };

  // Responsive detection using custom hook
  const { isMobile } = useResponsive();
  const { searchBarVisible } = useResponsiveScroll();

  // Get initial values from URL parameters
  const getInitialFilters = () => {
    return {
      search: searchParams.get('search') || '',
      name: searchParams.get('name') || '',
      min_rating: searchParams.get('min_rating') || '',
      country: searchParams.get('country') || '',
      region: searchParams.get('region') || '',
      city: searchParams.get('city') || '',
    };
  };

  const getInitialPagination = () => {
    return {
      page: parseInt(searchParams.get('page')) || 1,
      page_size: parseInt(searchParams.get('page_size')) || 25,
    };
  };

  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    search: getInitialFilters().search,
    name: getInitialFilters().name,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } =
    useSorting('diving-centers');

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    (() => {
      let timeoutId;
      return (newFilters, newPagination, newViewMode) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const newSearchParams = new URLSearchParams();

          // Add view mode
          if (newViewMode && newViewMode !== 'list') {
            newSearchParams.set('view', newViewMode);
          }

          // Add filters
          if (newFilters.search) newSearchParams.set('search', newFilters.search);
          if (newFilters.name) newSearchParams.set('name', newFilters.name);
          if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);
          if (newFilters.country) newSearchParams.set('country', newFilters.country);
          if (newFilters.region) newSearchParams.set('region', newFilters.region);
          if (newFilters.city) newSearchParams.set('city', newFilters.city);

          // Add sorting parameters
          const sortParams = getSortParams();
          if (sortParams.sort_by) newSearchParams.set('sort_by', sortParams.sort_by);
          if (sortParams.sort_order) newSearchParams.set('sort_order', sortParams.sort_order);

          // Add pagination
          newSearchParams.set('page', newPagination.page.toString());
          newSearchParams.set('page_size', newPagination.page_size.toString());

          // Update URL without triggering a page reload
          navigate(`?${newSearchParams.toString()}`, { replace: true });
        }, 800); // 800ms debounce delay
      };
    })(),
    [navigate, sortBy, sortOrder]
  );

  // Immediate URL update for non-search filters
  const immediateUpdateURL = useCallback(
    (newFilters, newPagination, newViewMode) => {
      const newSearchParams = new URLSearchParams();

      // Add view mode
      if (newViewMode && newViewMode !== 'list') {
        newSearchParams.set('view', newViewMode);
      }

      // Add filters
      if (newFilters.search) newSearchParams.set('search', newFilters.search);
      if (newFilters.name) newSearchParams.set('name', newFilters.name);
      if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);
      if (newFilters.country) newSearchParams.set('country', newFilters.country);
      if (newFilters.region) newSearchParams.set('region', newFilters.region);
      if (newFilters.city) newSearchParams.set('city', newFilters.city);

      // Add sorting parameters
      const sortParams = getSortParams();
      if (sortParams.sort_by) newSearchParams.set('sort_by', sortParams.sort_by);
      if (sortParams.sort_order) newSearchParams.set('sort_order', sortParams.sort_order);

      // Add pagination
      newSearchParams.set('page', newPagination.page.toString());
      newSearchParams.set('page_size', newPagination.page_size.toString());

      // Update URL without triggering a page reload
      navigate(`?${newSearchParams.toString()}`, { replace: true });
    },
    [navigate, sortBy, sortOrder]
  );

  // Update URL when view mode or pagination change (immediate)
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [viewMode, pagination, immediateUpdateURL]);

  // Debounced URL update for search inputs
  useEffect(() => {
    debouncedUpdateURL(filters, pagination, viewMode);
  }, [filters.search, debouncedUpdateURL]);

  // Debounced search terms for query key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerms({
        search: filters.search,
        name: filters.name,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.search, filters.name]);

  // Set debounced search terms immediately on initial load if URL has search parameters
  useEffect(() => {
    if (filters.search || filters.name) {
      setDebouncedSearchTerms({
        search: filters.search,
        name: filters.name,
      });
    }
  }, []); // Only run once on mount

  // Immediate URL update for non-search filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [filters.min_rating, filters.country, filters.region, filters.city, immediateUpdateURL]);

  // Invalidate query when sorting changes to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries(['diving-centers']);
  }, [sortBy, sortOrder, queryClient]);

  // Fetch diving centers with pagination
  const {
    data: divingCenters,
    isLoading,
    error,
  } = useQuery(
    [
      'diving-centers',
      debouncedSearchTerms.search,
      debouncedSearchTerms.name,
      filters.min_rating,
      filters.country,
      filters.region,
      filters.city,
      pagination.page,
      pagination.page_size,
      sortBy,
      sortOrder,
    ],
    () => {
      // Create URLSearchParams to properly handle parameters
      const params = new URLSearchParams();

      // Add filter parameters
      if (debouncedSearchTerms.search) params.append('search', debouncedSearchTerms.search);
      if (debouncedSearchTerms.name) params.append('name', debouncedSearchTerms.name);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);
      if (filters.city) params.append('city', filters.city);

      // Add sorting parameters directly from state (not from getSortParams)
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      // Add pagination parameters
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());

      return api.get(`/api/v1/diving-centers/?${params.toString()}`);
    },
    {
      select: response => {
        // Store pagination info from headers
        const paginationInfo = {
          totalCount: parseInt(response.headers['x-total-count'] || '0'),
          totalPages: parseInt(response.headers['x-total-pages'] || '0'),
          currentPage: parseInt(response.headers['x-current-page'] || '1'),
          pageSize: parseInt(response.headers['x-page-size'] || '25'),
          hasNextPage: response.headers['x-has-next-page'] === 'true',
          hasPrevPage: response.headers['x-has-prev-page'] === 'true',
        };

        // Extract match types from headers if available
        let matchTypes = {};
        try {
          if (response.headers['x-match-types']) {
            matchTypes = JSON.parse(response.headers['x-match-types']);
          }
        } catch (error) {
          console.warn('Failed to parse match types header:', error);
        }

        // Store pagination info in the query cache
        queryClient.setQueryData(
          ['diving-centers-pagination', filters, pagination],
          paginationInfo
        );

        // Store match types in the query cache
        queryClient.setQueryData(
          [
            'diving-centers-match-types',
            debouncedSearchTerms.search,
            debouncedSearchTerms.name,
            filters.min_rating,
            filters.country,
            filters.region,
            filters.city,
            pagination.page,
            pagination.page_size,
            sortBy,
            sortOrder,
          ],
          matchTypes
        );

        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'diving centers', () => window.location.reload());
  }, [error]);

  // Get pagination info from cached data
  const paginationInfo = queryClient.getQueryData([
    'diving-centers-pagination',
    filters,
    pagination,
  ]) || {
    totalCount: 0,
    totalPages: 0,
    currentPage: pagination.page,
    pageSize: pagination.page_size,
    hasNextPage: false,
    hasPrevPage: pagination.page > 1,
  };

  // Get match types from cached data
  const matchTypes =
    queryClient.getQueryData([
      'diving-centers-match-types',
      debouncedSearchTerms.search,
      debouncedSearchTerms.name,
      filters.min_rating,
      filters.country,
      filters.region,
      filters.city,
      pagination.page,
      pagination.page_size,
      sortBy,
      sortOrder,
    ]) || {};

  // Rating mutation
  const rateMutation = useMutation(
    ({ centerId, score }) => api.post(`/api/v1/diving-centers/${centerId}/rate`, { score }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-centers']);
        toast.success('Rating submitted successfully!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to submit rating');
      },
    }
  );

  const handleSearchChange = e => {
    const { name, value } = e.target;
    setFilters(_prev => ({
      ..._prev,
      [name]: value,
    }));
    // Reset to first page when filters change
    setPagination(_prev => ({ ..._prev, page: 1 }));
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(_prev => ({
      page: 1, // Reset to first page when changing page size
      page_size: newPageSize,
    }));
  };

  const handleRating = (centerId, score) => {
    if (!user) {
      toast.error('Please log in to rate diving centers');
      return;
    }
    rateMutation.mutate({ centerId, score });
  };

  // Helper function to count active filters
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.name) count++;
    if (filters.min_rating) count++;
    if (filters.country) count++;
    if (filters.region) count++;
    if (filters.city) count++;
    return count;
  };

  // Function to clear all filters
  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      name: '',
      min_rating: '',
      country: '',
      region: '',
      city: '',
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    immediateUpdateURL(clearedFilters, { ...pagination, page: 1 }, viewMode);
  };

  const handleViewModeChange = newViewMode => {
    setViewMode(newViewMode);

    // Update URL with new view mode
    const urlParams = new URLSearchParams(window.location.search);
    if (newViewMode === 'list') {
      urlParams.delete('view'); // Default view, no need for parameter
    } else {
      urlParams.set('view', newViewMode);
    }

    // Update URL without triggering a page reload
    navigate(`?${urlParams.toString()}`, { replace: true });
  };

  const handleQuickFilter = filterType => {
    // Toggle the quick filter - if it's already active, deactivate it
    if (quickFilter === filterType) {
      setQuickFilter('');
      // Clear the corresponding filter
      switch (filterType) {
        case 'min_rating':
          setFilters(prev => ({ ...prev, min_rating: '' }));
          break;
        case 'country':
          setFilters(prev => ({ ...prev, country: '' }));
          break;
        default:
          break;
      }
    } else {
      setQuickFilter(filterType);
      // Apply the quick filter
      switch (filterType) {
        case 'min_rating':
          setFilters(prev => ({ ...prev, min_rating: '4' }));
          break;
        case 'country':
          setFilters(prev => ({ ...prev, country: 'Greece' }));
          break;
        default:
          break;
      }
    }

    // Reset to first page
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Apply a filter when clicking a badge (country, region, city)
  const applyFilterTag = (key, value) => {
    if (!value) return;
    const newFilters = { ...filters, [key]: value };
    const newPagination = { ...pagination, page: 1 };
    setFilters(newFilters);
    setPagination(newPagination);
    immediateUpdateURL(newFilters, newPagination, viewMode);
  };

  // Error handling is now done within the content area to preserve hero section

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Mobile-First Responsive Container */}
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        {/* Hero Section */}
        <HeroSection
          title='Diving Centers'
          subtitle='Discover and connect with professional diving centers worldwide'
          background='ocean'
          size='large'
          showLogo={false}
          logoBackground={true}
          threeColumnLayout={true}
        >
          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
            <button
              onClick={() => {
                navigate('/map?type=diving-centers');
              }}
              className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Compass className='w-5 h-5' />
              Explore Map
            </button>
            <button
              onClick={() => {
                if (!user) {
                  window.alert('You need an account for this action.\nPlease Login or Register.');
                  return;
                }
                navigate('/diving-centers/create');
              }}
              className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Plus size={20} />
              Add Center
            </button>
          </div>
        </HeroSection>

        {/* Desktop Search Bar - Only visible on desktop/tablet */}
        {!isMobile && (
          <DivingCentersDesktopSearchBar
            searchValue={filters.search}
            onSearchChange={handleSearchChange}
            onSearchSelect={selectedItem => {
              handleSearchChange({ target: { name: 'search', value: selectedItem.name } });
            }}
            data={divingCenters || []}
            configType='divingCenters'
            placeholder='Search diving centers by name, location, or services...'
          />
        )}

        {/* Responsive Filter Bar - Handles both desktop and mobile */}
        {/* Hide on mobile when scrolling up (searchBarVisible is false) */}
        {(!isMobile || searchBarVisible) && (
          <DivingCentersResponsiveFilterBar
            showFilters={showAdvancedFilters}
            onToggleFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            onClearFilters={clearFilters}
            activeFiltersCount={getActiveFiltersCount()}
            filters={filters}
            onFilterChange={(key, value) => {
              handleSearchChange({ target: { name: key, value } });
            }}
            onQuickFilter={handleQuickFilter}
            quickFilter={quickFilter}
            variant='inline'
            showQuickFilters={true}
            showAdvancedToggle={true}
            searchQuery={filters.search}
            onSearchChange={value => handleSearchChange({ target: { name: 'search', value } })}
            onSearchSubmit={() => {}}
            // Sorting and view props
            sortBy={sortBy}
            sortOrder={sortOrder}
            sortOptions={getSortOptions('diving-centers')}
            onSortChange={handleSortChange}
            onReset={resetSorting}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            compactLayout={compactLayout}
            onDisplayOptionChange={handleDisplayOptionChange}
            reviewsEnabled={reviewsEnabled}
          />
        )}

        {/* Map Section - Show immediately when in map view */}
        {viewMode === 'map' && (
          <div className='mb-8'>
            {isLoading ? (
              <LoadingSkeleton type='map' />
            ) : (
              <div className='bg-white rounded-lg shadow-md p-4 mb-6'>
                <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                  Map view of filtered Diving Centers
                </h2>
                <div className='h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-200'>
                  <DivingCentersMap
                    divingCenters={(divingCenters || []).map(center => ({
                      ...center,
                      id: center.id.toString(),
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination Controls - Mobile-first responsive design */}
        {isLoading ? (
          <LoadingSkeleton type='pagination' className='mb-4 sm:mb-6 lg:mb-8' />
        ) : (
          divingCenters &&
          divingCenters.length > 0 && (
            <div className='mb-4 sm:mb-6 lg:mb-8 mx-3 sm:mx-4 lg:mx-6 xl:mx-8'>
              <div className='bg-white rounded-lg shadow-md p-2 sm:p-4 lg:p-6'>
                <div className='flex flex-col lg:flex-row justify-between items-center gap-2 sm:gap-4'>
                  {/* Pagination Controls */}
                  <div className='flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto'>
                    {/* Page Size Selection */}
                    <div className='flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start'>
                      <label
                        htmlFor='page-size-select-top'
                        className='text-xs sm:text-sm font-medium text-gray-700'
                      >
                        Show:
                      </label>
                      <select
                        id='page-size-select-top'
                        value={pagination.page_size}
                        onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                        className='px-1 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[36px] sm:min-h-0 touch-manipulation'
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className='text-xs sm:text-sm text-gray-600'>per page</span>
                    </div>

                    {/* Pagination Info */}
                    <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                      Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                      {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)}{' '}
                      of {paginationInfo.totalCount} diving centers
                    </div>

                    {/* Pagination Navigation */}
                    <div className='flex items-center gap-1 sm:gap-2'>
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!paginationInfo.hasPrevPage}
                        className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                      >
                        <svg
                          className='w-4 h-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M15 19l-7-7 7-7'
                          />
                        </svg>
                      </button>

                      <span className='text-xs sm:text-sm text-gray-700 px-1 sm:px-2'>
                        Page {pagination.page} of {paginationInfo.totalPages}
                      </span>

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!paginationInfo.hasNextPage}
                        className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                      >
                        <svg
                          className='w-4 h-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M9 5l7 7-7 7'
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* Content Container */}
        <div className='px-3 sm:px-4 lg:px-6 xl:px-8'>
          {error ? (
            <ErrorPage error={error} onRetry={() => window.location.reload()} />
          ) : isLoading ? (
            <LoadingSkeleton
              type='card'
              count={pagination.page_size || 25}
              className={`space-y-2 ${compactLayout ? 'view-mode-compact' : ''}`}
            />
          ) : (
            <>
              {/* Diving Centers List */}
              {viewMode === 'list' && (
                <div className={`space-y-2 ${compactLayout ? 'view-mode-compact' : ''}`}>
                  {divingCenters?.map(center => (
                    <div
                      key={center.id}
                      className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-blue-300 ${
                        compactLayout ? 'p-3' : 'p-4'
                      }`}
                    >
                      {/* Main content row */}
                      <div className='flex items-start gap-3'>
                        {/* Left side - Main info */}
                        <div className='flex-1 min-w-0'>
                          {/* Title and rating row */}
                          <div className='flex items-center justify-between mb-2'>
                            <div className='flex items-center gap-2 flex-1 min-w-0'>
                              <h3 className='font-semibold text-gray-900 text-sm flex-1 min-w-0'>
                                <Link
                                  to={`/diving-centers/${center.id}`}
                                  state={{
                                    from: window.location.pathname + window.location.search,
                                  }}
                                  className='text-blue-600 hover:text-blue-800 transition-colors block truncate'
                                >
                                  {center.name}
                                </Link>
                              </h3>
                              {/* Match type badge */}
                              {matchTypes[center.id] && (
                                <div className='flex-shrink-0'>
                                  <MatchTypeBadge
                                    matchType={matchTypes[center.id].type}
                                    score={matchTypes[center.id].score}
                                  />
                                </div>
                              )}
                            </div>
                            {center.average_rating && (
                              <div className='flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full'>
                                <Star className='w-3 h-3 text-yellow-500 fill-current' />
                                <span className='text-[11px] font-medium text-yellow-700'>
                                  {center.average_rating.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Contact and location info row */}
                          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2'>
                            {/* Email */}
                            {center.email && (
                              <div className='flex items-center gap-1 text-xs text-gray-600'>
                                <Mail className='w-3 h-3 text-gray-400' />
                                <span className='truncate'>
                                  <MaskedEmail email={center.email} />
                                </span>
                              </div>
                            )}

                            {/* Website */}
                            {center.website && (
                              <div className='flex items-center gap-1 text-xs text-gray-600'>
                                <Globe className='w-3 h-3 text-gray-400 flex-shrink-0' />
                                <a
                                  href={
                                    center.website.startsWith('http')
                                      ? center.website
                                      : `https://${center.website}`
                                  }
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='truncate text-blue-600 hover:text-blue-800 transition-colors min-w-0'
                                >
                                  {center.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            )}

                            {/* Coordinates removed to save space */}

                            {/* Geographic fields (clickable badges) - now in a single flex container */}
                            {(center.country || center.region || center.city) && (
                              <div className='flex items-center gap-1.5 flex-wrap sm:flex-nowrap'>
                                {center.country && (
                                  <button
                                    type='button'
                                    onClick={() => applyFilterTag('country', center.country)}
                                    className='flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex-shrink-0'
                                    title={`Filter by country: ${center.country}`}
                                  >
                                    <Globe className='w-3 h-3 text-blue-600' />
                                    <span className='truncate'>{center.country}</span>
                                  </button>
                                )}

                                {center.region && (
                                  <button
                                    type='button'
                                    onClick={() => applyFilterTag('region', center.region)}
                                    className='flex items-center gap-1 text-[10px] text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded flex-shrink-0'
                                    title={`Filter by region: ${center.region}`}
                                  >
                                    <MapPin className='w-3 h-3 text-green-600' />
                                    <span className='truncate'>{center.region}</span>
                                  </button>
                                )}

                                {center.city && (
                                  <button
                                    type='button'
                                    onClick={() => applyFilterTag('city', center.city)}
                                    className='flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded flex-shrink-0'
                                    title={`Filter by city: ${center.city}`}
                                  >
                                    <Building className='w-3 h-3 text-purple-600' />
                                    <span className='truncate'>{center.city}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Description - truncated for compactness */}
                          {center.description && (
                            <p
                              className={`text-gray-700 line-clamp-2 ${compactLayout ? 'text-xs' : 'text-sm'}`}
                            >
                              {center.description}
                            </p>
                          )}
                        </div>

                        {/* Right side - Actions */}
                        <div className='flex flex-col gap-2 flex-shrink-0'>
                          <Link
                            to={`/diving-centers/${center.id}`}
                            state={{ from: location.pathname + location.search }}
                            className='hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors'
                          >
                            <Eye className='w-3 h-3' />
                            Details
                          </Link>

                          {center.phone && (
                            <a
                              href={`tel:${center.phone}`}
                              className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors'
                              title='Call center'
                            >
                              <Phone className='w-3 h-3' />
                              Call
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Diving Centers Grid */}
              {viewMode === 'grid' && (
                <div
                  className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''}`}
                >
                  {divingCenters?.map(center => (
                    <div
                      key={center.id}
                      className={`dive-item bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] ${
                        compactLayout ? 'p-4' : 'p-6'
                      }`}
                    >
                      {/* Header thumbnail removed */}

                      <div className={`${compactLayout ? 'p-3' : 'p-5'}`}>
                        {/* Title and rating row */}
                        <div className='flex items-start justify-between mb-2'>
                          <div className='flex-1 pr-3 min-w-0'>
                            <div className='flex items-start gap-2 mb-1'>
                              <h3
                                className={`font-bold text-gray-900 line-clamp-2 flex-1 min-w-0 ${compactLayout ? 'text-sm' : 'text-lg'}`}
                              >
                                <Link
                                  to={`/diving-centers/${center.id}`}
                                  state={{
                                    from: window.location.pathname + window.location.search,
                                  }}
                                  className='text-blue-600 hover:text-blue-800 transition-colors hover:underline block'
                                >
                                  {center.name}
                                </Link>
                              </h3>
                              {/* Match type badge */}
                              {matchTypes[center.id] && (
                                <div className='flex-shrink-0'>
                                  <MatchTypeBadge
                                    matchType={matchTypes[center.id].type}
                                    score={matchTypes[center.id].score}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Rating badge - positioned to the right of title */}
                          {center.average_rating && (
                            <div className='bg-yellow-100 rounded-full px-3 py-1 shadow-sm border border-yellow-200 flex-shrink-0'>
                              <div className='flex items-center gap-1'>
                                <Star className='w-4 h-4 text-yellow-500 fill-current' />
                                <span className='text-[11px] font-semibold text-yellow-800'>
                                  {center.average_rating}/10
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Geolocation removed to save space */}

                        {/* Geographic fields */}
                        {(center.country || center.region || center.city) && (
                          <div className='flex items-center gap-1.5 flex-wrap sm:flex-nowrap mb-4'>
                            {center.country && (
                              <button
                                type='button'
                                onClick={() => applyFilterTag('country', center.country)}
                                className='flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 flex-shrink-0'
                                title={`Filter by country: ${center.country}`}
                              >
                                <Globe className='w-3 h-3 text-blue-600' />
                                <span className='text-[10px] font-medium text-blue-700'>
                                  {center.country}
                                </span>
                              </button>
                            )}
                            {center.region && (
                              <button
                                type='button'
                                onClick={() => applyFilterTag('region', center.region)}
                                className='flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full hover:bg-green-100 flex-shrink-0'
                                title={`Filter by region: ${center.region}`}
                              >
                                <MapPin className='w-3 h-3 text-green-600' />
                                <span className='text-[10px] font-medium text-green-700'>
                                  {center.region}
                                </span>
                              </button>
                            )}
                            {center.city && (
                              <button
                                type='button'
                                onClick={() => applyFilterTag('city', center.city)}
                                className='flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 flex-shrink-0'
                                title={`Filter by city: ${center.city}`}
                              >
                                <Building className='w-3 h-3 text-purple-600' />
                                <span className='text-[10px] font-medium text-purple-700'>
                                  {center.city}
                                </span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Key information grid */}
                        <div className='grid grid-cols-2 gap-3 mb-4'>
                          {/* Show email if available, otherwise rating */}
                          {center.email ? (
                            <div className='flex items-center justify-center bg-blue-50 rounded-lg px-3 py-2'>
                              {revealedEmails[center.id] ? (
                                <a
                                  href={`mailto:${center.email}`}
                                  className='text-blue-500 hover:text-blue-700 transition-colors'
                                  aria-label={`Send email to ${center.name}`}
                                  title={`Send email to ${center.email}`}
                                >
                                  <Mail className='w-5 h-5' />
                                </a>
                              ) : (
                                <button
                                  type='button'
                                  onClick={() =>
                                    setRevealedEmails(prev => ({ ...prev, [center.id]: true }))
                                  }
                                  className='text-blue-500 hover:text-blue-700 transition-colors'
                                  aria-label='Reveal email'
                                  title='Click to reveal'
                                >
                                  <Mail className='w-5 h-5' />
                                </button>
                              )}
                            </div>
                          ) : center.average_rating ? (
                            <div className='flex items-center justify-center bg-yellow-50 rounded-lg px-3 py-2'>
                              <div className='flex items-center gap-1'>
                                <Star className='w-4 h-4 text-yellow-500 fill-current' />
                                <span className='text-[11px] font-medium text-gray-700'>
                                  {center.average_rating}/10
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className='flex items-center justify-center bg-gray-50 rounded-lg px-3 py-2'>
                              <span className='text-sm text-gray-500'>No email</span>
                            </div>
                          )}

                          {/* Show website if available, otherwise show rating if no email */}
                          {center.website ? (
                            <div className='flex items-center justify-center bg-green-50 rounded-lg px-3 py-2'>
                              <a
                                href={
                                  center.website.startsWith('http')
                                    ? center.website
                                    : `https://${center.website}`
                                }
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-green-500 hover:text-green-700 transition-colors'
                                title={`Visit ${center.website}`}
                              >
                                <Globe className='w-5 h-5' />
                              </a>
                            </div>
                          ) : center.average_rating && !center.email ? (
                            <div className='flex items-center justify-center bg-yellow-50 rounded-lg px-3 py-2'>
                              <div className='flex items-center gap-1'>
                                <Star className='w-4 h-4 text-yellow-500 fill-current' />
                                <span className='text-[11px] font-medium text-gray-700'>
                                  {center.average_rating}/10
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className='flex items-center justify-center bg-gray-50 rounded-lg px-3 py-2'>
                              <span className='text-sm text-gray-500'>No website</span>
                            </div>
                          )}
                        </div>

                        {/* Description with expandable toggle for long texts */}
                        <div className='mb-4'>
                          <p
                            className={`text-gray-600 ${
                              expandedDescriptions[center.id] ? '' : 'line-clamp-3'
                            } ${compactLayout ? 'text-sm' : 'text-base'}`}
                          >
                            {center.description || 'No description available'}
                          </p>
                          {center.description && center.description.length > 180 && (
                            <button
                              type='button'
                              onClick={() =>
                                setExpandedDescriptions(prev => ({
                                  ...prev,
                                  [center.id]: !prev[center.id],
                                }))
                              }
                              className='mt-1 text-blue-600 hover:text-blue-700 text-sm font-medium'
                              aria-expanded={!!expandedDescriptions[center.id]}
                            >
                              {expandedDescriptions[center.id] ? 'Less' : 'More'}
                            </button>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className='flex gap-2'>
                          <Link
                            to={`/diving-centers/${center.id}`}
                            state={{ from: location.pathname + location.search }}
                            className='hidden sm:flex-1 sm:inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors hover:shadow-md'
                          >
                            <Eye className='w-4 h-4' />
                            View Details
                          </Link>

                          {center.phone && (
                            <a
                              href={`tel:${center.phone}`}
                              className='inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
                              title='Call center'
                            >
                              <Phone className='w-4 h-4' />
                            </a>
                          )}
                        </div>

                        {/* Additional info badges */}
                        {center.services && center.services.length > 0 && (
                          <div className='mt-4 pt-4 border-t border-gray-100'>
                            <div className='flex flex-wrap gap-2'>
                              {center.services.slice(0, 3).map((service, index) => (
                                <span
                                  key={index}
                                  className='inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'
                                >
                                  {service}
                                </span>
                              ))}
                              {center.services.length > 3 && (
                                <span className='inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full'>
                                  +{center.services.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {divingCenters?.length === 0 && (
                <div className='text-center py-12'>
                  <p className='text-gray-500 text-lg'>
                    No diving centers found matching your criteria.
                  </p>
                </div>
              )}

              {/* Bottom Pagination Controls */}
              {divingCenters && divingCenters.length > 0 && (
                <div className='mt-6 sm:mt-8'>
                  <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
                    <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
                      <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4'>
                        {/* Pagination Info */}
                        <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                          Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                          {Math.min(
                            pagination.page * pagination.page_size,
                            paginationInfo.totalCount
                          )}{' '}
                          of {paginationInfo.totalCount} diving centers
                        </div>

                        {/* Pagination Navigation */}
                        <div className='flex items-center gap-1 sm:gap-2'>
                          <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!paginationInfo.hasPrevPage}
                            className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                          >
                            <svg
                              className='w-4 h-4'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M15 19l-7-7 7-7'
                              />
                            </svg>
                          </button>

                          <span className='text-xs sm:text-sm text-gray-700 px-1 sm:px-2'>
                            Page {pagination.page} of {paginationInfo.totalPages}
                          </span>

                          <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!paginationInfo.hasNextPage}
                            className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                          >
                            <svg
                              className='w-4 h-4'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M9 5l7 7-7 7'
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DivingCenters;
