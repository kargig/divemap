import React from 'react';

const BackgroundLogo = ({ opacity = 0.03, size = 'large', className = '' }) => {
  const sizeClasses = {
    small: 'h-32 w-32',
    medium: 'h-48 w-48',
    large: 'h-64 w-64',
    xlarge: 'h-96 w-96',
  };

  return (
    <div
      className={`fixed inset-0 pointer-events-none flex items-center justify-center ${className}`}
    >
      <img
        src='/divemap-logo-hero.png'
        alt=''
        className={`${sizeClasses[size]} opacity-${Math.round(opacity * 100)}`}
        style={{ opacity }}
      />
    </div>
  );
};

export default BackgroundLogo;
