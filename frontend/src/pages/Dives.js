import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Clock,
  Thermometer,
  Star,
  Map,
  Search,
  List,
  Lock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Upload,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api, { deleteDive } from '../api';
import DivesMap from '../components/DivesMap';
import ImportDivesModal from '../components/ImportDivesModal';
import SortingControls from '../components/SortingControls';
import { useAuth } from '../contexts/AuthContext';
import useSorting from '../hooks/useSorting';
import { getSortOptions } from '../utils/sortOptions';

const Dives = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showImportModal, setShowImportModal] = useState(false);

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
      tag_ids: searchParams
        .getAll('tag_ids')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id)),
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
    zoom: 2,
  });

  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    dive_site_name: getInitialFilters().dive_site_name,
  });

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, handleSortApply, resetSorting, getSortParams } =
    useSorting('dives');

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    (() => {
      let timeoutId;
      return (newFilters, newPagination, newViewMode) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const newSearchParams = new URLSearchParams();

          // Add view mode
          if (newViewMode === 'map') {
            newSearchParams.set('view', 'map');
          }

          // Add filters
          if (newFilters.dive_site_id) newSearchParams.set('dive_site_id', newFilters.dive_site_id);
          if (newFilters.dive_site_name)
            newSearchParams.set('dive_site_name', newFilters.dive_site_name);
          if (newFilters.difficulty_level)
            newSearchParams.set('difficulty_level', newFilters.difficulty_level);
          if (newFilters.min_depth) newSearchParams.set('min_depth', newFilters.min_depth);
          if (newFilters.max_depth) newSearchParams.set('max_depth', newFilters.max_depth);
          if (newFilters.min_visibility)
            newSearchParams.set('min_visibility', newFilters.min_visibility);
          if (newFilters.max_visibility)
            newSearchParams.set('max_visibility', newFilters.max_visibility);
          if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);
          if (newFilters.max_rating) newSearchParams.set('max_rating', newFilters.max_rating);
          if (newFilters.start_date) newSearchParams.set('start_date', newFilters.start_date);
          if (newFilters.end_date) newSearchParams.set('end_date', newFilters.end_date);
          if (newFilters.my_dives) newSearchParams.set('my_dives', newFilters.my_dives.toString());

          // Add tag IDs
          newFilters.tag_ids.forEach(tagId => {
            newSearchParams.append('tag_ids', tagId.toString());
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
    [navigate]
  );

  // Immediate URL update for non-search filters
  const immediateUpdateURL = useCallback(
    (newFilters, newPagination, newViewMode) => {
      const newSearchParams = new URLSearchParams();

      // Add view mode
      if (newViewMode === 'map') {
        newSearchParams.set('view', 'map');
      }

      // Add filters
      if (newFilters.dive_site_id) newSearchParams.set('dive_site_id', newFilters.dive_site_id);
      if (newFilters.dive_site_name)
        newSearchParams.set('dive_site_name', newFilters.dive_site_name);
      if (newFilters.difficulty_level)
        newSearchParams.set('difficulty_level', newFilters.difficulty_level);
      if (newFilters.min_depth) newSearchParams.set('min_depth', newFilters.min_depth);
      if (newFilters.max_depth) newSearchParams.set('max_depth', newFilters.max_depth);
      if (newFilters.min_visibility)
        newSearchParams.set('min_visibility', newFilters.min_visibility);
      if (newFilters.max_visibility)
        newSearchParams.set('max_visibility', newFilters.max_visibility);
      if (newFilters.min_rating) newSearchParams.set('min_rating', newFilters.min_rating);
      if (newFilters.max_rating) newSearchParams.set('max_rating', newFilters.max_rating);
      if (newFilters.start_date) newSearchParams.set('start_date', newFilters.start_date);
      if (newFilters.end_date) newSearchParams.set('end_date', newFilters.end_date);
      if (newFilters.my_dives) newSearchParams.set('my_dives', newFilters.my_dives.toString());

      // Add tag IDs
      newFilters.tag_ids.forEach(tagId => {
        newSearchParams.append('tag_ids', tagId.toString());
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

  // Update URL when view mode or pagination change (immediate)
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [viewMode, pagination, immediateUpdateURL]);

  // No more debounced URL updates for search inputs - they only update when Search button is clicked

  // Debounced search terms for query key
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerms({
        dive_site_name: filters.dive_site_name,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.dive_site_name]);

  // Immediate URL update for non-search filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [
    filters.dive_site_id,
    filters.difficulty_level,
    filters.min_depth,
    filters.max_depth,
    filters.min_visibility,
    filters.max_visibility,
    filters.min_rating,
    filters.max_rating,
    filters.start_date,
    filters.end_date,
    filters.my_dives,
    filters.tag_ids,
    immediateUpdateURL,
  ]);

  // Invalidate query when sorting changes to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries(['dives']);
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
      'dives-count',
      debouncedSearchTerms.dive_site_name,
      filters.dive_site_id,
      filters.difficulty_level,
      filters.min_depth,
      filters.max_depth,
      filters.min_visibility,
      filters.max_visibility,
      filters.min_rating,
      filters.max_rating,
      filters.start_date,
      filters.end_date,
      filters.my_dives,
      filters.tag_ids,
    ],
    () => {
      const params = new URLSearchParams();

      if (filters.dive_site_id) params.append('dive_site_id', filters.dive_site_id);
      if (debouncedSearchTerms.dive_site_name)
        params.append('dive_site_name', debouncedSearchTerms.dive_site_name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_depth) params.append('min_depth', filters.min_depth);
      if (filters.max_depth) params.append('max_depth', filters.max_depth);
      if (filters.min_visibility) params.append('min_visibility', filters.min_visibility);
      if (filters.max_visibility) params.append('max_visibility', filters.max_visibility);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.my_dives) params.append('my_dives', filters.my_dives.toString());

      filters.tag_ids.forEach(tagId => {
        params.append('tag_ids', tagId.toString());
      });

      return api.get(`/api/v1/dives/count?${params.toString()}`).then(res => res.data);
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Extract total count from response
  const totalCount = totalCountResponse?.total || 0;

  // Fetch dives
  const {
    data: dives,
    isLoading,
    error,
  } = useQuery(
    [
      'dives',
      debouncedSearchTerms.dive_site_name,
      filters.dive_site_id,
      filters.difficulty_level,
      filters.min_depth,
      filters.max_depth,
      filters.min_visibility,
      filters.max_visibility,
      filters.min_rating,
      filters.max_rating,
      filters.start_date,
      filters.end_date,
      filters.my_dives,
      filters.tag_ids,
      pagination.page,
      pagination.page_size,
      sortBy,
      sortOrder,
    ],
    () => {
      const params = new URLSearchParams();

      if (filters.dive_site_id) params.append('dive_site_id', filters.dive_site_id);
      if (debouncedSearchTerms.dive_site_name)
        params.append('dive_site_name', debouncedSearchTerms.dive_site_name);
      if (filters.difficulty_level) params.append('difficulty_level', filters.difficulty_level);
      if (filters.min_depth) params.append('min_depth', filters.min_depth);
      if (filters.max_depth) params.append('max_depth', filters.max_depth);
      if (filters.min_visibility) params.append('min_visibility', filters.min_visibility);
      if (filters.max_visibility) params.append('max_visibility', filters.max_visibility);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.my_dives) params.append('my_dives', filters.my_dives.toString());

      filters.tag_ids.forEach(tagId => {
        params.append('tag_ids', tagId.toString());
      });

      // Add sorting parameters directly from state (not from getSortParams)
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());

      return api.get(`/api/v1/dives/?${params.toString()}`).then(res => res.data);
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const handleSearch = e => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when searching

    // Update URL with current search filters
    const newSearchParams = new URLSearchParams();

    // Add view mode
    if (viewMode === 'map') {
      newSearchParams.set('view', 'map');
    }

    // Add search filters
    if (filters.dive_site_name) newSearchParams.set('dive_site_name', filters.dive_site_name);

    // Add other filters
    if (filters.dive_site_id) newSearchParams.set('dive_site_id', filters.dive_site_id);
    if (filters.difficulty_level) newSearchParams.set('difficulty_level', filters.difficulty_level);
    if (filters.min_depth) newSearchParams.set('min_depth', filters.min_depth);
    if (filters.max_depth) newSearchParams.set('max_depth', filters.max_depth);
    if (filters.min_visibility) newSearchParams.set('min_visibility', filters.min_visibility);
    if (filters.max_visibility) newSearchParams.set('max_visibility', filters.max_visibility);
    if (filters.min_rating) newSearchParams.set('min_rating', filters.min_rating);
    if (filters.max_rating) newSearchParams.set('max_rating', filters.max_rating);
    if (filters.start_date) newSearchParams.set('start_date', filters.start_date);
    if (filters.end_date) newSearchParams.set('end_date', filters.end_date);
    if (filters.my_dives) newSearchParams.set('my_dives', filters.my_dives.toString());

    // Add sorting parameters
    if (sortBy) newSearchParams.set('sort_by', sortBy);
    if (sortOrder) newSearchParams.set('sort_order', sortOrder);

    // Add tag IDs
    filters.tag_ids.forEach(tagId => {
      newSearchParams.append('tag_ids', tagId.toString());
    });

    // Add pagination
    newSearchParams.set('page', '1'); // Reset to page 1
    newSearchParams.set('page_size', pagination.page_size.toString());

    // Update URL without triggering a page reload
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  };

  const handleSearchChange = e => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Don't reset pagination or trigger search on every change - only when Search button is clicked
  };

  // handleTagChange function removed as it's now handled inline in the button onClick

  const clearFilters = () => {
    setFilters({
      dive_site_id: '',
      dive_site_name: '',
      difficulty_level: '',
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

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(prev => ({ ...prev, page: 1, page_size: newPageSize }));
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Delete dive mutation
  const deleteDiveMutation = useMutation(deleteDive, {
    onSuccess: () => {
      toast.success('Dive deleted successfully');
      queryClient.invalidateQueries(['dives']);
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to delete dive');
    },
  });

  const handleDelete = diveId => {
    if (window.confirm('Are you sure you want to delete this dive?')) {
      deleteDiveMutation.mutate(diveId);
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDifficultyColor = level => {
    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-orange-100 text-orange-800',
      expert: 'bg-red-100 text-red-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getSuitTypeColor = type => {
    const colors = {
      wet_suit: 'bg-blue-100 text-blue-800',
      dry_suit: 'bg-purple-100 text-purple-800',
      shortie: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
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

  if (error) {
    return (
      <div className='text-center py-8'>
        <p className='text-red-600'>Error loading dives: {error.message}</p>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6'>
      <div className='mb-6 sm:mb-8'>
        <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-4'>Dives</h1>
        <p className='text-sm sm:text-base text-gray-600'>
          Track and explore your diving adventures
        </p>
        {totalCount !== undefined && (
          <div className='mt-2 text-xs sm:text-sm text-gray-500'>
            Showing {dives?.length || 0} dives from {totalCount} total dives
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
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4'>
            <div className='lg:col-span-2'>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Search Dives
              </label>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                <input
                  type='text'
                  name='dive_site_name'
                  placeholder='Search by dive site name...'
                  value={filters.dive_site_name}
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
                Min Depth (m)
              </label>
              <input
                type='number'
                name='min_depth'
                min='0'
                step='any'
                placeholder='Min depth'
                value={filters.min_depth}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Max Depth (m)
              </label>
              <input
                type='number'
                name='max_depth'
                min='0'
                step='any'
                placeholder='Max depth'
                value={filters.max_depth}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Min Visibility (m)
              </label>
              <input
                type='number'
                name='min_visibility'
                min='0'
                placeholder='Min visibility'
                value={filters.min_visibility}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                Max Visibility (m)
              </label>
              <input
                type='number'
                name='max_visibility'
                min='0'
                placeholder='Max visibility'
                value={filters.max_visibility}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
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
                Start Date
              </label>
              <input
                type='date'
                name='start_date'
                value={filters.start_date}
                onChange={handleSearchChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1 sm:mb-2'>
                End Date
              </label>
              <input
                type='date'
                name='end_date'
                value={filters.end_date}
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
        <SortingControls
          sortBy={sortBy}
          sortOrder={sortOrder}
          sortOptions={getSortOptions('dives')}
          onSortChange={handleSortChange}
          onSortApply={handleSortApply}
          onReset={resetSorting}
          entityType='dives'
        />
      </div>

      {/* View Mode and Pagination Controls - Integrated for better UX */}
      <div className='mb-6 sm:mb-8'>
        <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
          <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
            {/* View Mode Controls */}
            <div className='flex flex-col sm:flex-row items-center gap-4'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium text-gray-700'>View Mode:</span>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }`}
                >
                  <List className='h-5 w-5' />
                  List View
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  }`}
                >
                  <Map className='h-5 w-5' />
                  Map View
                </button>
              </div>
            </div>

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
              {totalCount !== undefined && (
                <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                  Showing {(pagination.page - 1) * pagination.page_size + 1} to{' '}
                  {Math.min(pagination.page * pagination.page_size, totalCount)} of {totalCount}{' '}
                  dives
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
      </div>

      {/* Action Buttons */}
      <div className='flex flex-col sm:flex-row justify-between items-center mb-6 gap-4'>
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
          <div className='flex flex-col sm:flex-row gap-3'>
            <button
              onClick={() => setShowImportModal(true)}
              className='bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2'
            >
              <Upload size={20} />
              Import Dives
            </button>
            <Link
              to='/dives/create'
              className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2'
            >
              <Plus size={20} />
              Log New Dive
            </Link>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportDivesModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          // Refresh the dives list
          queryClient.invalidateQueries(['dives']);
        }}
      />

      {/* Results Section */}
      {isLoading ? (
        <div className='flex justify-center items-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      ) : viewMode === 'map' ? (
        <div className='mb-6 sm:mb-8'>
          <DivesMap
            key={`dives-${dives?.length || 0}-${JSON.stringify(filters)}`}
            dives={dives}
            viewport={viewport}
            onViewportChange={setViewport}
          />
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
          {dives?.map(dive => {
            // Determine card styling based on ownership and privacy
            const isOwnedByUser = user?.id === dive.user_id;
            const isPrivate = dive.is_private;

            let cardClasses =
              'rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow';

            if (isPrivate) {
              cardClasses +=
                ' bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200';
            } else if (!isOwnedByUser) {
              cardClasses += ' bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200';
            } else {
              cardClasses += ' bg-white';
            }

            return (
              <div key={dive.id} className={cardClasses}>
                <div className='p-4 sm:p-6'>
                  <div className='flex justify-between items-start mb-3 sm:mb-4'>
                    <div className='flex-1 min-w-0'>
                      <Link
                        to={`/dives/${dive.id}`}
                        className='text-lg sm:text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block'
                      >
                        {dive.name || dive.dive_site?.name || 'Unnamed Dive Site'}
                      </Link>
                      <p className='text-sm text-gray-600'>
                        {formatDate(dive.dive_date)}
                        {dive.dive_time && ` at ${formatTime(dive.dive_time)}`}
                      </p>
                    </div>
                    <div className='flex gap-2 flex-shrink-0'>
                      <Link
                        to={`/dives/${dive.id}`}
                        className='text-blue-600 hover:text-blue-800'
                        title='View Dive'
                      >
                        <Eye size={16} />
                      </Link>
                      {isPrivate && (
                        <Lock size={16} className='text-gray-500' title='Private Dive' />
                      )}
                      {(isOwnedByUser || user?.is_admin) && (
                        <>
                          <Link
                            to={`/dives/${dive.id}/edit`}
                            className='text-green-600 hover:text-green-800'
                            title='Edit Dive'
                          >
                            <Edit size={16} />
                          </Link>
                          {(isOwnedByUser || user?.is_admin) && (
                            <button
                              onClick={() => handleDelete(dive.id)}
                              className='text-red-600 hover:text-red-800'
                              title='Delete Dive'
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className='space-y-2'>
                    {dive.difficulty_level && (
                      <div className='flex items-center gap-2'>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(dive.difficulty_level)}`}
                        >
                          {dive.difficulty_level}
                        </span>
                      </div>
                    )}

                    {dive.suit_type && (
                      <div className='flex items-center gap-2'>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getSuitTypeColor(dive.suit_type)}`}
                        >
                          {dive.suit_type.replace('_', ' ')}
                        </span>
                      </div>
                    )}

                    <div className='flex items-center gap-4 text-xs sm:text-sm text-gray-600'>
                      {dive.max_depth && (
                        <div className='flex items-center gap-1'>
                          <Thermometer size={14} />
                          <span>{dive.max_depth}m max</span>
                        </div>
                      )}
                      {dive.duration && (
                        <div className='flex items-center gap-1'>
                          <Clock size={14} />
                          <span>{dive.duration}min</span>
                        </div>
                      )}
                      {dive.user_rating && (
                        <div className='flex items-center gap-1'>
                          <Star size={14} className='text-yellow-500' />
                          <span>{dive.user_rating}/10</span>
                        </div>
                      )}
                    </div>

                    {dive.dive_information && (
                      <p className='text-sm text-gray-700 line-clamp-2'>{dive.dive_information}</p>
                    )}

                    {dive.tags && dive.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1 mt-2'>
                        {dive.tags.map(tag => (
                          <span
                            key={tag.id}
                            className={`px-2 py-1 text-xs rounded-full font-medium ${getTagColor(tag.name)}`}
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
        <div className='text-center py-8 sm:py-12'>
          <Map className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <p className='text-sm sm:text-base text-gray-600'>
            No dives found matching your criteria.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dives;
