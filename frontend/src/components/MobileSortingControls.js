import { ChevronDown, ChevronUp, RotateCcw, SortAsc, SortDesc } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const MobileSortingControls = ({
  sortBy,
  sortOrder,
  sortOptions,
  onSortChange,
  onSortApply,
  onReset,
  className = '',
  entityType = '',
}) => {
  const [pendingSortBy, setPendingSortBy] = useState(sortBy);
  const [pendingSortOrder, setPendingSortOrder] = useState(sortOrder);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update pending values when props change
  useEffect(() => {
    setPendingSortBy(sortBy);
    setPendingSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

  const handleSortFieldChange = newSortBy => {
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
      onReset();
    }
  };

  const handleApplySort = () => {
    onSortApply(pendingSortBy, pendingSortOrder);
    setIsExpanded(false); // Collapse after applying
  };

  // Get current sort option for display
  const currentSortOption = sortOptions.find(opt => opt.value === sortBy);
  const currentSortLabel = currentSortOption ? currentSortOption.label : 'Default';

  // Get display text for sort order
  const getSortOrderText = order => {
    return order === 'asc' ? 'Ascending' : 'Descending';
  };

  // Get icon for sort order
  const getSortOrderIcon = order => {
    return order === 'asc' ? <SortAsc className='w-4 h-4' /> : <SortDesc className='w-4 h-4' />;
  };

  return (
    <div className={`mobile-sort-controls ${className}`}>
      {/* Collapsible Toggle Button */}
      <button
        className='sort-toggle-btn'
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`Sorting controls - currently sorted by ${currentSortLabel} ${getSortOrderText(sortOrder)}`}
      >
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium'>Sort by: {currentSortLabel}</span>
          <span className='text-xs text-gray-500'>({getSortOrderText(sortOrder)})</span>
        </div>
        <ChevronDown className={`chevron ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Collapsible Sort Options */}
      {isExpanded && (
        <div className='sort-options'>
          {/* Sort Field Selection */}
          <div className='mb-4'>
            <h4 className='text-sm font-medium text-gray-700 mb-3'>Sort Field</h4>
            <div className='space-y-2'>
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleSortFieldChange(option.value)}
                  className={`sort-option w-full text-left ${
                    pendingSortBy === option.value ? 'active' : ''
                  }`}
                  aria-label={`Sort by ${option.label}`}
                >
                  <span className='sort-label'>{option.label}</span>
                  {pendingSortBy === option.value && (
                    <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Order Toggle */}
          <div className='mb-4'>
            <h4 className='text-sm font-medium text-gray-700 mb-3'>Sort Order</h4>
            <button
              onClick={handleSortOrderToggle}
              className='sort-option w-full text-left'
              aria-label={`Change sort order to ${pendingSortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              <span className='sort-label'>
                {getSortOrderIcon(pendingSortOrder)}
                {getSortOrderText(pendingSortOrder)}
              </span>
              <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
            </button>
          </div>

          {/* Action Buttons */}
          <div className='flex gap-2 pt-3 border-t border-gray-200'>
            <button
              onClick={handleApplySort}
              className='flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
              aria-label='Apply sorting changes'
            >
              Apply Sort
            </button>
            <button
              onClick={handleReset}
              className='flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-md text-sm font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors'
              aria-label='Reset to default sorting'
            >
              <RotateCcw className='w-4 h-4' />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

MobileSortingControls.propTypes = {
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.oneOf(['asc', 'desc']).isRequired,
  sortOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      defaultOrder: PropTypes.oneOf(['asc', 'desc']),
      adminOnly: PropTypes.bool,
    })
  ).isRequired,
  onSortChange: PropTypes.func.isRequired,
  onSortApply: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  className: PropTypes.string,
  entityType: PropTypes.string,
};

export default MobileSortingControls;
