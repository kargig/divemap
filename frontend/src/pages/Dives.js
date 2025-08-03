import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDives, deleteDive } from '../api';
import api from '../api';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Eye, Calendar, MapPin, Clock, Thermometer, Star, Map, Search, Filter, List, Globe, Tag, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import DivesMap from '../components/DivesMap';

const Dives = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const viewMode = searchParams.get('view');
    return viewMode === 'map' ? 'map' : 'list';
  };

  const getInitialFilters = () => {
    return {
      dive_site_id: searchParams.get('dive_site_id') || '',
      dive_site_name: searchParams.get('dive_site_name') || '',
      difficulty_level: searchParams.get('difficulty_level') || '',
      min_depth: searchParams.get('min_depth') || '',
      max_depth: searchParams.get('max_depth') || '',
      min_visibility: searchParams.get('min_visibility') || '',
      max_visibility: searchParams.get('max_visibility') || '',
      min_rating: searchParams.get('min_rating') || '',
      max_rating: searchParams.get('max_rating') || '',
      start_date: searchParams.get('start_date') || '',
      end_date: searchParams.get('end_date') || '',
      tag_ids: searchParams.getAll('tag_ids').map(id => parseInt(id)).filter(id => !isNaN(id)),
      my_dives: searchParams.get('my_dives') === 'true',
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
    zoom: 2
  });
  
  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);

  // Update URL when view mode, filters, or pagination change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();
    
    // Add view mode
    if (viewMode === 'map') {
      newSearchParams.set('view', 'map');
    }
    
    // Add filters
    if (filters.dive_site_id) newSearchParams.set('dive_site_id', filters.dive_site_id);
    if (filters.dive_site_name) newSearchParams.set('dive_site_name', filters.dive_site_name);
    if (filters.difficulty_level) newSearchParams.set('difficulty_level', filters.difficulty_level);
    if (filters.min_depth) newSearchParams.set('min_depth', filters.min_depth);
    if (filters.max_depth) newSearchParams.set('max_depth', filters.max_depth);
    if (filters.min_visibility) newSearchParams.set('min_visibility', filters.min_visibility);
    if (filters.max_visibility) newSearchParams.set('max_visibility', filters.max_visibility);
    if (filters.min_rating) newSearchParams.set('min_rating', filters.min_rating);
    if (filters.max_rating) newSearchParams.set('max_rating', filters.max_rating);
    if (filters.start_date) newSearchParams.set('start_date', filters.start_date);
    if (filters.end_date) newSearchParams.set('end_date', filters.end_date);
    if (filters.my_dives) newSearchParams.set('my_dives', 'true');
    
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

  // Query for fetching dives with pagination
  const { data: dives = [], isLoading, error } = useQuery(
    ['dives', filters, pagination, user],
    () => {
      // Create URLSearchParams to properly handle array parameters
      const params = new URLSearchParams();
      
      // Add non-array parameters
      if (filters.dive_site_id) params.append('dive_site_id', filters.dive_site_id);
      if (filters.dive_site_name) params.append('dive_site_name', filters.dive_site_name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_depth) params.append('min_depth', filters.min_depth);
      if (filters.max_depth) params.append('max_depth', filters.max_depth);
      if (filters.min_visibility) params.append('min_visibility', filters.min_visibility);
      if (filters.max_visibility) params.append('max_visibility', filters.max_visibility);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      // Add array parameters (tag_ids)
      if (filters.tag_ids && filters.tag_ids.length > 0) {
        filters.tag_ids.forEach(tagId => {
          params.append('tag_ids', tagId.toString());
        });
      }
      
      // Add pagination parameters
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());
      
      return api.get(`/api/v1/dives/?${params.toString()}`);
    },
    {
      select: (response) => {
        // Store pagination info from headers
        const paginationInfo = {
          totalCount: parseInt(response.headers['x-total-count'] || '0'),
          totalPages: parseInt(response.headers['x-total-pages'] || '0'),
          currentPage: parseInt(response.headers['x-current-page'] || '1'),
          pageSize: parseInt(response.headers['x-page-size'] || '25'),
          hasNextPage: response.headers['x-has-next-page'] === 'true',
          hasPrevPage: response.headers['x-has-prev-page'] === 'true'
        };
        // Store pagination info in the query cache
        queryClient.setQueryData(['dives-pagination', filters, pagination], paginationInfo);
        return response.data;
      },
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Get pagination info from cached data
  const paginationInfo = queryClient.getQueryData(['dives-pagination', filters, pagination]) || {
    totalCount: 0,
    totalPages: 0,
    currentPage: pagination.page,
    pageSize: pagination.page_size,
    hasNextPage: false,
    hasPrevPage: pagination.page > 1
  };

  // Delete dive mutation
  const deleteDiveMutation = useMutation(deleteDive, {
    onSuccess: () => {
      toast.success('Dive deleted successfully');
      queryClient.invalidateQueries(['dives']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete dive');
    },
  });

  const handleDelete = (diveId) => {
    if (window.confirm('Are you sure you want to delete this dive?')) {
      deleteDiveMutation.mutate(diveId);
    }
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      dive_site_id: '',
      dive_site_name: '',
      difficulty_level: '',
      suit_type: '',
      min_depth: '',
      max_depth: '',
      min_visibility: '',
      max_visibility: '',
      min_rating: '',
      max_rating: '',
      start_date: '',
      end_date: '',
      tag_ids: [],
      my_dives: false,
    });
    // Reset to first page when clearing filters
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
  };

  const handleTagToggle = (tagId) => {
    setFilters(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleMyDivesToggle = () => {
    setFilters(prev => ({
      ...prev,
      my_dives: !prev.my_dives,
    }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({
      page: 1, // Reset to first page when changing page size
      page_size: newPageSize,
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDifficultyColor = (level) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-orange-100 text-orange-800',
      expert: 'bg-red-100 text-red-800'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getSuitTypeColor = (type) => {
    const colors = {
      wet_suit: 'bg-blue-100 text-blue-800',
      dry_suit: 'bg-purple-100 text-purple-800',
      shortie: 'bg-green-100 text-green-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading dives: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Dives</h1>
        <p className="text-gray-600">Track and explore your diving adventures</p>
        {paginationInfo.totalCount !== undefined && (
          <div className="mt-2 text-sm text-gray-500">
            Showing {paginationInfo.totalCount} dives
          </div>
        )}
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Dives
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="dive_site_name"
                placeholder="Search by dive site name..."
                value={filters.dive_site_name}
                onChange={handleSearchChange}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              name="difficulty_level"
              value={filters.difficulty_level}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Depth (m)
            </label>
            <input
              type="number"
              name="min_depth"
              placeholder="Min depth"
              value={filters.min_depth}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Depth (m)
            </label>
            <input
              type="number"
              name="max_depth"
              placeholder="Max depth"
              value={filters.max_depth}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={clearFilters}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Visibility
            </label>
            <input
              type="number"
              name="min_visibility"
              min="1"
              max="10"
              placeholder="Min visibility"
              value={filters.min_visibility}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Visibility
            </label>
            <input
              type="number"
              name="max_visibility"
              min="1"
              max="10"
              placeholder="Max visibility"
              value={filters.max_visibility}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rating
            </label>
            <input
              type="number"
              name="min_rating"
              min="1"
              max="10"
              placeholder="Min rating"
              value={filters.min_rating}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Rating
            </label>
            <input
              type="number"
              name="max_rating"
              min="1"
              max="10"
              placeholder="Max rating"
              value={filters.max_rating}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              name="start_date"
              value={filters.start_date}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              name="end_date"
              value={filters.end_date}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Tag Cloud */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Filter by Tags
          </label>
          <div className="flex flex-wrap gap-3">
            {availableTags && availableTags.length > 0 ? (
              availableTags.map((tag, index) => {
                const isSelected = filters.tag_ids.includes(tag.id);
                const sizes = ['text-sm', 'text-base', 'text-lg', 'text-xl'];
                const colors = [
                  'bg-blue-100 text-blue-800 hover:bg-blue-200',
                  'bg-green-100 text-green-800 hover:bg-green-200',
                  'bg-purple-100 text-purple-800 hover:bg-purple-200',
                  'bg-orange-100 text-orange-800 hover:bg-orange-200',
                  'bg-pink-100 text-pink-800 hover:bg-pink-200',
                  'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                ];
                const sizeClass = sizes[index % sizes.length];
                const colorClass = colors[index % colors.length];
                
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={`px-4 py-2 rounded-full font-medium transition-all duration-200 transform hover:scale-105 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-lg scale-110'
                        : `${colorClass} shadow-md`
                    } ${sizeClass}`}
                  >
                    {tag.name}
                  </button>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm">Loading tags...</p>
            )}
          </div>
          {filters.tag_ids.length > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Selected:</span> {filters.tag_ids.length} tag{filters.tag_ids.length !== 1 ? 's' : ''} 
              {filters.tag_ids.length > 1 && (
                <span className="text-gray-500"> (showing dives with ALL selected tags)</span>
              )}
            </div>
          )}
        </div>
        
        {/* View Mode Toggle */}
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4 inline mr-2" />
              List View
            </button>
            <button
              onClick={() => handleViewModeChange('map')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="h-4 w-4 inline mr-2" />
              Map View
            </button>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Page Size Selection */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Show:</label>
            <select
              value={pagination.page_size}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          {/* Pagination Info */}
          {paginationInfo.totalCount !== undefined && (
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
              {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)} of {paginationInfo.totalCount} dives
            </div>
          )}

          {/* Pagination Navigation */}
          {paginationInfo.totalCount !== undefined && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <span className="text-sm text-gray-700">
                Page {pagination.page} of {Math.ceil(paginationInfo.totalCount / pagination.page_size)}
              </span>
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(paginationInfo.totalCount / pagination.page_size)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons and My Dives Filter */}
      <div className="flex justify-between items-center mb-6">
        {user && (
          <button
            onClick={handleMyDivesToggle}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              filters.my_dives
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            {filters.my_dives ? '✓ My Dives' : 'My Dives'}
          </button>
        )}
        
        {user && (
          <Link
            to="/dives/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus size={20} />
            Log New Dive
          </Link>
        )}
      </div>

      {/* Results Section */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'map' ? (
        <div className="mb-8">
          <DivesMap 
            dives={dives}
            viewport={viewport}
            onViewportChange={setViewport}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dives?.map((dive) => {
            // Determine card styling based on ownership and privacy
            const isOwnedByUser = user?.id === dive.user_id;
            const isPrivate = dive.is_private;
            
            let cardClasses = "rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow";
            
            if (isPrivate) {
              cardClasses += " bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200";
            } else if (!isOwnedByUser) {
              cardClasses += " bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200";
            } else {
              cardClasses += " bg-white";
            }
            
            return (
              <div key={dive.id} className={cardClasses}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Link 
                        to={`/dives/${dive.id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {dive.name || dive.dive_site?.name || 'Unnamed Dive Site'}
                      </Link>
                      <p className="text-sm text-gray-600">
                        {formatDate(dive.dive_date)}
                        {dive.dive_time && ` at ${formatTime(dive.dive_time)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/dives/${dive.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Dive"
                      >
                        <Eye size={16} />
                      </Link>
                      {isPrivate && (
                        <Lock size={16} className="text-gray-500" title="Private Dive" />
                      )}
                      {(isOwnedByUser || user?.is_admin) && (
                        <>
                          <Link
                            to={`/dives/${dive.id}/edit`}
                            className="text-green-600 hover:text-green-800"
                            title="Edit Dive"
                          >
                            <Edit size={16} />
                          </Link>
                          {(isOwnedByUser || user?.is_admin) && (
                            <button
                              onClick={() => handleDelete(dive.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete Dive"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {dive.difficulty_level && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(dive.difficulty_level)}`}>
                          {dive.difficulty_level}
                        </span>
                      </div>
                    )}

                    {dive.suit_type && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSuitTypeColor(dive.suit_type)}`}>
                          {dive.suit_type.replace('_', ' ')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {dive.max_depth && (
                        <div className="flex items-center gap-1">
                          <Thermometer size={14} />
                          <span>{dive.max_depth}m max</span>
                        </div>
                      )}
                      {dive.duration && (
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{dive.duration}min</span>
                        </div>
                      )}
                      {dive.user_rating && (
                        <div className="flex items-center gap-1">
                          <Star size={14} className="text-yellow-500" />
                          <span>{dive.user_rating}/10</span>
                        </div>
                      )}
                    </div>

                    {dive.dive_information && (
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {dive.dive_information}
                      </p>
                    )}

                    {dive.tags && dive.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {dive.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dives?.length === 0 && (
        <div className="text-center py-12">
          <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No dives found matching your criteria.</p>
        </div>
      )}

      
    </div>
  );
};

export default Dives; 