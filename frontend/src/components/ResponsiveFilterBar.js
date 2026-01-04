import {
  Filter,
  X,
  Search,
  Wrench,
  Settings,
  List,
  Map,
  RotateCcw,
  SortAsc,
  SortDesc,
  TrendingUp,
  Grid,
  ChevronDown,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';

import {
  searchDivingCenters,
  getDiveSites,
  searchUsers,
  getUniqueCountries,
  getUniqueRegions,
} from '../api';
import { useResponsiveScroll } from '../hooks/useResponsive';
import { getDifficultyOptions, getDifficultyLabel } from '../utils/difficultyHelpers';
import { getTagColor } from '../utils/tagHelpers';

import Modal from './ui/Modal';
import Select from './ui/Select';

const ResponsiveFilterBar = ({
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  filters = {},
  onFilterChange = () => {},
  onQuickFilter = () => {},
  quickFilters = [],
  className = '',
  variant = 'sticky',
  showQuickFilters = true,
  showAdvancedToggle = true,
  searchQuery = '',
  onSearchChange = () => {},
  onSearchSubmit = () => {},
  // New sorting props
  sortBy = '',
  sortOrder = 'asc',
  sortOptions = [],
  onSortChange = () => {},
  onReset = () => {},
  viewMode = 'list',
  onViewModeChange = () => {},
  compactLayout = false,
  onDisplayOptionChange = () => {},
  // New prop for page-specific quick filters
  pageType = 'dive-sites',
  user = null,
}) => {
  const { isMobile, navbarVisible, searchBarVisible, quickFiltersVisible } = useResponsiveScroll();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFilterOverlayOpen, setIsFilterOverlayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('filters');
  const searchBarRef = useRef(null);
  const [searchBarHeight, setSearchBarHeight] = useState(64);

  // Dive site search state (for dives page)
  const [diveSiteSearch, setDiveSiteSearch] = useState('');
  const [isDiveSiteDropdownOpen, setIsDiveSiteDropdownOpen] = useState(false);
  const diveSiteDropdownRef = useRef(null);

  // Searchable state for dive-trips page
  const [divingCenterSearch, setDivingCenterSearch] = useState('');
  const [divingCenterSearchResults, setDivingCenterSearchResults] = useState([]);
  const [divingCenterSearchLoading, setDivingCenterSearchLoading] = useState(false);
  const [isDivingCenterDropdownOpen, setIsDivingCenterDropdownOpen] = useState(false);
  const divingCenterDropdownRef = useRef(null);
  const divingCenterSearchTimeoutRef = useRef(null);

  const [diveSiteSearchForTrips, setDiveSiteSearchForTrips] = useState('');
  const [diveSiteSearchResultsForTrips, setDiveSiteSearchResultsForTrips] = useState([]);
  const [diveSiteSearchLoadingForTrips, setDiveSiteSearchLoadingForTrips] = useState(false);
  const [isDiveSiteDropdownOpenForTrips, setIsDiveSiteDropdownOpenForTrips] = useState(false);
  const diveSiteDropdownRefForTrips = useRef(null);
  const diveSiteSearchTimeoutRefForTrips = useRef(null);

  // Country and region search state
  const [countrySearch, setCountrySearch] = useState('');
  const [countrySearchResults, setCountrySearchResults] = useState([]);
  const [countrySearchLoading, setCountrySearchLoading] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef(null);
  const countrySearchTimeoutRef = useRef(null);

  const [regionSearch, setRegionSearch] = useState('');
  const [regionSearchResults, setRegionSearchResults] = useState([]);
  const [regionSearchLoading, setRegionSearchLoading] = useState(false);
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const regionDropdownRef = useRef(null);
  const regionSearchTimeoutRef = useRef(null);

  // Username/Owner and Buddy search state (for dives page)
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState([]);
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const ownerDropdownRef = useRef(null);
  const ownerSearchTimeoutRef = useRef(null);

  const [buddySearch, setBuddySearch] = useState('');
  const [buddySearchResults, setBuddySearchResults] = useState([]);
  const [buddySearchLoading, setBuddySearchLoading] = useState(false);
  const [isBuddyDropdownOpen, setIsBuddyDropdownOpen] = useState(false);
  const buddyDropdownRef = useRef(null);
  const buddySearchTimeoutRef = useRef(null);

  // Sorting state management
  const [pendingSortBy, setPendingSortBy] = useState(sortBy);
  const [pendingSortOrder, setPendingSortOrder] = useState(sortOrder);

  // Update pending values when props change
  useEffect(() => {
    setPendingSortBy(sortBy);
    setPendingSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

  // Track search bar height for positioning quick filters
  useEffect(() => {
    if (searchBarRef.current && searchBarVisible) {
      const updateHeight = () => {
        if (searchBarRef.current) {
          setSearchBarHeight(searchBarRef.current.offsetHeight);
        }
      };
      updateHeight();
      // Update on resize
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [searchBarVisible]);

  // Tag color function - same as in DiveSitesFilterBar
  const getTagColor = tagName => {
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

    const lowerTagName = tagName.toLowerCase();
    if (colorMap[lowerTagName]) {
      return colorMap[lowerTagName];
    }

    for (const [key, color] of Object.entries(colorMap)) {
      if (lowerTagName.includes(key) || key.includes(lowerTagName)) {
        return color;
      }
    }

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

    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = (hash << 5) - hash + tagName.charCodeAt(i);
      hash = hash & hash;
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const handleToggleFilters = () => {
    setIsExpanded(!isExpanded);
    onToggleFilters();
  };

  // Initialize dive site search when dive_site_id is set
  useEffect(() => {
    if (filters.country) {
      setCountrySearch(filters.country);
    } else {
      setCountrySearch('');
    }
  }, [filters.country]);

  useEffect(() => {
    if (filters.region) {
      setRegionSearch(filters.region);
    } else {
      setRegionSearch('');
    }
  }, [filters.region]);

  useEffect(() => {
    if (pageType === 'dives' && filters.availableDiveSites && filters.dive_site_id) {
      const selectedSite = filters.availableDiveSites.find(
        site => site.id.toString() === filters.dive_site_id.toString()
      );
      if (selectedSite) {
        setDiveSiteSearch(selectedSite.name);
      } else {
        setDiveSiteSearch('');
      }
    } else if (!filters.dive_site_id) {
      setDiveSiteSearch('');
    }
  }, [filters.dive_site_id, filters.availableDiveSites, pageType]);

  // Initialize search values when filters are set for dive-trips
  useEffect(() => {
    if (pageType === 'dive-trips') {
      // Initialize diving center search
      if (filters.diving_center_id && filters.availableDivingCenters) {
        const selectedCenter = filters.availableDivingCenters.find(
          center => center.id.toString() === filters.diving_center_id.toString()
        );
        if (selectedCenter) {
          setDivingCenterSearch(selectedCenter.name);
        }
      } else if (!filters.diving_center_id) {
        setDivingCenterSearch('');
      }

      // Initialize dive site search
      if (filters.dive_site_id && filters.availableDiveSites) {
        const selectedSite = filters.availableDiveSites.find(
          site => site.id.toString() === filters.dive_site_id.toString()
        );
        if (selectedSite) {
          setDiveSiteSearchForTrips(selectedSite.name);
        }
      } else if (!filters.dive_site_id) {
        setDiveSiteSearchForTrips('');
      }
    }
  }, [
    filters.diving_center_id,
    filters.dive_site_id,
    filters.availableDivingCenters,
    filters.availableDiveSites,
    pageType,
  ]);

  // Initialize dive site search when dive_site_id is set for dives page
  useEffect(() => {
    if (pageType === 'dives') {
      if (filters.dive_site_id && filters.availableDiveSites) {
        const selectedSite = filters.availableDiveSites.find(
          site => site.id.toString() === filters.dive_site_id.toString()
        );
        if (selectedSite) {
          setDiveSiteSearch(selectedSite.name);
        } else {
          // If not found in availableDiveSites, try to fetch it
          setDiveSiteSearch('');
        }
      } else if (!filters.dive_site_id) {
        setDiveSiteSearch('');
        setDiveSiteSearchResults([]);
      }
    }
  }, [filters.dive_site_id, filters.availableDiveSites, pageType]);

  // Track if user is actively typing in search fields to prevent useEffect from resetting
  const ownerSearchInputRef = useRef(false);
  const buddySearchInputRef = useRef(false);
  // Track the last value the user typed to prevent clearing while typing
  const lastTypedBuddySearchRef = useRef('');
  const lastTypedOwnerSearchRef = useRef('');

  // Initialize owner and buddy search values for dives page
  // Only sync from filters when user is not actively typing
  // Use refs to track previous filter values to detect external changes
  const prevUsernameRef = useRef(filters.username);
  const prevBuddyUsernameRef = useRef(filters.buddy_username);

  // Use a separate effect that only runs when filters actually change externally
  // (not on every render). We use a ref to track the previous filter values
  // and only update when they actually change AND user is not typing.
  useEffect(() => {
    if (pageType === 'dives') {
      // Only sync ownerSearch from filters if user is not actively typing
      // AND the filter value actually changed (not just a re-render)
      if (!ownerSearchInputRef.current) {
        const usernameChanged = prevUsernameRef.current !== filters.username;
        if (usernameChanged) {
          if (filters.username) {
            setOwnerSearch(filters.username);
            lastTypedOwnerSearchRef.current = ''; // Reset typed value when filter is set externally
          } else {
            // Only clear if filter was explicitly cleared (changed from non-empty to empty)
            // Use functional update to check current value without adding to dependencies
            setOwnerSearch(prev => {
              // Only clear if current value matches the previous filter value
              // AND it doesn't match what the user last typed
              // This prevents clearing when user is typing
              if (
                prevUsernameRef.current &&
                prev === prevUsernameRef.current &&
                prev !== lastTypedOwnerSearchRef.current
              ) {
                return '';
              }
              return prev;
            });
          }
          prevUsernameRef.current = filters.username;
        }
      }

      // Only sync buddySearch from filters if user is not actively typing
      // AND the filter value actually changed (not just a re-render)
      if (!buddySearchInputRef.current) {
        const buddyUsernameChanged = prevBuddyUsernameRef.current !== filters.buddy_username;
        if (buddyUsernameChanged) {
          if (filters.buddy_username) {
            setBuddySearch(filters.buddy_username);
            lastTypedBuddySearchRef.current = ''; // Reset typed value when filter is set externally
          } else {
            // Only clear if filter was explicitly cleared (changed from non-empty to empty)
            // Use functional update to check current value without adding to dependencies
            setBuddySearch(prev => {
              // Only clear if current value matches the previous filter value
              // AND it doesn't match what the user last typed
              // This prevents clearing when user is typing
              if (
                prevBuddyUsernameRef.current &&
                prev === prevBuddyUsernameRef.current &&
                prev !== lastTypedBuddySearchRef.current
              ) {
                return '';
              }
              return prev;
            });
          }
          prevBuddyUsernameRef.current = filters.buddy_username;
        }
      }
    }
    // Only depend on filters and pageType, NOT on ownerSearch/buddySearch state
    // This prevents the effect from running on every keystroke
  }, [filters.username, filters.buddy_username, pageType]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (divingCenterSearchTimeoutRef.current) {
        clearTimeout(divingCenterSearchTimeoutRef.current);
      }
      if (diveSiteSearchTimeoutRefForTrips.current) {
        clearTimeout(diveSiteSearchTimeoutRefForTrips.current);
      }
      if (diveSiteSearchTimeoutRef.current) {
        clearTimeout(diveSiteSearchTimeoutRef.current);
      }
      if (countrySearchTimeoutRef.current) {
        clearTimeout(countrySearchTimeoutRef.current);
      }
      if (regionSearchTimeoutRef.current) {
        clearTimeout(regionSearchTimeoutRef.current);
      }
      if (ownerSearchTimeoutRef.current) {
        clearTimeout(ownerSearchTimeoutRef.current);
      }
      if (buddySearchTimeoutRef.current) {
        clearTimeout(buddySearchTimeoutRef.current);
      }
    };
  }, []);

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = event => {
      if (diveSiteDropdownRef.current && !diveSiteDropdownRef.current.contains(event.target)) {
        setIsDiveSiteDropdownOpen(false);
      }
      if (
        divingCenterDropdownRef.current &&
        !divingCenterDropdownRef.current.contains(event.target)
      ) {
        setIsDivingCenterDropdownOpen(false);
      }
      if (
        diveSiteDropdownRefForTrips.current &&
        !diveSiteDropdownRefForTrips.current.contains(event.target)
      ) {
        setIsDiveSiteDropdownOpenForTrips(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target)) {
        setIsCountryDropdownOpen(false);
      }
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(event.target)) {
        setIsRegionDropdownOpen(false);
      }
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(event.target)) {
        setIsOwnerDropdownOpen(false);
        // Reset ref when dropdown closes (user clicked away without selecting)
        // This allows sync from filters if needed
        if (!ownerSearch) {
          ownerSearchInputRef.current = false;
        }
      }
      if (buddyDropdownRef.current && !buddyDropdownRef.current.contains(event.target)) {
        setIsBuddyDropdownOpen(false);
        // Reset ref when dropdown closes (user clicked away without selecting)
        // This allows sync from filters if needed
        if (!buddySearch) {
          buddySearchInputRef.current = false;
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dive site search state for dives page (API-based)
  const [diveSiteSearchResults, setDiveSiteSearchResults] = useState([]);
  const [diveSiteSearchLoading, setDiveSiteSearchLoading] = useState(false);
  const diveSiteSearchTimeoutRef = useRef(null);

  // Handle dive site selection
  const handleDiveSiteSelect = (siteId, siteName) => {
    onFilterChange('dive_site_id', siteId.toString());
    setDiveSiteSearch(siteName);
    setIsDiveSiteDropdownOpen(false);
  };

  // Handle dive site search change for dives page (API-based)
  const handleDiveSiteSearchChange = value => {
    setDiveSiteSearch(value);
    setIsDiveSiteDropdownOpen(true);
    if (!value) {
      // Clear dive_site_id when search is cleared
      onFilterChange('dive_site_id', '');
      setDiveSiteSearchResults([]);
      return;
    }

    // Clear previous timeout
    if (diveSiteSearchTimeoutRef.current) {
      clearTimeout(diveSiteSearchTimeoutRef.current);
    }

    // Debounce search: wait 0.5 seconds after user stops typing
    diveSiteSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setDiveSiteSearchLoading(true);
        const response = await getDiveSites({
          search: value,
          page_size: 25,
          detail_level: 'basic',
        });

        // Handle different possible response structures
        let results = [];
        if (Array.isArray(response)) {
          results = response;
        } else if (response && Array.isArray(response.items)) {
          results = response.items;
        } else if (response && Array.isArray(response.data)) {
          results = response.data;
        } else if (response && Array.isArray(response.results)) {
          results = response.results;
        }

        setDiveSiteSearchResults(results);
      } catch (error) {
        console.error('Search dive sites failed', error);
        setDiveSiteSearchResults([]);
      } finally {
        setDiveSiteSearchLoading(false);
      }
    }, 500);
  };

  // Handle diving center search for dive-trips
  const handleDivingCenterSearchChangeForTrips = value => {
    setDivingCenterSearch(value);
    setIsDivingCenterDropdownOpen(true);
    if (!value) {
      onFilterChange('diving_center_id', '');
      setDivingCenterSearchResults([]);
      return;
    }

    // Clear previous timeout
    if (divingCenterSearchTimeoutRef.current) {
      clearTimeout(divingCenterSearchTimeoutRef.current);
    }

    // Debounce search: wait 0.5 seconds after user stops typing
    divingCenterSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setDivingCenterSearchLoading(true);
        const results = await searchDivingCenters({
          q: value,
          limit: 20,
        });
        setDivingCenterSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Search diving centers failed', error);
        setDivingCenterSearchResults([]);
      } finally {
        setDivingCenterSearchLoading(false);
      }
    }, 500);
  };

  // Handle dive site search for dive-trips
  const handleDiveSiteSearchChangeForTrips = value => {
    setDiveSiteSearchForTrips(value);
    setIsDiveSiteDropdownOpenForTrips(true);
    if (!value) {
      onFilterChange('dive_site_id', '');
      setDiveSiteSearchResultsForTrips([]);
      return;
    }

    // Clear previous timeout
    if (diveSiteSearchTimeoutRefForTrips.current) {
      clearTimeout(diveSiteSearchTimeoutRefForTrips.current);
    }

    // Debounce search: wait 0.5 seconds after user stops typing
    diveSiteSearchTimeoutRefForTrips.current = setTimeout(async () => {
      try {
        setDiveSiteSearchLoadingForTrips(true);
        const response = await getDiveSites({
          search: value,
          page_size: 25,
          detail_level: 'basic',
        });

        // Handle different possible response structures
        let results = [];
        if (Array.isArray(response)) {
          results = response;
        } else if (response && Array.isArray(response.items)) {
          results = response.items;
        } else if (response && Array.isArray(response.data)) {
          results = response.data;
        } else if (response && Array.isArray(response.results)) {
          results = response.results;
        }

        setDiveSiteSearchResultsForTrips(results);
      } catch (error) {
        console.error('Search dive sites failed', error);
        setDiveSiteSearchResultsForTrips([]);
      } finally {
        setDiveSiteSearchLoadingForTrips(false);
      }
    }, 500);
  };

  // Handle diving center selection for dive-trips
  const handleDivingCenterSelectForTrips = (centerId, centerName) => {
    onFilterChange('diving_center_id', centerId.toString());
    setDivingCenterSearch(centerName);
    setIsDivingCenterDropdownOpen(false);
  };

  // Handle dive site selection for dive-trips
  const handleDiveSiteSelectForTrips = (siteId, siteName) => {
    onFilterChange('dive_site_id', siteId.toString());
    setDiveSiteSearchForTrips(siteName);
    setIsDiveSiteDropdownOpenForTrips(false);
  };

  // Handle country search
  const handleCountrySearchChange = value => {
    setCountrySearch(value);
    setIsCountryDropdownOpen(true);
    if (!value) {
      onFilterChange('country', '');
      setCountrySearchResults([]);
      return;
    }

    if (countrySearchTimeoutRef.current) {
      clearTimeout(countrySearchTimeoutRef.current);
    }

    countrySearchTimeoutRef.current = setTimeout(async () => {
      try {
        setCountrySearchLoading(true);
        const results = await getUniqueCountries(value);
        setCountrySearchResults(results.map(country => ({ name: country })));
      } catch (error) {
        console.error('Search countries failed', error);
        setCountrySearchResults([]);
      } finally {
        setCountrySearchLoading(false);
      }
    }, 500);
  };

  // Handle region search
  const handleRegionSearchChange = value => {
    setRegionSearch(value);
    setIsRegionDropdownOpen(true);
    if (!value) {
      onFilterChange('region', '');
      setRegionSearchResults([]);
      return;
    }

    if (regionSearchTimeoutRef.current) {
      clearTimeout(regionSearchTimeoutRef.current);
    }

    regionSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setRegionSearchLoading(true);
        const results = await getUniqueRegions(filters.country, value);
        setRegionSearchResults(results.map(region => ({ name: region })));
      } catch (error) {
        console.error('Search regions failed', error);
        setRegionSearchResults([]);
      } finally {
        setRegionSearchLoading(false);
      }
    }, 500);
  };

  // Handle owner/username search for dives
  const handleOwnerSearchChange = value => {
    ownerSearchInputRef.current = true; // Mark that user is actively typing
    lastTypedOwnerSearchRef.current = value; // Track what user typed
    setOwnerSearch(value);
    setIsOwnerDropdownOpen(true);
    if (!value) {
      onFilterChange('username', '');
      setOwnerSearchResults([]);
      ownerSearchInputRef.current = false; // User cleared, allow sync
      lastTypedOwnerSearchRef.current = ''; // Reset typed value
      return;
    }

    if (ownerSearchTimeoutRef.current) {
      clearTimeout(ownerSearchTimeoutRef.current);
    }

    ownerSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setOwnerSearchLoading(true);
        // Include self when searching for owners (for filtering dives)
        const results = await searchUsers(value, 20, true);
        setOwnerSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Search users failed', error);
        setOwnerSearchResults([]);
      } finally {
        setOwnerSearchLoading(false);
      }
    }, 500);
  };

  // Handle buddy search for dives
  const handleBuddySearchChange = value => {
    buddySearchInputRef.current = true; // Mark that user is actively typing
    lastTypedBuddySearchRef.current = value; // Track what user typed
    setBuddySearch(value);
    setIsBuddyDropdownOpen(true);
    if (!value) {
      onFilterChange('buddy_username', '');
      setBuddySearchResults([]);
      buddySearchInputRef.current = false; // User cleared, allow sync
      lastTypedBuddySearchRef.current = ''; // Reset typed value
      return;
    }

    if (buddySearchTimeoutRef.current) {
      clearTimeout(buddySearchTimeoutRef.current);
    }

    buddySearchTimeoutRef.current = setTimeout(async () => {
      try {
        setBuddySearchLoading(true);
        // Include self when searching for buddies (for filtering dives)
        const results = await searchUsers(value, 20, true);
        setBuddySearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Search users failed', error);
        setBuddySearchResults([]);
      } finally {
        setBuddySearchLoading(false);
      }
    }, 500);
  };

  // Handle country selection
  const handleCountrySelect = countryName => {
    onFilterChange('country', countryName);
    setCountrySearch(countryName);
    setIsCountryDropdownOpen(false);
  };

  // Handle region selection
  const handleRegionSelect = regionName => {
    onFilterChange('region', regionName);
    setRegionSearch(regionName);
    setIsRegionDropdownOpen(false);
  };

  // Handle owner selection
  const handleOwnerSelect = user => {
    ownerSearchInputRef.current = false; // User selected, allow sync from filters
    lastTypedOwnerSearchRef.current = ''; // Reset typed value when user selects
    onFilterChange('username', user.username);
    setOwnerSearch(user.username);
    setIsOwnerDropdownOpen(false);
  };

  // Handle buddy selection
  const handleBuddySelect = user => {
    buddySearchInputRef.current = false; // User selected, allow sync from filters
    lastTypedBuddySearchRef.current = ''; // Reset typed value when user selects
    onFilterChange('buddy_username', user.username);
    setBuddySearch(user.username);
    setIsBuddyDropdownOpen(false);
  };

  const handleFilterOverlayToggle = () => {
    setIsFilterOverlayOpen(!isFilterOverlayOpen);
    setActiveTab('filters'); // Reset to filters tab when opening
  };

  // Sorting handlers
  const handleSortFieldChange = newSortBy => {
    const option = sortOptions.find(opt => opt.value === newSortBy);
    const newSortOrder = option?.defaultOrder || pendingSortOrder;
    setPendingSortBy(newSortBy);
    setPendingSortOrder(newSortOrder);
  };

  const handleSortOrderToggle = () => {
    const newSortOrder = pendingSortOrder === 'asc' ? 'desc' : 'asc';
    setPendingSortOrder(newSortOrder);
  };

  const handleReset = () => {
    const firstOption = sortOptions[0];
    if (firstOption) {
      const defaultSortBy = firstOption.value;
      const defaultSortOrder = firstOption.defaultOrder || 'asc';
      setPendingSortBy(defaultSortBy);
      setPendingSortOrder(defaultSortOrder);
      onReset();
    }
  };

  const handleViewModeChange = newViewMode => {
    onViewModeChange(newViewMode);
  };

  // Handle applying all changes (filters + sorting + view)
  const handleApplyAll = () => {
    // Apply sorting changes if they differ from current
    if (pendingSortBy !== sortBy || pendingSortOrder !== sortOrder) {
      onSortChange(pendingSortBy, pendingSortOrder);
    }

    // Close the overlay
    setIsFilterOverlayOpen(false);
  };

  // Get current sort option for display
  const currentSortOption = sortOptions.find(opt => opt.value === sortBy);
  const currentSortLabel = currentSortOption ? currentSortOption.label : 'Default';

  // Get display text for sort order
  const getSortOrderText = order => {
    return order === 'asc' ? 'Ascending' : 'Descending';
  };

  const getActiveFilters = () => {
    const active = [];
    if (filters.search_query)
      active.push({ key: 'search_query', label: 'Search', value: filters.search_query });
    if (filters.search) active.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.username)
      active.push({ key: 'username', label: 'Username', value: filters.username });
    if (filters.buddy_username)
      active.push({ key: 'buddy_username', label: 'Buddy', value: filters.buddy_username });
    if (filters.dive_site_id && pageType === 'dives' && filters.availableDiveSites) {
      const selectedSite = filters.availableDiveSites.find(
        site => site.id.toString() === filters.dive_site_id.toString()
      );
      if (selectedSite) {
        active.push({ key: 'dive_site_id', label: 'Dive Site', value: selectedSite.name });
      }
    }
    if (filters.country) active.push({ key: 'country', label: 'Country', value: filters.country });
    if (filters.region) active.push({ key: 'region', label: 'Region', value: filters.region });
    if (filters.difficulty_code) {
      const difficultyLabel = getDifficultyLabel(filters.difficulty_code);
      active.push({
        key: 'difficulty_code',
        label: 'Difficulty',
        value: difficultyLabel,
      });
    }
    if (filters.exclude_unspecified_difficulty) {
      active.push({
        key: 'exclude_unspecified_difficulty',
        label: 'Exclude Unspecified',
        value: 'Yes',
      });
    }
    if (filters.min_rating)
      active.push({ key: 'min_rating', label: 'Min Rating', value: `≥${filters.min_rating}` });
    if (filters.tag_ids && filters.tag_ids.length > 0) {
      const tagNames = filters.availableTags
        ?.filter(tag => filters.tag_ids.includes(tag.id))
        .map(tag => tag.name)
        .join(', ');
      if (tagNames) {
        active.push({ key: 'tag_ids', label: 'Tags', value: tagNames });
      }
    }
    return active;
  };

  const activeFilters = getActiveFilters();

  // Desktop version - similar to original
  if (!isMobile) {
    return (
      <div
        data-testid='responsive-filter-bar'
        className={`bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 ${className}`}
      >
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4'>
          {/* Quick Filters */}
          {showQuickFilters && (
            <div className='flex items-center gap-2 sm:ml-2 w-full sm:w-auto justify-center sm:justify-end'>
              {/* Page-specific quick filters */}
              {pageType === 'dives' ? (
                // Dives page quick filters
                <>
                  {user && user.id && (
                    <button
                      onClick={() => onQuickFilter('my_dives')}
                      className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                        quickFilters.includes('my_dives')
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                      }`}
                      title='My Dives'
                    >
                      👤 <span className='hidden sm:inline'>My Dives</span>
                    </button>
                  )}
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('wrecks')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Wreck dives'
                  >
                    🚢 <span className='hidden sm:inline'>Wreck</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('reefs')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('reefs')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Reef dives'
                  >
                    🐠 <span className='hidden sm:inline'>Reef</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('boat_dive')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('boat_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Boat dives'
                  >
                    🚤 <span className='hidden sm:inline'>Boat</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('shore_dive')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('shore_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Shore dives'
                  >
                    🏖️ <span className='hidden sm:inline'>Shore</span>
                  </button>
                </>
              ) : pageType === 'dive-trips' ? null : ( // No quick filters for dive trips
                // Default dive-sites quick filters
                <>
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('wrecks')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Wreck dive sites'
                  >
                    🚢 <span className='hidden sm:inline'>Wreck</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('reefs')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('reefs')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Reef dive sites'
                  >
                    🐠 <span className='hidden sm:inline'>Reef</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('boat_dive')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('boat_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Boat dive sites'
                  >
                    🚤 <span className='hidden sm:inline'>Boat</span>
                  </button>
                  <button
                    onClick={() => onQuickFilter('shore_dive')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilters.includes('shore_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Shore dive sites'
                  >
                    🏖️ <span className='hidden sm:inline'>Shore</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Filter Actions */}
          <div className='flex items-center gap-3 ml-4'>
            {activeFiltersCount > 0 && (
              <div className='flex items-center gap-2'>
                <span className='text-xs sm:text-sm text-gray-600'>
                  {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={onClearFilters}
                  className='p-1 text-gray-400 hover:text-gray-600 transition-colors'
                  title='Clear all filters'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            )}

            {showAdvancedToggle && (
              <button
                onClick={handleToggleFilters}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
              >
                <Filter className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilters.length > 0 && (
          <div className='border-t border-gray-200 py-2 px-3 bg-blue-50'>
            <div className='flex items-center gap-2 mb-1.5'>
              <span className='text-xs font-medium text-blue-900'>Active Filters:</span>
            </div>
            <div className='flex flex-wrap gap-1 justify-start'>
              {activeFilters.map(filter => (
                <div
                  key={filter.key}
                  className='inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full border border-blue-200'
                >
                  <span className='font-medium'>{filter.label}:</span>
                  <span className='max-w-[100px] truncate'>{filter.value}</span>
                  <button
                    onClick={() => onFilterChange(filter.key, '')}
                    className='ml-1 text-blue-600 hover:text-blue-800 active:text-blue-900 transition-colors p-0.5 rounded-full hover:bg-blue-200 active:bg-blue-300'
                    title={`Remove ${filter.label} filter`}
                  >
                    <X className='h-2.5 w-2.5' />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desktop: Sorting & View Controls */}
        <div className='border-t border-gray-200 bg-white py-3 px-4'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            {/* Sorting Controls */}
            <div className='flex items-center gap-3'>
              <Select
                id='desktop-sort-by'
                label='Sort by:'
                className='flex-row items-center gap-2'
                value={sortBy}
                onValueChange={value => onSortChange(value, sortOrder)}
                options={sortOptions.map(opt => ({ value: opt.value, label: opt.label }))}
              />

              <div className='flex items-center gap-1'>
                <button
                  onClick={() => onSortChange(sortBy, 'asc')}
                  aria-label='Sort Ascending'
                  className={`px-3 py-2 text-sm rounded-l-md border transition-colors min-h-[40px] sm:min-h-0 ${
                    sortOrder === 'asc'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title='Sort Ascending'
                >
                  <SortAsc className='h-4 w-4' />
                </button>
                <button
                  onClick={() => onSortChange(sortBy, 'desc')}
                  aria-label='Sort Descending'
                  className={`px-3 py-2 text-sm rounded-r-md border-l-0 border transition-colors min-h-[40px] sm:min-h-0 ${
                    sortOrder === 'desc'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title='Sort Descending'
                >
                  <SortDesc className='h-4 w-4' />
                </button>
              </div>
            </div>

            {/* View Mode & Display Options */}
            <div className='flex items-center gap-3'>
              {/* View Mode Selection */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700'>View:</label>
                <div className='flex rounded-md shadow-sm'>
                  <button
                    onClick={() => onViewModeChange('list')}
                    aria-label='List View'
                    className={`px-3 py-2 text-sm border transition-colors rounded-l-md min-h-[40px] sm:min-h-0 ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title='List View'
                  >
                    <List className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => onViewModeChange('grid')}
                    aria-label='Grid View'
                    className={`px-3 py-2 text-sm border border-l-0 transition-colors min-h-[40px] sm:min-h-0 ${
                      viewMode === 'grid'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title='Grid View'
                  >
                    <Grid className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => onViewModeChange('map')}
                    aria-label='Map View'
                    className={`px-3 py-2 text-sm border border-l-0 transition-colors rounded-r-md min-h-[40px] sm:min-h-0 ${
                      viewMode === 'map'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    title='Map View'
                  >
                    <Map className='h-4 w-4' />
                  </button>
                </div>
              </div>

              {/* Display Options */}
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700'>Display:</label>
                <div className='flex items-center gap-2'>
                  <label className='flex items-center gap-1 text-sm text-gray-700'>
                    <input
                      type='checkbox'
                      checked={compactLayout}
                      onChange={() => onDisplayOptionChange('compact')}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    Compact
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Expandable Filters Section */}
        {showFilters && (
          <div className='border-t border-gray-200 bg-gray-50'>
            <div className='p-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {/* Difficulty Level Filter */}
                <div>
                  <Select
                    id='desktop-difficulty-filter'
                    label='Difficulty Level'
                    value={filters.difficulty_code || 'all'}
                    onValueChange={value =>
                      onFilterChange('difficulty_code', value === 'all' ? '' : value)
                    }
                    options={[
                      { value: 'all', label: 'All Levels' },
                      ...getDifficultyOptions()
                        .filter(opt => opt.value !== null)
                        .map(opt => ({ value: opt.value, label: opt.label })),
                    ]}
                  />
                  <label className='flex items-center mt-2'>
                    <input
                      type='checkbox'
                      checked={filters.exclude_unspecified_difficulty ?? false}
                      onChange={e =>
                        onFilterChange('exclude_unspecified_difficulty', e.target.checked)
                      }
                      className='mr-2'
                    />
                    <span className='text-xs text-gray-600'>Exclude Unspecified</span>
                  </label>
                </div>

                {/* Min Rating Filter - Only show for dive-sites and dives, not dive-trips */}
                {pageType !== 'dive-trips' && (
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Min Rating (≥)
                    </label>
                    <input
                      type='number'
                      min='0'
                      max='10'
                      step='1'
                      placeholder='Min rating (1-10)'
                      value={filters.min_rating || ''}
                      onChange={e => onFilterChange('min_rating', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                        filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10)
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-gray-300'
                      }`}
                    />
                    {filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10) && (
                      <p className='text-red-500 text-xs mt-1'>Rating must be between 0 and 10</p>
                    )}
                  </div>
                )}

                {/* Diving Center Filter - Searchable for dive-trips */}
                {pageType === 'dive-trips' && (
                  <div className='relative' ref={divingCenterDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Diving Center
                    </label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for a diving center...'
                        value={divingCenterSearch}
                        onChange={e => handleDivingCenterSearchChangeForTrips(e.target.value)}
                        onFocus={() => setIsDivingCenterDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {divingCenterSearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isDivingCenterDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isDivingCenterDropdownOpen && divingCenterSearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {divingCenterSearchResults.map(center => (
                          <div
                            key={center.id}
                            onClick={() => handleDivingCenterSelectForTrips(center.id, center.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDivingCenterSelectForTrips(center.id, center.name);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{center.name}</div>
                            {center.country && (
                              <div className='text-sm text-gray-500'>{center.country}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isDivingCenterDropdownOpen &&
                      divingCenterSearch &&
                      !divingCenterSearchLoading &&
                      divingCenterSearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>
                            No diving centers found
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Dive Site Filter - Show for dives and dive-trips */}
                {pageType === 'dives' && (
                  <div className='relative' ref={diveSiteDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Dive Site
                    </label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for a dive site...'
                        value={diveSiteSearch}
                        onChange={e => handleDiveSiteSearchChange(e.target.value)}
                        onFocus={() => setIsDiveSiteDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {diveSiteSearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isDiveSiteDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isDiveSiteDropdownOpen && diveSiteSearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {diveSiteSearchResults.map(site => (
                          <div
                            key={site.id}
                            onClick={() => handleDiveSiteSelect(site.id, site.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDiveSiteSelect(site.id, site.name);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{site.name}</div>
                            {site.country && (
                              <div className='text-sm text-gray-500'>{site.country}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isDiveSiteDropdownOpen &&
                      diveSiteSearch &&
                      !diveSiteSearchLoading &&
                      diveSiteSearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No dive sites found</div>
                        </div>
                      )}
                  </div>
                )}

                {/* Owner Filter - Searchable for dives page */}
                {pageType === 'dives' && (
                  <div className='relative' ref={ownerDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Owner</label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for owner...'
                        value={ownerSearch}
                        onChange={e => handleOwnerSearchChange(e.target.value)}
                        onFocus={() => setIsOwnerDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {ownerSearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isOwnerDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isOwnerDropdownOpen && ownerSearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {ownerSearchResults.map(user => (
                          <div
                            key={user.id}
                            onClick={() => handleOwnerSelect(user)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOwnerSelect(user);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{user.username}</div>
                            {user.name && <div className='text-sm text-gray-500'>{user.name}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {isOwnerDropdownOpen &&
                      ownerSearch &&
                      !ownerSearchLoading &&
                      ownerSearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No users found</div>
                        </div>
                      )}
                  </div>
                )}

                {/* Buddy Filter - Searchable for dives page */}
                {pageType === 'dives' && (
                  <div className='relative' ref={buddyDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Buddy</label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for buddy...'
                        value={buddySearch}
                        onChange={e => handleBuddySearchChange(e.target.value)}
                        onFocus={() => setIsBuddyDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {buddySearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isBuddyDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isBuddyDropdownOpen && buddySearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {buddySearchResults.map(user => (
                          <div
                            key={user.id}
                            onClick={() => handleBuddySelect(user)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleBuddySelect(user);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{user.username}</div>
                            {user.name && <div className='text-sm text-gray-500'>{user.name}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {isBuddyDropdownOpen &&
                      buddySearch &&
                      !buddySearchLoading &&
                      buddySearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No users found</div>
                        </div>
                      )}
                    <p className='mt-1 text-xs text-gray-500'>
                      Show dives where this user is a buddy
                    </p>
                  </div>
                )}

                {/* Dive Site Filter - Searchable for dive-trips */}
                {pageType === 'dive-trips' && (
                  <div className='relative' ref={diveSiteDropdownRefForTrips}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Dive Site
                    </label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for a dive site...'
                        value={diveSiteSearchForTrips}
                        onChange={e => handleDiveSiteSearchChangeForTrips(e.target.value)}
                        onFocus={() => setIsDiveSiteDropdownOpenForTrips(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {diveSiteSearchLoadingForTrips ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isDiveSiteDropdownOpenForTrips ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isDiveSiteDropdownOpenForTrips && diveSiteSearchResultsForTrips.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {diveSiteSearchResultsForTrips.map(site => (
                          <div
                            key={site.id}
                            onClick={() => handleDiveSiteSelectForTrips(site.id, site.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleDiveSiteSelectForTrips(site.id, site.name);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{site.name}</div>
                            {site.country && (
                              <div className='text-sm text-gray-500'>{site.country}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isDiveSiteDropdownOpenForTrips &&
                      diveSiteSearchForTrips &&
                      !diveSiteSearchLoadingForTrips &&
                      diveSiteSearchResultsForTrips.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No dive sites found</div>
                        </div>
                      )}
                  </div>
                )}

                {/* Date Range Filters - For dive-trips */}
                {pageType === 'dive-trips' && (
                  <>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Start Date
                      </label>
                      <input
                        type='date'
                        value={filters.start_date || ''}
                        onChange={e => onFilterChange('start_date', e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        End Date
                      </label>
                      <input
                        type='date'
                        value={filters.end_date || ''}
                        onChange={e => onFilterChange('end_date', e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                    </div>
                  </>
                )}

                {/* Country Filter - Searchable (not for dives page) */}
                {pageType !== 'dives' && (
                  <div className='relative' ref={countryDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Country</label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for a country...'
                        value={countrySearch}
                        onChange={e => handleCountrySearchChange(e.target.value)}
                        onFocus={() => setIsCountryDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {countrySearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isCountryDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isCountryDropdownOpen && countrySearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {countrySearchResults.map((country, index) => (
                          <div
                            key={index}
                            onClick={() => handleCountrySelect(country.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCountrySelect(country.name);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{country.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isCountryDropdownOpen &&
                      countrySearch &&
                      !countrySearchLoading &&
                      countrySearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No countries found</div>
                        </div>
                      )}
                  </div>
                )}

                {/* Region Filter - Searchable (not for dives page) */}
                {pageType !== 'dives' && (
                  <div className='relative' ref={regionDropdownRef}>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Region</label>
                    <div className='relative'>
                      <input
                        type='text'
                        placeholder='Search for a region...'
                        value={regionSearch}
                        onChange={e => handleRegionSearchChange(e.target.value)}
                        onFocus={() => setIsRegionDropdownOpen(true)}
                        className='w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                      />
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        {regionSearchLoading ? (
                          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                        ) : (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${
                              isRegionDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </div>
                    </div>
                    {/* Dropdown */}
                    {isRegionDropdownOpen && regionSearchResults.length > 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                        {regionSearchResults.map((region, index) => (
                          <div
                            key={index}
                            onClick={() => handleRegionSelect(region.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleRegionSelect(region.name);
                              }
                            }}
                            role='button'
                            tabIndex={0}
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{region.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isRegionDropdownOpen &&
                      regionSearch &&
                      !regionSearchLoading &&
                      regionSearchResults.length === 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
                          <div className='px-3 py-2 text-gray-500 text-sm'>No regions found</div>
                        </div>
                      )}
                  </div>
                )}

                {/* Tags Filter */}
                {filters.availableTags && filters.availableTags.length > 0 && (
                  <div className='md:col-span-2 lg:col-span-3'>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Tags</label>
                    <div className='flex flex-wrap gap-2'>
                      {filters.availableTags.map(tag => (
                        <button
                          key={tag.id}
                          type='button'
                          onClick={() => {
                            const tagId = parseInt(tag.id);
                            const currentTagIds = filters.tag_ids || [];
                            const newTagIds = currentTagIds.includes(tagId)
                              ? currentTagIds.filter(id => id !== tagId)
                              : [...currentTagIds, tagId];
                            onFilterChange('tag_ids', newTagIds);
                          }}
                          className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            (filters.tag_ids || []).includes(tag.id)
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
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile version with scroll-based behavior
  return (
    <>
      {/* Mobile Search Bar - visible when scrolling down */}
      {searchBarVisible && (
        <div
          ref={searchBarRef}
          data-testid='mobile-search-bar'
          className='fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out'
          style={{ transform: searchBarVisible ? 'translateY(0)' : 'translateY(-100%)' }}
        >
          <div className='p-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search dive sites...'
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && onSearchSubmit()}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Quick Filters Bar - visible when scrolling up or down */}
      {quickFiltersVisible && (
        <div
          data-testid='mobile-quick-filters'
          className='fixed left-0 right-0 z-[99] bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out'
          style={{
            top: searchBarVisible ? `${searchBarHeight}px` : '0px',
            transform: quickFiltersVisible ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          <div className='flex items-center justify-between p-3'>
            {/* Filter Icon with Count */}
            <button
              data-testid='mobile-filter-button'
              onClick={handleFilterOverlayToggle}
              className='flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors min-h-[44px]'
            >
              <Wrench className='h-5 w-5' />
              {activeFiltersCount > 0 && (
                <span className='bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center'>
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Quick Filter Buttons */}
            <div className='flex items-center gap-2 overflow-x-auto flex-1 ml-3'>
              {/* Page-specific mobile quick filters */}
              {pageType === 'dives' ? (
                // Dives page mobile quick filters
                <>
                  {user && user.id && (
                    <button
                      onClick={() => onQuickFilter('my_dives')}
                      aria-label='My Dives'
                      className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                        quickFilters.includes('my_dives')
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                      title='My Dives'
                    >
                      👤
                    </button>
                  )}
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    aria-label='Wreck Dives'
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('wrecks')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Wreck dives'
                  >
                    🚢
                  </button>
                  <button
                    onClick={() => onQuickFilter('reefs')}
                    aria-label='Reef Dives'
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('reefs')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Reef dives'
                  >
                    🐠
                  </button>
                  <button
                    onClick={() => onQuickFilter('boat_dive')}
                    aria-label='Boat Dives'
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('boat_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Boat dives'
                  >
                    🚤
                  </button>
                  <button
                    onClick={() => onQuickFilter('shore_dive')}
                    aria-label='Shore Dives'
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('shore_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Shore dives'
                  >
                    🏖️
                  </button>
                </>
              ) : pageType === 'dive-trips' ? null : ( // No quick filters for dive trips
                // Default dive-sites mobile quick filters
                <>
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('wrecks')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Wreck dive sites'
                  >
                    🚢
                  </button>
                  <button
                    onClick={() => onQuickFilter('reefs')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('reefs')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Reef dive sites'
                  >
                    🐠
                  </button>
                  <button
                    onClick={() => onQuickFilter('boat_dive')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('boat_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Boat dive sites'
                  >
                    🚤
                  </button>
                  <button
                    onClick={() => onQuickFilter('shore_dive')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilters.includes('shore_dive')
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Shore dive sites'
                  >
                    🏖️
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Overlay - Full Page with Tabs */}

      <Modal
        isOpen={isFilterOverlayOpen}
        onClose={handleFilterOverlayToggle}
        title='Filters & Sorting'
        className='w-full h-screen sm:h-auto sm:max-w-2xl p-0 flex flex-col'
        showCloseButton={true}
      >
        {/* Tab Navigation */}

        <div className='flex border-b border-gray-200 bg-white'>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'filters'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Filter className='h-4 w-4 inline mr-2' />
            Filters
          </button>

          <button
            onClick={() => setActiveTab('sorting')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sorting'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Settings className='h-4 w-4 inline mr-2' />
            Sorting & View
          </button>
        </div>

        {/* Tab Content */}

        <div className='flex-1 overflow-y-auto min-h-0'>
          {/* Filters Tab */}

          {activeTab === 'filters' && (
            <div className='p-4 space-y-6 pb-4'>
              {/* Difficulty Level Filter */}

              <div>
                <Select
                  id='mobile-difficulty-filter'
                  label='Difficulty Level'
                  value={filters.difficulty_code || 'all'}
                  onValueChange={value =>
                    onFilterChange('difficulty_code', value === 'all' ? '' : value)
                  }
                  options={[
                    { value: 'all', label: 'All Levels' },
                    ...getDifficultyOptions()
                      .filter(opt => opt.value !== null)
                      .map(opt => ({ value: opt.value, label: opt.label })),
                  ]}
                />

                <label className='flex items-center mt-2'>
                  <input
                    type='checkbox'
                    checked={filters.exclude_unspecified_difficulty ?? false}
                    onChange={e =>
                      onFilterChange('exclude_unspecified_difficulty', e.target.checked)
                    }
                    className='mr-2'
                  />

                  <span className='text-sm text-gray-600'>Exclude Unspecified</span>
                </label>
              </div>

              {/* Dive Site Filter - Searchable for dives page (mobile) */}

              {pageType === 'dives' && (
                <div className='relative' ref={diveSiteDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Dive Site</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for a dive site...'
                      value={diveSiteSearch}
                      onChange={e => handleDiveSiteSearchChange(e.target.value)}
                      onFocus={() => setIsDiveSiteDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {diveSiteSearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isDiveSiteDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isDiveSiteDropdownOpen && diveSiteSearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {diveSiteSearchResults.map(site => (
                        <div
                          key={site.id}
                          onClick={() => handleDiveSiteSelect(site.id, site.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleDiveSiteSelect(site.id, site.name);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{site.name}</div>

                          {site.country && (
                            <div className='text-sm text-gray-500'>{site.country}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isDiveSiteDropdownOpen &&
                    diveSiteSearch &&
                    !diveSiteSearchLoading &&
                    diveSiteSearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No dive sites found</div>
                      </div>
                    )}
                </div>
              )}

              {/* Owner Filter - Searchable for dives page (mobile) */}

              {pageType === 'dives' && (
                <div className='relative' ref={ownerDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Owner</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for owner...'
                      value={ownerSearch}
                      onChange={e => handleOwnerSearchChange(e.target.value)}
                      onFocus={() => setIsOwnerDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {ownerSearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isOwnerDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isOwnerDropdownOpen && ownerSearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {ownerSearchResults.map(user => (
                        <div
                          key={user.id}
                          onClick={() => handleOwnerSelect(user)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleOwnerSelect(user);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{user.username}</div>

                          {user.name && <div className='text-sm text-gray-500'>{user.name}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {isOwnerDropdownOpen &&
                    ownerSearch &&
                    !ownerSearchLoading &&
                    ownerSearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No users found</div>
                      </div>
                    )}
                </div>
              )}

              {/* Buddy Filter - Searchable for dives page (mobile) */}

              {pageType === 'dives' && (
                <div className='relative' ref={buddyDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Buddy</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for buddy...'
                      value={buddySearch}
                      onChange={e => handleBuddySearchChange(e.target.value)}
                      onFocus={() => setIsBuddyDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {buddySearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isBuddyDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isBuddyDropdownOpen && buddySearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {buddySearchResults.map(user => (
                        <div
                          key={user.id}
                          onClick={() => handleBuddySelect(user)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleBuddySelect(user);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{user.username}</div>

                          {user.name && <div className='text-sm text-gray-500'>{user.name}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {isBuddyDropdownOpen &&
                    buddySearch &&
                    !buddySearchLoading &&
                    buddySearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No users found</div>
                      </div>
                    )}

                  <p className='mt-1 text-xs text-gray-500'>
                    Show dives where this user is a buddy
                  </p>
                </div>
              )}

              {/* Diving Center Filter - Searchable for dive-trips (mobile) */}

              {pageType === 'dive-trips' && (
                <div className='relative' ref={divingCenterDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>
                    Diving Center
                  </label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for a diving center...'
                      value={divingCenterSearch}
                      onChange={e => handleDivingCenterSearchChangeForTrips(e.target.value)}
                      onFocus={() => setIsDivingCenterDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {divingCenterSearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isDivingCenterDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isDivingCenterDropdownOpen && divingCenterSearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {divingCenterSearchResults.map(center => (
                        <div
                          key={center.id}
                          onClick={() => handleDivingCenterSelectForTrips(center.id, center.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleDivingCenterSelectForTrips(center.id, center.name);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{center.name}</div>

                          {center.country && (
                            <div className='text-sm text-gray-500'>{center.country}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isDivingCenterDropdownOpen &&
                    divingCenterSearch &&
                    !divingCenterSearchLoading &&
                    divingCenterSearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>
                          No diving centers found
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Dive Site Filter - Searchable for dive-trips (mobile) */}

              {pageType === 'dive-trips' && (
                <div className='relative' ref={diveSiteDropdownRefForTrips}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Dive Site</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for a dive site...'
                      value={diveSiteSearchForTrips}
                      onChange={e => handleDiveSiteSearchChangeForTrips(e.target.value)}
                      onFocus={() => setIsDiveSiteDropdownOpenForTrips(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {diveSiteSearchLoadingForTrips ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isDiveSiteDropdownOpenForTrips ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isDiveSiteDropdownOpenForTrips && diveSiteSearchResultsForTrips.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {diveSiteSearchResultsForTrips.map(site => (
                        <div
                          key={site.id}
                          onClick={() => handleDiveSiteSelectForTrips(site.id, site.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleDiveSiteSelectForTrips(site.id, site.name);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{site.name}</div>

                          {site.country && (
                            <div className='text-sm text-gray-500'>{site.country}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isDiveSiteDropdownOpenForTrips &&
                    diveSiteSearchForTrips &&
                    !diveSiteSearchLoadingForTrips &&
                    diveSiteSearchResultsForTrips.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No dive sites found</div>
                      </div>
                    )}
                </div>
              )}

              {/* Date Range Filters - For dive-trips (mobile) */}

              {pageType === 'dive-trips' && (
                <>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-3'>
                      Start Date
                    </label>

                    <input
                      type='date'
                      value={filters.start_date || ''}
                      onChange={e => onFilterChange('start_date', e.target.value)}
                      className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-3'>End Date</label>

                    <input
                      type='date'
                      value={filters.end_date || ''}
                      onChange={e => onFilterChange('end_date', e.target.value)}
                      className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />
                  </div>
                </>
              )}

              {/* Min Rating Filter - Only show for dive-sites and dives, not dive-trips */}

              {pageType !== 'dive-trips' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>
                    Min Rating (≥)
                  </label>

                  <input
                    type='number'
                    min='0'
                    max='10'
                    step='1'
                    placeholder='Min rating (1-10)'
                    value={filters.min_rating || ''}
                    onChange={e => onFilterChange('min_rating', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === '.' || e.key === 'e' || e.key === 'E' || e.key === ',') {
                        e.preventDefault();
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px] ${
                      filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10)
                        ? 'border-red-500 ring-1 ring-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  {filters.min_rating && (filters.min_rating < 0 || filters.min_rating > 10) && (
                    <p className='text-red-500 text-sm mt-1'>Rating must be between 0 and 10</p>
                  )}
                </div>
              )}

              {/* Country Filter - Searchable (mobile, not for dives page) */}

              {pageType !== 'dives' && (
                <div className='relative' ref={countryDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Country</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for a country...'
                      value={countrySearch}
                      onChange={e => handleCountrySearchChange(e.target.value)}
                      onFocus={() => setIsCountryDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {countrySearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isCountryDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isCountryDropdownOpen && countrySearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {countrySearchResults.map((country, index) => (
                        <div
                          key={index}
                          onClick={() => handleCountrySelect(country.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleCountrySelect(country.name);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{country.name}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isCountryDropdownOpen &&
                    countrySearch &&
                    !countrySearchLoading &&
                    countrySearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No countries found</div>
                      </div>
                    )}
                </div>
              )}

              {/* Region Filter - Searchable (mobile, not for dives page) */}

              {pageType !== 'dives' && (
                <div className='relative' ref={regionDropdownRef}>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Region</label>

                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='Search for a region...'
                      value={regionSearch}
                      onChange={e => handleRegionSearchChange(e.target.value)}
                      onFocus={() => setIsRegionDropdownOpen(true)}
                      className='w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[34px]'
                    />

                    <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                      {regionSearchLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
                      ) : (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${
                            isRegionDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Dropdown */}

                  {isRegionDropdownOpen && regionSearchResults.length > 0 && (
                    <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto'>
                      {regionSearchResults.map((region, index) => (
                        <div
                          key={index}
                          onClick={() => handleRegionSelect(region.name)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();

                              handleRegionSelect(region.name);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                          className='px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 min-h-[44px]'
                        >
                          <div className='font-medium text-gray-900'>{region.name}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isRegionDropdownOpen &&
                    regionSearch &&
                    !regionSearchLoading &&
                    regionSearchResults.length === 0 && (
                      <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
                        <div className='px-4 py-3 text-gray-500 text-sm'>No regions found</div>
                      </div>
                    )}
                </div>
              )}

              {/* Tags Filter */}

              {filters.availableTags && filters.availableTags.length > 0 && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-3'>Tags</label>

                  <div className='flex flex-wrap gap-3'>
                    {filters.availableTags.map(tag => (
                      <button
                        key={tag.id}
                        type='button'
                        onClick={() => {
                          const tagId = parseInt(tag.id);

                          const currentTagIds = filters.tag_ids || [];

                          const newTagIds = currentTagIds.includes(tagId)
                            ? currentTagIds.filter(id => id !== tagId)
                            : [...currentTagIds, tagId];

                          onFilterChange('tag_ids', newTagIds);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 min-h-[34px] ${
                          (filters.tag_ids || []).includes(tag.id)
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
            </div>
          )}

          {/* Sorting & View Tab - Compact Mobile Interface */}

          {activeTab === 'sorting' && (
            <div className='p-4 space-y-6 pb-4'>
              {/* Sort Field Selection - Compact Dropdown */}

              <Select
                id='mobile-sort-by'
                label='Sort Field'
                value={pendingSortBy || 'all'}
                onValueChange={value => handleSortFieldChange(value === 'all' ? '' : value)}
                options={[
                  { value: 'all', label: 'Select sort field' },
                  ...sortOptions.map(opt => ({
                    value: opt.value,
                    label: `${opt.label} (${opt.defaultOrder === 'asc' ? 'Low to High' : 'High to Low'})`,
                  })),
                ]}
              />

              {/* Sort Order - Compact Toggle */}

              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Sort Order</h4>

                <div className='flex gap-2'>
                  <button
                    onClick={() => setPendingSortOrder('asc')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors min-h-[34px] ${
                      pendingSortOrder === 'asc'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <SortAsc className='w-4 h-4' />
                      Ascending
                    </div>
                  </button>

                  <button
                    onClick={() => setPendingSortOrder('desc')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors min-h-[34px] ${
                      pendingSortOrder === 'desc'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <SortDesc className='w-4 h-4' />
                      Descending
                    </div>
                  </button>
                </div>
              </div>

              {/* View Mode Selection - Compact Buttons */}

              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>View Mode</h4>

                <div className='flex gap-2'>
                  <button
                    onClick={() => handleViewModeChange('list')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors min-h-[34px] ${
                      viewMode === 'list'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <List className='w-4 h-4' />
                      List
                    </div>
                  </button>

                  <button
                    onClick={() => handleViewModeChange('map')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors min-h-[34px] ${
                      viewMode === 'map'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <Map className='w-4 h-4' />
                      Map
                    </div>
                  </button>
                </div>
              </div>

              {/* Display Options - Compact Checkbox */}

              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Display Options</h4>

                <div className='space-y-2'>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                      checked={compactLayout}
                      onChange={() => onDisplayOptionChange('compact')}
                    />

                    <span className='text-sm text-gray-700'>Compact layout</span>
                  </label>
                </div>
              </div>

              {/* Sorting Action Buttons - Only Reset button, no Apply Sort */}

              <div className='flex gap-3 pt-4'>
                <button
                  onClick={handleReset}
                  className='flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors'
                >
                  <RotateCcw className='w-4 h-4 inline mr-2' />
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Single Apply All button */}

        <div className='border-t border-gray-200 p-4 bg-gray-50 flex gap-3'>
          <button
            onClick={onClearFilters}
            className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[34px]'
          >
            Clear All
          </button>

          <button
            onClick={handleApplyAll}
            className='flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-h-[34px]'
          >
            Apply All
          </button>
        </div>
      </Modal>
    </>
  );
};

ResponsiveFilterBar.propTypes = {
  showFilters: PropTypes.bool,

  onToggleFilters: PropTypes.func,

  onClearFilters: PropTypes.func,

  activeFiltersCount: PropTypes.number,

  filters: PropTypes.object,

  onFilterChange: PropTypes.func,

  onQuickFilter: PropTypes.func,

  quickFilters: PropTypes.array,

  className: PropTypes.string,

  variant: PropTypes.oneOf(['sticky', 'floating', 'inline']),

  showQuickFilters: PropTypes.bool,

  showAdvancedToggle: PropTypes.bool,

  searchQuery: PropTypes.string,

  onSearchChange: PropTypes.func,

  onSearchSubmit: PropTypes.func,

  // New sorting props

  sortBy: PropTypes.string,

  sortOrder: PropTypes.oneOf(['asc', 'desc']),

  sortOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,

      label: PropTypes.string.isRequired,

      defaultOrder: PropTypes.oneOf(['asc', 'desc']),

      icon: PropTypes.element,
    })
  ),

  onSortChange: PropTypes.func,

  onReset: PropTypes.func,

  viewMode: PropTypes.oneOf(['list', 'grid', 'map']),

  onViewModeChange: PropTypes.func,

  compactLayout: PropTypes.bool,

  onDisplayOptionChange: PropTypes.func,

  // New prop for page-specific quick filters

  pageType: PropTypes.string,

  user: PropTypes.object,
};

export default ResponsiveFilterBar;
