import { ChevronDown, Filter } from 'lucide-react';
import PropTypes from 'prop-types';

const CollapsibleFilters = ({
  title = 'Advanced Filters',
  isOpen = false,
  onToggle = () => {},
  children,
  className = '',
  variant = 'default', // 'default', 'compact', 'minimal'
  showToggle = true,
}) => {
  const variantClasses = {
    default: 'bg-white border border-gray-200 rounded-lg shadow-sm',
    compact: 'bg-gray-50 border border-gray-200 rounded-md',
    minimal: 'bg-transparent border-b border-gray-200',
  };

  const headerClasses = {
    default: 'p-4',
    compact: 'p-3',
    minimal: 'py-3',
  };

  const contentClasses = {
    default: 'px-4 pb-4',
    compact: 'px-3 pb-3',
    minimal: 'pb-3',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Header */}
      <div className={`${headerClasses[variant]} ${isOpen ? 'border-b border-gray-200' : ''}`}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Filter className='h-5 w-5 text-gray-600' />
            <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
          </div>

          {showToggle && (
            <button
              onClick={onToggle}
              className='flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors'
            >
              {isOpen ? 'Hide Filters' : 'Show Filters'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && <div className={contentClasses[variant]}>{children}</div>}
    </div>
  );
};

CollapsibleFilters.propTypes = {
  title: PropTypes.string,
  isOpen: PropTypes.bool,
  onToggle: PropTypes.func,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'compact', 'minimal']),
  showToggle: PropTypes.bool,
};

export default CollapsibleFilters;
