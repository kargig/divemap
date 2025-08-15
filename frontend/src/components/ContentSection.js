import PropTypes from 'prop-types';
import React from 'react';

const ContentSection = ({
  children,
  maxWidth = '6xl',
  padding = 'default',
  background = 'white',
  className = '',
  ...props
}) => {
  const maxWidthClasses = {
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  const paddingClasses = {
    none: '',
    small: 'px-4 py-6',
    default: 'px-6 py-8',
    large: 'px-8 py-12',
    xlarge: 'px-8 py-16',
  };

  const backgroundClasses = {
    white: 'bg-white',
    gray: 'bg-gray-50',
    blue: 'bg-blue-50',
    transparent: 'bg-transparent',
  };

  return (
    <section
      className={`${maxWidthClasses[maxWidth]} mx-auto ${paddingClasses[padding]} ${backgroundClasses[background]} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
};

ContentSection.propTypes = {
  children: PropTypes.node.isRequired,
  maxWidth: PropTypes.oneOf(['4xl', '5xl', '6xl', '7xl', 'full']),
  padding: PropTypes.oneOf(['none', 'small', 'default', 'large', 'xlarge']),
  background: PropTypes.oneOf(['white', 'gray', 'blue', 'transparent']),
  className: PropTypes.string,
};

export default ContentSection;
