import PropTypes from 'prop-types';
import React from 'react';

const HeroSection = ({
  title,
  subtitle,
  background = 'default',
  size = 'medium',
  centered = true,
  children,
}) => {
  const backgroundClasses = {
    default: 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800',
    ocean: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600',
    sunset: 'bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600',
    earth: 'bg-gradient-to-br from-green-500 via-teal-500 to-blue-600',
    minimal: 'bg-gray-50 border-b border-gray-200',
  };

  const sizeClasses = {
    small: 'py-8 px-4',
    medium: 'py-12 px-6',
    large: 'py-16 px-8',
    xlarge: 'py-20 px-8',
  };

  const textColor = background === 'minimal' ? 'text-gray-900' : 'text-white';

  return (
    <section
      className={`${backgroundClasses[background]} ${sizeClasses[size]} ${
        centered ? 'text-center' : ''
      }`}
    >
      <div className='max-w-6xl mx-auto'>
        <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${textColor} mb-4`}>{title}</h1>
        {subtitle && (
          <p
            className={`text-lg sm:text-xl ${textColor} opacity-90 max-w-3xl ${
              centered ? 'mx-auto' : ''
            } mb-6`}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div
            className={`mt-6 min-h-[60px] flex items-center justify-center ${
              centered ? 'flex justify-center' : ''
            }`}
          >
            <div className='flex flex-col sm:flex-row gap-3 justify-center max-w-4xl w-full'>
              {children}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

HeroSection.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  background: PropTypes.oneOf(['default', 'ocean', 'sunset', 'earth', 'minimal']),
  size: PropTypes.oneOf(['small', 'medium', 'large', 'xlarge']),
  centered: PropTypes.bool,
  children: PropTypes.node,
};

export default HeroSection;
