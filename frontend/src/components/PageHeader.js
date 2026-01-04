import PropTypes from 'prop-types';
import React from 'react';

import Breadcrumbs from './Breadcrumbs';

/**
 * PageHeader Component
 *
 * A functional header for internal utility pages (Dives, Dive Sites, etc.)
 * that replaces marketing-heavy heroes.
 */
const PageHeader = ({ title, breadcrumbItems = [], actions = [], className = '' }) => {
  return (
    <div className={`mb-8 ${className}`}>
      {/* Navigation Context */}
      {breadcrumbItems.length > 0 && <Breadcrumbs items={breadcrumbItems} />}

      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6'>
        {/* Title Group */}
        <div className='flex-1 min-w-0'>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>{title}</h1>
        </div>

        {/* Action Toolbar */}
        <div className='flex flex-wrap items-center gap-3'>
          {actions.map((action, index) => {
            const { label, onClick, to, icon: Icon, variant = 'primary', ariaLabel } = action;

            const baseClasses =
              'inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-200 active:scale-95 shadow-sm';
            const variants = {
              primary: 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md',
              secondary:
                'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:shadow-md',
              ghost:
                'bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700 shadow-none',
            };

            const className = `${baseClasses} ${variants[variant] || variants.primary}`;

            if (onClick) {
              return (
                <button
                  key={index}
                  onClick={onClick}
                  className={className}
                  aria-label={ariaLabel || label}
                >
                  {Icon && <Icon className='w-5 h-5' />}
                  <span>{label}</span>
                </button>
              );
            }

            if (to) {
              return (
                <a key={index} href={to} className={className} aria-label={ariaLabel || label}>
                  {Icon && <Icon className='w-5 h-5' />}
                  <span>{label}</span>
                </a>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  breadcrumbItems: PropTypes.array,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
      to: PropTypes.string,
      icon: PropTypes.elementType,
      variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
      ariaLabel: PropTypes.string,
    })
  ),
  className: PropTypes.string,
};

export default PageHeader;
