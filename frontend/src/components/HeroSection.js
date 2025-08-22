import PropTypes from 'prop-types';
import React from 'react';

const HeroSection = ({
  title,
  subtitle,
  background = 'default',
  size = 'medium',
  centered = true,
  showLogo = false,
  logoSize = 'hero',
  logoBackground = false,
  topBottomLayout = false,
  threeColumnLayout = false,
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

  const textColor = logoBackground
    ? 'text-gray-900'
    : background === 'minimal'
      ? 'text-gray-900'
      : 'text-white';

  if (threeColumnLayout) {
    // Mobile: Simple stacked layout, Desktop: Three-Column Layout
    return (
      <>
        {/* Mobile Layout */}
        <section className='md:hidden'>
          {/* Hero with logo background - no white box, just logo */}
          <div className='relative min-h-[200px] flex items-center justify-center overflow-hidden'>
            <img
              src='/divemap-logo-hero-background-mobile.png'
              alt=''
              className='absolute inset-0 h-full w-full object-cover opacity-80'
            />
            <div className='relative z-10 text-center px-4'>
              <h1 className='text-2xl font-bold text-gray-900 mb-2'>{title}</h1>
              {subtitle && (
                <p className='text-sm text-gray-700 mb-4 max-w-xs mx-auto'>{subtitle}</p>
              )}
            </div>
          </div>

          {/* Buttons section below hero */}
          {children && (
            <div className='bg-gray-50 py-6 px-4'>
              <div className='flex flex-col gap-3 max-w-sm mx-auto'>{children}</div>
            </div>
          )}
        </section>

        {/* Desktop Layout */}
        <section className='hidden md:flex'>
          <div
            className={`${logoBackground ? 'relative overflow-hidden' : backgroundClasses[background]} ${sizeClasses[size]} ${
              centered ? 'text-center' : ''
            } flex items-center justify-center min-h-[400px] w-full`}
          >
            {logoBackground && (
              <div className='absolute inset-0 flex items-center justify-center opacity-8 bg-white'>
                <img
                  src='/divemap-logo-hero-background.png'
                  alt=''
                  className='h-full w-full object-contain'
                />
              </div>
            )}

            <div className='max-w-7xl mx-auto relative z-10 flex items-center justify-between w-full px-8'>
              {/* Left Column - Title (Vertical) */}
              <div className='flex flex-col items-center text-center max-w-xs'>
                {title.split(' ').map((word, index) => (
                  <h1
                    key={index}
                    className={`text-3xl lg:text-4xl font-bold ${textColor} mb-2 leading-tight`}
                  >
                    {word}
                  </h1>
                ))}
              </div>

              {/* Center Column - Logo Background */}
              <div className='flex-shrink-0 mx-8'>
                {/* Logo is already in the background, this creates space */}
              </div>

              {/* Right Column - Subtitle (Vertical) */}
              <div className='flex flex-col items-center text-center max-w-xs'>
                {subtitle && (
                  <div className='space-y-3'>
                    <p className={`text-base lg:text-lg ${textColor} opacity-90 leading-relaxed`}>
                      Explore the world's best scuba diving locations
                    </p>
                    <p className={`text-base lg:text-lg ${textColor} opacity-90 leading-relaxed`}>
                      read reviews from fellow divers
                    </p>
                    <p className={`text-base lg:text-lg ${textColor} opacity-90 leading-relaxed`}>
                      and find diving centers for your next underwater adventure
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section - Buttons */}
            {children && (
              <div className='absolute bottom-8 left-1/2 transform -translate-x-1/2'>
                <div className='flex flex-col sm:flex-row gap-3 justify-center'>{children}</div>
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  if (topBottomLayout) {
    // Top-Bottom Layout: Title at top, buttons at bottom, logo background in middle
    return (
      <section
        className={`${logoBackground ? 'relative overflow-hidden' : backgroundClasses[background]} ${sizeClasses[size]} ${
          centered ? 'text-center' : ''
        } flex flex-col justify-between min-h-[350px]`}
      >
        {logoBackground && (
          <div className='absolute inset-0 flex items-center justify-center opacity-8 bg-white'>
            {/* Desktop Logo */}
            <img
              src='/divemap-logo-hero-background.png'
              alt=''
              className='hidden md:block h-full w-full object-contain'
            />
            {/* Mobile Logo */}
            <img
              src='/divemap-logo-hero-background-mobile.png'
              alt=''
              className='md:hidden h-full w-full object-contain'
            />
          </div>
        )}

        {/* Top Section - Title and Subtitle */}
        <div className='max-w-6xl mx-auto relative z-10 flex-shrink-0 pt-0'>
          <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${textColor} mb-4`}>
            {title}
          </h1>
          {subtitle && (
            <p
              className={`text-lg sm:text-xl ${textColor} opacity-90 max-w-3xl ${
                centered ? 'mx-auto' : ''
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Middle Section - Spacer for logo background */}
        <div className='flex-grow'></div>

        {/* Bottom Section - Buttons */}
        {children && (
          <div className='max-w-6xl mx-auto relative z-10 flex-shrink-0 pb-8'>
            <div className='flex flex-col sm:flex-row gap-3 justify-center max-w-4xl mx-auto'>
              {children}
            </div>
          </div>
        )}
      </section>
    );
  }

  // Standard Layout (existing behavior)
  return (
    <section
      className={`${logoBackground ? 'relative overflow-hidden' : backgroundClasses[background]} ${sizeClasses[size]} ${
        centered ? 'text-center' : ''
      }`}
    >
      {logoBackground && (
        <div className='absolute inset-0 flex items-center justify-center opacity-8 bg-white'>
          {/* Desktop Logo */}
          <img
            src='/divemap-logo-hero-background.png'
            alt=''
            className='hidden md:block h-full w-full object-contain'
          />
          {/* Mobile Logo */}
          <img
            src='/divemap-logo-hero-background-mobile.png'
            alt=''
            className='md:hidden h-full w-full object-contain'
          />
        </div>
      )}
      <div className='max-w-6xl mx-auto relative z-10'>
        {showLogo && (
          <div className='flex justify-center mb-6'>
            <img
              src={
                logoSize === 'hero-large'
                  ? '/divemap-logo-hero-large.png'
                  : '/divemap-logo-hero.png'
              }
              alt='Divemap Logo'
              className={
                logoSize === 'hero-large'
                  ? 'h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 drop-shadow-lg'
                  : 'h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 drop-shadow-lg'
              }
            />
          </div>
        )}
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
  showLogo: PropTypes.bool,
  logoSize: PropTypes.oneOf(['hero', 'hero-large']),
  logoBackground: PropTypes.bool,
  topBottomLayout: PropTypes.bool,
  threeColumnLayout: PropTypes.bool,
  children: PropTypes.node,
};

export default HeroSection;
