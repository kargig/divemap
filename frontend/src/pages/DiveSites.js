import { Search, List, ChevronLeft, ChevronRight, Map, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';

import api from '../api';
import DiveSitesMap from '../components/DiveSitesMap';

const DiveSites = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const viewMode = searchParams.get('view');
    return viewMode === 'map' ? 'map' : 'list';
  };

  const getInitialFilters = () => {
    return {
      name: searchParams.get('name') || '',
      difficulty_level: searchParams.get('difficulty_level') || '',
      min_rating: searchParams.get('min_rating') || '',
      max_rating: searchParams.get('max_rating') || '',
      country: searchParams.get('country') || '',
      region: searchParams.get('region') || '',
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

  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);
  const [showFilters, setShowFilters] = useState(false);

  // Update URL when view mode, filters, or pagination change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();

    // Add view mode
    if (viewMode === 'map') {
      newSearchParams.set('view', 'map');
    }

    // Add filters
    if (filters.name) newSearchParams.set('name', filters.name);
    if (filters.difficulty_level) newSearchParams.set('difficulty_level', filters.difficulty_level);
    if (filters.min_rating) newSearchParams.set('min_rating', filters.min_rating);
    if (filters.max_rating) newSearchParams.set('max_rating', filters.max_rating);
    if (filters.country) newSearchParams.set('country', filters.country);
    if (filters.region) newSearchParams.set('region', filters.region);

    // Add tag IDs
    filters.tag_ids.forEach(tagId => {
      newSearchParams.append('tag_ids', tagId.toString());
    });

    // Add pagination
    newSearchParams.set('page', pagination.page.toString());
    newSearchParams.set('page_size', pagination.page_size.toString());

    // Update URL without triggering a page reload
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  }, [viewMode, filters, pagination, navigate]);

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
    ['dive-sites-count', filters],
    () => {
      const params = new URLSearchParams();

      if (filters.name) params.append('name', filters.name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);

      filters.tag_ids.forEach(tagId => {
        params.append('tag_ids', tagId.toString());
      });

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
    ['dive-sites', filters, pagination],
    () => {
      const params = new URLSearchParams();

      if (filters.name) params.append('name', filters.name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);

      filters.tag_ids.forEach(tagId => {
        params.append('tag_ids', tagId.toString());
      });

      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());

      return api.get(`/api/v1/dive-sites/?${params.toString()}`).then(res => res.data);
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const handleSearchChange = e => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleTagChange = e => {
    const tagId = parseInt(e.target.value);
    setFilters(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      difficulty_level: '',
      min_rating: '',
      max_rating: '',
      country: '',
      region: '',
      tag_ids: [],
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(prev => ({ ...prev, page: 1, page_size: newPageSize }));
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
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
      <div className='text-center py-12'>
        <p className='text-red-600'>Error loading dive sites. Please try again.</p>
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
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4'>
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
                Min Rating
              </label>
              <input
                type='number'
                name='min_rating'
                min='1'
                max='10'
                placeholder='Min rating'
                value={filters.min_rating}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Max Rating
              </label>
              <input
                type='number'
                name='max_rating'
                min='1'
                max='10'
                placeholder='Max rating'
                value={filters.max_rating}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
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
                  <label key={tag.id} className='flex items-center space-x-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={filters.tag_ids.includes(tag.id)}
                      onChange={handleTagChange}
                      value={tag.id}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    <span className='text-sm text-gray-700'>{tag.name}</span>
                  </label>
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
            <div className='flex flex-col sm:flex-row gap-2 sm:gap-4'>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md transition-colors text-sm ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <List className='h-4 w-4 inline mr-2' />
                List View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-md transition-colors text-sm ${
                  viewMode === 'map'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Map className='h-4 w-4 inline mr-2' />
                Map View
              </button>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className='mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4'>
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
            {totalCount !== undefined && (
              <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                {Math.min(pagination.page * pagination.page_size, totalCount)} of {totalCount} dive
                sites
              </div>
            )}

            {/* Pagination Navigation */}
            {totalCount !== undefined && (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  <ChevronLeft className='h-4 w-4' />
                </button>

                <span className='text-xs sm:text-sm text-gray-700'>
                  Page {pagination.page} of {Math.ceil(totalCount / pagination.page_size)}
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(totalCount / pagination.page_size)}
                  className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {viewMode === 'map' ? (
        <div className='mb-6 sm:mb-8'>
          <DiveSitesMap diveSites={diveSites} viewport={viewport} onViewportChange={setViewport} />
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
          {diveSites?.map(site => (
            <div
              key={site.id}
              className='bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow'
            >
              <div className='p-4 sm:p-6'>
                <div className='flex items-start justify-between mb-3 sm:mb-4'>
                  <h3 className='text-lg sm:text-xl font-semibold text-gray-900 pr-2'>
                    {site.name}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                      site.difficulty_level === 'beginner'
                        ? 'bg-green-100 text-green-800'
                        : site.difficulty_level === 'intermediate'
                          ? 'bg-yellow-100 text-yellow-800'
                          : site.difficulty_level === 'advanced'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {site.difficulty_level}
                  </span>
                </div>

                {site.description && (
                  <p className='text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-3'>
                    {site.description}
                  </p>
                )}

                {site.average_rating && (
                  <div className='flex items-center mb-3 sm:mb-4'>
                    <span className='text-xs sm:text-sm font-semibold text-gray-700'>
                      {site.average_rating.toFixed(1)}/10 ({site.total_ratings} reviews)
                    </span>
                  </div>
                )}

                {site.latitude && site.longitude && (
                  <div className='flex items-center text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4'>
                    <Map className='h-3 w-3 sm:h-4 sm:w-4 mr-1' />
                    <span>
                      {site.latitude}, {site.longitude}
                    </span>
                  </div>
                )}

                {/* Tags */}
                {site.tags && site.tags.length > 0 && (
                  <div className='mb-3 sm:mb-4'>
                    <div className='flex flex-wrap gap-1'>
                      {site.tags.map(tag => (
                        <span
                          key={tag.id}
                          className='px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium'
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <RouterLink
                  to={`/dive-sites/${site.id}`}
                  className='block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base'
                >
                  View Details
                </RouterLink>
              </div>
            </div>
          ))}
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
