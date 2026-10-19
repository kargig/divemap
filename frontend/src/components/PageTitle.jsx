import PropTypes from 'prop-types';
import React from 'react';

/**
 * PageTitle Component
 *
 * The standardized H1 for the entire application.
 * Uses the 'Outfit' display font and maintains consistent responsive sizing.
 */
const PageTitle = ({ children, icon: Icon, badge, className = '' }) => {
  return (
    <h1
      className={`text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-2 sm:gap-3 ${className}`}
    >
      <div className='flex items-center gap-2 sm:gap-3'>
        {Icon && (
          <Icon
            className='w-6 h-6 sm:w-8 sm:h-8 text-gray-700 dark:text-slate-300'
            aria-hidden='true'
          />
        )}
        <span>{children}</span>
      </div>
      {badge !== undefined && badge !== null && badge !== '' && (
        <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50 transition-all duration-300'>
          {typeof badge === 'number' ? badge.toLocaleString() : badge}
        </span>
      )}
    </h1>
  );
};

PageTitle.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
};

export default PageTitle;
