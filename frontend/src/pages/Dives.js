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
  Calendar,
  TrendingUp,
  Grid,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api, { deleteDive } from '../api';
import DesktopSearchBar from '../components/DesktopSearchBar';
import DivesMap from '../components/DivesMap';
import FuzzySearchInput from '../components/FuzzySearchInput';
import HeroSection from '../components/HeroSection';
import ImportDivesModal from '../components/ImportDivesModal';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { getSortOptions } from '../utils/sortOptions';

const Dives = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const mode = searchParams.get('view') || 'list';
    return ['list', 'grid', 'map'].includes(mode) ? mode : 'list';
  };

  const getInitialFilters = () => {
    return {
      dive_site_name: searchParams.get('dive_site_name') || '',
      min_depth: searchParams.get('min_depth') || '',
      duration_min: searchParams.get('duration_min') || '',
      duration_max: searchParams.get('duration_max') || '',
      difficulty_level: searchParams.get('difficulty_level') || '',
      date_from: searchParams.get('date_from') || '',
      date_to: searchParams.get('date_to') || '',
      tag_ids: searchParams
        .getAll('tag_ids')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id)),
    };
  };

  const getInitialPagination = () => {
    return {
      page: parseInt(searchParams.get('page')) || 1,
      per_page: parseInt(searchParams.get('per_page')) || 25,
    };
  };

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

  // Add viewport state for map functionality
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showMobileSorting, setShowMobileSorting] = useState(false);

  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);
  const [showImportModal, setShowImportModal] = useState(false);
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    dive_site_name: getInitialFilters().dive_site_name,
  });

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState('');

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } = useSorting('dives');

  // Responsive detection using custom hook
  const { isMobile } = useResponsive();

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

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    (() => {
      let timeoutId;
      return (newFilters, newPagination, newViewMode) => {
        // Safety check: only proceed if all parameters are properly defined
        if (!newFilters || !newPagination || !newViewMode) {
          return;
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const newSearchParams = new URLSearchParams();

          // Add view mode
          if (newViewMode === 'map') {
            newSearchParams.set('view', 'map');
          } else if (newViewMode === 'grid') {
            newSearchParams.set('view', 'grid');
          } else {
            newSearchParams.delete('view'); // Default to list view
          }

          // Add filters with comprehensive safety checks
          if (
            newFilters.dive_site_id &&
            newFilters.dive_site_id.toString &&
            newFilters.dive_site_id.toString().trim()
          ) {
            newSearchParams.set('dive_site_id', newFilters.dive_site_id.toString());
          }
          if (
            newFilters.dive_site_name &&
            newFilters.dive_site_name.toString &&
            newFilters.dive_site_name.toString().trim()
          ) {
            newSearchParams.set('dive_site_name', newFilters.dive_site_name.toString());
          }
          if (
            newFilters.difficulty_level &&
            newFilters.difficulty_level.toString &&
            newFilters.difficulty_level.toString().trim()
          ) {
            newSearchParams.set('difficulty_level', newFilters.difficulty_level.toString());
          }
          if (
            newFilters.min_depth &&
            newFilters.min_depth.toString &&
            newFilters.min_depth.toString().trim()
          ) {
            newSearchParams.set('min_depth', newFilters.min_depth.toString());
          }
          if (
            newFilters.min_rating &&
            newFilters.min_rating.toString &&
            newFilters.min_rating.toString().trim()
          ) {
            newSearchParams.set('min_rating', newFilters.min_rating.toString());
          }
          if (
            newFilters.start_date &&
            newFilters.start_date.toString &&
            newFilters.start_date.toString().trim()
          ) {
            newSearchParams.set('start_date', newFilters.start_date.toString());
          }
          if (
            newFilters.end_date &&
            newFilters.end_date.toString &&
            newFilters.end_date.toString().trim()
          ) {
            newSearchParams.set('end_date', newFilters.end_date.toString());
          }
          if (
            newFilters.my_dives !== undefined &&
            newFilters.my_dives !== null &&
            newFilters.my_dives.toString
          ) {
            newSearchParams.set('my_dives', newFilters.my_dives.toString());
          }

          // Add tag IDs with safety check
          if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
            newFilters.tag_ids.forEach(tagId => {
              if (tagId && tagId.toString) {
                newSearchParams.append('tag_ids', tagId.toString());
              }
            });
          }

          // Add sorting parameters with safety check
          const sortParams = getSortParams();
          if (sortParams && sortParams.sort_by) {
            newSearchParams.set('sort_by', sortParams.sort_by);
          }
          if (sortParams && sortParams.sort_order) {
            newSearchParams.set('sort_order', sortParams.sort_order);
          }

          // Add pagination with safety checks
          if (newPagination.page && newPagination.page.toString) {
            newSearchParams.set('page', newPagination.page.toString());
          }
          if (newPagination.per_page && newPagination.per_page.toString) {
            newSearchParams.set('per_page', newPagination.per_page.toString());
          }

          // Update URL without triggering a page reload
          navigate(`?${newSearchParams.toString()}`, { replace: true });
        }, 800); // 800ms debounce delay
      };
    })(),
    [navigate, getSortParams]
  );

  // Immediate URL update for non-search filters
  const immediateUpdateURL = useCallback(
    (newFilters, newPagination, newViewMode) => {
      // Safety check: only proceed if all parameters are properly defined
      if (!newFilters || !newPagination || !newViewMode) {
        return;
      }

      const newSearchParams = new URLSearchParams();

      // Add view mode
      if (newViewMode === 'map') {
        newSearchParams.set('view', 'map');
      } else if (newViewMode === 'grid') {
        newSearchParams.set('view', 'grid');
      } else {
        newSearchParams.delete('view'); // Default to list view
      }

      // Add filters with comprehensive safety checks
      if (
        newFilters.dive_site_id &&
        newFilters.dive_site_id.toString &&
        newFilters.dive_site_id.toString().trim()
      ) {
        newSearchParams.set('dive_site_id', newFilters.dive_site_id.toString());
      }
      if (
        newFilters.dive_site_name &&
        newFilters.dive_site_name.toString &&
        newFilters.dive_site_name.toString().trim()
      ) {
        newSearchParams.set('dive_site_name', newFilters.dive_site_name.toString());
      }
      if (
        newFilters.difficulty_level &&
        newFilters.difficulty_level.toString &&
        newFilters.difficulty_level.toString().trim()
      ) {
        newSearchParams.set('difficulty_level', newFilters.difficulty_level.toString());
      }
      if (
        newFilters.min_depth &&
        newFilters.min_depth.toString &&
        newFilters.min_depth.toString().trim()
      ) {
        newSearchParams.set('min_depth', newFilters.min_depth.toString());
      }
      if (
        newFilters.min_rating &&
        newFilters.min_rating.toString &&
        newFilters.min_rating.toString().trim()
      ) {
        newSearchParams.set('min_rating', newFilters.min_rating.toString());
      }
      if (
        newFilters.start_date &&
        newFilters.start_date.toString &&
        newFilters.start_date.toString().trim()
      ) {
        newSearchParams.set('start_date', newFilters.start_date.toString());
      }
      if (
        newFilters.end_date &&
        newFilters.end_date.toString &&
        newFilters.end_date.toString().trim()
      ) {
        newSearchParams.set('end_date', newFilters.end_date.toString());
      }
      if (
        newFilters.my_dives !== undefined &&
        newFilters.my_dives !== null &&
        newFilters.my_dives.toString
      ) {
        newSearchParams.set('my_dives', newFilters.my_dives.toString());
      }

      // Add tag IDs with safety check
      if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
        newFilters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString) {
            newSearchParams.append('tag_ids', tagId.toString());
          }
        });
      }

      // Add sorting parameters with safety check
      const sortParams = getSortParams();
      if (sortParams && sortParams.sort_by) {
        newSearchParams.set('sort_by', sortParams.sort_by);
      }
      if (sortParams && sortParams.sort_order) {
        newSearchParams.set('sort_order', sortParams.sort_order);
      }

      // Add pagination with safety checks
      if (newPagination.page && newPagination.page.toString) {
        newSearchParams.set('page', newPagination.page.toString());
      }
      if (newPagination.per_page && newPagination.per_page.toString) {
        newSearchParams.set('per_page', newPagination.per_page.toString());
      }

      // Update URL without triggering a page reload
      navigate(`?${newSearchParams.toString()}`, { replace: true });
    },
    [navigate, getSortParams]
  );

  // Update URL when view mode or pagination change (immediate)
  useEffect(() => {
    // Only run if filters and pagination are properly initialized
    if (
      filters &&
      pagination &&
      Object.keys(filters).length > 0 &&
      Object.keys(pagination).length > 0
    ) {
      immediateUpdateURL(filters, pagination, viewMode);
    }
  }, [filters, pagination, viewMode, immediateUpdateURL]);

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
    filters.min_rating,
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
      filters.min_rating,
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
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.my_dives && filters.my_dives.toString) {
        params.append('my_dives', filters.my_dives.toString());
      }

      if (filters.tag_ids && Array.isArray(filters.tag_ids)) {
        filters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString) {
            params.append('tag_ids', tagId.toString());
          }
        });
      }

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
      filters.min_rating,
      filters.start_date,
      filters.end_date,
      filters.my_dives,
      filters.tag_ids,
      pagination.page,
      pagination.per_page,
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
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.my_dives) params.append('my_dives', filters.my_dives.toString());

      if (filters.tag_ids && Array.isArray(filters.tag_ids)) {
        filters.tag_ids.forEach(tagId => {
          params.append('tag_ids', tagId.toString());
        });
      }

      // Add sorting parameters directly from state (not from getSortParams)
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      if (pagination.page && pagination.page.toString) {
        params.append('page', pagination.page.toString());
      }
      if (pagination.per_page && pagination.per_page.toString) {
        params.append('per_page', pagination.per_page.toString());
      }

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
    } else if (viewMode === 'grid') {
      newSearchParams.set('view', 'grid');
    } else {
      newSearchParams.delete('view'); // Default to list view
    }

    // Add search filters with safety checks
    if (filters.dive_site_name && filters.dive_site_name.toString) {
      newSearchParams.set('dive_site_name', filters.dive_site_name.toString());
    }

    // Add other filters with safety checks
    if (filters.dive_site_id && filters.dive_site_id.toString) {
      newSearchParams.set('dive_site_id', filters.dive_site_id.toString());
    }
    if (filters.difficulty_level && filters.difficulty_level.toString) {
      newSearchParams.set('difficulty_level', filters.difficulty_level.toString());
    }
    if (filters.min_depth && filters.min_depth.toString) {
      newSearchParams.set('min_depth', filters.min_depth.toString());
    }
    if (filters.min_rating && filters.min_rating.toString) {
      newSearchParams.set('min_rating', filters.min_rating.toString());
    }
    if (filters.start_date && filters.start_date.toString) {
      newSearchParams.set('start_date', filters.start_date.toString());
    }
    if (filters.end_date && filters.end_date.toString) {
      newSearchParams.set('end_date', filters.end_date.toString());
    }
    if (filters.my_dives !== undefined && filters.my_dives !== null && filters.my_dives.toString) {
      newSearchParams.set('my_dives', filters.my_dives.toString());
    }

    // Add sorting parameters
    if (sortBy) newSearchParams.set('sort_by', sortBy);
    if (sortOrder) newSearchParams.set('sort_order', sortOrder);

    // Add tag IDs with safety check
    if (filters.tag_ids && Array.isArray(filters.tag_ids)) {
      filters.tag_ids.forEach(tagId => {
        if (tagId && tagId.toString) {
          newSearchParams.append('tag_ids', tagId.toString());
        }
      });
    }

    // Add pagination with safety check
    newSearchParams.set('page', '1'); // Reset to page 1
    if (pagination.per_page && pagination.per_page.toString) {
      newSearchParams.set('per_page', pagination.per_page.toString());
    }

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
      min_rating: '',
      start_date: '',
      end_date: '',
      tag_ids: [],
      my_dives: false,
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Quick filter handler for dive types
  const handleQuickFilter = filterType => {
    setQuickFilter(filterType);

    // Implement quick filter logic for dive types
    switch (filterType) {
      case 'my_dives': {
        // Filter for user's own dives
        setFilters(prev => ({
          ...prev,
          my_dives: true,
        }));
        break;
      }
      case 'wrecks': {
        // Filter for wreck dives (this would need tag-based filtering)
        // For now, we'll use a placeholder approach
        setFilters(prev => ({
          ...prev,
          // Note: This would need to be implemented based on dive site tags
        }));
        break;
      }
      case 'reefs': {
        // Filter for reef dives (this would need tag-based filtering)
        setFilters(prev => ({
          ...prev,
          // Note: This would need to be implemented based on dive site tags
        }));
        break;
      }
      case 'boat_dive': {
        // Filter for boat dives (this would need tag-based filtering)
        setFilters(prev => ({
          ...prev,
          // Note: This would need to be implemented based on dive site tags
        }));
        break;
      }
      case 'shore_dive': {
        // Filter for shore dives (this would need tag-based filtering)
        setFilters(prev => ({
          ...prev,
          // Note: This would need to be implemented based on dive site tags
        }));
        break;
      }
      case 'clear': {
        // Clear quick filters
        setQuickFilter('');
        clearFilters();
        break;
      }
      default:
        break;
    }

    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = newPage => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    setPagination(prev => ({ ...prev, page: 1, per_page: newPageSize }));
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

  // getDifficultyColor function is now replaced by getDifficultyColorClasses from difficultyHelpers

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
    <div className='max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {/* Hero Section */}
      <HeroSection
        title='Dives'
        subtitle='Track and explore your diving adventures'
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
              navigate('/dives?view=map');
            }}
            className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
          >
            <Map className='w-5 h-5' />
            Explore Map
          </button>
          <button
            onClick={() => {
              setViewMode('list');
              navigate('/dives');
            }}
            className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
          >
            <List className='w-5 h-5' />
            Browse Dives
          </button>
          {user && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
              >
                <Upload size={20} />
                Import Dives
              </button>
              <button
                onClick={() => navigate('/dives/create')}
                className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
              >
                <Plus size={20} />
                Add Dive
              </button>
            </>
          )}
        </div>
      </HeroSection>

      {/* Desktop Search Bar - Only visible on desktop/tablet */}
      {!isMobile && (
        <DesktopSearchBar
          searchValue={filters.dive_site_name}
          onSearchChange={value =>
            handleSearchChange({ target: { name: 'dive_site_name', value } })
          }
          onSearchSelect={selectedItem => {
            // For dives, we need to handle the selected item appropriately
            // Since dives don't have a direct name field, we'll use the dive site name
            handleSearchChange({
              target: {
                name: 'dive_site_name',
                value: selectedItem.name || selectedItem.dive_site?.name || '',
              },
            });
          }}
          data={dives || []}
          configType='dives'
          placeholder='Search dives by dive site name...'
        />
      )}

      {/* Responsive Filter Bar */}
      <ResponsiveFilterBar
        showFilters={showFilters}
        onToggleFilters={toggleFilters}
        onClearFilters={clearFilters}
        activeFiltersCount={
          Object.values(filters).filter(
            value =>
              value !== '' && value !== false && (Array.isArray(value) ? value.length > 0 : true)
          ).length
        }
        filters={{
          ...filters,
          availableTags: availableTags || [],
        }}
        onFilterChange={handleSearchChange}
        onQuickFilter={handleQuickFilter}
        quickFilter={quickFilter}
        variant='sticky'
        showQuickFilters={true}
        showAdvancedToggle={true}
        searchQuery={filters.dive_site_name}
        onSearchChange={value => handleSearchChange({ target: { name: 'dive_site_name', value } })}
        onSearchSubmit={() => {}}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={getSortOptions('dives', isAdmin)}
        onSortChange={handleSortChange}
        onReset={resetSorting}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        showThumbnails={showThumbnails}
        compactLayout={compactLayout}
        onDisplayOptionChange={(option, value) => {
          if (option === 'showThumbnails') setShowThumbnails(value);
          if (option === 'compactLayout') setCompactLayout(value);
        }}
        pageType='dives'
      />

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
                  value={pagination.per_page}
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
                  Showing {Math.max(1, (pagination.page - 1) * pagination.per_page + 1)} to{' '}
                  {Math.min(pagination.page * pagination.per_page, totalCount)} of {totalCount}{' '}
                  dives
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
                    {Math.max(1, Math.ceil(totalCount / pagination.per_page))}
                  </span>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= Math.ceil(totalCount / pagination.per_page)}
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
            dives={dives || []}
            viewport={viewport}
            onViewportChange={setViewport}
          />
        </div>
      ) : (
        <>
          {/* Dives List */}
          {viewMode === 'list' && (
            <div className={`space-y-4 ${compactLayout ? 'view-mode-compact' : ''}`}>
              {dives?.map(dive => (
                <div
                  key={dive.id}
                  className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${
                    compactLayout ? 'p-4' : 'p-6'
                  }`}
                >
                  <div className='flex items-start justify-between mb-4'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-3 mb-2'>
                        {showThumbnails && (
                          <div className='dive-thumbnail'>
                            <Calendar className='w-8 h-8' />
                          </div>
                        )}
                        <div>
                          <h3
                            className={`font-semibold text-gray-900 ${compactLayout ? 'text-base' : 'text-lg'}`}
                          >
                            <Link
                              to={`/dives/${dive.id}`}
                              className='hover:text-blue-600 transition-colors'
                            >
                              {dive.name || `Dive #${dive.id}`}
                            </Link>
                          </h3>
                          <p className={`text-gray-600 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                            {new Date(dive.dive_date).toLocaleDateString('en-GB')} at{' '}
                            {new Date(dive.dive_date).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/dives/${dive.id}`}
                      className='inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors'
                    >
                      <Eye className='w-4 h-4' />
                      View Dive
                    </Link>
                  </div>

                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_level)}`}
                      >
                        {getDifficultyLabel(dive.difficulty_level)}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                        {dive.suit_type || 'dry suit'}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <TrendingUp className='w-4 h-4 text-gray-400' />
                      <span className='text-sm text-gray-600'>{dive.max_depth}m max</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Clock className='w-4 h-4 text-gray-400' />
                      <span className='text-sm text-gray-600'>{dive.duration}min</span>
                    </div>
                  </div>

                  <div className='flex items-center gap-4 mb-4'>
                    <div className='flex items-center gap-2'>
                      <Star className='w-4 h-4 text-yellow-400' />
                      <span className='text-sm text-gray-600'>{dive.rating}/10</span>
                    </div>
                  </div>

                  <p className={`text-gray-700 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                    Buddy: {dive.buddy} SAC: {dive.sac} l/min OTU: {dive.otu} CNS: {dive.cns}% Max
                    Depth: {dive.max_depth} m Avg Depth: {dive.avg_depth} m Water Temp:{' '}
                    {dive.water_temp} C Deco Model: {dive.deco_model} Weights: {dive.weights} kg
                    weight
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Dives Grid */}
          {viewMode === 'grid' && (
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''}`}
            >
              {dives?.map(dive => (
                <div
                  key={dive.id}
                  className={`dive-item bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${
                    compactLayout ? 'p-4' : 'p-6'
                  }`}
                >
                  {showThumbnails && (
                    <div className='dive-thumbnail bg-gray-100 p-4 flex items-center justify-center'>
                      <Calendar className='w-12 h-12 text-gray-400' />
                    </div>
                  )}

                  <div className='p-4'>
                    <h3
                      className={`font-semibold text-gray-900 mb-2 ${compactLayout ? 'text-base' : 'text-lg'}`}
                    >
                      <Link
                        to={`/dives/${dive.id}`}
                        className='hover:text-blue-600 transition-colors'
                      >
                        {dive.name || `Dive #${dive.id}`}
                      </Link>
                    </h3>

                    <p className={`text-gray-600 mb-3 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                      {new Date(dive.dive_date).toLocaleDateString('en-GB')} at{' '}
                      {new Date(dive.dive_date).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>

                    <div className='space-y-2 mb-4'>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_level)}`}
                        >
                          {getDifficultyLabel(dive.difficulty_level)}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                          {dive.suit_type || 'dry suit'}
                        </span>
                      </div>
                    </div>

                    <div className='grid grid-cols-2 gap-3 mb-4'>
                      <div className='flex items-center gap-2'>
                        <TrendingUp className='w-4 h-4 text-gray-400' />
                        <span className='text-sm text-gray-600'>{dive.max_depth}m</span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Clock className='w-4 h-4 text-gray-400' />
                        <span className='text-sm text-gray-600'>{dive.duration}min</span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Star className='w-4 h-4 text-yellow-400' />
                        <span className='text-sm text-gray-600'>{dive.rating}/10</span>
                      </div>
                    </div>

                    <Link
                      to={`/dives/${dive.id}`}
                      className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors'
                    >
                      <Eye className='w-4 h-4' />
                      View Dive
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dives Map */}
          {viewMode === 'map' && (
            <div className='h-96 rounded-lg overflow-hidden border border-gray-200'>
              <DivesMap
                key={`dives-${dives?.length || 0}-${JSON.stringify(filters)}`}
                dives={dives || []}
                viewport={viewport}
                onViewportChange={setViewport}
              />
            </div>
          )}
        </>
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
