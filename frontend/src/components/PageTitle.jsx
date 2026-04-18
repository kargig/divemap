import React from 'react';
import PropTypes from 'prop-types';

/**
 * PageTitle Component
 * 
 * The standardized H1 for the entire application.
 * Uses the 'Outfit' display font and maintains consistent responsive sizing.
 */
const PageTitle = ({ children, icon: Icon, className = '' }) => {
  return (
    <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 tracking-tight flex items-center gap-2 sm:gap-3 ${className}`}>
      {Icon && (
        <Icon className='w-6 h-6 sm:w-8 sm:h-8 text-gray-700' aria-hidden='true' />
      )}
      <span>{children}</span>
    </h1>
  );
};

PageTitle.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  className: PropTypes.string,
};

export default PageTitle;
