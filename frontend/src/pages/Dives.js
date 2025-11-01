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
  Route,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import api, { deleteDive } from '../api';
import DesktopSearchBar from '../components/DesktopSearchBar';
import DivesMap from '../components/DivesMap';
import ErrorPage from '../components/ErrorPage';
import FuzzySearchInput from '../components/FuzzySearchInput';
import HeroSection from '../components/HeroSection';
import ImportDivesModal from '../components/ImportDivesModal';
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

const Dives = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Set page title
  usePageTitle('Divemap - Dives');

  // Get initial values from URL parameters
  const getInitialViewMode = () => {
    const mode = searchParams.get('view') || 'list';
    return ['list', 'grid', 'map'].includes(mode) ? mode : 'list';
  };

  const getInitialFilters = () => {
    return {
      search: searchParams.get('search') || '',
      dive_site_name: searchParams.get('dive_site_name') || '',
      min_depth: searchParams.get('min_depth') || '',
      duration_min: searchParams.get('duration_min') || '',
      duration_max: searchParams.get('duration_max') || '',
      difficulty_code: searchParams.get('difficulty_code') || '',
      exclude_unspecified_difficulty: searchParams.get('exclude_unspecified_difficulty') === 'true',
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

  // Match types state for fuzzy search results
  const [matchTypes, setMatchTypes] = useState({});

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
            newFilters.difficulty_code &&
            newFilters.difficulty_code.toString &&
            newFilters.difficulty_code.toString().trim()
          ) {
            newSearchParams.set('difficulty_code', newFilters.difficulty_code.toString());
          }
          if (newFilters.exclude_unspecified_difficulty) {
            newSearchParams.set('exclude_unspecified_difficulty', 'true');
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
        newFilters.difficulty_code &&
        newFilters.difficulty_code.toString &&
        newFilters.difficulty_code.toString().trim()
      ) {
        newSearchParams.set('difficulty_code', newFilters.difficulty_code.toString());
      }
      if (newFilters.exclude_unspecified_difficulty) {
        newSearchParams.set('exclude_unspecified_difficulty', 'true');
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
        search: filters.search,
      });
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  // Immediate URL update for non-search filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [
    filters.dive_site_id,
    filters.difficulty_code,
    filters.exclude_unspecified_difficulty,
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
      debouncedSearchTerms.search,
      filters.dive_site_id,
      filters.difficulty_code,
      filters.exclude_unspecified_difficulty,
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
      if (debouncedSearchTerms.search) params.append('search', debouncedSearchTerms.search);
      if (filters.difficulty_code) params.append('difficulty_code', filters.difficulty_code);
      if (filters.exclude_unspecified_difficulty) {
        params.append('exclude_unspecified_difficulty', 'true');
      }
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
      debouncedSearchTerms.search,
      filters.dive_site_id,
      filters.difficulty_code,
      filters.exclude_unspecified_difficulty,
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
      if (debouncedSearchTerms.search) params.append('search', debouncedSearchTerms.search);
      if (filters.difficulty_code) params.append('difficulty_code', filters.difficulty_code);
      if (filters.exclude_unspecified_difficulty) {
        params.append('exclude_unspecified_difficulty', 'true');
      }
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
        params.append('page_size', pagination.per_page.toString());
      }

      return api.get(`/api/v1/dives/?${params.toString()}`).then(res => {
        // Extract match types from response headers
        const matchTypesHeader = res.headers['x-match-types'];
        if (matchTypesHeader) {
          try {
            const parsedMatchTypes = JSON.parse(matchTypesHeader);
            setMatchTypes(parsedMatchTypes);
          } catch (error) {
            console.warn('Failed to parse match types header:', error);
            setMatchTypes({});
          }
        } else {
          setMatchTypes({});
        }
        return res.data;
      });
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dives', () => window.location.reload());
  }, [error]);

  useEffect(() => {
    handleRateLimitError(totalCountResponse?.error, 'dives count', () => window.location.reload());
  }, [totalCountResponse?.error]);

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
    if (filters.search && filters.search.toString) {
      newSearchParams.set('search', filters.search.toString());
    }

    // Add other filters with safety checks
    if (filters.dive_site_id && filters.dive_site_id.toString) {
      newSearchParams.set('dive_site_id', filters.dive_site_id.toString());
    }
    if (filters.difficulty_code && filters.difficulty_code.toString) {
      newSearchParams.set('difficulty_code', filters.difficulty_code.toString());
    }
    if (filters.exclude_unspecified_difficulty) {
      newSearchParams.set('exclude_unspecified_difficulty', 'true');
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

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Don't reset pagination or trigger search on every change - only when Search button is clicked
  };

  const clearFilters = () => {
    setFilters({
      dive_site_id: '',
      dive_site_name: '',
      difficulty_code: '',
      exclude_unspecified_difficulty: false,
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
    // Toggle the quick filter - if it's already active, deactivate it
    if (quickFilter === filterType) {
      setQuickFilter('');
      // Clear the corresponding filter
      switch (filterType) {
        case 'my_dives':
          setFilters(prev => ({ ...prev, my_dives: false }));
          break;
        case 'wrecks':
        case 'reefs':
        case 'boat_dive':
        case 'shore_dive':
          setFilters(prev => ({ ...prev, tag_ids: [] }));
          break;
        default:
          break;
      }
    } else {
      setQuickFilter(filterType);

      // Apply the quick filter
      switch (filterType) {
        case 'my_dives': {
          // Filter for user's own dives
          setFilters(prev => ({
            ...prev,
            my_dives: true,
            tag_ids: [], // Clear tag filters when switching to my dives
          }));
          break;
        }
        case 'wrecks': {
          // Filter for wreck dives
          setFilters(prev => ({
            ...prev,
            tag_ids: [8], // Wreck tag ID
            my_dives: false, // Clear my dives filter
          }));
          break;
        }
        case 'reefs': {
          // Filter for reef dives
          setFilters(prev => ({
            ...prev,
            tag_ids: [14], // Reef tag ID
            my_dives: false, // Clear my dives filter
          }));
          break;
        }
        case 'boat_dive': {
          // Filter for boat dives
          setFilters(prev => ({
            ...prev,
            tag_ids: [4], // Boat Dive tag ID
            my_dives: false, // Clear my dives filter
          }));
          break;
        }
        case 'shore_dive': {
          // Filter for shore dives
          setFilters(prev => ({
            ...prev,
            tag_ids: [13], // Shore Dive tag ID
            my_dives: false, // Clear my dives filter
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
      hour12: false, // Use 24-hour format
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

  // Error handling is now done within the content area to preserve hero section

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
              navigate('/map?type=dives');
            }}
            className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
          >
            <Map className='w-5 h-5' />
            Explore Map
          </button>
          <button
            onClick={() => {
              if (!user) {
                window.alert('You need an account for this action.\nPlease Login or Register.');
                return;
              }
              setShowImportModal(true);
            }}
            className='bg-green-600 hover:bg-green-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
          >
            <Upload size={20} />
            Import Dives
          </button>
          <button
            onClick={() => {
              if (!user) {
                window.alert('You need an account for this action.\nPlease Login or Register.');
                return;
              }
              navigate('/dives/create');
            }}
            className='bg-blue-600 hover:bg-blue-700 text-white px-12 py-2 text-sm sm:text-base font-semibold min-w-[200px] whitespace-nowrap rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105'
          >
            <Plus size={20} />
            Add Dive
          </button>
        </div>
      </HeroSection>

      {/* Desktop Search Bar - Only visible on desktop/tablet */}
      {!isMobile && (
        <DesktopSearchBar
          searchValue={filters.search}
          onSearchChange={value => handleSearchChange({ target: { name: 'search', value } })}
          onSearchSelect={selectedItem => {
            // For dives, we need to handle the selected item appropriately
            // Since dives don't have a direct name field, we'll use the dive site name
            handleSearchChange({
              target: {
                name: 'search',
                value: selectedItem.name || selectedItem.dive_site?.name || '',
              },
            });
          }}
          data={dives || []}
          configType='dives'
          placeholder='Search dives by dive site name, description, or notes...'
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
        onFilterChange={handleFilterChange}
        onQuickFilter={handleQuickFilter}
        quickFilter={quickFilter}
        variant='sticky'
        showQuickFilters={true}
        showAdvancedToggle={true}
        searchQuery={filters.search}
        onSearchChange={value => handleSearchChange({ target: { name: 'search', value } })}
        onSearchSubmit={() => {}}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={getSortOptions('dives', isAdmin)}
        onSortChange={handleSortChange}
        onReset={resetSorting}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        compactLayout={compactLayout}
        onDisplayOptionChange={(option, value) => {
          if (option === 'compactLayout') setCompactLayout(value);
        }}
        pageType='dives'
        user={user}
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
      {error ? (
        <ErrorPage error={error} onRetry={() => window.location.reload()} />
      ) : isLoading ? (
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
                  className={`dive-item rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow ${
                    dive.is_private ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
                  } ${compactLayout ? 'p-4' : 'p-6'}`}
                >
                  <div className='flex items-start justify-between mb-4 relative'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-3 mb-2'>
                        <div>
                          <div className='flex flex-wrap items-center gap-2 mb-1'>
                            <div className='flex items-center gap-2 flex-1 min-w-0'>
                              <h3
                                className={`font-semibold text-gray-900 flex-1 min-w-0 ${compactLayout ? 'text-base' : 'text-lg'}`}
                              >
                                <Link
                                  to={`/dives/${dive.id}`}
                                  className='hover:text-blue-600 transition-colors block whitespace-normal break-words'
                                >
                                  {dive.name || `Dive #${dive.id}`}
                                </Link>
                              </h3>
                              {dive.selected_route_id && (
                                <div
                                  className='flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium'
                                  title='This dive has a route'
                                >
                                  <Route size={12} />
                                  Route
                                </div>
                              )}
                              {matchTypes[dive.id] && (
                                <div className='flex-shrink-0'>
                                  <MatchTypeBadge
                                    matchType={matchTypes[dive.id].type}
                                    score={matchTypes[dive.id].score}
                                  />
                                </div>
                              )}
                            </div>
                            {dive.is_private && (
                              <div className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
                                <Lock size={12} />
                                Private
                              </div>
                            )}
                          </div>
                          <p className={`text-gray-600 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                            {new Date(dive.dive_date).toLocaleDateString('en-GB')}
                            {dive.dive_time && ` at ${formatTime(dive.dive_time)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/dives/${dive.id}`}
                      className='hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors'
                    >
                      <Eye className='w-4 h-4' />
                      View Dive
                    </Link>
                  </div>

                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                      >
                        {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
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

                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center gap-2'>
                      <Star className='w-4 h-4 text-yellow-400' />
                      <span className='text-sm text-gray-600'>{dive.user_rating}/10</span>
                    </div>

                    {/* Tags */}
                    {dive.tags && dive.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1'>
                        {dive.tags.slice(0, 4).map(tag => (
                          <button
                            key={tag.id}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              const tagId = parseInt(tag.id);
                              const currentTagIds = filters.tag_ids || [];
                              const newTagIds = currentTagIds.includes(tagId)
                                ? currentTagIds.filter(id => id !== tagId)
                                : [...currentTagIds, tagId];
                              handleFilterChange('tag_ids', newTagIds);
                            }}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getTagColor(tag.name)}`}
                            title={`Filter by ${tag.name}`}
                          >
                            {tag.name}
                          </button>
                        ))}
                        {dive.tags.length > 4 && (
                          <span className='inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full'>
                            +{dive.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {dive.dive_information && dive.dive_information.trim() ? (
                    <p className={`text-gray-700 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                      {dive.dive_information.replace(/\n/g, ' | ')}
                    </p>
                  ) : (
                    <p className={`text-gray-700 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                      {(() => {
                        const stats = [];

                        // Only add fields that have values
                        if (dive.buddy) stats.push(`Buddy: ${dive.buddy}`);
                        if (dive.sac) stats.push(`SAC: ${dive.sac}`);
                        if (dive.otu) stats.push(`OTU: ${dive.otu}`);
                        if (dive.cns) stats.push(`CNS: ${dive.cns}`);
                        if (dive.max_depth) stats.push(`Max Depth: ${dive.max_depth} m`);
                        if (dive.average_depth) stats.push(`Avg Depth: ${dive.average_depth} m`);
                        if (dive.water_temperature)
                          stats.push(`Water Temp: ${dive.water_temperature}`);
                        if (dive.deco_model) stats.push(`Deco Model: ${dive.deco_model}`);
                        if (dive.weights) stats.push(`Weights: ${dive.weights}`);
                        if (dive.duration) stats.push(`Duration: ${dive.duration} min`);
                        if (dive.visibility_rating)
                          stats.push(`Visibility: ${dive.visibility_rating}/10`);
                        if (dive.user_rating) stats.push(`Rating: ${dive.user_rating}/10`);

                        return stats.length > 0
                          ? stats.join(' | ')
                          : 'No additional dive statistics available';
                      })()}
                    </p>
                  )}
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
                  className={`dive-item rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
                    dive.is_private ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
                  } ${compactLayout ? 'p-4' : 'p-6'}`}
                >
                  <div className='p-4'>
                    <div className='flex items-center gap-2 mb-2'>
                      <div className='flex items-center gap-2 flex-1 min-w-0'>
                        <h3
                          className={`font-semibold text-gray-900 flex-1 min-w-0 ${compactLayout ? 'text-base' : 'text-lg'}`}
                        >
                          <Link
                            to={`/dives/${dive.id}`}
                            className='hover:text-blue-600 transition-colors block whitespace-normal break-words'
                          >
                            {dive.name || `Dive #${dive.id}`}
                          </Link>
                        </h3>
                        {dive.selected_route_id && (
                          <div
                            className='flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium'
                            title='This dive has a route'
                          >
                            <Route size={12} />
                            Route
                          </div>
                        )}
                        {matchTypes[dive.id] && (
                          <div className='flex-shrink-0'>
                            <MatchTypeBadge
                              matchType={matchTypes[dive.id].type}
                              score={matchTypes[dive.id].score}
                            />
                          </div>
                        )}
                      </div>
                      {dive.is_private && (
                        <div className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
                          <Lock size={12} />
                          Private
                        </div>
                      )}
                    </div>

                    <p className={`text-gray-600 mb-3 ${compactLayout ? 'text-sm' : 'text-base'}`}>
                      {new Date(dive.dive_date).toLocaleDateString('en-GB')}
                      {dive.dive_time && ` at ${formatTime(dive.dive_time)}`}
                    </p>

                    <div className='space-y-2 mb-4'>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                        >
                          {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
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
                    </div>

                    <div className='flex items-center justify-between mb-4'>
                      <div className='flex items-center gap-2'>
                        <Star className='w-4 h-4 text-yellow-400' />
                        <span className='text-sm text-gray-600'>{dive.user_rating}/10</span>
                      </div>

                      {/* Tags */}
                      {dive.tags && dive.tags.length > 0 && (
                        <div className='flex flex-wrap gap-1'>
                          {dive.tags.slice(0, 2).map(tag => (
                            <button
                              key={tag.id}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                const tagId = parseInt(tag.id);
                                const currentTagIds = filters.tag_ids || [];
                                const newTagIds = currentTagIds.includes(tagId)
                                  ? currentTagIds.filter(id => id !== tagId)
                                  : [...currentTagIds, tagId];
                                handleFilterChange('tag_ids', newTagIds);
                              }}
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getTagColor(tag.name)}`}
                              title={`Filter by ${tag.name}`}
                            >
                              {tag.name}
                            </button>
                          ))}
                          {dive.tags.length > 2 && (
                            <span className='inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full'>
                              +{dive.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
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
