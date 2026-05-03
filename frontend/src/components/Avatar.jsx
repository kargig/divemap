import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

import { resolveAvatarUrl } from '../utils/avatarHelpers';

const Avatar = ({
  src,
  alt,
  size = 'md',
  className = '',
  fallbackText = null,
  username = null,
  shape = 'circle',
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state if the src prop changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const shapeClass =
    shape === 'circle' ? 'rounded-full' : shape === 'square' ? 'rounded-none' : 'rounded-xl';

  const baseClasses = `${shapeClass} flex items-center justify-center font-semibold text-white bg-gray-500 flex-shrink-0`;
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Generate initials from available text props
  const getInitials = () => {
    const text = fallbackText || username || alt || '';
    return text
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Default avatar background colors
  const getBackgroundColor = () => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const text = fallbackText || username || alt || '';
    const hash = text.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  if (src && !hasError) {
    return (
      <img
        src={resolveAvatarUrl(src)}
        alt={alt}
        className={`${sizeClass} ${shapeClass} object-cover flex-shrink-0 ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClass} ${baseClasses} ${getBackgroundColor()} ${className}`}>
      {getInitials()}
    </div>
  );
};

Avatar.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),
  shape: PropTypes.oneOf(['circle', 'square', 'rounded']),
  className: PropTypes.string,
  fallbackText: PropTypes.string,
  username: PropTypes.string,
};

export default Avatar;
