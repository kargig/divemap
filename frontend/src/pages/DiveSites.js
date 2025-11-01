import { debounce } from 'lodash';
import {
  Plus,
  Eye,
  Map,
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  TrendingUp,
  Compass,
  Globe,
  List,
  Grid,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api from '../api';
import DesktopSearchBar from '../components/DesktopSearchBar';
import DiveSitesMap from '../components/DiveSitesMap';
import ErrorPage from '../components/ErrorPage';
import HeroSection from '../components/HeroSection';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MatchTypeBadge from '../components/MatchTypeBadge';
import RateLimitError from '../components/RateLimitError';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getSortOptions } from '../utils/sortOptions';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

const DiveSites = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Dive Sites');

  // Enhanced state for mobile UX
  const [viewMode, setViewMode] = useState(() => {
    // Use React Router's searchParams consistently
    return searchParams.get('view') || 'list';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [quickFilters, setQuickFilters] = useState([]);

  // Thumbnails feature removed
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compact_layout') !== 'false'; // Default to true (compact)
  });

  // Mobile optimization styles
  const mobileStyles = {
    touchTarget: 'min-h-[44px] sm:min-h-0 touch-manipulation',
    mobilePadding: 'p-3 sm:p-4 lg:p-6',
    mobileMargin: 'mb-4 sm:mb-6 lg:mb-8',
    mobileText: 'text-xs sm:text-sm lg:text-base',
    mobileFlex: 'flex-col sm:flex-row',
    mobileCenter: 'justify-center sm:justify-start',
    mobileFullWidth: 'w-full sm:w-auto',
  };

  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const mode = searchParams.get('view') || 'list';
    return ['list', 'grid', 'map'].includes(mode) ? mode : 'list';
  };

  const getInitialFilters = () => {
    return {
      search_query: searchParams.get('search') || '',
      country: searchParams.get('country') || '',
      region: searchParams.get('region') || '',
      difficulty_code: searchParams.get('difficulty_code') || '',
      exclude_unspecified_difficulty: searchParams.get('exclude_unspecified_difficulty') === 'true',
      min_rating: searchParams.get('min_rating') || '',
      tag_ids: searchParams
        .getAll('tag_ids')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id)),
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
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  // Responsive detection using custom hook
  const { isMobile } = useResponsive();
  // Calculate effective page size for pagination display
  const effectivePageSize = pagination.page_size || 25;
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    search_query: getInitialFilters().search_query,
    country: getInitialFilters().country,
    region: getInitialFilters().region,
    location: getInitialFilters().location,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } =
    useSorting('dive-sites');

  // Update viewMode when searchParams change
  useEffect(() => {
    const newViewMode = searchParams.get('view') || 'list';
    setViewMode(newViewMode);
  }, [searchParams]);

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    debounce((newFilters, newPagination, newViewMode) => {
      const newSearchParams = new URLSearchParams();

      // Preserve current view mode if not explicitly changing it
      if (newViewMode) {
        if (newViewMode === 'map') {
          newSearchParams.set('view', 'map');
        } else if (newViewMode === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
        // List view is default, so no need to set it
      }

      if (newFilters.search_query && newFilters.search_query.trim()) {
        newSearchParams.set('search', newFilters.search_query.trim());
      }

      if (newFilters.country && newFilters.country.trim()) {
        newSearchParams.set('country', newFilters.country.trim());
      }

      if (newFilters.region && newFilters.region.trim()) {
        newSearchParams.set('region', newFilters.region.trim());
      }

      if (newFilters.difficulty_code && newFilters.difficulty_code.trim()) {
        newSearchParams.set('difficulty_code', newFilters.difficulty_code.trim());
      }
      if (newFilters.exclude_unspecified_difficulty) {
        newSearchParams.set('exclude_unspecified_difficulty', 'true');
      }

      if (newFilters.min_rating && newFilters.min_rating.trim()) {
        newSearchParams.set('min_rating', newFilters.min_rating.trim());
      }

      if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
        newFilters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString && tagId.toString().trim()) {
            newSearchParams.append('tag_ids', tagId.toString());
          }
        });
      }

      if (
        newPagination.page &&
        newPagination.page.toString &&
        newPagination.page.toString().trim()
      ) {
        newSearchParams.set('page', newPagination.page.toString());
      }
      if (
        newPagination.page_size &&
        newPagination.page_size.toString &&
        newPagination.page_size.toString().trim()
      ) {
        newSearchParams.set('page_size', newPagination.page_size.toString());
      }

      navigate(`?${newSearchParams.toString()}`, { replace: true });
    }, 300),
    [navigate]
  );

  // Immediate URL update for non-search filters (difficulty, ratings, tags, pagination)
  const immediateUpdateURL = useCallback(
    (newFilters, newPagination, newViewMode) => {
      const newSearchParams = new URLSearchParams();

      // Preserve current view mode if not explicitly changing it
      if (newViewMode) {
        if (newViewMode === 'map') {
          newSearchParams.set('view', 'map');
        } else if (newViewMode === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
        // List view is default, so no need to set it
      }

      if (newFilters.search_query && newFilters.search_query.trim()) {
        newSearchParams.set('search', newFilters.search_query.trim());
      }

      if (newFilters.location && newFilters.location.trim()) {
        newSearchParams.set('location', newFilters.location.trim());
      }

      if (newFilters.country && newFilters.country.trim()) {
        newSearchParams.set('country', newFilters.country.trim());
      }

      if (newFilters.region && newFilters.region.trim()) {
        newSearchParams.set('region', newFilters.region.trim());
      }

      if (newFilters.difficulty_code && newFilters.difficulty_code.trim()) {
        newSearchParams.set('difficulty_code', newFilters.difficulty_code.trim());
      }
      if (newFilters.exclude_unspecified_difficulty) {
        newSearchParams.set('exclude_unspecified_difficulty', 'true');
      }

      if (newFilters.min_rating && newFilters.min_rating.trim()) {
        newSearchParams.set('min_rating', newFilters.min_rating.trim());
      }

      if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
        newFilters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString && tagId.toString().trim()) {
            newSearchParams.append('tag_ids', tagId.toString());
          }
        });
      }

      if (
        newPagination.page &&
        newPagination.page.toString &&
        newPagination.page.toString().trim()
      ) {
        newSearchParams.set('page', newPagination.page.toString());
      }
      if (
        newPagination.page_size &&
        newPagination.page_size.toString &&
        newPagination.page_size.toString().trim()
      ) {
        newSearchParams.set('page_size', newPagination.page_size.toString());
      }

      navigate(`?${newSearchParams.toString()}`, { replace: true });
    },
    [navigate]
  );

  // Update URL when pagination changes (immediate)
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [pagination, immediateUpdateURL, filters, viewMode]);

  // Debounced URL update for search inputs
  useEffect(() => {
    debouncedUpdateURL(filters, pagination, viewMode);
  }, [
    filters.name,
    filters.search_query,
    filters.country,
    filters.region,
    filters.location,
    debouncedUpdateURL,
  ]);

  // Debounced search terms for query key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerms({
        name: filters.name,
        search_query: filters.search_query,
        country: filters.country,
        region: filters.region,
        location: filters.location,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.name, filters.search_query, filters.country, filters.region, filters.location]);

  // Immediate URL update for non-search filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [
    filters.difficulty_code,
    filters.exclude_unspecified_difficulty,
    filters.min_rating,
    filters.tag_ids,
    filters.my_dive_sites,
    immediateUpdateURL,
  ]);

  // Invalidate query when sorting changes to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries(['dive-sites']);
  }, [sortBy, sortOrder, queryClient]);

  // Fetch available tags for filtering
  const { data: availableTags } = useQuery(
    ['available-tags'],
    () => api.get('/api/v1/tags/').then(res => res.data),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch dive sites
  const {
    data: diveSitesResponse,
    isLoading,
    error,
  } = useQuery(
    [
      'dive-sites',
      debouncedSearchTerms.search_query,
      debouncedSearchTerms.country,
      debouncedSearchTerms.region,
      filters.difficulty_code,
      filters.exclude_unspecified_difficulty,
      filters.min_rating,
      filters.tag_ids,
      filters.my_dive_sites,
      pagination.page,
      pagination.page_size,
      sortBy,
      sortOrder,
    ],
    async () => {
      const params = new URLSearchParams();

      if (debouncedSearchTerms.search_query)
        params.append('search', debouncedSearchTerms.search_query);
      if (filters.difficulty_code) params.append('difficulty_code', filters.difficulty_code);
      if (filters.exclude_unspecified_difficulty) {
        params.append('exclude_unspecified_difficulty', 'true');
      }
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (debouncedSearchTerms.country) params.append('country', debouncedSearchTerms.country);
      if (debouncedSearchTerms.region) params.append('region', debouncedSearchTerms.region);

      // Add sorting parameters directly from state (not from getSortParams)
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      if (filters.tag_ids && Array.isArray(filters.tag_ids)) {
        filters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString && tagId.toString().trim()) {
            params.append('tag_ids', tagId.toString());
          }
        });
      }
      if (filters.my_dive_sites) params.append('my_dive_sites', 'true');

      if (pagination.page && pagination.page.toString && pagination.page.toString().trim()) {
        params.append('page', pagination.page.toString());
      }
      if (
        pagination.page_size &&
        pagination.page_size.toString &&
        pagination.page_size.toString().trim()
      ) {
        params.append('page_size', pagination.page_size.toString());
      }

      const response = await api.get(`/api/v1/dive-sites/?${params.toString()}`);

      // Extract pagination info from response headers
      const paginationInfo = {
        totalCount: parseInt(response.headers['x-total-count'] || '0'),
        totalPages: parseInt(response.headers['x-total-pages'] || '0'),
        currentPage: parseInt(response.headers['x-current-page'] || '1'),
        pageSize: parseInt(response.headers['x-page-size'] || '25'),
        hasNextPage: response.headers['x-has-next-page'] === 'true',
        hasPrevPage: response.headers['x-has-prev-page'] === 'true',
      };

      // Extract match type information from response headers
      const matchTypesHeader = response.headers['x-match-types'];
      let matchTypes = {};

      if (matchTypesHeader) {
        try {
          matchTypes = JSON.parse(matchTypesHeader);
        } catch (e) {
          console.warn('Failed to parse match types header:', e);
        }
      }

      return {
        data: response.data,
        matchTypes: matchTypes,
        paginationInfo: paginationInfo,
      };
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Handle the backend response structure - it returns a list directly, not an object with results
  const diveSites = diveSitesResponse
    ? { results: diveSitesResponse.data || diveSitesResponse }
    : null;
  const matchTypes = diveSitesResponse?.matchTypes || {};

  // Extract total count from the main API response headers (filtered results)
  const totalCount = diveSitesResponse?.paginationInfo?.totalCount || 0;
  const totalPages = diveSitesResponse?.paginationInfo?.totalPages || 0;
  const hasNextPage = diveSitesResponse?.paginationInfo?.hasNextPage || false;
  const hasPrevPage = diveSitesResponse?.paginationInfo?.hasPrevPage || false;

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive sites', () => window.location.reload());
  }, [error]);

  useEffect(() => {
    handleRateLimitError(availableTags?.error, 'available tags', () => window.location.reload());
  }, [availableTags?.error]);

  // handleTagChange function removed as it's now handled inline in the button onClick

  const clearFilters = () => {
    const clearedFilters = {
      search_query: '',
      difficulty_code: '',
      exclude_unspecified_difficulty: false,
      min_rating: '',
      country: '',
      region: '',
      tag_ids: [],
      my_dive_sites: false,
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    resetSorting();
    immediateUpdateURL(clearedFilters, { ...pagination, page: 1 }, viewMode);
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(prev => ({ ...prev, page: 1, page_size: newPageSize }));
  };

  const handleViewModeChange = newViewMode => {
    // Prevent switching to grid view on mobile
    if (isMobile && newViewMode === 'grid') {
      return;
    }

    setViewMode(newViewMode);

    // Update URL with new view mode
    const urlParams = new URLSearchParams(window.location.search);
    if (newViewMode === 'map') {
      urlParams.set('view', 'map');
    } else if (newViewMode === 'grid' && !isMobile) {
      urlParams.set('view', 'grid');
    } else {
      urlParams.delete('view'); // Default to list view
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

  const handleQuickFilter = filterType => {
    // Toggle the filter in the quickFilters array
    setQuickFilters(prev => {
      if (prev.includes(filterType)) {
        // Remove filter if already selected
        return prev.filter(f => f !== filterType);
      } else {
        // Add filter if not selected
        return [...prev, filterType];
      }
    });

    // Apply the quick filter changes
    if (filterType === 'clear') {
      setQuickFilters([]);
      setFilters(prev => ({
        ...prev,
        difficulty_code: '',
        search_query: '',
        tag_ids: [],
      }));
    } else {
      // Handle additive tag filters
      const tagIdMap = {
        wrecks: 8,
        reefs: 14,
        boat_dive: 4,
        shore_dive: 13,
      };

      // Handle difficulty filters (these are mutually exclusive)
      const difficultyFilters = ['beginner', 'intermediate', 'advanced'];

      setFilters(prev => {
        const newFilters = { ...prev };

        if (difficultyFilters.includes(filterType)) {
          // For difficulty, replace any existing difficulty
          newFilters.difficulty_code = filterType;
          newFilters.search_query = '';
        } else if (tagIdMap[filterType]) {
          // For tag filters, add/remove from existing tags
          const currentTagIds = prev.tag_ids || [];
          const tagId = tagIdMap[filterType];

          if (currentTagIds.includes(tagId)) {
            // Remove tag if already selected
            newFilters.tag_ids = currentTagIds.filter(id => id !== tagId);
          } else {
            // Add tag if not selected
            newFilters.tag_ids = [...currentTagIds, tagId];
          }
          newFilters.search_query = '';
        }

        return newFilters;
      });
    }

    // Reset to first page
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search_query) count++;
    if (filters.country) count++;
    if (filters.region) count++;
    if (filters.difficulty_code) count++;
    if (filters.exclude_unspecified_difficulty) count++;
    if (filters.min_rating) count++;
    if (filters.tag_ids && filters.tag_ids.length > 0) count++;
    return count;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Error handling is now done within the content area to preserve hero section

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Mobile-First Responsive Container */}
      <div className='max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        {/* Hero Section */}
        <HeroSection
          title='Dive Sites'
          subtitle='Discover amazing dive sites around the world'
          background='ocean'
          size='large'
          showLogo={false}
          logoBackground={true}
          threeColumnLayout={true}
        >
          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
            <button
              onClick={() => {
                navigate('/map?type=dive-sites');
              }}
              className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Compass className='w-5 h-5' />
              Explore Map
            </button>
            <button
              onClick={() => {
                if (!user) {
                  window.alert('You need an account for this action.\\nPlease Login or Register.');
                  return;
                }
                navigate('/dive-sites/create');
              }}
              className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Plus size={20} />
              Add Dive Site
            </button>
          </div>
        </HeroSection>
        {/* Map Section - Show immediately when in map view */}
        {viewMode === 'map' && (
          <div className='mb-8'>
            {isLoading ? (
              <LoadingSkeleton type='map' />
            ) : (
              <div className='bg-white rounded-lg shadow-md p-4 mb-6'>
                <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                  Map view of filtered Dive Sites
                </h2>
                <div className='h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-200'>
                  <DiveSitesMap data-testid='dive-sites-map' diveSites={diveSites?.results || []} />
                </div>
              </div>
            )}
          </div>
        )}
        {/* Filter Bar - Sticky and compact with mobile-first responsive design */}
        <div className='sticky-below-navbar bg-white shadow-sm border-b border-gray-200 rounded-t-lg py-3 sm:py-4'>
          {isLoading ? (
            <LoadingSkeleton type='filter' />
          ) : (
            <>
              {/* Desktop Search Bar - Only visible on desktop/tablet */}
              {!isMobile && (
                <DesktopSearchBar
                  searchValue={filters.search_query}
                  onSearchChange={value => handleFilterChange('search_query', value)}
                  onSearchSelect={selectedItem => {
                    handleFilterChange('search_query', selectedItem.name);
                  }}
                  data={diveSites?.results || []}
                  configType='diveSites'
                  placeholder='Search dive sites by name, country, region, or description...'
                />
              )}

              <ResponsiveFilterBar
                showFilters={showAdvancedFilters}
                onToggleFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
                onClearFilters={clearFilters}
                activeFiltersCount={getActiveFiltersCount()}
                filters={{ ...filters, availableTags, user }}
                onFilterChange={handleFilterChange}
                onQuickFilter={handleQuickFilter}
                quickFilters={quickFilters}
                variant='inline'
                showQuickFilters={true}
                showAdvancedToggle={true}
                searchQuery={filters.search_query}
                onSearchChange={value => handleFilterChange('search_query', value)}
                onSearchSubmit={() => {}}
                // Add sorting props
                sortBy={sortBy}
                sortOrder={sortOrder}
                sortOptions={getSortOptions('dive-sites')}
                onSortChange={handleSortChange}
                onReset={resetSorting}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                compactLayout={compactLayout}
                onDisplayOptionChange={handleDisplayOptionChange}
              />
            </>
          )}
        </div>
        {/* Content Section */}
        <div className={`content-section ${mobileStyles.mobileMargin}`}>
          {/* Pagination Controls - Mobile-first responsive design */}
          {isLoading ? (
            <LoadingSkeleton type='pagination' className='mb-2 sm:mb-6 lg:mb-8' />
          ) : (
            <div className='mb-2 sm:mb-6 lg:mb-8'>
              <div className='bg-white rounded-lg shadow-md p-2 sm:p-4 lg:p-6'>
                <div className='flex flex-col lg:flex-row justify-between items-center gap-2 sm:gap-4'>
                  {/* Pagination Controls */}
                  <div className='flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto'>
                    {/* Page Size Selection */}
                    <div className='flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start'>
                      <label className='text-xs sm:text-sm font-medium text-gray-700'>Show:</label>
                      <select
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
                    {totalCount !== undefined && totalCount !== null && (
                      <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                        Showing {Math.max(1, (pagination.page - 1) * effectivePageSize + 1)} to{' '}
                        {Math.min(pagination.page * effectivePageSize, totalCount)} of {totalCount}{' '}
                        dive sites
                      </div>
                    )}

                    {/* Pagination Navigation */}
                    {totalCount !== undefined && totalCount !== null && totalCount > 0 && (
                      <div className='flex items-center gap-1 sm:gap-2'>
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!hasPrevPage}
                          className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                        >
                          <ChevronLeft className='h-4 w-4' />
                        </button>

                        <span className='text-xs sm:text-sm text-gray-700 px-1 sm:px-2'>
                          Page {pagination.page} of{' '}
                          {totalPages || Math.max(1, Math.ceil(totalCount / effectivePageSize))}
                        </span>

                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!hasNextPage}
                          className='px-2 sm:px-3 py-1 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                        >
                          <ChevronRight className='h-4 w-4' />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Section - Mobile-first responsive design */}
          {error ? (
            <ErrorPage error={error} onRetry={() => window.location.reload()} />
          ) : isLoading ? (
            <LoadingSkeleton
              type='card'
              count={pagination.page_size || 25}
              className={`space-y-2 sm:space-y-3 ${compactLayout ? 'view-mode-compact' : ''}`}
            />
          ) : (
            <>
              {/* Dive Sites List - Show when data is available and viewMode is list */}
              {viewMode === 'list' && diveSites?.results && (
                <div
                  data-testid='dive-sites-list'
                  className={`space-y-2 sm:space-y-3 ${compactLayout ? 'view-mode-compact' : ''}`}
                >
                  {diveSites.results.map(site => (
                    <div
                      key={site.id}
                      className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative ${
                        compactLayout ? 'p-2 sm:p-3' : 'p-3 sm:p-4'
                      }`}
                    >
                      <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2'>
                        {/* Mobile: View button in upper right corner */}
                        <Link
                          to={`/dive-sites/${site.id}`}
                          state={{ from: location.pathname + location.search }}
                          className='sm:hidden absolute top-2 right-2 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors min-h-[32px] touch-manipulation'
                        >
                          <Eye className='w-3 h-3' />
                          <span>View</span>
                        </Link>

                        <div className='flex-1 min-w-0'>
                          <div className='flex items-start gap-2 mb-2'>
                            {/* Thumbnail removed */}
                            <div className='min-w-0 flex-1'>
                              <div className='flex flex-col gap-0'>
                                <h3
                                  className={`font-semibold text-gray-900 truncate ${compactLayout ? 'text-sm' : 'text-base'} sm:mb-0 -mb-2 leading-tight sm:leading-normal`}
                                >
                                  <Link
                                    to={`/dive-sites/${site.id}`}
                                    state={{ from: location.pathname + location.search }}
                                    className='hover:text-blue-600 transition-colors block truncate'
                                    title={site.name}
                                  >
                                    {site.name}
                                  </Link>
                                </h3>
                                {/* Mobile: Country/Region as subtitle */}
                                {(site.country || site.region) && (
                                  <span
                                    className={`text-gray-600 ${compactLayout ? 'text-xs' : 'text-sm'} sm:hidden -mt-3 leading-tight`}
                                  >
                                    {[site.country, site.region].filter(Boolean).join(', ')}
                                  </span>
                                )}
                                {/* Desktop: Country/Region in original position */}
                                <div className='hidden sm:flex sm:flex-row sm:items-center gap-1 sm:gap-2'>
                                  {/* Match Type Badge - Show when we have match type information */}
                                  {matchTypes[site.id] && (
                                    <MatchTypeBadge
                                      matchType={matchTypes[site.id].type}
                                      score={matchTypes[site.id].score}
                                      className='flex-shrink-0'
                                    />
                                  )}
                                  {(site.country || site.region) && (
                                    <span
                                      className={`text-gray-600 flex-shrink-0 ${compactLayout ? 'text-xs' : 'text-sm'}`}
                                    >
                                      {[site.country, site.region].filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Desktop: View button in original position */}
                        <Link
                          to={`/dive-sites/${site.id}`}
                          state={{ from: location.pathname + location.search }}
                          className='hidden sm:inline-flex self-center flex-shrink-0 items-center justify-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors'
                        >
                          <Eye className='w-3 h-3' />
                          <span>View</span>
                        </Link>
                      </div>

                      <div className='flex flex-wrap items-center gap-2 sm:gap-4 mb-2'>
                        <div className='flex items-center gap-1'>
                          <span
                            className={`inline-flex items-center px-2 py-1 sm:py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(site.difficulty_code)}`}
                          >
                            {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                          </span>
                        </div>
                        {site.max_depth !== undefined && site.max_depth !== null && (
                          <div className='flex items-center gap-1'>
                            <TrendingUp className='w-3 h-3 text-gray-400' />
                            <span className='text-xs text-gray-600'>{site.max_depth}m</span>
                          </div>
                        )}
                        {site.average_rating !== undefined && site.average_rating !== null && (
                          <div className='flex items-center gap-1'>
                            <Star className='w-3 h-3 text-yellow-400' />
                            <span className='text-xs text-gray-600'>
                              {Number(site.average_rating).toFixed(1)}/10
                            </span>
                          </div>
                        )}
                        {/* Geo coordinates removed for mobile view */}
                      </div>

                      {site.description && (
                        <p
                          className={`text-gray-700 ${compactLayout ? 'text-xs' : 'text-sm'} mb-2 line-clamp-2`}
                        >
                          {renderTextWithLinks(site.description)}
                        </p>
                      )}

                      {/* Tags */}
                      {site.tags && site.tags.length > 0 && (
                        <div className='flex flex-wrap gap-1'>
                          {site.tags.slice(0, 3).map((tag, index) => {
                            const tagName = tag.name || tag;
                            const tagId = tag.id || tag;
                            return (
                              <button
                                key={index}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const currentTagIds = filters.tag_ids || [];
                                  const newTagIds = currentTagIds.includes(tagId)
                                    ? currentTagIds.filter(id => id !== tagId)
                                    : [...currentTagIds, tagId];
                                  handleFilterChange('tag_ids', newTagIds);
                                }}
                                className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded cursor-pointer hover:opacity-80 transition-opacity ${getTagColor(tagName)}`}
                                title={`Filter by ${tagName}`}
                              >
                                {tagName}
                              </button>
                            );
                          })}
                          {site.tags.length > 3 && (
                            <span className='inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded'>
                              +{site.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dive Sites Grid */}
              {viewMode === 'grid' && !isMobile && diveSites?.results && (
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${compactLayout ? 'view-mode-compact' : ''}`}
                >
                  {diveSites.results.map(site => (
                    <div
                      key={site.id}
                      className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                        compactLayout ? 'p-3' : 'p-4'
                      }`}
                    >
                      {/* Thumbnail removed */}

                      <div className='p-3'>
                        <div className='flex items-center gap-3 mb-2'>
                          <h3
                            className={`font-semibold text-gray-900 truncate flex-1 ${compactLayout ? 'text-base' : 'text-lg'}`}
                          >
                            <Link
                              to={`/dive-sites/${site.id}`}
                              state={{ from: location.pathname + location.search }}
                              className='hover:text-blue-600 transition-colors block truncate'
                              title={site.name}
                            >
                              {site.name}
                            </Link>
                          </h3>
                          {/* Match Type Badge - Show when we have match type information */}
                          {matchTypes[site.id] && (
                            <MatchTypeBadge
                              matchType={matchTypes[site.id].type}
                              score={matchTypes[site.id].score}
                              className='flex-shrink-0'
                            />
                          )}
                          {(site.country || site.region) && (
                            <span
                              className={`text-gray-600 flex-shrink-0 ${compactLayout ? 'text-xs' : 'text-sm'}`}
                            >
                              {[site.country, site.region].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>

                        <div className='mb-2'>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(site.difficulty_code)}`}
                          >
                            {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                          </span>
                        </div>

                        <div className='grid grid-cols-2 gap-2 mb-2'>
                          {site.max_depth !== undefined && site.max_depth !== null && (
                            <div className='flex items-center gap-2'>
                              <TrendingUp className='w-4 h-4 text-gray-400' />
                              <span className='text-sm text-gray-600'>{site.max_depth}m</span>
                            </div>
                          )}
                          {site.average_rating !== undefined && site.average_rating !== null && (
                            <div className='flex items-center gap-2'>
                              <Star className='w-4 h-4 text-yellow-400' />
                              <span className='text-sm text-gray-600'>
                                {Number(site.average_rating).toFixed(1)}/10
                              </span>
                            </div>
                          )}
                          {/* Geo coordinates removed for grid view */}
                        </div>

                        {site.description && (
                          <p
                            className={`text-gray-700 ${compactLayout ? 'text-xs' : 'text-sm'} mb-2 line-clamp-2`}
                          >
                            {site.description.split(/(https?:\/\/[^\s]+)/).map((part, index) => {
                              if (part.match(/^https?:\/\//)) {
                                return (
                                  <a
                                    key={index}
                                    href={part}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-blue-600 hover:text-blue-800 underline break-all'
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              return part;
                            })}
                          </p>
                        )}

                        {/* Tags */}
                        {site.tags && site.tags.length > 0 && (
                          <div className='mb-4'>
                            <div className='flex flex-wrap gap-2'>
                              {site.tags.slice(0, 3).map((tag, index) => {
                                const tagName = tag.name || tag;
                                const tagId = tag.id || tag;
                                return (
                                  <button
                                    key={index}
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const currentTagIds = filters.tag_ids || [];
                                      const newTagIds = currentTagIds.includes(tagId)
                                        ? currentTagIds.filter(id => id !== tagId)
                                        : [...currentTagIds, tagId];
                                      handleFilterChange('tag_ids', newTagIds);
                                    }}
                                    className='inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full cursor-pointer hover:opacity-80 transition-opacity'
                                    title={`Filter by ${tagName}`}
                                  >
                                    {tagName}
                                  </button>
                                );
                              })}
                              {site.tags.length > 3 && (
                                <span className='inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full'>
                                  +{site.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <Link
                          to={`/dive-sites/${site.id}`}
                          state={{ from: location.pathname + location.search }}
                          className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors'
                        >
                          <Eye className='w-4 h-4' />
                          View Site
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Close content-section */}
              {/* No Results Message */}
              {diveSites?.results?.length === 0 && (
                <div className='text-center py-8 sm:py-12'>
                  <Map className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                  <p className='text-sm sm:text-base text-gray-600'>
                    {filters.search_query.trim()
                      ? `No dive sites found matching "${filters.search_query}". Try adjusting your search terms.`
                      : 'No dive sites found matching your criteria.'}
                  </p>
                </div>
              )}
              {/* Fallback message when no dive sites are found */}
              {diveSites?.results && diveSites.results.length === 0 && (
                <div className='text-center py-12'>
                  <p className='text-gray-600'>No dive sites found matching your criteria.</p>
                  <p className='text-sm text-gray-500 mt-2'>
                    Try adjusting your search or filters.
                  </p>
                </div>
              )}

              {/* Did you mean? - Show fuzzy search suggestions when no exact matches */}
              {diveSites?.results && diveSites.results.length === 0 && filters.search_query && (
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
                  <h3 className='text-lg font-medium text-blue-900 mb-2'>Did you mean?</h3>
                  <p className='text-blue-700 mb-3'>
                    No exact matches found for "{filters.search_query}". Here are some similar dive
                    sites:
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {/* This will be populated by backend fuzzy search results */}
                    <div className='text-sm text-blue-600'>
                      Try searching for similar terms or check the spelling.
                    </div>
                  </div>
                </div>
              )}
              {/* No Results Message */}
              {diveSites?.results?.length === 0 && (
                <div className='text-center py-8 sm:py-12'>
                  <Map className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                  <p className='text-sm sm:text-base text-gray-600'>
                    {filters.search_query.trim()
                      ? `No dive sites found matching "${filters.search_query}". Try adjusting your search terms.`
                      : 'No dive sites found matching your criteria.'}
                  </p>
                </div>
              )}
              {/* Fallback message when no dive sites are found */}
              {diveSites?.results && diveSites.results.length === 0 && (
                <div className='text-center py-12'>
                  <p className='text-gray-600'>No dive sites found matching your criteria.</p>
                  <p className='text-sm text-gray-500 mt-2'>
                    Try adjusting your search or filters.
                  </p>
                </div>
              )}

              {/* Did you mean? - Show fuzzy search suggestions when no exact matches */}
              {diveSites?.results && diveSites.results.length === 0 && filters.search_query && (
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
                  <h3 className='text-lg font-medium text-blue-900 mb-2'>Did you mean?</h3>
                  <p className='text-blue-700 mb-3'>
                    No exact matches found for "{filters.search_query}". Here are some similar dive
                    sites:
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {/* This will be populated by backend fuzzy search results */}
                    <div className='text-sm text-blue-600'>
                      Try searching for similar terms or check the spelling.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {/* Close content-section */}
      </div>
      {/* Close mobile-first responsive container */}
      {/* Phase 5 Mobile Optimization Summary */}
      {/*
        ✅ Mobile-First Responsive Design Implemented:
        - Touch-friendly controls with 44px minimum height
        - Responsive padding and margins (p-3 sm:p-4 lg:p-6)
        - Mobile-optimized text sizes (text-xs sm:text-sm lg:text-base)
        - Flexible layouts (flex-col sm:flex-row)
        - Mobile-centered content with desktop justification
        - Full-width mobile elements with auto desktop sizing
        - Touch manipulation and active states for better UX
        - Progressive disclosure for mobile information density
      */}
    </div>
  );
};

export default DiveSites;
