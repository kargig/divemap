import { Filter, X, ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

const DivingCentersFilterBar = ({
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  filters = {},
  onFilterChange = () => {},
  className = '',
  variant = 'sticky', // 'sticky', 'floating', 'inline'
  showAdvancedToggle = true,
  mobileOptimized = false,
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

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Main Filter Bar */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${mobileOptimized ? 'p-3 sm:p-4' : 'p-4'}`}
      >
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
              className={`flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
                showFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              <Filter className='h-4 w-4' />
              <span className='text-sm font-medium'>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <div className='border-t border-gray-200 py-2 px-3 bg-blue-50'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1.5'>
            <span className='text-xs font-medium text-blue-900 text-center sm:text-left'>
              Active Filters:
            </span>
            <button
              onClick={onClearFilters}
              className='text-xs text-blue-600 hover:text-blue-800 active:text-blue-900 underline min-h-[44px] sm:min-h-0 touch-manipulation px-3 py-2 sm:px-0 sm:py-0 rounded-lg sm:rounded-none hover:bg-blue-100 sm:hover:bg-transparent transition-colors'
            >
              Clear All
            </button>
          </div>
          <div className='flex flex-wrap gap-1 justify-center sm:justify-start'>
            {activeFilters.map(filter => (
              <div
                key={filter.key}
                className='inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full border border-blue-200'
              >
                <span className='font-medium'>{filter.label}:</span>
                <span>{filter.value}</span>
                <button
                  onClick={() => onFilterChange(filter.key, '')}
                  className='ml-1 text-blue-600 hover:text-blue-800 active:text-blue-900 transition-colors p-0.5 rounded-full hover:bg-blue-200 active:bg-blue-300 min-h-[32px] sm:min-h-0 touch-manipulation'
                  title={`Remove ${filter.label} filter`}
                >
                  <X className='h-2.5 w-2.5' />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Filters Section */}
      {showFilters && (
        <div className='border-t border-gray-200 p-3 sm:p-4 bg-gray-50'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
            {/* Min Rating Filter */}
            <div>
              <label
                htmlFor='min-rating-filter'
                className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'
              >
                Min Rating (≥)
              </label>
              <input
                id='min-rating-filter'
                type='number'
                min='0'
                max='10'
                step='0.1'
                placeholder='Show centers rated ≥ this value'
                value={filters.min_rating || ''}
                onChange={e => onFilterChange('min_rating', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* Country Filter */}
            <div>
              <label
                htmlFor='country-filter'
                className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'
              >
                Country
              </label>
              <input
                id='country-filter'
                type='text'
                placeholder='Enter country name'
                value={filters.country || ''}
                onChange={e => onFilterChange('country', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* Region Filter */}
            <div>
              <label
                htmlFor='region-filter'
                className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'
              >
                Region
              </label>
              <input
                id='region-filter'
                type='text'
                placeholder='Enter region name'
                value={filters.region || ''}
                onChange={e => onFilterChange('region', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* City Filter */}
            <div>
              <label
                htmlFor='city-filter'
                className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'
              >
                City
              </label>
              <input
                id='city-filter'
                type='text'
                placeholder='Enter city name'
                value={filters.city || ''}
                onChange={e => onFilterChange('city', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DivingCentersFilterBar.propTypes = {
  showFilters: PropTypes.bool,
  onToggleFilters: PropTypes.func,
  onClearFilters: PropTypes.func,
  activeFiltersCount: PropTypes.number,
  filters: PropTypes.object,
  onFilterChange: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['sticky', 'floating', 'inline']),
  showAdvancedToggle: PropTypes.bool,
  mobileOptimized: PropTypes.bool,
};

export default DivingCentersFilterBar;
