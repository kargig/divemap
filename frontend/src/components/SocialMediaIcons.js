/**
 * Social Media Icons Component
 *
 * Uses CDN sources for official brand icons:
 * - Primary: Simple Icons CDN (https://cdn.simpleicons.org/{brand}/{color})
 * - Alternative: SVGRepo, IconScout, and other reliable CDNs
 *
 * Icon Sources:
 * - IconScout: https://iconscout.com/free-icons/social-media
 * - SVGRepo: https://www.svgrepo.com
 * - Simple Icons: https://simpleicons.org
 */

/**
 * Twitter/X Icon Component
 */
export const TwitterIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/x/${color}`}
      alt='Twitter/X'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Fallback to SVGRepo
        e.target.src = 'https://www.svgrepo.com/show/303150/twitter-3-logo.svg';
      }}
    />
  );
};

/**
 * Facebook Icon Component
 */
export const FacebookIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/facebook/${color}`}
      alt='Facebook'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Fallback to SVGRepo
        e.target.src = 'https://www.svgrepo.com/show/303114/facebook-3-logo.svg';
      }}
    />
  );
};

/**
 * WhatsApp Icon Component
 */
export const WhatsAppIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/whatsapp/${color}`}
      alt='WhatsApp'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Fallback to SVGRepo
        e.target.src = 'https://www.svgrepo.com/show/303157/whatsapp-icon-logo.svg';
      }}
    />
  );
};

/**
 * Viber Icon Component
 */
export const ViberIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/viber/${color}`}
      alt='Viber'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Fallback to alternative CDN
        e.target.src = 'https://www.svgrepo.com/show/373450/viber.svg';
      }}
    />
  );
};

/**
 * Reddit Icon Component
 */
export const RedditIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/reddit/${color}`}
      alt='Reddit'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Fallback to SVGRepo
        e.target.src = 'https://www.svgrepo.com/show/303338/reddit-5-logo.svg';
      }}
    />
  );
};

/**
 * Get social media icon component by platform name
 * @param {string} platform - Platform identifier
 * @param {object} props - Icon props (className, color)
 * @returns {JSX.Element} Icon component
 */
export const getSocialMediaIcon = (platform, props = {}) => {
  const iconProps = { className: props.className || 'w-5 h-5', color: props.color || '#ffffff' };

  switch (platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return <TwitterIcon {...iconProps} />;
    case 'facebook':
      return <FacebookIcon {...iconProps} />;
    case 'whatsapp':
      return <WhatsAppIcon {...iconProps} />;
    case 'viber':
      return <ViberIcon {...iconProps} />;
    case 'reddit':
      return <RedditIcon {...iconProps} />;
    default:
      return null;
  }
};
