import PropTypes from 'prop-types';

const Avatar = ({ src, alt, size = 'md', className = '', fallbackText = null }) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const baseClasses =
    'rounded-full flex items-center justify-center font-semibold text-white bg-gray-500';
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Generate initials from alt text or fallback text
  const getInitials = () => {
    const text = fallbackText || alt || '';
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
    const text = fallbackText || alt || '';
    const hash = text.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} ${baseClasses} ${className}`}
        onError={e => {
          // If image fails to load, show fallback
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
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
  className: PropTypes.string,
  fallbackText: PropTypes.string,
};

Avatar.defaultProps = {
  size: 'md',
  className: '',
  fallbackText: null,
};

export default Avatar;
