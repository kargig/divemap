import PropTypes from 'prop-types';
import React from 'react';

import { getDifficultyLabel, getDifficultyColorClasses } from '../../utils/difficultyHelpers';

/**
 * A reusable badge component for displaying dive difficulty levels.
 * Replaces the old "pill" style with a "rectangle box" style.
 */
const DifficultyBadge = ({ code, label, className = '', size = 'sm', showUnspecified = false }) => {
  const displayLabel = label || getDifficultyLabel(code);

  if (!showUnspecified && displayLabel === 'Unspecified') {
    return null;
  }

  const colorClasses = getDifficultyColorClasses(code);

  const sizeClasses = {
    xs: 'px-1 py-0 text-[10px]',
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-2.5 py-1.5 text-base',
  };

  const selectedSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <span
      className={`inline-flex items-center font-medium rounded border ${colorClasses} ${selectedSize} ${className}`}
    >
      {displayLabel}
    </span>
  );
};

DifficultyBadge.propTypes = {
  /** The difficulty code (e.g., 'OPEN_WATER', 'ADVANCED_OPEN_WATER') */
  code: PropTypes.string,
  /** Optional manual label. If not provided, it will be derived from the code. */
  label: PropTypes.string,
  /** Additional Tailwind CSS classes */
  className: PropTypes.string,
  /** Badge size: 'xs', 'sm', 'md', 'lg' */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  /** Whether to show the badge if difficulty is 'Unspecified' */
  showUnspecified: PropTypes.bool,
};

export default DifficultyBadge;
