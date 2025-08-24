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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import DiveSitesFilterBar from '../components/DiveSitesFilterBar';
import DiveSitesMap from '../components/DiveSitesMap';
import EnhancedMobileSortingControls from '../components/EnhancedMobileSortingControls';
import FuzzySearchInput from '../components/FuzzySearchInput';
import HeroSection from '../components/HeroSection';
import MatchTypeBadge from '../components/MatchTypeBadge';
import RateLimitError from '../components/RateLimitError';
import { useAuth } from '../contexts/AuthContext';
import useSorting from '../hooks/useSorting';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getSortOptions } from '../utils/sortOptions';

const DiveSites = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Enhanced state for mobile UX
  const [viewMode, setViewMode] = useState(() => {
    // Use React Router's searchParams consistently
    return searchParams.get('view') || 'list';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');

  // View mode state
  const [showThumbnails, setShowThumbnails] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('show_thumbnails') === 'true';
  });
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
      difficulty_level: searchParams.get('difficulty_level') || '',
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

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  // Calculate effective page size for pagination display
  const effectivePageSize = pagination.page_size || 25;
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    search_query: getInitialFilters().search_query,
    country: getInitialFilters().country,
    region: getInitialFilters().region,
    location: getInitialFilters().location,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, handleSortApply, resetSorting, getSortParams } =
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
        } else if (newViewMode === 'grid') {
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

      if (newFilters.difficulty_level && newFilters.difficulty_level.trim()) {
        newSearchParams.set('difficulty_level', newFilters.difficulty_level.trim());
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
        } else if (newViewMode === 'grid') {
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

      if (newFilters.difficulty_level && newFilters.difficulty_level.trim()) {
        newSearchParams.set('difficulty_level', newFilters.difficulty_level.trim());
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
    filters.difficulty_level,
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
      filters.difficulty_level,
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
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
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
      difficulty_level: '',
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

  const handleQuickFilter = filterType => {
    setQuickFilter(filterType);

    // Apply the quick filter
    switch (filterType) {
      case 'beginner':
        setFilters(prev => ({
          ...prev,
          difficulty_level: 'beginner',
          search_query: '',
        }));
        break;
      case 'intermediate':
        setFilters(prev => ({
          ...prev,
          difficulty_level: 'intermediate',
          search_query: '',
        }));
        break;
      case 'advanced':
        setFilters(prev => ({
          ...prev,
          difficulty_level: 'advanced',
          search_query: '',
        }));
        break;
      case 'wrecks':
        setFilters(prev => ({
          ...prev,
          search_query: 'wreck',
          difficulty_level: '',
        }));
        break;
      case 'reefs':
        setFilters(prev => ({
          ...prev,
          search_query: 'reef',
          difficulty_level: '',
        }));
        break;
      case 'boat_dive':
        setFilters(prev => ({
          ...prev,
          search_query: 'boat dive',
          difficulty_level: '',
        }));
        break;
      case 'shore_dive':
        setFilters(prev => ({
          ...prev,
          search_query: 'shore dive',
          difficulty_level: '',
        }));
        break;
      case 'clear':
        setQuickFilter('');
        setFilters(prev => ({
          ...prev,
          difficulty_level: '',
          search_query: '',
        }));
        break;
      default:
        break;
    }

    // Reset to first page
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search_query) count++;
    if (filters.country) count++;
    if (filters.region) count++;
    if (filters.difficulty_level) count++;
    if (filters.min_rating) count++;
    if (filters.tag_ids && filters.tag_ids.length > 0) count++;
    return count;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error) {
    return (
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
            <p className='text-red-600'>Error loading dive sites. Please try again.</p>
            <p className='text-sm text-gray-500 mt-2'>
              {error.response?.data?.detail || error.message || 'An unexpected error occurred'}
            </p>
          </div>
        )}
      </div>
    );
  }

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
                setViewMode('map');
                navigate('/dive-sites?view=map');
              }}
              className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Compass className='w-5 h-5' />
              Explore Map
            </button>
            <button
              onClick={() => {
                setViewMode('list');
                navigate('/dive-sites');
              }}
              className='bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
            >
              <Globe className='w-5 h-5' />
              Browse Sites
            </button>
            {user && (
              <button
                onClick={() => navigate('/dive-sites/create')}
                className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
              >
                <Plus size={20} />
                Add Dive Site
              </button>
            )}
          </div>
        </HeroSection>
        {/* Map Section - Show immediately when in map view */}
        {viewMode === 'map' && (
          <div className='mb-8'>
            <div className='bg-white rounded-lg shadow-md p-4 mb-6'>
              <h2 className='text-xl font-semibold text-gray-900 mb-4'>
                Interactive Dive Sites Map
              </h2>
              <div className='h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-200'>
                <DiveSitesMap data-testid='dive-sites-map' diveSites={diveSites?.results || []} />
              </div>
            </div>
          </div>
        )}
        {/* Filter Bar - Sticky and compact with mobile-first responsive design */}
        <div className='sticky-below-navbar bg-white shadow-sm border-b border-gray-200 rounded-t-lg py-3 sm:py-4'>
          {/* Smart Fuzzy Search Input - Enhanced search experience */}
          <div className='px-3 sm:px-4 mb-3 sm:mb-4'>
            <div className='max-w-2xl mx-auto'>
              <FuzzySearchInput
                data={diveSites?.results || []}
                searchValue={filters.search_query}
                onSearchChange={value => handleFilterChange('search_query', value)}
                onSearchSelect={selectedItem => {
                  handleFilterChange('search_query', selectedItem.name);
                }}
                configType='diveSites'
                placeholder='Search dive sites by name, country, region, or description...'
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
          </div>

          <DiveSitesFilterBar
            showFilters={showAdvancedFilters}
            onToggleFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            onClearFilters={clearFilters}
            activeFiltersCount={getActiveFiltersCount()}
            filters={{ ...filters, availableTags, user }}
            onFilterChange={handleFilterChange}
            onQuickFilter={handleQuickFilter}
            quickFilter={quickFilter}
            variant='inline'
            showQuickFilters={true}
            showAdvancedToggle={true}
            mobileOptimized={true}
          />
        </div>
        {/* Content Section */}
        <div className={`content-section ${mobileStyles.mobileMargin}`}>
          {/* Enhanced Mobile Sorting Controls */}
          <div className='bg-white shadow-sm border-b border-l border-r border-gray-200 rounded-b-lg'>
            <EnhancedMobileSortingControls
              sortBy={sortBy}
              sortOrder={sortOrder}
              sortOptions={getSortOptions('dive-sites')}
              onSortChange={handleSortChange}
              onSortApply={handleSortApply}
              onReset={resetSorting}
              entityType='dive-sites'
              showFilters={false} // Hide filters in this section for now
              onToggleFilters={() => {}}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              showQuickActions={true}
              showFAB={true}
              showTabs={true}
              showThumbnails={showThumbnails}
              compactLayout={compactLayout}
              onDisplayOptionChange={handleDisplayOptionChange}
              mobileOptimized={true}
            />

            {/* Mobile View Mode Quick Access */}
            {isMobile && (
              <div data-testid='view-mode-toggle' className='mt-4 flex justify-center gap-2'>
                <button
                  data-testid='list-view-button'
                  onClick={() => handleViewModeChange('list')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } touch-manipulation min-h-[44px] ${viewMode === 'list' ? 'active' : ''}`}
                >
                  <List className='h-5 w-5 inline mr-2' />
                  List
                </button>
                <button
                  data-testid='grid-view-button'
                  onClick={() => handleViewModeChange('grid')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } touch-manipulation min-h-[44px] ${viewMode === 'grid' ? 'active' : ''}`}
                >
                  <Grid className='h-5 w-5 inline mr-2' />
                  Grid
                </button>
                <button
                  data-testid='map-view-button'
                  onClick={() => handleViewModeChange('map')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } touch-manipulation min-h-[44px] ${viewMode === 'map' ? 'active' : ''}`}
                >
                  <Map className='h-5 w-5 inline mr-2' />
                  Map
                </button>
              </div>
            )}
          </div>

          {/* Pagination Controls - Mobile-first responsive design */}
          <div className='mb-4 sm:mb-6 lg:mb-8'>
            <div className='bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6'>
              <div className='flex flex-col lg:flex-row justify-between items-center gap-3 sm:gap-4'>
                {/* Pagination Controls */}
                <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto'>
                  {/* Page Size Selection */}
                  <div className='flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start'>
                    <label className='text-xs sm:text-sm font-medium text-gray-700'>Show:</label>
                    <select
                      value={pagination.page_size}
                      onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                      className='px-2 sm:px-3 py-2 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] sm:min-h-0 touch-manipulation'
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
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!hasPrevPage}
                        className='px-3 py-2 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors'
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </button>

                      <span className='text-xs sm:text-sm text-gray-700 px-2'>
                        Page {pagination.page} of{' '}
                        {totalPages || Math.max(1, Math.ceil(totalCount / effectivePageSize))}
                      </span>

                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!hasNextPage}
                        className='px-3 py-2 sm:py-1 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[44px] sm:min-h-0 touch-manipulation transition-colors'
                      >
                        <ChevronRight className='h-4 w-4' />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Mobile-first responsive design */}
          <div className='flex flex-col sm:flex-row justify-center sm:justify-end items-center mb-4 sm:mb-6 gap-3 sm:gap-4'>
            {user && (
              <div className='flex flex-col sm:flex-row gap-3 w-full sm:w-auto'>
                <button
                  onClick={() => navigate('/dive-sites/create')}
                  className='bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-4 py-3 sm:py-2 rounded-lg flex items-center justify-center gap-2 text-sm sm:text-base font-medium shadow-sm transition-all duration-200 hover:shadow-md active:shadow-inner min-h-[44px] sm:min-h-0 touch-manipulation w-full sm:w-auto'
                >
                  <Plus size={20} />
                  Create Dive Site
                </button>
              </div>
            )}
          </div>

          {/* Results Section - Mobile-first responsive design */}
          {/* Dive Sites List - Show when data is available and viewMode is list */}
          {viewMode === 'list' && diveSites?.results && (
            <div
              data-testid='dive-sites-list'
              className={`space-y-2 sm:space-y-3 ${compactLayout ? 'view-mode-compact' : ''}`}
            >
              {diveSites.results.map(site => (
                <div
                  key={site.id}
                  className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
                    compactLayout ? 'p-2 sm:p-3' : 'p-3 sm:p-4'
                  }`}
                >
                  <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start gap-2 mb-2'>
                        {showThumbnails && (
                          <div className='dive-thumbnail flex-shrink-0 mt-0.5'>
                            <MapPin className='w-5 h-5 sm:w-6 sm:h-6 text-gray-400' />
                          </div>
                        )}
                        <div className='min-w-0 flex-1'>
                          <div className='flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2'>
                            <h3
                              className={`font-semibold text-gray-900 truncate ${compactLayout ? 'text-sm' : 'text-base'}`}
                            >
                              <Link
                                to={`/dive-sites/${site.id}`}
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
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/dive-sites/${site.id}`}
                      className='self-start sm:self-center flex-shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 sm:px-2 sm:py-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors min-h-[44px] sm:min-h-0 touch-manipulation'
                    >
                      <Eye className='w-3 h-3 sm:w-3 sm:h-3' />
                      <span className='sm:hidden'>View Details</span>
                      <span className='hidden sm:inline'>View</span>
                    </Link>
                  </div>

                  <div className='flex flex-wrap items-center gap-2 sm:gap-4 mb-2'>
                    <div className='flex items-center gap-1'>
                      <span
                        className={`inline-flex items-center px-2 py-1 sm:py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(site.difficulty_level)}`}
                      >
                        {getDifficultyLabel(site.difficulty_level)}
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
                    {site.latitude !== undefined &&
                      site.latitude !== null &&
                      site.longitude !== undefined &&
                      site.longitude !== null && (
                        <div className='flex items-center gap-1'>
                          <MapPin className='w-3 h-3 text-gray-400' />
                          <span className='text-xs text-gray-600'>
                            {Number(site.latitude).toFixed(4)}°, {Number(site.longitude).toFixed(4)}
                            °
                          </span>
                        </div>
                      )}
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
                    <div className='flex flex-wrap gap-1'>
                      {site.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className='inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded'
                        >
                          {tag.name || tag}
                        </span>
                      ))}
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
          {viewMode === 'grid' && diveSites?.results && (
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
                  {showThumbnails && (
                    <div className='dive-thumbnail bg-gray-100 p-3 flex items-center justify-center'>
                      <MapPin className='w-10 h-10 text-gray-400' />
                    </div>
                  )}

                  <div className='p-3'>
                    <div className='flex items-center gap-3 mb-2'>
                      <h3
                        className={`font-semibold text-gray-900 truncate flex-1 ${compactLayout ? 'text-base' : 'text-lg'}`}
                      >
                        <Link
                          to={`/dive-sites/${site.id}`}
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(site.difficulty_level)}`}
                      >
                        {getDifficultyLabel(site.difficulty_level)}
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
                      {site.latitude !== undefined &&
                        site.latitude !== null &&
                        site.longitude !== undefined &&
                        site.longitude !== null && (
                          <div className='flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-gray-400' />
                            <span className='text-sm text-gray-600'>
                              {Number(site.latitude).toFixed(4)}°,{' '}
                              {Number(site.longitude).toFixed(4)}°
                            </span>
                          </div>
                        )}
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
                          {site.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className='inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'
                            >
                              {tag.name || tag}
                            </span>
                          ))}
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
        </div>
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
            <p className='text-sm text-gray-500 mt-2'>Try adjusting your search or filters.</p>
          </div>
        )}

        {/* Did you mean? - Show fuzzy search suggestions when no exact matches */}
        {diveSites?.results && diveSites.results.length === 0 && filters.search_query && (
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6'>
            <h3 className='text-lg font-medium text-blue-900 mb-2'>Did you mean?</h3>
            <p className='text-blue-700 mb-3'>
              No exact matches found for "{filters.search_query}". Here are some similar dive sites:
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
              {/* This will be populated by backend fuzzy search results */}
              <div className='text-sm text-blue-600'>
                Try searching for similar terms or check the spelling.
              </div>
            </div>
          </div>
        )}
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
