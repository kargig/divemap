import PropTypes from 'prop-types';

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

TwitterIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
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

FacebookIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
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

WhatsAppIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
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

ViberIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
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

RedditIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Instagram Icon Component
 */
export const InstagramIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/instagram/${color}`}
      alt='Instagram'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452229/instagram-1.svg';
      }}
    />
  );
};

InstagramIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * TikTok Icon Component
 */
export const TikTokIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/tiktok/${color}`}
      alt='TikTok'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452109/tiktok.svg';
      }}
    />
  );
};

TikTokIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * LinkedIn Icon Component
 */
export const LinkedInIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/linkedin/${color}`}
      alt='LinkedIn'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452045/linkedin.svg';
      }}
    />
  );
};

LinkedInIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * YouTube Icon Component
 */
export const YouTubeIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/youtube/${color}`}
      alt='YouTube'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452138/youtube.svg';
      }}
    />
  );
};

YouTubeIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Telegram Icon Component
 */
export const TelegramIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/telegram/${color}`}
      alt='Telegram'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452115/telegram.svg';
      }}
    />
  );
};

TelegramIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * BlueSky Icon Component
 */
export const BlueSkyIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/bluesky/${color}`}
      alt='BlueSky'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Simple fallback
        e.target.style.display = 'none';
      }}
    />
  );
};

BlueSkyIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Mastodon Icon Component
 */
export const MastodonIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/mastodon/${color}`}
      alt='Mastodon'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452055/mastodon.svg';
      }}
    />
  );
};

MastodonIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Discord Icon Component
 */
export const DiscordIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/discord/${color}`}
      alt='Discord'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452191/discord.svg';
      }}
    />
  );
};

DiscordIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Threads Icon Component
 */
export const ThreadsIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/threads/${color}`}
      alt='Threads'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        // Simple fallback
        e.target.style.display = 'none';
      }}
    />
  );
};

ThreadsIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Signal Icon Component
 */
export const SignalIcon = ({ className = 'w-5 h-5', color = 'ffffff' }) => {
  return (
    <img
      src={`https://cdn.simpleicons.org/signal/${color}`}
      alt='Signal'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
        e.target.src = 'https://www.svgrepo.com/show/452097/signal-app.svg';
      }}
    />
  );
};

SignalIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.string,
};

/**
 * Get social media icon component by platform name
 * @param {string} platform - Platform identifier
 * @param {object} props - Icon props (className, color)
 * @returns {JSX.Element} Icon component
 */
export const getSocialMediaIcon = (platform, props = {}) => {
  const iconProps = { className: props.className || 'w-5 h-5', color: props.color || 'ffffff' };

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
    case 'instagram':
      return <InstagramIcon {...iconProps} />;
    case 'tiktok':
      return <TikTokIcon {...iconProps} />;
    case 'linkedin':
      return <LinkedInIcon {...iconProps} />;
    case 'youtube':
      return <YouTubeIcon {...iconProps} />;
    case 'telegram':
      return <TelegramIcon {...iconProps} />;
    case 'bluesky':
      return <BlueSkyIcon {...iconProps} />;
    case 'mastodon':
      return <MastodonIcon {...iconProps} />;
    case 'discord':
      return <DiscordIcon {...iconProps} />;
    case 'threads':
      return <ThreadsIcon {...iconProps} />;
    case 'signal':
      return <SignalIcon {...iconProps} />;
    default:
      return null;
  }
};
