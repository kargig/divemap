import { Share2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import ShareModal from './ShareModal';
import Button from './ui/Button';

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

  // Map internal variant to Button props
  const getButtonProps = () => {
    switch (variant) {
      case 'icon-only':
        return { variant: 'secondary', size: 'md', className: `px-2 ${className}` };
      case 'small':
        return { variant: 'secondary', size: 'xs', className };
      case 'default':
      default:
        return { variant: 'secondary', size: 'md', className };
    }
  };

  // Default button content
  const defaultContent = (
    <>
      <Share2 className={`w-4 h-4 ${variant === 'icon-only' ? '' : 'mr-1.5'}`} />
      {variant !== 'icon-only' && <span>Share</span>}
    </>
  );

  return (
    <>
      <Button onClick={handleClick} aria-label={`Share ${entityType}`} {...getButtonProps()}>
        {children || defaultContent}
      </Button>

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
