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
  Anchor,
  Notebook,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from 'react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import api from '../api';
import DesktopSearchBar from '../components/DesktopSearchBar';
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
import SEO from '../components/SEO';
import DifficultyBadge from '../components/ui/DifficultyBadge';
import InfiniteScrollTrigger from '../components/ui/InfiniteScrollTrigger';
import { useAuth } from '../contexts/AuthContext';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { deleteDive } from '../services/dives';
import { getDiveSite, getDiveSites } from '../services/diveSites';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
import { getSortOptions } from '../utils/sortOptions';
import { getTagColor } from '../utils/tagHelpers';

const getDiveSlug = dive => {
  const slugText = dive.name || (dive.dive_site ? dive.dive_site.name : 'dive');
  const datePart = dive.dive_date;
  return slugify(`${slugText}-${datePart}-dive-${dive.id}`);
};

const DivesMap = lazy(() => import('../components/DivesMap'));

const Dives = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

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
      my_dives: searchParams.get('my_dives') === 'true',
      tag_ids: searchParams
        .getAll('tag_ids')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id)),
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({
    search: getInitialFilters().search,
  });

  // Responsive detection using custom hook
  const { isMobile } = useResponsive();
  const pageSize = isMobile ? 10 : 20;

  // Sync URL params back to filters when URL changes
  useEffect(() => {
    const diveSiteIdFromURL = searchParams.get('dive_site_id') || '';
    const currentDiveSiteId = filters.dive_site_id || '';
    if (diveSiteIdFromURL !== currentDiveSiteId) {
      setFilters(prev => ({ ...prev, dive_site_id: diveSiteIdFromURL }));
    }
  }, [location.search, filters.dive_site_id, searchParams]);

  // Quick filter state
  const getInitialQuickFilters = () => {
    const initialFilters = getInitialFilters();
    const quick = [];
    if (initialFilters.my_dives) quick.push('my_dives');
    if (initialFilters.tag_ids?.includes(8)) quick.push('wrecks');
    if (initialFilters.tag_ids?.includes(14)) quick.push('reefs');
    if (initialFilters.tag_ids?.includes(4)) quick.push('boat_dive');
    if (initialFilters.tag_ids?.includes(13)) quick.push('shore_dive');
    return quick;
  };

  const [quickFilters, setQuickFilters] = useState(getInitialQuickFilters);

  // Initialize sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting, getSortParams } = useSorting('dives');

  // Debounced URL update for search inputs
  const debouncedUpdateURL = useCallback(
    (() => {
      let timeoutId;
      return (newFilters, newViewMode) => {
        if (!newFilters || !newViewMode) {
          return;
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const newSearchParams = new URLSearchParams();

          if (newViewMode === 'map') {
            newSearchParams.set('view', 'map');
          } else if (newViewMode === 'grid') {
            newSearchParams.set('view', 'grid');
          } else {
            newSearchParams.delete('view');
          }

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

          if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
            newFilters.tag_ids.forEach(tagId => {
              if (tagId && tagId.toString) {
                newSearchParams.append('tag_ids', tagId.toString());
              }
            });
          }

          const sortParams = getSortParams();
          if (sortParams && sortParams.sort_by) {
            newSearchParams.set('sort_by', sortParams.sort_by);
          }
          if (sortParams && sortParams.sort_order) {
            newSearchParams.set('sort_order', sortParams.sort_order);
          }

          navigate(`?${newSearchParams.toString()}`, { replace: true });
        }, 800);
      };
    })(),
    [navigate, getSortParams]
  );

  // Immediate URL update for non-search filters
  const immediateUpdateURL = useCallback(
    (newFilters, newViewMode) => {
      if (!newFilters || !newViewMode) {
        return;
      }

      const newSearchParams = new URLSearchParams();

      if (newViewMode === 'map') {
        newSearchParams.set('view', 'map');
      } else if (newViewMode === 'grid') {
        newSearchParams.set('view', 'grid');
      } else {
        newSearchParams.delete('view');
      }

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

      if (newFilters.tag_ids && Array.isArray(newFilters.tag_ids)) {
        newFilters.tag_ids.forEach(tagId => {
          if (tagId && tagId.toString) {
            newSearchParams.append('tag_ids', tagId.toString());
          }
        });
      }

      const sortParams = getSortParams();
      if (sortParams && sortParams.sort_by) {
        newSearchParams.set('sort_by', sortParams.sort_by);
      }
      if (sortParams && sortParams.sort_order) {
        newSearchParams.set('sort_order', sortParams.sort_order);
      }

      navigate(`?${newSearchParams.toString()}`, { replace: true });
    },
    [navigate, getSortParams]
  );

  // Update URL when view mode changes
  useEffect(() => {
    if (filters && Object.keys(filters).length > 0) {
      immediateUpdateURL(filters, viewMode);
    }
  }, [filters, viewMode, immediateUpdateURL]);

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
    immediateUpdateURL(filters, viewMode);
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
    viewMode,
  ]);

  // Invalidate query when sorting changes
  useEffect(() => {
    queryClient.invalidateQueries(['dives']);
  }, [sortBy, sortOrder, queryClient]);

  // Fetch available tags
  const { data: availableTags } = useQuery(
    ['available-tags'],
    () => api.get('/api/v1/tags/').then(res => res.data),
    {
      staleTime: 5 * 60 * 1000,
      enabled: showFilters || (filters.tag_ids && filters.tag_ids.length > 0),
    }
  );

  const diveSiteIdFromURL = searchParams.get('dive_site_id');
  const { data: selectedDiveSite } = useQuery(
    ['dive-site-for-filter', diveSiteIdFromURL],
    () => getDiveSite(diveSiteIdFromURL),
    {
      staleTime: 10 * 60 * 1000,
      enabled: Boolean(diveSiteIdFromURL),
      retry: false,
    }
  );

  // Consolidated query for dives with infinite scrolling
  const {
    data: infiniteDivesData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery(
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
      pageSize,
      sortBy,
      sortOrder,
    ],
    ({ pageParam = 1 }) => {
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

      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      params.append('page', pageParam.toString());
      params.append('page_size', pageSize.toString());

      return api.get(`/api/v1/dives/?${params.toString()}`).then(res => {
        if (res.data?.match_types) {
          setMatchTypes(prev => ({ ...prev, ...res.data.match_types }));
        }
        return res.data;
      });
    },
    {
      getNextPageParam: lastPage => {
        if (lastPage.has_next_page) {
          return lastPage.page + 1;
        }
        return undefined;
      },
      staleTime: 5 * 60 * 1000,
    }
  );

  const dives = useMemo(() => {
    if (!infiniteDivesData) return [];
    return infiniteDivesData.pages.flatMap(page => page.items || []);
  }, [infiniteDivesData]);

  const totalCount = infiniteDivesData?.pages[0]?.total || 0;

  // Convert single dive site to array format expected by ResponsiveFilterBar
  // Also extract unique dive sites from the loaded dives to populate the filter dropdown without extra API calls
  const diveSites = useMemo(() => {
    const sitesMap = {};

    // Add the site from URL if it was fetched
    if (selectedDiveSite) {
      sitesMap[selectedDiveSite.id] = selectedDiveSite;
    }

    // Add all unique sites from the current dives results
    if (dives && Array.isArray(dives)) {
      dives.forEach(dive => {
        if (dive.dive_site && dive.dive_site.id) {
          sitesMap[dive.dive_site.id] = dive.dive_site;
        }
      });
    }

    return Object.values(sitesMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedDiveSite, dives]);

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dives', () => window.location.reload());
  }, [error]);

  const handleSearch = e => {
    e.preventDefault();

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

    // Update URL without triggering a page reload
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  };

  const handleSearchChange = e => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
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
    setQuickFilters([]);
  };

  // Quick filter handler for dive types
  const handleQuickFilter = filterType => {
    if (filterType === 'clear') {
      setQuickFilters([]);
      clearFilters();
      return;
    }

    // Toggle the filter in the quickFilters array
    setQuickFilters(prev => {
      if (prev.includes(filterType)) {
        return prev.filter(f => f !== filterType);
      } else {
        return [...prev, filterType];
      }
    });

    // Apply the quick filter changes to the actual filters state
    const tagIdMap = {
      wrecks: 8,
      reefs: 14,
      boat_dive: 4,
      shore_dive: 13,
    };

    setFilters(prev => {
      const newFilters = { ...prev };

      if (filterType === 'my_dives') {
        // Toggle my_dives boolean
        newFilters.my_dives = !prev.my_dives;
      } else if (tagIdMap[filterType]) {
        // Toggle specific tag in the tag_ids array
        const tagId = tagIdMap[filterType];
        const currentTagIds = prev.tag_ids || [];

        if (currentTagIds.includes(tagId)) {
          // Remove tag if already selected
          newFilters.tag_ids = currentTagIds.filter(id => id !== tagId);
        } else {
          // Add tag if not selected
          newFilters.tag_ids = [...currentTagIds, tagId];
        }
      }

      return newFilters;
    });
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

  // getDifficultyColor function is now replaced by getDifficultyColorClasses from difficultyHelpers

  const getSuitTypeColor = type => {
    const colors = {
      wet_suit: 'bg-blue-100 text-blue-800',
      dry_suit: 'bg-purple-100 text-purple-800',
      shortie: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Calculate active filters count for UI
  const activeFiltersCount = Object.values(filters).filter(
    value => value !== '' && value !== false && (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  // Error handling is now done within the content area to preserve hero section

  return (
    <>
      <SEO
        title='Recent Public Dive Logs | Divemap'
        description='Browse recently logged scuba dives from the community. See water conditions, visibility, bottom time, and user ratings for dive sites around the world.'
      />
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
        <PageHeader
          title='Dive Log'
          titleIcon={Notebook}
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
              onClick: () => navigate('/map?type=dives&my_dives=true'),
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
        <ResponsiveFilterBar
          showFilters={showFilters}
          onToggleFilters={toggleFilters}
          onClearFilters={clearFilters}
          activeFiltersCount={activeFiltersCount}
          filters={{
            ...filters,
            availableTags: availableTags || [],
            availableDiveSites: diveSites || [],
          }}
          onFilterChange={handleFilterChange}
          onQuickFilter={handleQuickFilter}
          quickFilters={quickFilters}
          variant='inline'
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
          <LoadingSkeleton
            type='card'
            count={pageSize}
            className={`space-y-2 ${compactLayout ? 'view-mode-compact' : ''}`}
          />
        ) : viewMode === 'map' ? (
          <div className='mb-6 sm:mb-8 bg-gray-50 flex items-center justify-center min-h-[400px] rounded-lg border border-gray-200'>
            <Suspense
              fallback={
                <div className='flex flex-col items-center gap-2'>
                  <div className='w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                  <span>Loading Map...</span>
                </div>
              }
            >
              <DivesMap
                key={`dives-${dives?.length || 0}-${JSON.stringify(filters)}`}
                dives={dives || []}
                viewport={viewport}
                onViewportChange={setViewport}
              />
            </Suspense>
          </div>
        ) : (
          <>
            {/* Dives List */}
            {viewMode === 'list' && (
              <div className={`space-y-3 sm:space-y-4 ${compactLayout ? 'view-mode-compact' : ''}`}>
                {dives?.map(dive => (
                  <div
                    key={dive.id}
                    className={`dive-item rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] p-3 sm:p-6 hover:shadow-md transition-all duration-200 ${
                      dive.is_private ? 'bg-purple-50/30' : 'bg-white'
                    }`}
                  >
                    <div className='flex flex-col space-y-1.5 sm:space-y-4'>
                      {/* HEADER ROW */}
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex-1 min-w-0'>
                          {/* Compact Title & Site combo */}
                          <h3 className='font-semibold text-gray-900 leading-tight text-base sm:text-xl'>
                            <Link
                              to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                              className='hover:text-blue-600 transition-colors'
                            >
                              {dive.name || `Dive #${dive.id}`}
                            </Link>
                            {dive.dive_site?.name && (
                              <span className='text-xs sm:text-sm font-medium text-blue-500 ml-1.5 opacity-80'>
                                @ {dive.dive_site.name}
                              </span>
                            )}
                          </h3>

                          {/* Meta Byline - Single line on mobile */}
                          <div className='mt-0.5 text-xs sm:text-sm text-gray-500 flex items-center gap-1.5 flex-wrap'>
                            <Calendar className='w-3 h-3 text-gray-400' />
                            {formatDate(dive.dive_date, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {dive.dive_time && (
                              <span className='flex items-center gap-1'>
                                <span className='text-gray-300'>•</span>
                                {formatTime(dive.dive_time)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Rating */}
                        {dive.user_rating !== undefined && dive.user_rating !== null && (
                          <div className='flex items-center gap-1 text-yellow-600 flex-shrink-0'>
                            <img
                              src='/arts/starfish-2.svg'
                              alt='Rating'
                              className='w-3.5 h-3.5 object-contain'
                            />
                            <span className='text-sm sm:text-lg font-bold text-gray-900'>
                              {dive.user_rating}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* STATS STRIP - Compact 1-liner */}
                      <div className='flex flex-wrap items-center gap-x-3 sm:gap-x-8 gap-y-1 py-1 sm:py-3 border-y border-gray-50'>
                        {dive.max_depth && (
                          <div className='flex items-center gap-1'>
                            <TrendingUp className='w-3 h-3 text-gray-400' />
                            <span className='text-xs sm:text-sm font-semibold text-gray-700'>
                              {dive.max_depth}m
                            </span>
                          </div>
                        )}
                        {dive.duration && (
                          <div className='flex items-center gap-1'>
                            <Clock className='w-3 h-3 text-gray-400' />
                            <span className='text-xs sm:text-sm font-semibold text-gray-700'>
                              {dive.duration}m
                            </span>
                          </div>
                        )}
                        <DifficultyBadge
                          code={dive.difficulty_code}
                          label={dive.difficulty_label}
                        />
                      </div>

                      {/* FOOTER: Tags & Buddies - Only show icons/counts on mobile */}
                      <div className='flex items-center justify-between gap-4'>
                        <div className='flex items-center gap-2 overflow-hidden'>
                          {dive.tags?.length > 0 && (
                            <div className='flex gap-1'>
                              {dive.tags.slice(0, isMobile ? 3 : 5).map(tag => (
                                <span
                                  key={tag.id}
                                  className={`px-1.5 py-0.5 rounded-full text-xs sm:text-sm font-medium ${getTagColor(tag.name)}`}
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {dive.tags.length > (isMobile ? 3 : 5) && (
                                <span className='text-xs text-gray-400'>
                                  +{dive.tags.length - (isMobile ? 3 : 5)}
                                </span>
                              )}
                            </div>
                          )}
                          {dive.buddies?.length > 0 && (
                            <div className='flex -space-x-1.5'>
                              {dive.buddies.slice(0, isMobile ? 2 : 5).map(buddy => (
                                <div
                                  key={buddy.id}
                                  className='w-4 h-4 sm:w-6 sm:h-6 rounded-full ring-1 ring-white bg-blue-100 flex items-center justify-center overflow-hidden'
                                >
                                  {buddy.avatar_url ? (
                                    <img
                                      src={buddy.avatar_full_url || buddy.avatar_url}
                                      className='w-full h-full object-cover'
                                      alt=''
                                    />
                                  ) : (
                                    <span className='text-[7px] font-bold text-blue-600'>
                                      {buddy.username[0]}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          to={`/dives/${dive.id}/${getDiveSlug(dive)}`}
                          className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
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

            {/* Dives Grid */}
            {viewMode === 'grid' && (
              <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${compactLayout ? 'view-mode-compact' : ''}`}
              >
                {dives?.map(dive => (
                  <div
                    key={dive.id}
                    className={`dive-item rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] flex flex-col hover:shadow-md hover:-translate-y-1 transition-all duration-200 ${
                      dive.is_private ? 'bg-purple-50/30' : 'bg-white'
                    }`}
                  >
                    <div className='p-5 flex flex-col h-full'>
                      {/* Header: Title & Site */}
                      <div className='mb-3'>
                        {dive.dive_site && (
                          <div className='text-xs font-bold uppercase tracking-widest text-blue-600 mb-0.5 flex items-center gap-1'>
                            <MapPin className='w-2.5 h-2.5' />
                            {dive.dive_site.name}
                            {dive.dive_site.deleted_at && ' (Archived)'}
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
                          {formatDate(dive.dive_date, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
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
                            <p className='text-xs text-gray-400 uppercase font-medium leading-none mb-0.5'>
                              Depth
                            </p>
                            <p className='text-sm font-semibold text-gray-700'>{dive.max_depth}m</p>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Clock className='w-4 h-4 text-gray-400' />
                          <div>
                            <p className='text-xs text-gray-400 uppercase font-medium leading-none mb-0.5'>
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
                              className={`text-xs font-medium px-1.5 py-0.5 rounded border border-transparent ${getTagColor(tag.name)} truncate`}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>

                        <div className='flex items-center gap-2 flex-shrink-0'>
                          {dive.user_rating !== undefined && (
                            <div className='flex items-center gap-1 text-yellow-600'>
                              <img
                                src='/arts/starfish-2.svg'
                                alt='Rating'
                                className='w-3.5 h-3.5 object-contain'
                              />
                              <span className='text-xs font-bold text-gray-900'>
                                {dive.user_rating}
                              </span>
                            </div>
                          )}
                          <DifficultyBadge
                            code={dive.difficulty_code}
                            label={dive.difficulty_label}
                            size='xs'
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {viewMode !== 'map' && (
              <InfiniteScrollTrigger
                onIntersect={fetchNextPage}
                hasNextPage={!!hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
              />
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
      </div>
    </>
  );
};

export default Dives;
