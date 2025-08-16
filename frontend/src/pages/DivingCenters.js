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
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import DivingCentersMap from '../components/DivingCentersMap';
import EnhancedMobileSortingControls from '../components/EnhancedMobileSortingControls';
import HeroSection from '../components/HeroSection';
import MaskedEmail from '../components/MaskedEmail';
import { useAuth } from '../contexts/AuthContext';
import useSorting from '../hooks/useSorting';
import { getSortOptions } from '../utils/sortOptions';

// Helper function to safely extract error message
const getErrorMessage = error => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const DivingCenters = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'list';
  });
  const [showThumbnails, setShowThumbnails] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('show_thumbnails') === 'true';
  });
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compact_layout') !== 'false'; // Default to true (compact)
  });

  // Get initial values from URL parameters
  const getInitialFilters = () => {
    return {
      name: searchParams.get('name') || '',
      min_rating: searchParams.get('min_rating') || '',
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
    name: getInitialFilters().name,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, handleSortApply, resetSorting, getSortParams } =
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
          if (newFilters.name) newSearchParams.set('name', newFilters.name);
          if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);

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
      if (newFilters.name) newSearchParams.set('name', newFilters.name);
      if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);

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
  }, [filters.name, debouncedUpdateURL]);

  // Debounced search terms for query key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerms({
        name: filters.name,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.name]);

  // Immediate URL update for non-search filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [filters.min_rating, immediateUpdateURL]);

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
      debouncedSearchTerms.name,
      filters.min_rating,
      pagination.page,
      pagination.page_size,
      sortBy,
      sortOrder,
    ],
    () => {
      // Create URLSearchParams to properly handle parameters
      const params = new URLSearchParams();

      // Add filter parameters
      if (debouncedSearchTerms.name) params.append('name', debouncedSearchTerms.name);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);

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
        // Store pagination info in the query cache
        queryClient.setQueryData(
          ['diving-centers-pagination', filters, pagination],
          paginationInfo
        );
        return response.data;
      },
      keepPreviousData: true,
    }
  );

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

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-8'>
        <p className='text-red-600'>Error loading diving centers: {getErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {/* Hero Section */}
      <HeroSection
        title='Diving Centers'
        subtitle='Discover and connect with professional diving centers worldwide'
        background='ocean'
        size='medium'
      >
        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          <Link
            to='/diving-centers/create'
            className='bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-6 py-3 rounded-lg flex items-center gap-2 border border-white border-opacity-30 transition-all duration-200 hover:scale-105'
          >
            <Plus className='w-5 h-5' />
            Add Center
          </Link>
        </div>
      </HeroSection>

      {/* Map Section - Show immediately when in map view */}
      {viewMode === 'map' && (
        <div className='mb-8'>
          <div className='bg-white rounded-lg shadow-md p-4 mb-6'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>
              Interactive Diving Centers Map
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
        </div>
      )}

      {/* Sticky Filter Bar - Mobile-First Responsive Design */}
      <div className='sticky top-16 z-40 bg-white shadow-sm border-b border-gray-200 rounded-t-lg px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4'>
        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 items-end'>
          {/* Search Input - Primary Filter */}
          <div className='flex-1 w-full'>
            <label htmlFor='search-name' className='block text-sm font-medium text-gray-700 mb-2'>
              Search
            </label>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                id='search-name'
                type='text'
                name='name'
                value={filters.name}
                onChange={handleSearchChange}
                className='w-full pl-10 pr-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
                placeholder='Search diving centers by name, location, or services...'
              />
            </div>
          </div>

          {/* Min Rating Filter - Compact */}
          <div className='w-full sm:w-32'>
            <label htmlFor='min-rating' className='block text-sm font-medium text-gray-700 mb-2'>
              Min Rating (≥)
            </label>
            <input
              id='min-rating'
              type='number'
              min='0'
              max='10'
              step='0.1'
              name='min_rating'
              value={filters.min_rating}
              onChange={handleSearchChange}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              placeholder='≥ 0'
            />
          </div>
        </div>
      </div>

      {/* Sorting & View Controls - Attached to Sticky Filters */}
      <div className='bg-white shadow-sm border-b border-l border-r border-gray-200 rounded-b-lg'>
        {viewMode === 'map' ? (
          <div className='p-3 sm:p-4'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4'>
              <h3 className='text-base sm:text-lg font-medium text-gray-900 text-center sm:text-left'>
                View Mode
              </h3>
              <div className='flex justify-center sm:justify-end gap-2'>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                  }`}
                >
                  <List className='h-4 w-4 sm:h-4 sm:w-4' />
                  <span className='hidden xs:inline'>List</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('map')}
                  className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                  }`}
                >
                  <Map className='h-4 w-4 sm:h-4 sm:w-4' />
                  <span className='hidden xs:inline'>Map</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EnhancedMobileSortingControls
            sortBy={sortBy}
            sortOrder={sortOrder}
            sortOptions={getSortOptions('diving-centers')}
            onSortChange={handleSortChange}
            onSortApply={handleSortApply}
            onReset={resetSorting}
            entityType='diving-centers'
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            showFilters={false} // Hide filters in this section for now
            onToggleFilters={() => {}}
            showQuickActions={true}
            showFAB={true}
            showTabs={true}
            showThumbnails={showThumbnails}
            compactLayout={compactLayout}
            onDisplayOptionChange={handleDisplayOptionChange}
          />
        )}
      </div>

      {/* Pagination Controls */}
      <div className='mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8'>
        {/* Page Size Controls */}
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium text-gray-700'>Show:</span>
            <select
              value={pagination.page_size}
              onChange={e => handlePageSizeChange(parseInt(e.target.value))}
              className='px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className='text-sm text-gray-600'>per page</span>
          </div>
        </div>

        {/* Pagination Info and Navigation */}
        <div className='flex items-center gap-4'>
          <div className='text-sm text-gray-600'>
            Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
            {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)} of{' '}
            {paginationInfo.totalCount} diving centers
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!paginationInfo.hasPrevPage}
              className='p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M15 19l-7-7 7-7'
                />
              </svg>
            </button>
            <span className='text-sm font-medium text-gray-700'>
              Page {pagination.page} of {paginationInfo.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!paginationInfo.hasNextPage}
              className='p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
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

      {/* Results Section */}
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
                    <h3 className='font-semibold text-gray-900 text-base truncate'>
                      <Link
                        to={`/diving-centers/${center.id}`}
                        className='hover:text-blue-600 transition-colors'
                      >
                        {center.name}
                      </Link>
                    </h3>
                    {center.average_rating && (
                      <div className='flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full'>
                        <Star className='w-3 h-3 text-yellow-500 fill-current' />
                        <span className='text-xs font-medium text-yellow-700'>
                          {center.average_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact and location info row */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2'>
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
                        <Globe className='w-3 h-3 text-gray-400' />
                        <a
                          href={
                            center.website.startsWith('http')
                              ? center.website
                              : `https://${center.website}`
                          }
                          target='_blank'
                          rel='noopener noreferrer'
                          className='truncate hover:text-blue-600 transition-colors'
                        >
                          {center.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}

                    {/* Coordinates */}
                    {center.latitude && center.longitude && (
                      <div className='flex items-center gap-1 text-xs text-gray-600'>
                        <MapPin className='w-3 h-3 text-gray-400' />
                        <span className='truncate'>
                          {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
                        </span>
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
                    className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors'
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
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${compactLayout ? 'view-mode-compact' : ''}`}
        >
          {divingCenters?.map(center => (
            <div
              key={center.id}
              className={`dive-item bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-[1.02] ${
                compactLayout ? 'p-4' : 'p-6'
              }`}
            >
              {/* Header with thumbnail and rating */}
              <div className='relative'>
                {showThumbnails && (
                  <div className='dive-thumbnail bg-gradient-to-br from-blue-50 to-cyan-50 p-6 flex items-center justify-center border-b border-gray-100'>
                    <div className='relative'>
                      <Building className='w-16 h-16 text-blue-600' />
                      {center.average_rating && (
                        <div className='absolute -top-2 -right-2 bg-yellow-400 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center'>
                          {Math.round(center.average_rating)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={`${compactLayout ? 'p-3' : 'p-5'}`}>
                {/* Title and rating row */}
                <div className='flex items-start justify-between mb-2'>
                  <h3
                    className={`font-bold text-gray-900 line-clamp-2 flex-1 pr-3 ${compactLayout ? 'text-base' : 'text-lg'}`}
                  >
                    <Link
                      to={`/diving-centers/${center.id}`}
                      className='hover:text-blue-600 transition-colors hover:underline'
                    >
                      {center.name}
                    </Link>
                  </h3>

                  {/* Rating badge - positioned to the right of title */}
                  {center.average_rating && (
                    <div className='bg-yellow-100 rounded-full px-3 py-1 shadow-sm border border-yellow-200 flex-shrink-0'>
                      <div className='flex items-center gap-1'>
                        <Star className='w-4 h-4 text-yellow-500 fill-current' />
                        <span className='text-sm font-semibold text-yellow-800'>
                          {center.average_rating}/10
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Geolocation - always present for consistent spacing */}
                <div className='flex items-center gap-2 text-gray-600 mb-4'>
                  <MapPin className='w-4 h-4 text-gray-400 flex-shrink-0' />
                  <span className={`${compactLayout ? 'text-sm' : 'text-base'}`}>
                    {center.latitude && center.longitude
                      ? `${center.latitude}, ${center.longitude}`
                      : center.address || 'Location N/A'}
                  </span>
                </div>

                {/* Key information grid */}
                <div className='grid grid-cols-2 gap-3 mb-4'>
                  {/* Show email if available, otherwise rating */}
                  {center.email ? (
                    <div className='flex items-center justify-center bg-blue-50 rounded-lg px-3 py-2'>
                      <a
                        href={`mailto:${center.email}`}
                        className='text-blue-500 hover:text-blue-700 transition-colors'
                        title={`Send email to ${center.email}`}
                      >
                        <Mail className='w-5 h-5' />
                      </a>
                    </div>
                  ) : center.average_rating ? (
                    <div className='flex items-center justify-center bg-yellow-50 rounded-lg px-3 py-2'>
                      <div className='flex items-center gap-1'>
                        <Star className='w-4 h-4 text-yellow-500 fill-current' />
                        <span className='text-sm font-medium text-gray-700'>
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
                        <span className='text-sm font-medium text-gray-700'>
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

                {/* Description - always present for consistent card heights */}
                <div className='mb-4'>
                  <p
                    className={`text-gray-600 line-clamp-3 ${compactLayout ? 'text-sm' : 'text-base'}`}
                  >
                    {center.description || 'No description available'}
                  </p>
                </div>

                {/* Action buttons */}
                <div className='flex gap-2'>
                  <Link
                    to={`/diving-centers/${center.id}`}
                    className='flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors hover:shadow-md'
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
          <p className='text-gray-500 text-lg'>No diving centers found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default DivingCenters;
