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
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { useResponsiveScroll } from '../hooks/useResponsive';

const ResponsiveFilterBar = ({
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  filters = {},
  onFilterChange = () => {},
  onQuickFilter = () => {},
  quickFilter = '',
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
  showThumbnails = false,
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

  // Sorting state management
  const [pendingSortBy, setPendingSortBy] = useState(sortBy);
  const [pendingSortOrder, setPendingSortOrder] = useState(sortOrder);

  // Update pending values when props change
  useEffect(() => {
    setPendingSortBy(sortBy);
    setPendingSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

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
    if (filters.country) active.push({ key: 'country', label: 'Country', value: filters.country });
    if (filters.region) active.push({ key: 'region', label: 'Region', value: filters.region });
    if (filters.difficulty_level)
      active.push({
        key: 'difficulty_level',
        label: 'Difficulty',
        value: filters.difficulty_level,
      });
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
                        quickFilter === 'my_dives'
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
                      quickFilter === 'wrecks'
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
                      quickFilter === 'reefs'
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
                      quickFilter === 'boat_dive'
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
                      quickFilter === 'shore_dive'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                    }`}
                    title='Shore dives'
                  >
                    🏖️ <span className='hidden sm:inline'>Shore</span>
                  </button>
                </>
              ) : (
                // Default dive-sites quick filters
                <>
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                      quickFilter === 'wrecks'
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
                      quickFilter === 'reefs'
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
                      quickFilter === 'boat_dive'
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
                      quickFilter === 'shore_dive'
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
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium text-gray-700'>Sort by:</label>
                <select
                  value={sortBy}
                  onChange={e => onSortChange(e.target.value, sortOrder)}
                  className='px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-center gap-1'>
                <button
                  onClick={() => onSortChange(sortBy, 'asc')}
                  className={`px-3 py-2 text-sm rounded-l-md border transition-colors ${
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
                  className={`px-3 py-2 text-sm rounded-r-md border-l-0 border transition-colors ${
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
                    className={`px-3 py-2 text-sm border transition-colors rounded-l-md ${
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
                    className={`px-3 py-2 text-sm border border-l-0 transition-colors ${
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
                    className={`px-3 py-2 text-sm border border-l-0 transition-colors rounded-r-md ${
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
                      checked={showThumbnails}
                      onChange={e => onDisplayOptionChange('showThumbnails', e.target.checked)}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    Thumbnails
                  </label>
                  <label className='flex items-center gap-1 text-sm text-gray-700'>
                    <input
                      type='checkbox'
                      checked={compactLayout}
                      onChange={e => onDisplayOptionChange('compactLayout', e.target.checked)}
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
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Difficulty Level
                  </label>
                  <select
                    value={filters.difficulty_level || ''}
                    onChange={e => onFilterChange('difficulty_level', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  >
                    <option value=''>All Levels</option>
                    <option value='beginner'>Beginner</option>
                    <option value='intermediate'>Intermediate</option>
                    <option value='advanced'>Advanced</option>
                    <option value='expert'>Expert</option>
                  </select>
                </div>

                {/* Min Rating Filter */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Min Rating (≥)
                  </label>
                  <input
                    type='number'
                    min='0'
                    max='10'
                    step='0.1'
                    placeholder='Show sites rated ≥ this value'
                    value={filters.min_rating || ''}
                    onChange={e => onFilterChange('min_rating', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>

                {/* Country Filter */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Country</label>
                  <input
                    type='text'
                    placeholder='Enter country name'
                    value={filters.country || ''}
                    onChange={e => onFilterChange('country', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>

                {/* Region Filter */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Region</label>
                  <input
                    type='text'
                    placeholder='Enter region name'
                    value={filters.region || ''}
                    onChange={e => onFilterChange('region', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>

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
            top: searchBarVisible ? '64px' : '0px',
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
                      className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                        quickFilter === 'my_dives'
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
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilter === 'wrecks'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Wreck dives'
                  >
                    🚢
                  </button>
                  <button
                    onClick={() => onQuickFilter('reefs')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilter === 'reefs'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Wreck dives'
                  >
                    🐠
                  </button>
                  <button
                    onClick={() => onQuickFilter('boat_dive')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilter === 'boat_dive'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Boat dives'
                  >
                    🚤
                  </button>
                  <button
                    onClick={() => onQuickFilter('shore_dive')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilter === 'shore_dive'
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                    title='Shore dives'
                  >
                    🏖️
                  </button>
                </>
              ) : (
                // Default dive-sites mobile quick filters
                <>
                  <button
                    onClick={() => onQuickFilter('wrecks')}
                    className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                      quickFilter === 'wrecks'
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
                      quickFilter === 'reefs'
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
                      quickFilter === 'boat_dive'
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
                      quickFilter === 'shore_dive'
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
      {isFilterOverlayOpen && (
        <div
          data-testid='mobile-filter-overlay'
          className='fixed inset-0 z-[200] bg-black bg-opacity-50 flex flex-col'
        >
          <div className='bg-white w-full h-full flex flex-col'>
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50'>
              <h3 className='text-lg font-semibold text-gray-900'>Filters & Sorting</h3>
              <button
                onClick={handleFilterOverlayToggle}
                className='p-2 rounded-lg hover:bg-gray-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center'
                aria-label='Close filters'
              >
                <X className='h-5 w-5 text-gray-600' />
              </button>
            </div>

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
                    <label className='block text-sm font-medium text-gray-700 mb-3'>
                      Difficulty Level
                    </label>
                    <select
                      value={filters.difficulty_level || ''}
                      onChange={e => onFilterChange('difficulty_level', e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                    >
                      <option value=''>All Levels</option>
                      <option value='beginner'>Beginner</option>
                      <option value='intermediate'>Intermediate</option>
                      <option value='advanced'>Advanced</option>
                      <option value='expert'>Expert</option>
                    </select>
                  </div>

                  {/* Min Rating Filter */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-3'>
                      Min Rating (≥)
                    </label>
                    <input
                      type='number'
                      min='0'
                      max='10'
                      step='0.1'
                      placeholder='Show sites rated ≥ this value'
                      value={filters.min_rating || ''}
                      onChange={e => onFilterChange('min_rating', e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                    />
                  </div>

                  {/* Country Filter */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-3'>Country</label>
                    <input
                      type='text'
                      placeholder='Enter country name'
                      value={filters.country || ''}
                      onChange={e => onFilterChange('country', e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                    />
                  </div>

                  {/* Region Filter */}
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-3'>Region</label>
                    <input
                      type='text'
                      placeholder='Enter region name'
                      value={filters.region || ''}
                      onChange={e => onFilterChange('region', e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                    />
                  </div>

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
                            className={`px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 min-h-[48px] ${
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
                  <div>
                    <h4 className='text-sm font-medium text-gray-700 mb-3'>Sort Field</h4>
                    <select
                      value={pendingSortBy || ''}
                      onChange={e => handleSortFieldChange(e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                    >
                      <option value=''>Select sort field</option>
                      {sortOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label} (
                          {option.defaultOrder === 'asc' ? 'Low to High' : 'High to Low'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Order - Compact Toggle */}
                  <div>
                    <h4 className='text-sm font-medium text-gray-700 mb-3'>Sort Order</h4>
                    <div className='flex gap-2'>
                      <button
                        onClick={() => setPendingSortOrder('asc')}
                        className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border transition-colors min-h-[48px] ${
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
                        className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border transition-colors min-h-[48px] ${
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
                        className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border transition-colors min-h-[48px] ${
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
                        className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border transition-colors min-h-[48px] ${
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

                  {/* Display Options - Compact Checkboxes */}
                  <div>
                    <h4 className='text-sm font-medium text-gray-700 mb-3'>Display Options</h4>
                    <div className='space-y-2'>
                      <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                        <input
                          type='checkbox'
                          className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                          checked={showThumbnails}
                          onChange={() => onDisplayOptionChange('thumbnails')}
                        />
                        <span className='text-sm text-gray-700'>Show thumbnails</span>
                      </label>

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
                className='flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]'
              >
                Clear All
              </button>
              <button
                onClick={handleApplyAll}
                className='flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-h-[48px]'
              >
                Apply All
              </button>
            </div>
          </div>
        </div>
      )}
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
  quickFilter: PropTypes.string,
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
  viewMode: PropTypes.oneOf(['list', 'map']),
  onViewModeChange: PropTypes.func,
  showThumbnails: PropTypes.bool,
  compactLayout: PropTypes.bool,
  onDisplayOptionChange: PropTypes.func,
  // New prop for page-specific quick filters
  pageType: PropTypes.string,
  user: PropTypes.object,
};

export default ResponsiveFilterBar;
