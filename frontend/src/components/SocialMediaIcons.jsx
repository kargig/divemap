import PropTypes from 'prop-types';

/**
 * Social Media Icons Component
 *
 * Uses CDN sources for official brand icons:
 * - Primary: Simple Icons CDN (https://cdn.simpleicons.org/{brand}/{color})
 * - Alternative: SVGRepo, IconScout, and other reliable CDNs
 *
 * Defaults to official vibrant brand colors, with light/dark contrast
 * support for monochrome brands (X, TikTok, Threads).
 */

const getBrandIconUrl = (slug, color) => {
  if (color) {
    return `https://cdn.simpleicons.org/${slug}/${color}`;
  }
  // For monochrome brands, adapt to light/dark system settings automatically
  if (['x', 'twitter', 'tiktok', 'threads'].includes(slug)) {
    return `https://cdn.simpleicons.org/${slug}/000000/ffffff`;
  }
  // For colored brands, use the official vibrant brand color
  return `https://cdn.simpleicons.org/${slug}`;
};

/**
 * Twitter/X Icon Component
 */
export const TwitterIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('x', color)}
      alt='Twitter/X'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const FacebookIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('facebook', color)}
      alt='Facebook'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const WhatsAppIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('whatsapp', color)}
      alt='WhatsApp'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const ViberIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('viber', color)}
      alt='Viber'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const RedditIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('reddit', color)}
      alt='Reddit'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const InstagramIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('instagram', color)}
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
export const TikTokIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('tiktok', color)}
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
export const LinkedInIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('linkedin', color)}
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
export const YouTubeIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('youtube', color)}
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
export const TelegramIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('telegram', color)}
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
export const BlueSkyIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('bluesky', color)}
      alt='BlueSky'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const MastodonIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('mastodon', color)}
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
export const DiscordIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('discord', color)}
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
export const ThreadsIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('threads', color)}
      alt='Threads'
      className={className}
      style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain' }}
      onError={e => {
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
export const SignalIcon = ({ className = 'w-5 h-5', color }) => {
  return (
    <img
      src={getBrandIconUrl('signal', color)}
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
  const iconProps = {
    className: props.className || 'w-5 h-5',
    ...(props.color ? { color: props.color } : {}),
  };

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
