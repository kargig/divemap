import { debounce } from 'lodash';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Map,
  Search,
  List,
  Lock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Star,
  MapPin,
  Tag,
  TrendingUp,
  Grid,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import DiveSitesMap from '../components/DiveSitesMap';
import EnhancedMobileSortingControls from '../components/EnhancedMobileSortingControls';
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
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'list';
  });
  const [showFilters, setShowFilters] = useState(false);

  // View mode state
  const [showThumbnails, setShowThumbnails] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('show_thumbnails') === 'true';
  });
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('compact_layout') !== 'false'; // Default to true (compact)
  });

  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const mode = searchParams.get('view') || 'list';
    return ['list', 'grid', 'map'].includes(mode) ? mode : 'list';
  };

  const getInitialFilters = () => {
    return {
      name: searchParams.get('name') || '',
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
  const effectivePageSize = Number(pagination.page_size) || 25;
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    name: getInitialFilters().name,
    country: getInitialFilters().country,
    region: getInitialFilters().region,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, handleSortApply, resetSorting, getSortParams } =
    useSorting('dive-sites');

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

      if (newFilters.location_query && newFilters.location_query.trim()) {
        newSearchParams.set('location', newFilters.location_query.trim());
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

      if (newFilters.location_query && newFilters.location_query.trim()) {
        newSearchParams.set('location', newFilters.location_query.trim());
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
  }, [filters.name, filters.country, filters.region, debouncedUpdateURL]);

  // Debounced search terms for query key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerms({
        name: filters.name,
        country: filters.country,
        region: filters.region,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.name, filters.country, filters.region]);

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

  // Fetch total count
  const { data: totalCountResponse } = useQuery(
    [
      'dive-sites-count',
      debouncedSearchTerms.name,
      debouncedSearchTerms.country,
      debouncedSearchTerms.region,
      filters.difficulty_level,
      filters.min_rating,
      filters.tag_ids,
      filters.my_dive_sites,
    ],
    () => {
      const params = new URLSearchParams();

      if (debouncedSearchTerms.name) params.append('name', debouncedSearchTerms.name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (debouncedSearchTerms.country) params.append('country', debouncedSearchTerms.country);
      if (debouncedSearchTerms.region) params.append('region', debouncedSearchTerms.region);

      if (filters.tag_ids && Array.isArray(filters.tag_ids)) {
        filters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString && tagId.toString().trim()) {
            params.append('tag_ids', tagId.toString());
          }
        });
      }
      if (filters.my_dive_sites) params.append('my_dive_sites', 'true');

      return api.get(`/api/v1/dive-sites/count?${params.toString()}`).then(res => res.data);
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Extract total count from response
  const totalCount = totalCountResponse?.total || 0;

  // Fetch dive sites
  const {
    data: diveSites,
    isLoading,
    error,
  } = useQuery(
    [
      'dive-sites',
      debouncedSearchTerms.name,
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
    () => {
      const params = new URLSearchParams();

      if (debouncedSearchTerms.name) params.append('name', debouncedSearchTerms.name);
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

      return api.get(`/api/v1/dive-sites/?${params.toString()}`).then(res => res.data);
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive sites', () => window.location.reload());
  }, [error]);

  useEffect(() => {
    handleRateLimitError(totalCountResponse?.error, 'dive sites count', () =>
      window.location.reload()
    );
  }, [totalCountResponse?.error]);

  useEffect(() => {
    handleRateLimitError(availableTags?.error, 'available tags', () => window.location.reload());
  }, [availableTags?.error]);

  const handleSearchChange = e => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // handleTagChange function removed as it's now handled inline in the button onClick

  const clearFilters = () => {
    const clearedFilters = {
      name: '',
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

  const getTagColor = tagName => {
    // Create a consistent color mapping based on tag name
    const colorMap = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-orange-100 text-orange-800',
      expert: 'bg-red-100 text-red-800',
      deep: 'bg-blue-100 text-blue-800',
      shallow: 'bg-cyan-100 text-cyan-800',
      wreck: 'bg-purple-100 text-purple-800',
      reef: 'bg-emerald-100 text-emerald-800',
      cave: 'bg-indigo-100 text-indigo-800',
      wall: 'bg-slate-100 text-slate-800',
      drift: 'bg-teal-100 text-teal-800',
      night: 'bg-violet-100 text-violet-800',
      photography: 'bg-pink-100 text-pink-800',
      marine: 'bg-cyan-100 text-cyan-800',
      training: 'bg-amber-100 text-amber-800',
      tech: 'bg-red-100 text-red-800',
      boat: 'bg-blue-100 text-blue-800',
      shore: 'bg-green-100 text-green-800',
    };

    // Try exact match first
    const lowerTagName = tagName.toLowerCase();
    if (colorMap[lowerTagName]) {
      return colorMap[lowerTagName];
    }

    // Try partial matches
    for (const [key, color] of Object.entries(colorMap)) {
      if (lowerTagName.includes(key) || key.includes(lowerTagName)) {
        return color;
      }
    }

    // Default color scheme based on hash of tag name
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-orange-100 text-orange-800',
      'bg-red-100 text-red-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-cyan-100 text-cyan-800',
      'bg-teal-100 text-teal-800',
      'bg-emerald-100 text-emerald-800',
      'bg-amber-100 text-amber-800',
      'bg-violet-100 text-violet-800',
      'bg-slate-100 text-slate-800',
    ];

    // Simple hash function for consistent color assignment
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = (hash << 5) - hash + tagName.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
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
    <div className='max-w-7xl mx-auto px-4 sm:px-6'>
      <div className='mb-6 sm:mb-8'>
        <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4'>Dive Sites</h1>
        <p className='text-sm sm:text-base text-gray-600'>
          Discover amazing dive sites around the world
        </p>
        {totalCount !== undefined && (
          <div className='mt-2 text-xs sm:text-sm text-gray-500'>
            Showing {diveSites?.length || 0} dive sites from {totalCount} total dive sites
          </div>
        )}
      </div>

      {/* Mobile Filter Toggle Button */}
      <div className='md:hidden mb-4'>
        <button
          onClick={toggleFilters}
          className='w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
        >
          <Filter className='h-5 w-5' />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Search and Filter Section */}
      <div
        className={`bg-white rounded-lg shadow-md mb-6 sm:mb-8 ${showFilters ? 'block' : 'hidden md:block'}`}
      >
        <div className='p-4 sm:p-6'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
            <div className='lg:col-span-2'>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Search Sites
              </label>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                <input
                  type='text'
                  name='name'
                  placeholder='Search by name...'
                  value={filters.name}
                  onChange={handleSearchChange}
                  className='pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Difficulty Level
              </label>
              <select
                name='difficulty_level'
                value={filters.difficulty_level}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              >
                <option value=''>All Levels</option>
                <option value='beginner'>Beginner</option>
                <option value='intermediate'>Intermediate</option>
                <option value='advanced'>Advanced</option>
                <option value='expert'>Expert</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Min Rating (≥)
              </label>
              <input
                type='number'
                min='0'
                max='10'
                step='0.1'
                name='min_rating'
                value={filters.min_rating}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                placeholder='Show sites rated ≥ this value'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Country
              </label>
              <input
                type='text'
                name='country'
                placeholder='Filter by country...'
                value={filters.country}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>Region</label>
              <input
                type='text'
                name='region'
                placeholder='Filter by region...'
                value={filters.region}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>
          </div>

          {/* Tags Filter */}
          {availableTags && availableTags.length > 0 && (
            <div className='mt-4'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Tags</label>
              <div className='flex flex-wrap gap-2'>
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    type='button'
                    onClick={() => {
                      const tagId = parseInt(tag.id);
                      setFilters(prev => ({
                        ...prev,
                        tag_ids: prev.tag_ids.includes(tagId)
                          ? prev.tag_ids.filter(id => id !== tagId)
                          : [...prev.tag_ids, tagId],
                      }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      filters.tag_ids.includes(tag.id)
                        ? `${getTagColor(tag.name)} border-2 border-current shadow-md`
                        : `${getTagColor(tag.name)} opacity-60 hover:opacity-100 border-2 border-transparent`
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter Actions */}
          <div className='mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4'>
            <button
              onClick={clearFilters}
              className='px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm'
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Sorting Controls */}
      <div className='mb-6 sm:mb-8'>
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
        />
      </div>

      {/* Pagination Controls */}
      <div className='mb-6 sm:mb-8'>
        <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
          <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
            {/* Pagination Controls */}
            <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4'>
              {/* Page Size Selection */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700'>Show:</label>
                <select
                  value={pagination.page_size}
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
              {totalCount !== undefined && totalCount !== null && (
                <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                  Showing {Math.max(1, (pagination.page - 1) * effectivePageSize + 1)} to{' '}
                  {Math.min(pagination.page * effectivePageSize, totalCount)} of {totalCount} dive
                  sites
                </div>
              )}

              {/* Pagination Navigation */}
              {totalCount !== undefined && totalCount !== null && totalCount > 0 && (
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
                    {Math.max(1, Math.ceil(totalCount / effectivePageSize))}
                  </span>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= Math.ceil(totalCount / effectivePageSize)}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className='flex flex-col sm:flex-row justify-between items-center mb-6 gap-4'>
        {user && (
          <button
            onClick={() => {
              const newFilters = { ...filters, my_dive_sites: !filters.my_dive_sites };
              setFilters(newFilters);
              setPagination(prev => ({ ...prev, page: 1 }));
              immediateUpdateURL(newFilters, { ...pagination, page: 1 }, viewMode);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              filters.my_dive_sites
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            {filters.my_dive_sites ? '✓ My Dive Sites' : 'My Dive Sites'}
          </button>
        )}

        {user && (
          <div className='flex flex-col sm:flex-row gap-3'>
            <button
              onClick={() => navigate('/dive-sites/create')}
              className='bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2'
            >
              <Plus size={20} />
              Create Dive Site
            </button>
          </div>
        )}
      </div>

      {/* Results Section */}
      {/* Dive Sites List */}
      {viewMode === 'list' && (
        <div className={`space-y-2 ${compactLayout ? 'view-mode-compact' : ''}`}>
          {diveSites?.map(site => (
            <div
              key={site.id}
              className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
                compactLayout ? 'p-2' : 'p-3'
              }`}
            >
              <div className='flex items-start justify-between mb-2'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1'>
                    {showThumbnails && (
                      <div className='dive-thumbnail flex-shrink-0'>
                        <MapPin className='w-6 h-6' />
                      </div>
                    )}
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
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
                  className='ml-2 flex-shrink-0 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors'
                >
                  <Eye className='w-3 h-3' />
                  View
                </Link>
              </div>

              <div className='flex items-center gap-4 mb-2'>
                <div className='flex items-center gap-1'>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(site.difficulty_level)}`}
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
                        {Number(site.latitude).toFixed(4)}°, {Number(site.longitude).toFixed(4)}°
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
      {viewMode === 'grid' && (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${compactLayout ? 'view-mode-compact' : ''}`}
        >
          {diveSites?.map(site => (
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
                          {Number(site.latitude).toFixed(4)}°, {Number(site.longitude).toFixed(4)}°
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

      {/* Dive Sites Map */}
      {viewMode === 'map' && (
        <div className='h-96 rounded-lg overflow-hidden border border-gray-200'>
          <DiveSitesMap diveSites={diveSites || []} />
        </div>
      )}

      {diveSites?.length === 0 && (
        <div className='text-center py-8 sm:py-12'>
          <Map className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <p className='text-sm sm:text-base text-gray-600'>
            No dive sites found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiveSites;
