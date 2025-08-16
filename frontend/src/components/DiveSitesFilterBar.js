import { Filter, X, ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

const DiveSitesFilterBar = ({
  showFilters = false,
  onToggleFilters = () => {},
  onClearFilters = () => {},
  activeFiltersCount = 0,
  filters = {},
  onFilterChange = () => {},
  onQuickFilter = () => {},
  quickFilter = '',
  className = '',
  variant = 'sticky', // 'sticky', 'floating', 'inline'
  showQuickFilters = true,
  showAdvancedToggle = true,
  mobileOptimized = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Tag color function - same as in Dives.js
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
    if (filters.tag_ids && filters.tag_ids.length > 0)
      active.push({ key: 'tag_ids', label: 'Tags', value: `${filters.tag_ids.length} selected` });
    return active;
  };

  const activeFilters = getActiveFilters();

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Main Filter Bar */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${mobileOptimized ? 'p-3 sm:p-4' : 'p-4'}`}
      >
        {/* Quick Filters */}
        {showQuickFilters && (
          <div className='flex items-center gap-2 sm:ml-2 w-full sm:w-auto justify-center sm:justify-end'>
            <button
              onClick={() => onQuickFilter('wrecks')}
              className={`flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
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
              className={`flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
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
              className={`flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
                quickFilter === 'boat_dive'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
              }`}
              title='Boat dive sites'
            >
              🚤 <span className='hidden sm:inline'>Boat Dive</span>
            </button>
            <button
              onClick={() => onQuickFilter('shore_dive')}
              className={`flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
                quickFilter === 'shore_dive'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
              }`}
              title='Shore dive sites'
            >
              🏖️ <span className='hidden sm:inline'>Shore Dive</span>
            </button>
            {filters.user && (
              <button
                onClick={() => onQuickFilter('my_sites')}
                className={`flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation ${
                  quickFilter === 'my_sites'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 active:bg-gray-200'
                }`}
                title='My dive sites'
              >
                👤 <span className='hidden sm:inline'>My Sites</span>
              </button>
            )}
            {quickFilter && (
              <button
                onClick={() => onQuickFilter('clear')}
                className='flex items-center gap-1 px-3 py-2.5 sm:py-2 text-sm rounded-md transition-colors min-h-[44px] sm:min-h-0 touch-manipulation bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:bg-red-200'
                title='Clear quick filter'
              >
                <X className='h-4 w-4' />
                <span className='hidden sm:inline'>Clear</span>
              </button>
            )}
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
        <div className='border-t border-gray-200 p-3 sm:p-4 bg-blue-50'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-2'>
            <span className='text-sm font-medium text-blue-900 text-center sm:text-left'>
              Active Filters:
            </span>
            <button
              onClick={onClearFilters}
              className='text-sm text-blue-600 hover:text-blue-800 active:text-blue-900 underline min-h-[44px] sm:min-h-0 touch-manipulation px-3 py-2 sm:px-0 sm:py-0 rounded-lg sm:rounded-none hover:bg-blue-100 sm:hover:bg-transparent transition-colors'
            >
              Clear All
            </button>
          </div>
          <div className='flex flex-wrap gap-2 justify-center sm:justify-start'>
            {activeFilters.map(filter => (
              <div
                key={filter.key}
                className='inline-flex items-center gap-2 px-3 py-2 sm:py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200'
              >
                <span className='font-medium'>{filter.label}:</span>
                <span>{filter.value}</span>
                <button
                  onClick={() => onFilterChange(filter.key, '')}
                  className='ml-1 text-blue-600 hover:text-blue-800 active:text-blue-900 transition-colors p-1 rounded-full hover:bg-blue-200 active:bg-blue-300 min-h-[32px] sm:min-h-0 touch-manipulation'
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
        <div className='border-t border-gray-200 p-3 sm:p-4 bg-gray-50'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
            {/* Difficulty Level Filter */}
            <div>
              <label className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'>
                Difficulty Level
              </label>
              <select
                value={filters.difficulty_level || ''}
                onChange={e => onFilterChange('difficulty_level', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
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
              <label className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'>
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
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* Country Filter */}
            <div>
              <label className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'>
                Country
              </label>
              <input
                type='text'
                placeholder='Enter country name'
                value={filters.country || ''}
                onChange={e => onFilterChange('country', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* Region Filter */}
            <div>
              <label className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'>
                Region
              </label>
              <input
                type='text'
                placeholder='Enter region name'
                value={filters.region || ''}
                onChange={e => onFilterChange('region', e.target.value)}
                className='w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px] sm:min-h-0 touch-manipulation'
              />
            </div>

            {/* Tags Filter */}
            {filters.availableTags && filters.availableTags.length > 0 && (
              <div className='md:col-span-2 lg:col-span-3'>
                <label className='block text-xs sm:text-sm font-medium text-gray-700 mb-2'>
                  Tags
                </label>
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
      )}
    </div>
  );
};

DiveSitesFilterBar.propTypes = {
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
  mobileOptimized: PropTypes.bool,
};

export default DiveSitesFilterBar;
