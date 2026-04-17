import debounce from 'lodash/debounce';
import {
  Plus,
  Eye,
  Search,
  MapPin,
  Building,
  Phone,
  Mail,
  Globe,
  List,
  Map,
  Grid,
  Compass,
  ChevronRight,
  Wrench,
} from 'lucide-react';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api from '../api';
import DivingCentersDesktopSearchBar from '../components/DivingCentersDesktopSearchBar';
import DivingCentersResponsiveFilterBar from '../components/DivingCentersResponsiveFilterBar';
import ErrorPage from '../components/ErrorPage';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MaskedEmail from '../components/MaskedEmail';
import MatchTypeBadge from '../components/MatchTypeBadge';
import PageHeader from '../components/PageHeader';
import RateLimitError from '../components/RateLimitError';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive, useResponsiveScroll } from '../hooks/useResponsive';
import { useSetting } from '../hooks/useSettings';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';

// Lazy load the map component
const DivingCentersMap = lazy(() => import('../components/DivingCentersMap'));

const DivingCenters = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const { searchBarVisible, quickFiltersVisible } = useResponsiveScroll();
  const { compactLayout, handleDisplayOptionChange: setCompactLayout } = useCompactLayout({
    urlParam: 'diving-centers-compact',
    defaultCompact: false,
  });

  // Fetch reviews disabled setting
  const { data: disableReviewsSetting } = useSetting('disable_diving_center_reviews');
  const reviewsEnabled = !disableReviewsSetting?.value;

  // Set page title
  usePageTitle('Divemap - Diving Centers');

  // Sorting state
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'name');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort_order') || 'asc');

  // View mode state (list, grid, map)
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'list');

  // Initialize filters from URL
  const getInitialFilters = () => {
    return {
      search: searchParams.get('search') || '',
      name: searchParams.get('name') || '',
      min_rating: searchParams.get('min_rating') || '',
      services: searchParams.get('services') || '',
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

  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

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
          Object.entries(newFilters).forEach(([key, value]) => {
            if (value) newSearchParams.set(key, value.toString());
          });

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
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) newSearchParams.set(key, value.toString());
      });

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

  // Map sort labels to API fields
  const getSortParams = () => {
    return {
      sort_by: sortBy,
      sort_order: sortOrder,
    };
  };

  // Helper to count active filters
  useEffect(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'search' && key !== 'name') count++;
    });
    // Count search as one filter if either is present
    if (filters.search || filters.name) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  const {
    data: divingCentersResponse,
    isLoading,
    error,
    isPreviousData,
  } = useQuery(
    ['diving-centers', filters, pagination, sortBy, sortOrder],
    () => {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());

      // Add sorting
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      return api.get(`/api/v1/diving-centers/?${params.toString()}`).then(res => res.data);
    },
    {
      keepPreviousData: true,
      staleTime: 5000,
    }
  );

  const divingCenters = divingCentersResponse?.items || [];
  const totalCount = divingCentersResponse?.total || 0;
  const paginationInfo = {
    totalCount,
    totalPages: divingCentersResponse?.total_pages || 0,
    currentPage: divingCentersResponse?.page || pagination.page,
    pageSize: divingCentersResponse?.page_size || pagination.page_size,
    hasNextPage: divingCentersResponse?.has_next_page || false,
    hasPrevPage: divingCentersResponse?.has_prev_page || false,
  };

  // Track match types for diving centers (if search results contain scoring info)
  const [matchTypes, setMatchTypes] = useState({});

  useEffect(() => {
    // If match_types is returned in the response body, use it
    if (divingCentersResponse?.match_types) {
      setMatchTypes(divingCentersResponse.match_types);
    } else if (divingCenters && Array.isArray(divingCenters)) {
      // Fallback for individual items having match info (rare in current backend)
      const newMatchTypes = {};
      divingCenters.forEach(center => {
        if (center.match_type) {
          newMatchTypes[center.id] = {
            type: center.match_type,
            score: center.match_score,
          };
        }
      });
      if (Object.keys(newMatchTypes).length > 0) {
        setMatchTypes(newMatchTypes);
      } else {
        setMatchTypes({});
      }
    }
  }, [divingCentersResponse, divingCenters]);

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);

    // Reset to first page
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);

    // Update URL - use debounced for search/name, immediate for others
    if (name === 'search' || name === 'name') {
      setDebouncedSearchTerms(prev => ({ ...prev, [name]: value }));
      debouncedUpdateURL(newFilters, newPagination, viewMode);
    } else {
      immediateUpdateURL(newFilters, newPagination, viewMode);
    }
  };

  const handlePageChange = newPage => {
    const newPagination = { ...pagination, page: newPage };
    setPagination(newPagination);
    immediateUpdateURL(filters, newPagination, viewMode);
  };

  const handlePageSizeChange = newPageSize => {
    const newPagination = { page: 1, page_size: newPageSize };
    setPagination(newPagination);
    immediateUpdateURL(filters, newPagination, viewMode);
  };

  const handleSortChange = (newSortBy, newSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);
    immediateUpdateURL(filters, newPagination, viewMode);
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      name: '',
      min_rating: '',
      services: '',
      country: '',
      region: '',
      city: '',
    };
    setFilters(clearedFilters);
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);
    immediateUpdateURL(clearedFilters, newPagination, viewMode);
  };

  const handleViewModeChange = newViewMode => {
    setViewMode(newViewMode);
    immediateUpdateURL(filters, pagination, newViewMode);
  };

  const handleQuickFilter = type => {
    const newFilters = { ...filters };
    if (type === 'min_rating') {
      newFilters.min_rating = filters.min_rating === '4' ? '' : '4';
    } else if (type === 'country') {
      newFilters.country = filters.country === 'Greece' ? '' : 'Greece';
    }

    setFilters(newFilters);
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);
    immediateUpdateURL(newFilters, newPagination, viewMode);
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

  const sortOptions = [
    { value: 'name', label: 'Name', defaultOrder: 'asc' },
    { value: 'city', label: 'City', defaultOrder: 'asc' },
    { value: 'country', label: 'Country', defaultOrder: 'asc' },
    { value: 'rating', label: 'Rating', defaultOrder: 'desc' },
    { value: 'created_at', label: 'Date Added', defaultOrder: 'desc' },
  ];

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <PageHeader
        title='Diving Centers'
        titleIcon={Building}
        breadcrumbItems={[{ label: 'Diving Centers' }]}
        actions={[
          {
            label: 'Explore Map',
            icon: Map,
            variant: 'primary',
            onClick: () => handleViewModeChange('map'),
          },
          {
            label: 'Add Center',
            icon: Plus,
            variant: 'secondary',
            onClick: () => navigate('/diving-centers/create'),
          },
        ]}
        className='mb-4 sm:mb-6 lg:mb-8'
      />

      <div className='flex flex-col lg:flex-row gap-6 lg:gap-8'>
        {/* Main Content Area */}
        <div className='flex-1 min-w-0'>
          {/* Desktop Search Bar */}
          <div className='hidden lg:block mb-6'>
            <DivingCentersDesktopSearchBar
              searchValue={filters.search}
              onSearchChange={val => handleFilterChange('search', val.target.value)}
              onSearchSelect={() => {}}
            />
          </div>

          {/* Responsive Filter Bar */}
          <DivingCentersResponsiveFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            activeFiltersCount={activeFiltersCount}
            searchQuery={filters.search}
            onSearchChange={val => handleFilterChange('search', val)}
            onSearchSubmit={() => {}}
            sortBy={sortBy}
            sortOrder={sortOrder}
            sortOptions={sortOptions}
            onSortChange={handleSortChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            compactLayout={compactLayout}
            onDisplayOptionChange={setCompactLayout}
            onQuickFilter={handleQuickFilter}
            reviewsEnabled={reviewsEnabled}
            quickFilter={
              filters.min_rating === '4'
                ? 'min_rating'
                : filters.country === 'Greece'
                  ? 'country'
                  : ''
            }
            className='mb-6'
          />

          {/* Map Section - Show immediately when in map view */}
          {viewMode === 'map' && (
            <div className='mb-4 sm:mb-8'>
              {isLoading ? (
                <LoadingSkeleton type='map' />
              ) : (
                <div className='bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-100'>
                  <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                    Map view of filtered Diving Centers
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
                      <DivingCentersMap
                        data-testid='diving-centers-map'
                        divingCenters={divingCenters || []}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content Container */}
          <div className='content-section mb-4 sm:mb-8'>
            {!isLoading && !error && (
              <Pagination
                currentPage={pagination.page}
                pageSize={pagination.page_size}
                totalCount={totalCount}
                itemName='diving centers'
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                className='mb-3 sm:mb-6'
              />
            )}

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
                  <div
                    className={`space-y-3 sm:space-y-4 ${compactLayout ? 'view-mode-compact' : ''}`}
                  >
                    {divingCenters?.map(center => (
                      <div
                        key={center.id}
                        className={`dive-item bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-1.5 sm:p-4 hover:shadow-md transition-all duration-200 relative`}
                      >
                        {/* Main content column */}
                        <div className='flex flex-col'>
                          {/* Main info */}
                          <div className='flex-1 min-w-0 flex flex-col'>
                            {/* Title row */}
                            <div className='flex items-start justify-between gap-2'>
                              <div className='flex-1 min-w-0 pr-2'>
                                <h3 className='font-semibold text-gray-900 leading-tight text-base sm:text-lg truncate'>
                                  <Link
                                    to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                                    state={{
                                      from: window.location.pathname + window.location.search,
                                    }}
                                    className='hover:text-blue-600 transition-colors'
                                  >
                                    {center.name}
                                  </Link>
                                </h3>
                              </div>
                              {center.average_rating && (
                                <div className='flex items-center gap-1 text-yellow-600 flex-shrink-0 bg-yellow-50/50 px-1 py-0.5 rounded text-[10px] sm:text-xs font-bold'>
                                  <img
                                    src='/arts/divemap_shell.png'
                                    alt='Rating'
                                    className='w-2.5 h-2.5 object-contain'
                                  />
                                  <span>{center.average_rating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>

                            {/* Location & Metadata Row - Very compact */}
                            <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5'>
                              {(center.country || center.region || center.city) && (
                                <div className='flex items-center gap-1 text-[9px] sm:text-[10px] text-blue-500 font-semibold'>
                                  <MapPin className='w-2.5 h-2.5 text-blue-400 flex-shrink-0' />
                                  <span className='truncate max-w-[200px] sm:max-w-[300px]'>
                                    {Array.from(
                                      new Set(
                                        [center.country, center.region, center.city]
                                          .filter(Boolean)
                                          .flatMap(s => s.split(',').map(p => p.trim()))
                                      )
                                    ).join(', ')}
                                  </span>
                                </div>
                              )}
                              {matchTypes[center.id] && (
                                <MatchTypeBadge
                                  matchType={matchTypes[center.id].type}
                                  score={matchTypes[center.id].score}
                                  className='scale-75 origin-left -ml-2'
                                />
                              )}
                            </div>

                            {/* Description - expanded to fill space */}
                            {center.description && (
                              <p className='text-[10px] sm:text-sm text-gray-600 line-clamp-3 sm:line-clamp-4 leading-tight mt-1.5'>
                                {decodeHtmlEntities(center.description)}
                              </p>
                            )}
                          </div>

                          {/* Bottom row - Quick Action Row (High consistency) */}
                          <div className='flex flex-row items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-50'>
                            {center.website && (
                              <a
                                href={
                                  center.website.startsWith('http')
                                    ? center.website
                                    : `https://${center.website}`
                                }
                                target='_blank'
                                rel='noopener noreferrer'
                                className='w-8 h-8 inline-flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:scale-95 transition-all'
                                title='Website'
                              >
                                <Globe className='w-4 h-4 text-blue-700 flex-shrink-0' />
                              </a>
                            )}
                            {center.email &&
                              (isMobile ? (
                                <a
                                  href={`mailto:${center.email}`}
                                  className='w-8 h-8 inline-flex items-center justify-center bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:scale-95 transition-all'
                                  title='Email'
                                >
                                  <Mail className='w-4 h-4 text-green-700 flex-shrink-0' />
                                </a>
                              ) : (
                                <MaskedEmail
                                  email={center.email}
                                  label=''
                                  className='w-8 h-8 inline-flex items-center justify-center bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:scale-95 transition-all cursor-pointer'
                                >
                                  <Mail className='w-4 h-4 text-green-700 flex-shrink-0' />
                                </MaskedEmail>
                              ))}
                            {center.phone && (
                              <a
                                href={`tel:${center.phone}`}
                                className='w-8 h-8 inline-flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 active:scale-95 transition-all'
                                title='Call'
                              >
                                <Phone className='w-4 h-4 text-indigo-700 flex-shrink-0' />
                              </a>
                            )}
                            <Link
                              to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                              className='w-8 h-8 inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group ml-auto sm:ml-0'
                              title='View Details'
                            >
                              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
                            </Link>
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
                        className={`dive-item bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-[rgb(0,114,178)] overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] ${
                          compactLayout ? 'p-4' : 'p-6'
                        }`}
                      >
                        <div className={`${compactLayout ? 'p-3' : 'p-5'}`}>
                          {/* Title and rating row */}
                          <div className='flex items-start justify-between mb-2'>
                            <div className='flex-1 pr-3 min-w-0'>
                              <div className='flex items-start gap-2 mb-1'>
                                <h3
                                  className={`font-bold text-gray-900 line-clamp-2 flex-1 min-w-0 ${compactLayout ? 'text-sm' : 'text-lg'}`}
                                >
                                  <Link
                                    to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                                    className='hover:text-blue-600 transition-colors'
                                  >
                                    {center.name}
                                  </Link>
                                </h3>
                              </div>

                              <div className='flex items-center gap-1.5 text-xs text-gray-500'>
                                <MapPin className='w-3 h-3 text-blue-500' />
                                <span className='truncate'>
                                  {center.city ? `${center.city}, ` : ''}
                                  {center.country || 'Global'}
                                </span>
                              </div>
                            </div>

                            {center.average_rating && (
                              <div className='flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100'>
                                <img
                                  src='/arts/divemap_shell.png'
                                  alt='Rating'
                                  className='w-3.5 h-3.5 object-contain'
                                />
                                <span className='text-sm font-bold text-yellow-700'>
                                  {center.average_rating.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Description */}
                          {center.description && (
                            <p className='text-gray-600 text-sm line-clamp-3 mb-4 leading-relaxed'>
                              {decodeHtmlEntities(center.description)}
                            </p>
                          )}

                          {/* Footer with actions */}
                          <div className='flex items-center justify-between pt-4 border-t border-gray-50 mt-auto'>
                            <div className='flex items-center gap-2'>
                              {center.phone && (
                                <a
                                  href={`tel:${center.phone}`}
                                  className='p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors'
                                  title='Call'
                                >
                                  <Phone className='w-4 h-4' />
                                </a>
                              )}
                              {center.website && (
                                <a
                                  href={
                                    center.website.startsWith('http')
                                      ? center.website
                                      : `https://${center.website}`
                                  }
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors'
                                  title='Website'
                                >
                                  <Globe className='w-4 h-4' />
                                </a>
                              )}
                            </div>

                            <Link
                              to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                              className='text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 group'
                            >
                              Explore
                              <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5' />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {divingCenters?.length === 0 && (
                  <div className='text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300'>
                    <Building className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                    <h3 className='text-lg font-medium text-gray-900'>No diving centers found</h3>
                    <p className='text-gray-500 mt-2 max-w-xs mx-auto'>
                      Try adjusting your filters or search terms to find what you're looking for.
                    </p>
                    <button
                      onClick={clearFilters}
                      className='mt-4 text-blue-600 font-semibold hover:underline'
                    >
                      Clear all filters
                    </button>
                  </div>
                )}

                {/* Bottom Pagination Controls */}
                {divingCenters && divingCenters.length > 0 && (
                  <Pagination
                    currentPage={pagination.page}
                    pageSize={pagination.page_size}
                    totalCount={totalCount}
                    itemName='diving centers'
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    className='mt-6 sm:mt-8'
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DivingCenters;
