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
  User,
  Award,
  MessageCircle,
  Globe,
  MapPin,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api, { deleteDive, getDiveSites, getDiveSite } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import DesktopSearchBar from '../components/DesktopSearchBar';
import DivesMap from '../components/DivesMap';
import EmptyState from '../components/EmptyState';
import ErrorPage from '../components/ErrorPage';
import FuzzySearchInput from '../components/FuzzySearchInput';
import HeroSection from '../components/HeroSection';
import ImportDivesModal from '../components/ImportDivesModal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import MatchTypeBadge from '../components/MatchTypeBadge';
import PageHeader from '../components/PageHeader';
import RateLimitError from '../components/RateLimitError';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive, useResponsiveScroll } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
import { getSortOptions } from '../utils/sortOptions';
import { getTagColor } from '../utils/tagHelpers';

const getDiveSlug = dive => {
  const slugText = dive.name || (dive.dive_site_info ? dive.dive_site_info.name : 'dive');
  const datePart = dive.dive_date;
  return slugify(`${slugText}-${datePart}-dive-${dive.id}`);
};

const Dives = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    const diveSiteIdParam = searchParams.get('dive_site_id');
    return {
      search: searchParams.get('search') || '',
      username: searchParams.get('username') || '',
      buddy_username: searchParams.get('buddy_username') || '',
      dive_site_id: diveSiteIdParam ? diveSiteIdParam : '',
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
      per_page: parseInt(searchParams.get('per_page') || searchParams.get('page_size')) || 25,
    };
  };

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'list';
  });

  // Compact layout state management
  const { compactLayout, handleDisplayOptionChange } = useCompactLayout();

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
    search: getInitialFilters().search,
  });

  // Sync URL params back to filters when URL changes (e.g., when navigating with dive_site_id)
  // This ensures that when navigating to /dives?dive_site_id=18, the filter is applied
  useEffect(() => {
    const diveSiteIdFromURL = searchParams.get('dive_site_id') || '';
    const currentDiveSiteId = filters.dive_site_id || '';
    // Only update if URL param differs from current filter state
    // This prevents infinite loops while ensuring URL params are synced to filters
    if (diveSiteIdFromURL !== currentDiveSiteId) {
      setFilters(prev => ({ ...prev, dive_site_id: diveSiteIdFromURL }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // Depend on location.search to detect URL changes

  // Quick filter state
  const [quickFilter, setQuickFilter] = useState('');

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } = useSorting('dives');

  // Responsive detection using custom hook
  const { isMobile } = useResponsive();
  const { searchBarVisible } = useResponsiveScroll();

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
            newFilters.search &&
            newFilters.search.toString &&
            newFilters.search.toString().trim()
          ) {
            newSearchParams.set('search', newFilters.search.toString());
          }
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
      if (newFilters.search && newFilters.search.toString && newFilters.search.toString().trim()) {
        newSearchParams.set('search', newFilters.search.toString());
      }
      if (
        newFilters.username &&
        newFilters.username.toString &&
        newFilters.username.toString().trim()
      ) {
        newSearchParams.set('username', newFilters.username.toString());
      }
      if (
        newFilters.buddy_username &&
        newFilters.buddy_username.toString &&
        newFilters.buddy_username.toString().trim()
      ) {
        newSearchParams.set('buddy_username', newFilters.buddy_username.toString());
      }
      if (
        newFilters.dive_site_id &&
        newFilters.dive_site_id.toString &&
        newFilters.dive_site_id.toString().trim()
      ) {
        newSearchParams.set('dive_site_id', newFilters.dive_site_id.toString());
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

  // Immediate URL update for filters
  useEffect(() => {
    immediateUpdateURL(filters, pagination, viewMode);
  }, [
    filters.search,
    filters.dive_site_id,
    filters.difficulty_code,
    filters.exclude_unspecified_difficulty,
    filters.min_depth,
    filters.min_rating,
    filters.start_date,
    filters.end_date,
    filters.my_dives,
    filters.tag_ids,
    filters.buddy_username,
    immediateUpdateURL,
  ]);

  // Invalidate query when sorting changes to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries(['dives']);
  }, [sortBy, sortOrder, queryClient]);

  // Fetch available tags for filtering - only when filters are shown
  const { data: availableTags } = useQuery(
    ['available-tags'],
    () => api.get('/api/v1/tags/').then(res => res.data),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: showFilters, // Only fetch when filters are shown
    }
  );

  // Fetch dive site for filter initialization - only if there's a dive_site_id in URL params
  // Since dive site filter is now searchable via API, we don't need to fetch all sites upfront
  // Only fetch the specific site if it's in the URL to initialize the search input
  const diveSiteIdFromURL = searchParams.get('dive_site_id');
  const { data: selectedDiveSite } = useQuery(
    ['dive-site-for-filter', diveSiteIdFromURL],
    () => getDiveSite(diveSiteIdFromURL),
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
      enabled: Boolean(diveSiteIdFromURL) && showFilters, // Only fetch when filters are shown AND there's a dive_site_id in URL
      retry: false, // Don't retry if site doesn't exist
    }
  );

  // Convert single dive site to array format expected by ResponsiveFilterBar
  const diveSites = selectedDiveSite ? [selectedDiveSite] : [];

  // Fetch total count
  const { data: totalCountResponse } = useQuery(
    [
      'dives-count',
      debouncedSearchTerms.search,
      filters.username,
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
      if (filters.username && filters.username.trim()) {
        params.append('username', filters.username.trim());
      }
      if (filters.buddy_username && filters.buddy_username.trim()) {
        params.append('buddy_username', filters.buddy_username.trim());
      }
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
      filters.username,
      filters.buddy_username,
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
      if (filters.username && filters.username.trim()) {
        params.append('username', filters.username.trim());
      }
      if (filters.buddy_username && filters.buddy_username.trim()) {
        params.append('buddy_username', filters.buddy_username.trim());
      }
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
    // Reset pagination to page 1 when filters change (except for pagination-related filters)
    if (name !== 'page' && name !== 'per_page') {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  const clearFilters = () => {
    setFilters({
      dive_site_id: '',
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
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <PageHeader
        title='Dive Log'
        breadcrumbItems={[{ label: 'Dive Log' }]}
        actions={[
          {
            label: 'Log a New Dive',
            icon: Plus,
            onClick: () => {
              if (!user) {
                window.alert('You need an account for this action.\nPlease Login or Register.');
                return;
              }
              navigate('/dives/create');
            },
            variant: 'primary',
          },
          {
            label: 'Import Dives',
            icon: Upload,
            onClick: () => {
              if (!user) {
                window.alert('You need an account for this action.\nPlease Login or Register.');
                return;
              }
              setShowImportModal(true);
            },
            variant: 'secondary',
          },
          {
            label: 'View My Map',
            icon: Map,
            onClick: () => navigate('/map?type=dives'),
            variant: 'ghost',
          },
        ]}
      />

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
      {/* Hide on mobile when scrolling up (searchBarVisible is false) */}
      {(!isMobile || searchBarVisible) && (
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
            availableDiveSites: diveSites || [],
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
          onDisplayOptionChange={handleDisplayOptionChange}
          pageType='dives'
          user={user}
        />
      )}

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
                  className={`dive-item rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:-translate-y-1 transition-all duration-200 ${
                    dive.is_private ? 'bg-purple-50/30' : 'bg-white'
                  } ${compactLayout ? 'p-4' : 'p-6'}`}
                >
                  <div className='flex flex-col space-y-4'>
                    {/* HEADER ROW */}
                    <div className='flex items-start justify-between'>
                      <div className='flex-1 min-w-0'>
                        {/* Kicker: Dive Site */}
                        {dive.dive_site_info && dive.dive_site_info.name && (
                          <div className='flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-blue-600 mb-1'>
                            <MapPin className='w-3 h-3' />
                            <Link
                              to={`/dive-sites/${dive.dive_site_info.id}`}
                              className='hover:underline'
                            >
                              {dive.dive_site_info.name}
                            </Link>
                          </div>
                        )}

                        {/* Title: Dive Name */}
                        <h3
                          className={`font-semibold text-gray-900 leading-snug ${compactLayout ? 'text-lg' : 'text-xl'}`}
                        >
                          <Link
                            to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                            state={{ from: window.location.pathname + window.location.search }}
                            className='hover:text-blue-600 transition-colors'
                          >
                            {dive.name || `Dive #${dive.id}`}
                          </Link>
                        </h3>

                        {/* Meta Byline */}
                        <div className='mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap'>
                          <span className='flex items-center gap-1'>
                            <Calendar className='w-3.5 h-3.5' />
                            {new Date(dive.dive_date).toLocaleDateString('en-GB')}
                          </span>
                          <span>&bull;</span>
                          {dive.dive_time && (
                            <>
                              <span className='flex items-center gap-1'>
                                <Clock className='w-3.5 h-3.5' />
                                {formatTime(dive.dive_time)}
                              </span>
                              <span>&bull;</span>
                            </>
                          )}
                          {dive.user_username && (
                            <Link
                              to={`/users/${dive.user_username}`}
                              className='hover:text-blue-600 hover:underline inline-flex items-center gap-1'
                            >
                              <User className='w-3.5 h-3.5' />
                              {dive.user_username}
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Rating & Privacy */}
                      <div className='flex flex-col items-end gap-2'>
                        {dive.user_rating !== undefined && dive.user_rating !== null && (
                          <div className='flex items-center gap-1.5 text-yellow-600'>
                            <img
                              src='/arts/divemap_shell.png'
                              alt='Rating'
                              className='w-5 h-5 object-contain'
                            />
                            <span className='text-lg font-bold text-gray-900'>
                              {dive.user_rating}
                              <span className='text-xs font-normal text-gray-400 ml-0.5'>/10</span>
                            </span>
                          </div>
                        )}
                        <div className='flex gap-2'>
                          {dive.is_private && (
                            <span className='flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold uppercase tracking-wider'>
                              <Lock className='w-3 h-3' />
                              Private
                            </span>
                          )}
                          {dive.selected_route_id && (
                            <span className='flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold uppercase tracking-wider'>
                              <Route className='w-3 h-3' />
                              Route
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STATS STRIP */}
                    <div className='flex flex-wrap gap-x-8 gap-y-3 py-3 border-y border-gray-50'>
                      {dive.max_depth !== undefined && dive.max_depth !== null && (
                        <div className='flex flex-col'>
                          <span className='text-xs font-normal text-gray-400 uppercase tracking-tight'>
                            Max Depth
                          </span>
                          <div className='flex items-center gap-1.5 mt-0.5'>
                            <TrendingUp className='w-4 h-4 text-gray-400' />
                            <span className='text-sm font-semibold text-gray-700'>
                              {dive.max_depth}
                              <span className='text-xs font-normal ml-0.5'>m</span>
                            </span>
                          </div>
                        </div>
                      )}
                      {dive.duration !== undefined && dive.duration !== null && (
                        <div className='flex flex-col'>
                          <span className='text-xs font-normal text-gray-400 uppercase tracking-tight'>
                            Duration
                          </span>
                          <div className='flex items-center gap-1.5 mt-0.5'>
                            <Clock className='w-4 h-4 text-gray-400' />
                            <span className='text-sm font-semibold text-gray-700'>
                              {dive.duration}
                              <span className='text-xs font-normal ml-0.5'>min</span>
                            </span>
                          </div>
                        </div>
                      )}
                      {dive.water_temperature !== undefined && dive.water_temperature !== null && (
                        <div className='flex flex-col'>
                          <span className='text-xs font-normal text-gray-400 uppercase tracking-tight'>
                            Temp
                          </span>
                          <div className='flex items-center gap-1.5 mt-0.5'>
                            <Thermometer className='w-4 h-4 text-gray-400' />
                            <span className='text-sm font-semibold text-gray-700'>
                              {dive.water_temperature}
                              <span className='text-xs font-normal ml-0.5'>°C</span>
                            </span>
                          </div>
                        </div>
                      )}
                      {dive.visibility_rating !== undefined && dive.visibility_rating !== null && (
                        <div className='flex flex-col'>
                          <span className='text-xs font-normal text-gray-400 uppercase tracking-tight'>
                            Visibility
                          </span>
                          <div className='flex items-center gap-1.5 mt-0.5'>
                            <Eye className='w-4 h-4 text-gray-400' />
                            <span className='text-sm font-semibold text-gray-700'>
                              {dive.visibility_rating}
                              <span className='text-xs font-normal ml-0.5'>/10</span>
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Difficulty Badge - promoted to stats strip for context */}
                      <div className='flex flex-col'>
                        <span className='text-xs font-normal text-gray-400 uppercase tracking-tight'>
                          Level
                        </span>
                        <div className='flex items-center mt-0.5'>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                          >
                            {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FOOTER: Tags & Buddies */}
                    <div className='flex items-center justify-between gap-4 mt-auto'>
                      <div className='flex flex-wrap items-center gap-3'>
                        {/* Tags */}
                        {dive.tags && dive.tags.length > 0 && (
                          <div className='flex flex-wrap gap-1.5'>
                            {dive.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag.id}
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${getTagColor(tag.name)}`}
                              >
                                {tag.name}
                              </span>
                            ))}
                            {dive.tags.length > 3 && (
                              <span className='text-xs font-medium text-gray-400'>
                                +{dive.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Separator if both tags and buddies exist */}
                        {dive.tags?.length > 0 && dive.buddies?.length > 0 && (
                          <span className='text-gray-300'>|</span>
                        )}

                        {/* Buddies (Avatars only to reduce noise) */}
                        {dive.buddies && dive.buddies.length > 0 && (
                          <div className='flex -space-x-2 overflow-hidden'>
                            {dive.buddies.slice(0, 5).map(buddy => (
                              <Link
                                key={buddy.id}
                                to={`/users/${buddy.username}`}
                                title={`Buddy: ${buddy.username}`}
                                className='inline-block h-6 w-6 rounded-full ring-2 ring-white'
                              >
                                {buddy.avatar_url ? (
                                  <img
                                    className='h-full w-full rounded-full object-cover'
                                    src={buddy.avatar_url}
                                    alt=''
                                  />
                                ) : (
                                  <div className='h-full w-full rounded-full bg-blue-100 flex items-center justify-center'>
                                    <span className='text-[10px] font-bold text-blue-600'>
                                      {buddy.username.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className='flex items-center gap-3'>
                        <Link
                          to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                          className='text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 group'
                        >
                          View Details
                          <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5' />
                        </Link>
                      </div>
                    </div>
                  </div>
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
                  className={`dive-item rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-200 ${
                    dive.is_private ? 'bg-purple-50/30' : 'bg-white'
                  }`}
                >
                  <div className='p-5 flex flex-col h-full'>
                    {/* Header: Title & Site */}
                    <div className='mb-3'>
                      {dive.dive_site_info && (
                        <div className='text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-0.5 flex items-center gap-1'>
                          <MapPin className='w-2.5 h-2.5' />
                          {dive.dive_site_info.name}
                        </div>
                      )}
                      <h3 className='font-semibold text-gray-900 leading-snug line-clamp-1'>
                        <Link
                          to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                          className='hover:text-blue-600 transition-colors'
                        >
                          {dive.name || `Dive #${dive.id}`}
                        </Link>
                      </h3>
                      <div className='text-xs text-gray-500 mt-1 flex items-center gap-1.5'>
                        <Calendar className='w-3 h-3' />
                        {new Date(dive.dive_date).toLocaleDateString('en-GB')}
                        {dive.user_username && (
                          <>
                            <span>&bull;</span>
                            <span className='inline-flex items-center gap-1'>
                              <User className='w-3 h-3' />
                              {dive.user_username}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats Grid (Simplified for Grid layout) */}
                    <div className='grid grid-cols-2 gap-4 py-3 border-y border-gray-50 mb-4'>
                      <div className='flex items-center gap-2'>
                        <TrendingUp className='w-4 h-4 text-gray-400' />
                        <div>
                          <p className='text-[10px] text-gray-400 uppercase font-medium leading-none mb-0.5'>
                            Depth
                          </p>
                          <p className='text-sm font-semibold text-gray-700'>{dive.max_depth}m</p>
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Clock className='w-4 h-4 text-gray-400' />
                        <div>
                          <p className='text-[10px] text-gray-400 uppercase font-medium leading-none mb-0.5'>
                            Time
                          </p>
                          <p className='text-sm font-semibold text-gray-700'>{dive.duration}m</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Tags, Rating & Badges */}
                    <div className='mt-auto flex items-center justify-between gap-2'>
                      <div className='flex gap-1 overflow-hidden'>
                        {dive.tags?.slice(0, 2).map(tag => (
                          <span
                            key={tag.id}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border border-transparent ${getTagColor(tag.name)} truncate`}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      <div className='flex items-center gap-2 flex-shrink-0'>
                        {dive.user_rating !== undefined && (
                          <div className='flex items-center gap-1 text-yellow-600'>
                            <img
                              src='/arts/divemap_shell.png'
                              alt='Rating'
                              className='w-3.5 h-3.5 object-contain'
                            />
                            <span className='text-xs font-bold text-gray-900'>
                              {dive.user_rating}
                            </span>
                          </div>
                        )}
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getDifficultyColorClasses(dive.difficulty_code)}`}
                        >
                          {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                        </span>
                      </div>
                    </div>
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
        <EmptyState
          onClearFilters={clearFilters}
          actionLink='/dives/create'
          actionText='Add New Dive'
          message='We couldn’t find any dives matching your current filters. Try broadening your search or log a new adventure.'
        />
      )}

      {/* Bottom Pagination Controls */}
      {dives && dives.length > 0 && (
        <div className='mt-6 sm:mt-8'>
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
      )}
    </div>
  );
};

export default Dives;
