import {
  Filter,
  X,
  Wrench,
  Building,
  Star,
  MapPin,
  Search,
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
import React, { useState, useEffect, useRef } from 'react';

import { useResponsiveScroll } from '../hooks/useResponsive';

import Modal from './ui/Modal';

const DivingCentersResponsiveFilterBar = ({
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
  onSortApply = () => {},
  onReset = () => {},
  viewMode = 'list',
  onViewModeChange = () => {},
  compactLayout = false,
  onDisplayOptionChange = () => {},
  reviewsEnabled = true, // Default to enabled
}) => {
  const { isMobile, searchBarVisible, quickFiltersVisible } = useResponsiveScroll();
  const [isFilterOverlayOpen, setIsFilterOverlayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('filters');
  const searchBarRef = useRef(null);
  const [searchBarHeight, setSearchBarHeight] = useState(64);

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

  const handleFilterOverlayToggle = () => {
    setIsFilterOverlayOpen(!isFilterOverlayOpen);
    setActiveTab('filters'); // Reset to filters tab when opening
  };

  // Handle applying all changes (filters + sorting + view)
  const handleApplyAll = () => {
    // Apply sorting changes if they differ from current
    if (pendingSortBy !== sortBy || pendingSortOrder !== sortOrder) {
      if (onSortChange && typeof onSortChange === 'function') {
        onSortChange(pendingSortBy, pendingSortOrder);
      }
    }

    // Close the overlay
    setIsFilterOverlayOpen(false);
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

  // Get display text for sort order
  const getSortOrderText = order => {
    return order === 'asc' ? 'Ascending' : 'Descending';
  };

  const getActiveFilters = () => {
    const active = [];
    if (filters.search) active.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.name) active.push({ key: 'name', label: 'Name', value: filters.name });
    if (filters.min_rating)
      active.push({ key: 'min_rating', label: 'Min Rating', value: `≥${filters.min_rating}` });
    if (filters.country) active.push({ key: 'country', label: 'Country', value: filters.country });
    if (filters.region) active.push({ key: 'region', label: 'Region', value: filters.region });
    if (filters.city) active.push({ key: 'city', label: 'City', value: filters.city });
    return active;
  };

  const activeFilters = getActiveFilters();

  const getTagColor = tagName => {
    const colors = {
      PADI: 'bg-blue-100 text-blue-800',
      SSI: 'bg-green-100 text-green-800',
      NAUI: 'bg-purple-100 text-purple-800',
      CMAS: 'bg-orange-100 text-orange-800',
      default: 'bg-gray-100 text-gray-800',
    };
    return colors[tagName] || colors.default;
  };

  // Desktop version
  if (!isMobile) {
    return (
      <div
        data-testid='diving-centers-responsive-filter-bar'
        className={`bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40 ${className}`}
      >
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4'>
          {/* Quick Filters */}
          {showQuickFilters && (
            <div className='flex items-center gap-2 overflow-x-auto'>
              {reviewsEnabled && (
                <button
                  onClick={() => onQuickFilter('min_rating')}
                  className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors ${
                    quickFilter === 'min_rating'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <Star className='h-4 w-4 inline mr-1' />
                  4+ Stars
                </button>
              )}
              <button
                onClick={() => onQuickFilter('country')}
                className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors ${
                  quickFilter === 'country'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <MapPin className='h-4 w-4 inline mr-1' />
                Greece
              </button>
            </div>
          )}

          {/* Advanced Filters Toggle */}
          {showAdvancedToggle && (
            <button
              onClick={onToggleFilters}
              className='flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors'
            >
              <Filter className='h-4 w-4' />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              {activeFiltersCount > 0 && (
                <span className='bg-blue-600 text-white text-xs rounded-full px-2 py-1'>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}
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
                {/* Min Rating Filter */}
                {reviewsEnabled && (
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

                {/* Services Filter */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Services</label>
                  <input
                    type='text'
                    placeholder='Enter service type'
                    value={filters.services || ''}
                    onChange={e => onFilterChange('services', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
                  />
                </div>
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
          data-testid='diving-centers-mobile-search-bar'
          className='fixed top-0 left-0 right-0 z-[100] bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out'
          style={{ transform: searchBarVisible ? 'translateY(0)' : 'translateY(-100%)' }}
        >
          <div className='p-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search diving centers...'
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
          data-testid='diving-centers-mobile-quick-filters'
          className='fixed left-0 right-0 z-[99] bg-white border-b border-gray-200 shadow-sm transition-all duration-300 ease-in-out'
          style={{
            top: searchBarVisible ? `${searchBarHeight}px` : '0px',
            transform: quickFiltersVisible ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          <div className='flex items-center justify-between p-3'>
            {/* Filter Icon with Count */}
            <button
              data-testid='diving-centers-mobile-filter-button'
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
              {reviewsEnabled && (
                <button
                  onClick={() => onQuickFilter('min_rating')}
                  className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                    quickFilter === 'min_rating'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <Star className='h-4 w-4 inline mr-1' />
                  4+ Stars
                </button>
              )}
              <button
                onClick={() => onQuickFilter('country')}
                className={`flex-shrink-0 px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                  quickFilter === 'country'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <MapPin className='h-4 w-4 inline mr-1' />
                Greece
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Overlay - Full Page with Tabs */}
      <Modal
        isOpen={isFilterOverlayOpen}
        onClose={handleFilterOverlayToggle}
        title='Filters & Sorting'
        className='w-full h-screen sm:h-auto sm:max-w-xl p-0 flex flex-col'
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
              {/* Min Rating Filter */}
              {reviewsEnabled && (
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
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px] ${
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

              {/* Services Filter */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-3'>Services</label>
                <input
                  type='text'
                  placeholder='Enter service type'
                  value={filters.services || ''}
                  onChange={e => onFilterChange('services', e.target.value)}
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base min-h-[48px]'
                />
              </div>
            </div>
          )}

          {/* Sorting & View Tab */}
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
                    <span className='text-sm font-medium'>Compact layout</span>
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
      </Modal>
    </>
  );
};

DivingCentersResponsiveFilterBar.propTypes = {
  showFilters: PropTypes.bool,
  onToggleFilters: PropTypes.func,
  onClearFilters: PropTypes.func,
  activeFiltersCount: PropTypes.number,
  filters: PropTypes.object,
  onFilterChange: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['sticky', 'floating', 'inline']),
  showQuickFilters: PropTypes.bool,
  showAdvancedToggle: PropTypes.bool,
  onQuickFilter: PropTypes.func,
  quickFilter: PropTypes.string,
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
  onSortApply: PropTypes.func,
  onReset: PropTypes.func,
  viewMode: PropTypes.oneOf(['list', 'grid', 'map']),
  onViewModeChange: PropTypes.func,
  compactLayout: PropTypes.bool,
  onDisplayOptionChange: PropTypes.func,
  reviewsEnabled: PropTypes.bool,
};

export default DivingCentersResponsiveFilterBar;
