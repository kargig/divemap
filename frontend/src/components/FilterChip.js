import { X } from 'lucide-react';
import PropTypes from 'prop-types';

const FilterChip = ({
  filter,
  onRemove,
  variant = 'default', // 'default', 'compact', 'inline'
  className = '',
}) => {
  const variantClasses = {
    default:
      'inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200',
    compact:
      'inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200',
    inline:
      'inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-200',
  };

  const iconClasses = {
    default: 'h-3 w-3',
    compact: 'h-2.5 w-2.5',
    inline: 'h-2.5 w-2.5',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      <span className='font-medium'>{filter.label}:</span>
      <span className='truncate max-w-24'>{filter.value}</span>
      <button
        onClick={() => onRemove(filter.key)}
        className='ml-1 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0'
        title={`Remove ${filter.label} filter`}
      >
        <X className={iconClasses[variant]} />
      </button>
    </div>
  );
};

FilterChip.propTypes = {
  filter: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['default', 'compact', 'inline']),
  className: PropTypes.string,
};

export default FilterChip;
