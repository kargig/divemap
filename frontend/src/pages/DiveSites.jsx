import debounce from 'lodash/debounce';
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
  MessageSquare,
  User,
  Fish,
  Shield,
  Navigation,
  Award,
  MessageCircle,
  Route,
  Search,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import DesktopSearchBar from '../components/DesktopSearchBar';
import { DiveSiteListCard, DiveSiteGridCard } from '../components/DiveSiteCard';
import EmptyState from '../components/EmptyState';
import ErrorPage from '../components/ErrorPage';
import HeroSection from '../components/HeroSection';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MatchTypeBadge from '../components/MatchTypeBadge';
import PageHeader from '../components/PageHeader';
import RateLimitError from '../components/RateLimitError';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import SEO from '../components/SEO';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import useFlickrImages from '../hooks/useFlickrImages';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
import { getSortOptions } from '../utils/sortOptions';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

const DiveSitesMap = lazy(() => import('../components/DiveSitesMap'));

const DiveSites = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Removed usePageTitle hook; title is now managed by SEO component

  // Enhanced state for mobile UX
  const [viewMode, setViewMode] = useState(() => {
    // Use React Router's searchParams consistently
    return searchParams.get('view') || 'list';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [quickFilters, setQuickFilters] = useState([]);

  // Compact layout state management
  const { compactLayout, handleDisplayOptionChange } = useCompactLayout();

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
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } = useSorting(
    'dive-sites',
    null,
    null,
    isAdmin
  );

  // Update viewMode when searchParams change
  useEffect(() => {
    const newViewMode = searchParams.get('view') || 'list';
    setViewMode(newViewMode);
  }, [searchParams]);

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    debounce((newFilters, newPagination, newViewMode) => {
      const currentParams = new URLSearchParams(window.location.search);
      const newSearchParams = new URLSearchParams();

      // Preserve compact_layout parameter
      const compactLayoutParam = currentParams.get('compact_layout');
      if (compactLayoutParam === 'true') {
        newSearchParams.set('compact_layout', 'true');
      }

      // Preserve current view mode if not explicitly changing it
      if (newViewMode) {
        if (newViewMode === 'map') {
          newSearchParams.set('view', 'map');
        } else if (newViewMode === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
        // List view is default, so no need to set it
      } else {
        // Preserve existing view mode if not changing
        const currentView = currentParams.get('view');
        if (currentView === 'map') {
          newSearchParams.set('view', 'map');
        } else if (currentView === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
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
    }, 500),
    [navigate]
  );

  // Immediate URL update for non-search filters (difficulty, ratings, tags, pagination)
  const immediateUpdateURL = useCallback(
    (newFilters, newPagination, newViewMode) => {
      const currentParams = new URLSearchParams(window.location.search);
      const newSearchParams = new URLSearchParams();

      // Preserve compact_layout parameter
      const compactLayoutParam = currentParams.get('compact_layout');
      if (compactLayoutParam === 'true') {
        newSearchParams.set('compact_layout', 'true');
      }

      // Preserve current view mode if not explicitly changing it
      if (newViewMode) {
        if (newViewMode === 'map') {
          newSearchParams.set('view', 'map');
        } else if (newViewMode === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
        // List view is default, so no need to set it
      } else {
        // Preserve existing view mode if not changing
        const currentView = currentParams.get('view');
        if (currentView === 'map') {
          newSearchParams.set('view', 'map');
        } else if (currentView === 'grid' && !isMobile) {
          newSearchParams.set('view', 'grid');
        }
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
    }, 1500);
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

  // Check if search query is too short (min 3 characters)
  const isSearchTooShort =
    debouncedSearchTerms.search_query.trim().length > 0 &&
    debouncedSearchTerms.search_query.trim().length < 3;

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
      const data = response.data;

      // Extract pagination info from response body (new) or headers (fallback)
      const paginationInfo = {
        totalCount:
          data.total !== undefined
            ? data.total
            : parseInt(response.headers['x-total-count'] || '0'),
        totalPages:
          data.total_pages !== undefined
            ? data.total_pages
            : parseInt(response.headers['x-total-pages'] || '0'),
        currentPage:
          data.page !== undefined ? data.page : parseInt(response.headers['x-current-page'] || '1'),
        pageSize:
          data.page_size !== undefined
            ? data.page_size
            : parseInt(response.headers['x-page-size'] || '25'),
        hasNextPage:
          data.has_next_page !== undefined
            ? data.has_next_page
            : response.headers['x-has-next-page'] === 'true',
        hasPrevPage:
          data.has_prev_page !== undefined
            ? data.has_prev_page
            : response.headers['x-has-prev-page'] === 'true',
      };

      // Extract match type information from response body (new) or headers (fallback)
      let matchTypes = data.match_types || {};
      if (!data.match_types) {
        const matchTypesHeader = response.headers['x-match-types'];
        if (matchTypesHeader) {
          try {
            matchTypes = JSON.parse(matchTypesHeader);
          } catch (e) {
            console.warn('Failed to parse match types header:', e);
          }
        }
      }

      return {
        data: data.items || data,
        matchTypes: matchTypes,
        paginationInfo: paginationInfo,
      };
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: !isSearchTooShort,
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

  // Extract all thumbnail URLs from the results to pass to the hook
  const thumbnailUrls = useMemo(() => {
    if (!diveSites?.results) return [];
    return diveSites.results
      .filter(site => site.thumbnail)
      .map(site => ({
        id: site.id, // We need an ID for the hook
        url: site.thumbnail,
        media_type: 'photo', // Assume photo for thumbnail
      }));
  }, [diveSites?.results]);

  // Use hook to convert Flickr URLs
  const { data: convertedFlickrUrls = new Map() } = useFlickrImages(thumbnailUrls);

  // Helper to get the image URL
  const getThumbnailUrl = site => {
    if (!site.thumbnail) return null;
    return convertedFlickrUrls.get(site.thumbnail) || site.thumbnail;
  };

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

  const getMediaLink = site => {
    let link = `/dive-sites/${site.id}?tab=media`;
    if (site.thumbnail_id) {
      link += `&mediaId=${site.thumbnail_id}`;
      if (site.thumbnail_source) {
        link += `&source=${site.thumbnail_source}`;
      }
      if (site.thumbnail_type) {
        link += `&type=${site.thumbnail_type}`;
      }
    }
    return link;
  };

  // Error handling is now done within the content area to preserve hero section

  return (
    <div className='min-h-screen bg-gray-50'>
      <SEO
        title='Explore Top Scuba Dive Sites Worldwide | Divemap'
        description='Discover, search, and explore thousands of scuba dive sites. View GPS coordinates, depth profiles, difficulty levels, and marine life reports for locations globally.'
      />
      {/* Mobile-First Responsive Container */}
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
        <PageHeader
          title='Dive Sites'
          titleIcon={Map}
          breadcrumbItems={[{ label: 'Dive Sites' }]}
          actions={[
            {
              label: 'Explore on Map',
              icon: Compass,
              onClick: () => navigate('/map?type=dive-sites'),
              variant: 'primary',
            },
            {
              label: 'Suggest a New Site',
              icon: Plus,
              onClick: () => {
                if (!user) {
                  window.alert('You need an account for this action.\nPlease Login or Register.');
                  return;
                }
                navigate('/dive-sites/create');
              },
              variant: 'secondary',
            },
          ]}
        />

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

        {/* Responsive Filter Bar */}
        {isLoading ? (
          <LoadingSkeleton type='filter' />
        ) : (
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
            sortOptions={getSortOptions('dive-sites', isAdmin)}
            onSortChange={handleSortChange}
            onReset={resetSorting}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            compactLayout={compactLayout}
            onDisplayOptionChange={handleDisplayOptionChange}
          />
        )}

        {/* Map Section - Show immediately when in map view */}
        {viewMode === 'map' && (
          <div className='mb-4 sm:mb-8'>
            {isLoading ? (
              <LoadingSkeleton type='map' />
            ) : (
              <div className='bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-100'>
                <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                  Map view of filtered Dive Sites
                </h2>
                <div className='h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center'>
                  <Suspense
                    fallback={
                      <div className='flex flex-col items-center gap-2'>
                        <div className='w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                        <span>Loading Map...</span>
                      </div>
                    }
                  >
                    <DiveSitesMap
                      data-testid='dive-sites-map'
                      diveSites={diveSites?.results || []}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Content Section */}
        <div className={`content-section mb-4 sm:mb-6 lg:mb-8`}>
          {/* Pagination Controls */}
          {isLoading ? (
            <LoadingSkeleton type='pagination' className='mb-2 sm:mb-4 lg:mb-6' />
          ) : (
            !isSearchTooShort && (
              <Pagination
                currentPage={pagination.page}
                pageSize={pagination.page_size}
                totalCount={totalCount}
                itemName='dive sites'
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                className='mb-2 sm:mb-4 lg:mb-6'
              />
            )
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
              {/* Search query too short warning */}
              {isSearchTooShort && (
                <div className='bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-md shadow-sm'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <Search className='h-5 w-5 text-blue-400' />
                    </div>
                    <div className='ml-3'>
                      <p className='text-sm text-blue-700 font-medium'>
                        Type at least 3 characters to search dive sites...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dive Sites List - Show when data is available and viewMode is list */}
              {viewMode === 'list' && !isSearchTooShort && diveSites?.results && (
                <div
                  data-testid='dive-sites-list'
                  className={`space-y-3 sm:space-y-4 ${compactLayout ? 'view-mode-compact' : ''}`}
                >
                  {diveSites.results.map(site => (
                    <DiveSiteListCard
                      key={site.id}
                      site={site}
                      compactLayout={compactLayout}
                      getMediaLink={getMediaLink}
                      getThumbnailUrl={getThumbnailUrl}
                      handleFilterChange={handleFilterChange}
                    />
                  ))}
                </div>
              )}

              {/* Dive Sites Grid */}
              {viewMode === 'grid' && !isMobile && !isSearchTooShort && diveSites?.results && (
                <div
                  className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''}`}
                >
                  {diveSites.results.map(site => (
                    <DiveSiteGridCard
                      key={site.id}
                      site={site}
                      compactLayout={compactLayout}
                      getMediaLink={getMediaLink}
                      getThumbnailUrl={getThumbnailUrl}
                      handleFilterChange={handleFilterChange}
                    />
                  ))}
                </div>
              )}
              {/* Close content-section */}
            </>
          )}

          {/* No Results Messages - Show when no dive sites found */}
          {!isLoading &&
            !isSearchTooShort &&
            diveSites?.results &&
            diveSites.results.length === 0 &&
            viewMode !== 'map' && (
              <EmptyState
                onClearFilters={clearFilters}
                actionLink='/dive-sites/create'
                actionText='Add Dive Site'
                message={
                  filters.search_query.trim()
                    ? `No dive sites found matching "${filters.search_query}". Try different terms or add this site to our database.`
                    : 'No dive sites found matching your criteria. Try adjusting your filters.'
                }
              />
            )}

          {/* Bottom Pagination Controls */}
          {!isLoading &&
            !isSearchTooShort &&
            diveSites?.results &&
            diveSites.results.length > 0 && (
              <Pagination
                currentPage={pagination.page}
                pageSize={pagination.page_size}
                totalCount={totalCount}
                itemName='dive sites'
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                className='mt-6 sm:mt-8'
              />
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
