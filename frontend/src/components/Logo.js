import PropTypes from 'prop-types';
import React from 'react';

const Logo = ({
  size = 'medium',
  className = '',
  showText = true,
  textClassName = '',
  textOnly = false,
}) => {
  const sizeClasses = {
    small: 'h-10 w-10',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16',
    hero: 'h-20 w-20 sm:h-24 sm:w-24',
    'hero-large': 'h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40',
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl',
    xlarge: 'text-2xl',
    hero: 'text-3xl',
    'hero-large': 'text-4xl',
  };

  const getLogoSrc = size => {
    switch (size) {
      case 'small':
        return '/divemap_navbar_logo.png';
      case 'medium':
        return '/divemap-logo-medium.png';
      case 'large':
      case 'xlarge':
        return '/divemap-logo-medium.png';
      case 'hero':
        return '/divemap-logo-hero.png';
      case 'hero-large':
        return '/divemap-logo-hero-large.png';
      default:
        return '/divemap-logo-medium.png';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {!textOnly && (
        <img
          src={getLogoSrc(size)}
          alt='Divemap Logo'
          className={`${sizeClasses[size]} drop-shadow-sm`}
          onError={(e) => {
            console.error('Logo image failed to load:', e.target.src);
            e.target.style.display = 'none';
          }}
          onLoad={() => {
            console.log('Logo image loaded successfully:', getLogoSrc(size));
          }}
        />
      )}
      {showText && (
        <span className={`font-bold text-blue-600 ${textSizeClasses[size]} ${textClassName}`}>
          Divemap
        </span>
      )}
    </div>
  );
};

Logo.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge', 'hero', 'hero-large']),
  className: PropTypes.string,
  showText: PropTypes.bool,
  textClassName: PropTypes.string,
  textOnly: PropTypes.bool,
};

export default Logo;
