import { Share2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import ShareModal from './ShareModal';

/**
 * ShareButton Component
 *
 * Reusable share button that opens the ShareModal when clicked.
 * Handles different entity types (dive, dive-site, route).
 *
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route'
 * @param {object} entityData - Entity data (id, name, description, etc.)
 * @param {object} additionalParams - Additional URL parameters (optional)
 * @param {string} className - Additional CSS classes
 * @param {string} variant - Button variant: 'default', 'icon-only', 'small'
 * @param {object} children - Custom button content (optional)
 */
const ShareButton = ({
  entityType,
  entityData,
  additionalParams = {},
  className = '',
  variant = 'default',
  children,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!entityData) {
      console.error('ShareButton: entityData is required');
      return;
    }
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  // Default button styles based on variant
  const getButtonClassName = () => {
    const baseClass = 'flex items-center transition-colors';

    switch (variant) {
      case 'icon-only':
        return `${baseClass} px-2 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md ${className}`;
      case 'small':
        return `${baseClass} px-2 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md ${className}`;
      case 'default':
      default:
        return `${baseClass} px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md ${className}`;
    }
  };

  // Default button content
  const defaultContent = (
    <>
      <Share2 className='w-4 h-4 mr-1' />
      <span>Share</span>
    </>
  );

  return (
    <>
      <button
        onClick={handleClick}
        className={getButtonClassName()}
        aria-label={`Share ${entityType}`}
      >
        {children || defaultContent}
      </button>

      <ShareModal
        isOpen={isModalOpen}
        onClose={handleClose}
        entityType={entityType}
        entityData={entityData}
        additionalParams={additionalParams}
      />
    </>
  );
};

ShareButton.propTypes = {
  entityType: PropTypes.oneOf(['dive', 'dive-site', 'route']).isRequired,
  entityData: PropTypes.object.isRequired,
  additionalParams: PropTypes.object,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['default', 'icon-only', 'small']),
  children: PropTypes.node,
};

export default ShareButton;
