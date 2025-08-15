import { Filter, Search, X, ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

const FilterBar = ({
  children,
  searchValue = '',
  onSearchChange = () => {},
  searchPlaceholder = 'Search...',
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  className = '',
  variant = 'default', // 'default', 'sticky', 'floating'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const variantClasses = {
    default: 'bg-white border border-gray-200 rounded-lg shadow-sm',
    sticky: 'bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40',
    floating: 'bg-white border border-gray-200 rounded-lg shadow-lg',
  };

  const handleToggleFilters = () => {
    setIsExpanded(!isExpanded);
    onToggleFilters();
  };

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
        </div>
      </div>

      {/* Expandable Filters Section */}
      {showFilters && <div className='border-t border-gray-200 p-4 bg-gray-50'>{children}</div>}
    </div>
  );
};

FilterBar.propTypes = {
  children: PropTypes.node,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  showFilters: PropTypes.bool,
  onToggleFilters: PropTypes.func,
  onClearFilters: PropTypes.func,
  activeFiltersCount: PropTypes.number,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'sticky', 'floating']),
};

export default FilterBar;
