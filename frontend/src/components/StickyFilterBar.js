import { Filter, Search, X, ChevronDown, MapPin, Calendar } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

const StickyFilterBar = ({
  searchValue = '',
  onSearchChange = () => {},
  searchPlaceholder = 'Search...',
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  filters = {},
  onFilterChange = () => {},
  className = '',
  variant = 'sticky', // 'sticky', 'floating', 'inline'
  showQuickFilters = true,
  showAdvancedToggle = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const variantClasses = {
    sticky: 'bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40',
    floating: 'bg-white border border-gray-200 rounded-lg shadow-lg',
    inline: 'bg-gray-50 border border-gray-200 rounded-lg',
  };

  const handleToggleFilters = () => {
    setIsExpanded(!isExpanded);
    onToggleFilters();
  };

  const getActiveFilters = () => {
    const active = [];
    if (filters.search_query)
      active.push({ key: 'search', label: 'Search', value: filters.search_query });
    if (filters.start_date)
      active.push({ key: 'start_date', label: 'From', value: filters.start_date });
    if (filters.end_date) active.push({ key: 'end_date', label: 'To', value: filters.end_date });
    if (filters.diving_center_id)
      active.push({ key: 'diving_center_id', label: 'Center', value: filters.diving_center_id });
    if (filters.trip_status)
      active.push({ key: 'trip_status', label: 'Status', value: filters.trip_status });
    if (filters.min_price)
      active.push({ key: 'min_price', label: 'Min Price', value: `€${filters.min_price}` });
    if (filters.max_price)
      active.push({ key: 'max_price', label: 'Max Price', value: `€${filters.max_price}` });
    if (filters.difficulty_level)
      active.push({
        key: 'difficulty_level',
        label: 'Difficulty',
        value: filters.difficulty_level,
      });
    return active;
  };

  const activeFilters = getActiveFilters();

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Main Filter Bar */}
      <div className='flex items-center justify-between p-4'>
        {/* Search Section */}
        <div className='flex-1 max-w-md'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='text'
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => onSearchChange(e.target.value)}
              className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
            />
          </div>
        </div>

        {/* Quick Filters */}
        {showQuickFilters && (
          <div className='flex items-center gap-2 ml-4'>
            {/* Date Range Quick Filter */}
            <button
              onClick={() => onFilterChange('date_range', 'next_week')}
              className='flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors'
              title='Next 7 days'
            >
              <Calendar className='h-4 w-4' />
              <span className='hidden sm:inline'>Next Week</span>
            </button>

            {/* Location Quick Filter */}
            <button
              onClick={() => onFilterChange('location', 'current')}
              className='flex items-center gap-1 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors'
              title='Current location'
            >
              <MapPin className='h-4 w-4' />
              <span className='hidden sm:inline'>Near Me</span>
            </button>
          </div>
        )}

        {/* Filter Actions */}
        <div className='flex items-center gap-3 ml-4'>
          {/* Active Filters Count */}
          {activeFiltersCount > 0 && (
            <div className='flex items-center gap-2'>
              <span className='text-sm text-gray-600'>
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

          {/* Toggle Filters Button */}
          {showAdvancedToggle && (
            <button
              onClick={handleToggleFilters}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className='h-4 w-4' />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <div className='border-t border-gray-200 p-3 bg-blue-50'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-blue-900'>Active Filters:</span>
            <button
              onClick={onClearFilters}
              className='text-sm text-blue-600 hover:text-blue-800 underline'
            >
              Clear All
            </button>
          </div>
          <div className='flex flex-wrap gap-2'>
            {activeFilters.map(filter => (
              <div
                key={filter.key}
                className='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200'
              >
                <span className='font-medium'>{filter.label}:</span>
                <span>{filter.value}</span>
                <button
                  onClick={() => onFilterChange(filter.key, '')}
                  className='ml-1 text-blue-600 hover:text-blue-800 transition-colors'
                  title={`Remove ${filter.label} filter`}
                >
                  <X className='h-3 w-3' />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Filters Section */}
      {showFilters && (
        <div className='border-t border-gray-200 p-4 bg-gray-50'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {/* Date Filters */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Start Date</label>
              <input
                type='date'
                value={filters.start_date || ''}
                onChange={e => onFilterChange('start_date', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>End Date</label>
              <input
                type='date'
                value={filters.end_date || ''}
                onChange={e => onFilterChange('end_date', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>

            {/* Price Filters */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Min Price (€)</label>
              <input
                type='number'
                placeholder='0'
                value={filters.min_price || ''}
                onChange={e => onFilterChange('min_price', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Max Price (€)</label>
              <input
                type='number'
                placeholder='1000'
                value={filters.max_price || ''}
                onChange={e => onFilterChange('max_price', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              />
            </div>

            {/* Status and Difficulty */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Status</label>
              <select
                value={filters.trip_status || ''}
                onChange={e => onFilterChange('trip_status', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              >
                <option value=''>All Statuses</option>
                <option value='scheduled'>Scheduled</option>
                <option value='confirmed'>Confirmed</option>
                <option value='completed'>Completed</option>
                <option value='cancelled'>Cancelled</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Difficulty</label>
              <select
                value={filters.difficulty_level || ''}
                onChange={e => onFilterChange('difficulty_level', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              >
                <option value=''>All Levels</option>
                <option value='1'>Beginner</option>
                <option value='2'>Intermediate</option>
                <option value='3'>Advanced</option>
                <option value='4'>Expert</option>
              </select>
            </div>

            {/* Diving Center Filter */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Diving Center</label>
              <select
                value={filters.diving_center_id || ''}
                onChange={e => onFilterChange('diving_center_id', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
              >
                <option value=''>All Centers</option>
                {filters.diving_centers?.map(center => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Location for Distance Sorting */}
            <div className='md:col-span-2 lg:col-span-4'>
              <div className='p-3 bg-blue-50 rounded-lg border border-blue-200'>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-medium text-blue-700'>
                    Your Location (for distance sorting)
                  </label>
                  <button
                    onClick={() => onFilterChange('get_user_location', '')}
                    className='text-xs text-blue-600 hover:text-blue-800 underline'
                  >
                    Use Current Location
                  </button>
                </div>
                <div className='text-xs text-blue-600'>
                  📍 Set your location to enable distance-based sorting and filtering
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

StickyFilterBar.propTypes = {
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
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
};

export default StickyFilterBar;
