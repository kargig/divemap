import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const SortingControls = ({
  sortBy,
  sortOrder,
  sortOptions,
  onSortChange,
  onSortApply,
  className = '',
}) => {
  const [pendingSortBy, setPendingSortBy] = useState(sortBy);
  const [pendingSortOrder, setPendingSortOrder] = useState(sortOrder);

  // Update pending values when props change
  useEffect(() => {
    setPendingSortBy(sortBy);
    setPendingSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

  const handleSortFieldChange = e => {
    const newSortBy = e.target.value;
    // Find the default order for this field, or use current order
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
    // Find the first option and use its default order
    const firstOption = sortOptions[0];
    if (firstOption) {
      const defaultSortBy = firstOption.value;
      const defaultSortOrder = firstOption.defaultOrder || 'asc';
      setPendingSortBy(defaultSortBy);
      setPendingSortOrder(defaultSortOrder);
      onSortChange(defaultSortBy, defaultSortOrder);
    }
  };

  const handleApplySort = () => {
    onSortApply(pendingSortBy, pendingSortOrder);
  };

  // Get current sort option for display
  const currentSortOption = sortOptions.find(opt => opt.value === sortBy);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border shadow-sm ${className}`}
    >
      {/* Sort Field Selection */}
      <div className='flex items-center gap-2'>
        <label htmlFor='sort-by' className='text-sm font-medium text-gray-700 whitespace-nowrap'>
          Sort by:
        </label>
        <select
          id='sort-by'
          value={pendingSortBy || ''}
          onChange={handleSortFieldChange}
          className='px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sort Order Toggle */}
      <button
        onClick={handleSortOrderToggle}
        className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
        title={`Sort ${pendingSortOrder === 'asc' ? 'ascending' : 'descending'}`}
      >
        {pendingSortOrder === 'asc' ? (
          <>
            <ChevronUp className='w-4 h-4' />
            Ascending
          </>
        ) : (
          <>
            <ChevronDown className='w-4 h-4' />
            Descending
          </>
        )}
      </button>

      {/* Sort Button */}
      <button
        onClick={handleApplySort}
        className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
        title='Apply sorting'
      >
        <span>Sort</span>
      </button>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
        title='Reset to default sorting'
      >
        <RotateCcw className='w-4 h-4' />
        Reset
      </button>

      {/* Current Sort Display */}
      {currentSortOption && (
        <div className='flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md'>
          <span className='font-medium'>Current:</span>
          <span>{currentSortOption.label}</span>
          <span className='text-blue-500'>{sortOrder === 'asc' ? '↑' : '↓'}</span>
        </div>
      )}
    </div>
  );
};

SortingControls.propTypes = {
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.string.isRequired,
  sortOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      defaultOrder: PropTypes.string,
    })
  ).isRequired,
  onSortChange: PropTypes.func.isRequired,
  onSortApply: PropTypes.func.isRequired,
  onReset: PropTypes.func,
  entityType: PropTypes.string,
  className: PropTypes.string,
};

SortingControls.defaultProps = {
  onReset: () => {},
  entityType: 'default',
  className: '',
};

export default SortingControls;
