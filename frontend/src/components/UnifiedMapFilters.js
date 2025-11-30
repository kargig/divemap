import { X, Search, Filter, MapPin, Calendar, Star, Waves, Wind } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { getSuitabilityLabel } from '../utils/windSuitabilityHelpers';

const UnifiedMapFilters = ({
  filters,
  onFilterChange,
  selectedEntityType,
  onClose,
  divingCenters = [],
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

  // Handle multiple value changes (like tag_ids) - currently unused but kept for future use
  // const handleMultiFilterChange = (key, value) => {
  //   const newFilters = { ...localFilters, [key]: value };
  //   setLocalFilters(newFilters);
  //   onFilterChange(newFilters);
  // };

  // Reset all filters
  const resetFilters = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 14); // 14 days ago
    const endDate = new Date(today);
    endDate.setFullYear(today.getFullYear() + 1); // 1 year ahead

    const resetFilters = {
      search: '',
      difficulty_code: '',
      exclude_unspecified_difficulty: false,
      wind_suitability: '',
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
      // Dive-trips specific filters with default date range
      diving_center_id: '',
      trip_status: '',
      min_price: '',
      max_price: '',
      start_date: selectedEntityType === 'dive-trips' ? startDate.toISOString().split('T')[0] : '',
      end_date: selectedEntityType === 'dive-trips' ? endDate.toISOString().split('T')[0] : '',
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
          <label htmlFor='search-input' className='block text-sm font-medium text-gray-700 mb-2'>
            <Search className='w-4 h-4 inline mr-1' />
            Search
          </label>
          <input
            id='search-input'
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
            <label htmlFor='country-input' className='block text-xs text-gray-600 mb-1'>
              Country
            </label>
            <input
              id='country-input'
              type='text'
              value={localFilters.country}
              onChange={e => handleFilterChange('country', e.target.value)}
              placeholder='Enter country'
              className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            />
          </div>

          <div>
            <label htmlFor='region-input' className='block text-xs text-gray-600 mb-1'>
              Region
            </label>
            <input
              id='region-input'
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
              <label htmlFor='min-rating-select' className='block text-xs text-gray-600 mb-1'>
                Min Rating
              </label>
              <select
                id='min-rating-select'
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
              <label htmlFor='max-rating-select' className='block text-xs text-gray-600 mb-1'>
                Max Rating
              </label>
              <select
                id='max-rating-select'
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

        {/* Wind Suitability Filter - Only for Dive Sites */}
        {selectedEntityType === 'dive-sites' && (
          <div>
            <label
              htmlFor='wind-suitability-select'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              <Wind className='w-4 h-4 inline mr-1' />
              Wind Suitability
            </label>
            <select
              id='wind-suitability-select'
              value={localFilters.wind_suitability || ''}
              onChange={e => handleFilterChange('wind_suitability', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value=''>All Conditions</option>
              <option value='good'>Good Conditions</option>
              <option value='caution'>Caution</option>
              <option value='difficult'>Difficult</option>
              <option value='avoid'>Avoid</option>
              <option value='unknown'>Unknown</option>
            </select>
            <p className='text-xs text-gray-500 mt-1'>
              Filter dive sites by current wind conditions suitability
            </p>
          </div>
        )}

        {/* Difficulty Filter */}
        {(selectedEntityType === 'dive-sites' || selectedEntityType === 'dives') && (
          <div>
            <label
              htmlFor='difficulty-select'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              <Waves className='w-4 h-4 inline mr-1' />
              Difficulty Level
            </label>
            <select
              id='difficulty-select'
              value={localFilters.difficulty_code || ''}
              onChange={e => handleFilterChange('difficulty_code', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value=''>Any Difficulty</option>
              {getDifficultyOptions()
                .filter(option => option.value !== null) // Exclude "Unspecified" from the dropdown
                .map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
            <label className='flex items-center mt-2'>
              <input
                type='checkbox'
                checked={localFilters.exclude_unspecified_difficulty ?? false}
                onChange={e =>
                  handleFilterChange('exclude_unspecified_difficulty', e.target.checked)
                }
                className='mr-2'
              />
              <span className='text-sm text-gray-600'>Exclude Unspecified</span>
            </label>
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
                <label htmlFor='depth-min-input' className='block text-xs text-gray-600 mb-1'>
                  Min Depth (m)
                </label>
                <input
                  id='depth-min-input'
                  type='number'
                  value={localFilters.depth_min}
                  onChange={e => handleFilterChange('depth_min', e.target.value)}
                  placeholder='0'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div>
                <label htmlFor='depth-max-input' className='block text-xs text-gray-600 mb-1'>
                  Max Depth (m)
                </label>
                <input
                  id='depth-max-input'
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
                <label htmlFor='visibility-min-input' className='block text-xs text-gray-600 mb-1'>
                  Min Visibility (m)
                </label>
                <input
                  id='visibility-min-input'
                  type='number'
                  value={localFilters.visibility_min}
                  onChange={e => handleFilterChange('visibility_min', e.target.value)}
                  placeholder='0'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div>
                <label htmlFor='visibility-max-input' className='block text-xs text-gray-600 mb-1'>
                  Max Visibility (m)
                </label>
                <input
                  id='visibility-max-input'
                  type='number'
                  value={localFilters.visibility_max}
                  onChange={e => handleFilterChange('visibility_max', e.target.value)}
                  placeholder='50'
                  className='w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>
            </div>

            <div>
              <label htmlFor='suit-type-select' className='block text-xs text-gray-600 mb-1'>
                Suit Type
              </label>
              <select
                id='suit-type-select'
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
              <label htmlFor='date-from-input' className='block text-xs text-gray-600 mb-1'>
                From Date
              </label>
              <input
                id='date-from-input'
                type='date'
                value={localFilters.date_from}
                onChange={e => handleFilterChange('date_from', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>

            <div>
              <label htmlFor='date-to-input' className='block text-xs text-gray-600 mb-1'>
                To Date
              </label>
              <input
                id='date-to-input'
                type='date'
                value={localFilters.date_to}
                onChange={e => handleFilterChange('date_to', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
          </div>
        )}

        {/* Dive-trips specific filters */}
        {selectedEntityType === 'dive-trips' && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium text-gray-700 flex items-center'>
              <MapPin className='w-4 h-4 mr-1' />
              Trip Filters
            </h3>

            {/* Diving Center Filter */}
            <div>
              <label htmlFor='diving-center-select' className='block text-xs text-gray-600 mb-1'>
                Diving Center
              </label>
              <select
                id='diving-center-select'
                value={localFilters.diving_center_id || ''}
                onChange={e => handleFilterChange('diving_center_id', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value=''>All Centers</option>
                {divingCenters.map(center => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trip Status Filter */}
            <div>
              <label htmlFor='trip-status-select' className='block text-xs text-gray-600 mb-1'>
                Trip Status
              </label>
              <select
                id='trip-status-select'
                value={localFilters.trip_status || ''}
                onChange={e => handleFilterChange('trip_status', e.target.value)}
                className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              >
                <option value=''>All Statuses</option>
                <option value='scheduled'>Scheduled</option>
                <option value='confirmed'>Confirmed</option>
                <option value='cancelled'>Cancelled</option>
                <option value='completed'>Completed</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className='block text-xs text-gray-600 mb-1'>Trip Date Range</label>
              <div className='space-y-2'>
                <input
                  type='date'
                  value={localFilters.start_date || ''}
                  onChange={e => handleFilterChange('start_date', e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Start Date'
                />
                <input
                  type='date'
                  value={localFilters.end_date || ''}
                  onChange={e => handleFilterChange('end_date', e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='End Date'
                />
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className='block text-xs text-gray-600 mb-1'>Price Range (EUR)</label>
              <div className='space-y-2'>
                <input
                  type='number'
                  value={localFilters.min_price || ''}
                  onChange={e => handleFilterChange('min_price', e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Min Price'
                  min='0'
                />
                <input
                  type='number'
                  value={localFilters.max_price || ''}
                  onChange={e => handleFilterChange('max_price', e.target.value)}
                  className='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Max Price'
                  min='0'
                />
              </div>
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
  divingCenters: PropTypes.array,
};

export default UnifiedMapFilters;
