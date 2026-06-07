import PropTypes from 'prop-types';
import React from 'react';

const DepthIcon = ({ className = '', size = 16, strokeWidth = 2.5, ...props }) => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      width={size}
      height={size}
      className={className}
      {...props}
    >
      {/* Ocean waves at the top */}
      <path d='M2 6c.6.5 1.2 1 2.5 1s1.9-.5 2.5-1c.6-.5 1.2-1 2.5-1s1.9.5 2.5 1c.6.5 1.2 1 2.5 1s1.9-.5 2.5-1c.6-.5 1.2-1 2.5-1s1.9.5 2.5 1c.6.5 1.2 1 2.5 1' />
      {/* Vertical descending line */}
      <path d='M12 10v10' />
      {/* Downward pointing arrowhead */}
      <polyline points='8 16 12 20 16 16' />
    </svg>
  );
};

DepthIcon.propTypes = {
  className: PropTypes.string,
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  strokeWidth: PropTypes.number,
};

export default DepthIcon;
