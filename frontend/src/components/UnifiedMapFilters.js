import { X, Search, Filter, MapPin, Calendar, Star, Waves, Eye } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const UnifiedMapFilters = ({
  filters,
  onFilterChange,
  selectedEntityType,
  onClose,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Handle multiple value changes (like tag_ids)
  const handleMultiFilterChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Reset all filters
  const resetFilters = () => {
    const resetFilters = {
      search: '',
      difficulty_level: '',
      min_rating: '',
      max_rating: '',
      country: '',
      region: '',
      date_from: '',
      date_to: '',
      depth_min: '',
      depth_max: '',
      visibility_min: '',
      visibility_max: '',
      suit_type: '',
      tag_ids: [],
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    return Object.values(localFilters).filter(
      value =>
        value !== '' &&
        value !== null &&
        value !== undefined &&
        (!Array.isArray(value) || value.length > 0)
    ).length;
  };

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-gray-200'>
        <div className='flex items-center space-x-2'>
          <Filter className='w-5 h-5 text-gray-600' />
          <h2 className='text-lg font-semibold text-gray-900'>Filters</h2>
          {getActiveFilterCount() > 0 && (
            <span className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full'>
              {getActiveFilterCount()}
            </span>
          )}
        </div>
        <button onClick={onClose} className='p-1 hover:bg-gray-100 rounded-lg transition-colors'>
          <X className='w-5 h-5 text-gray-600' />
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4 space-y-6'>

        {/* Search */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            <Search className='w-4 h-4 inline mr-1' />
            Search
          </label>
          <input
            type='text'
            value={localFilters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            placeholder='Search by name, location...'
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          />
        </div>

        {/* Location Filters */}
        <div className='space-y-3'>
          <h3 className='text-sm font-medium text-gray-700 flex items-center'>
            <MapPin className='w-4 h-4 mr-1' />
            Location
          </h3>

          <div>
            <label className='block text-xs text-gray-600 mb-1'>Country</label>
            <input
              type='text'
              value={localFilters.country}
              onChange={e => handleFilterChange('country', e.target.value)}
              placeholder='Enter country'
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          <div>
            <label className='block text-xs text-gray-600 mb-1'>Region</label>
            <input
              type='text'
              value={localFilters.region}
              onChange={e => handleFilterChange('region', e.target.value)}
              placeholder='Enter region'
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
        </div>

        {/* Rating Filters */}
        <div className='space-y-3'>
          <h3 className='text-sm font-medium text-gray-700 flex items-center'>
            <Star className='w-4 h-4 mr-1' />
            Rating
          </h3>

          <div className='grid grid-cols-2 gap-2'>
            <div>
              <label className='block text-xs text-gray-600 mb-1'>Min Rating</label>
              <select
                value={localFilters.min_rating}
                onChange={e => handleFilterChange('min_rating', e.target.value)}
                className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value=''>Any</option>
                <option value='1'>1+ Stars</option>
                <option value='2'>2+ Stars</option>
                <option value='3'>3+ Stars</option>
                <option value='4'>4+ Stars</option>
                <option value='5'>5 Stars</option>
              </select>
            </div>

            <div>
              <label className='block text-xs text-gray-600 mb-1'>Max Rating</label>
              <select
                value={localFilters.max_rating}
                onChange={e => handleFilterChange('max_rating', e.target.value)}
                className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value=''>Any</option>
                <option value='1'>1 Star</option>
                <option value='2'>2 Stars</option>
                <option value='3'>3 Stars</option>
                <option value='4'>4 Stars</option>
                <option value='5'>5 Stars</option>
              </select>
            </div>
          </div>
        </div>

        {/* Difficulty Filter */}
        {(selectedEntityType === 'dive-sites' ||
          selectedEntityType === 'dives') && (
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              <Waves className='w-4 h-4 inline mr-1' />
              Difficulty Level
            </label>
            <select
              value={localFilters.difficulty_level}
              onChange={e => handleFilterChange('difficulty_level', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value=''>Any Difficulty</option>
              <option value='1'>Beginner (1)</option>
              <option value='2'>Easy (2)</option>
              <option value='3'>Intermediate (3)</option>
              <option value='4'>Advanced (4)</option>
              <option value='5'>Expert (5)</option>
            </select>
          </div>
        )}

        {/* Dive-specific Filters */}
        {selectedEntityType === 'dives' && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-gray-700 flex items-center'>
              <Calendar className='w-4 h-4 mr-1' />
              Dive Details
            </h3>

            <div className='grid grid-cols-2 gap-2'>
              <div>
                <label className='block text-xs text-gray-600 mb-1'>Min Depth (m)</label>
                <input
                  type='number'
                  value={localFilters.depth_min}
                  onChange={e => handleFilterChange('depth_min', e.target.value)}
                  placeholder='0'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div>
                <label className='block text-xs text-gray-600 mb-1'>Max Depth (m)</label>
                <input
                  type='number'
                  value={localFilters.depth_max}
                  onChange={e => handleFilterChange('depth_max', e.target.value)}
                  placeholder='100'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-2'>
              <div>
                <label className='block text-xs text-gray-600 mb-1'>Min Visibility (m)</label>
                <input
                  type='number'
                  value={localFilters.visibility_min}
                  onChange={e => handleFilterChange('visibility_min', e.target.value)}
                  placeholder='0'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div>
                <label className='block text-xs text-gray-600 mb-1'>Max Visibility (m)</label>
                <input
                  type='number'
                  value={localFilters.visibility_max}
                  onChange={e => handleFilterChange('visibility_max', e.target.value)}
                  placeholder='50'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs text-gray-600 mb-1'>Suit Type</label>
              <select
                value={localFilters.suit_type}
                onChange={e => handleFilterChange('suit_type', e.target.value)}
                className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value=''>Any</option>
                <option value='wetsuit'>Wetsuit</option>
                <option value='dry_suit'>Dry Suit</option>
                <option value='swimsuit'>Swimsuit</option>
                <option value='none'>No Suit</option>
              </select>
            </div>
          </div>
        )}

        {/* Date Range Filters - Only for Dives */}
        {selectedEntityType === 'dives' && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-gray-700 flex items-center'>
              <Calendar className='w-4 h-4 mr-1' />
              Date Range
            </h3>

            <div>
              <label className='block text-xs text-gray-600 mb-1'>From Date</label>
              <input
                type='date'
                value={localFilters.date_from}
                onChange={e => handleFilterChange('date_from', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <div>
              <label className='block text-xs text-gray-600 mb-1'>To Date</label>
              <input
                type='date'
                value={localFilters.date_to}
                onChange={e => handleFilterChange('date_to', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className='border-t border-gray-200 p-4'>
        <div className='flex space-x-2'>
          <button
            onClick={resetFilters}
            className='flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors'
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className='flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors'
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

UnifiedMapFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  selectedEntityType: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default UnifiedMapFilters;
