import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const ActiveFilters = ({
  filters = [],
  onRemoveFilter = () => {},
  onClearAll = () => {},
  className = '',
  variant = 'default', // 'default', 'compact', 'inline'
}) => {
  if (filters.length === 0) return null;

  const variantClasses = {
    default: 'p-3 bg-blue-50 border border-blue-200 rounded-lg',
    compact: 'p-2 bg-gray-50 border border-gray-200 rounded-md',
    inline: 'flex flex-wrap gap-2',
  };

  const chipClasses = {
    default:
      'inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200',
    compact:
      'inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200',
    inline:
      'inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between mb-3'>
        <span className='text-sm font-medium text-gray-700'>Active Filters ({filters.length})</span>
        {filters.length > 1 && (
          <button
            onClick={onClearAll}
            className='text-sm text-blue-600 hover:text-blue-800 underline'
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className='flex flex-wrap gap-2'>
        {filters.map(filter => (
          <div key={filter.key} className={chipClasses[variant]}>
            <span className='font-medium'>{filter.label}:</span>
            <span>{filter.value}</span>
            <button
              onClick={() => onRemoveFilter(filter.key)}
              className='ml-1 text-gray-500 hover:text-gray-700 transition-colors'
              title={`Remove ${filter.label} filter`}
            >
              <X className='h-3 w-3' />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

ActiveFilters.propTypes = {
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ),
  onRemoveFilter: PropTypes.func,
  onClearAll: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'compact', 'inline']),
};

export default ActiveFilters;
