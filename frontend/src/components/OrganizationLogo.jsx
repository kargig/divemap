import PropTypes from 'prop-types';
import { useState } from 'react';

/**
 * Renders the logo of a diving organization or a fallback acronym.
 *
 * @param {Object} org - The organization object containing logo_url, name, and acronym.
 * @param {string} size - Tailwind CSS size classes (e.g., 'h-10 w-10').
 * @param {string} textSize - Tailwind CSS text size classes for fallback acronym (e.g., 'text-xs').
 * @param {string} className - Additional CSS classes.
 */
const OrganizationLogo = ({ org, size = 'h-10 w-10', textSize = 'text-xs', className = '' }) => {
  const [imageError, setImageError] = useState(false);

  if (org.logo_url && !imageError) {
    return (
      <div
        className={`${size} rounded-full bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center ${className}`}
      >
        <img
          src={org.logo_url}
          alt={`${org.name} logo`}
          className='h-full w-full object-contain'
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold ${textSize} border border-blue-200 flex-shrink-0 ${className}`}
    >
      {org.acronym || (org.name ? org.name.substring(0, 2).toUpperCase() : '??')}
    </div>
  );
};

OrganizationLogo.propTypes = {
  org: PropTypes.shape({
    logo_url: PropTypes.string,
    name: PropTypes.string.isRequired,
    acronym: PropTypes.string,
  }).isRequired,
  size: PropTypes.string,
  textSize: PropTypes.string,
  className: PropTypes.string,
};

export default OrganizationLogo;
