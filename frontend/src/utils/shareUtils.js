import { slugify } from './slugify';

/**
 * Share utilities for generating shareable URLs and platform-specific share links
 * Supports multiple social media platforms and communication channels
 */

/**
 * Generate shareable URL for a given entity
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route'
 * @param {number|string} entityId - ID of the entity
 * @param {object} params - Additional URL parameters (optional)
 * @param {string} baseUrl - Base URL (defaults to window.location.origin)
 * @returns {string} Shareable URL
 */
export function generateShareUrl(entityType, entityId, params = {}, baseUrl = null) {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  let path = '';
  const slug = params.slug ? `/${params.slug}` : '';

  switch (entityType) {
    case 'dive':
      path = `/dives/${entityId}${slug}`;
      break;
    case 'dive-site':
      path = `/dive-sites/${entityId}${slug}`;
      break;
    case 'route':
      // Routes need dive_site_id from params
      if (params.diveSiteId) {
        path = `/dive-sites/${params.diveSiteId}/route/${entityId}${slug}`;
      } else {
        path = `/routes/${entityId}${slug}`;
      }
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  // Add query parameters if provided
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'diveSiteId' && key !== 'slug' && value !== null && value !== undefined) {
      queryParams.append(key, value.toString());
    }
  });

  const queryString = queryParams.toString();
  return `${base}${path}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Format share text for different platforms with entity data
 * @param {string} entityType - Type of entity
 * @param {object} entityData - Entity data (title, description, etc.)
 * @param {string} platform - Target platform ('twitter', 'facebook', etc.)
 * @returns {string} Formatted share text
 */
export function formatShareText(entityType, entityData, platform = 'generic') {
  const { title, description, url } = entityData;

  let text = title || '';

  // Add description if available
  if (description) {
    const maxLength = platform === 'twitter' ? 200 : 500;
    const truncatedDesc =
      description.length > maxLength ? `${description.substring(0, maxLength)}...` : description;
    text += `\n\n${truncatedDesc}`;
  }

  // Add URL
  if (url) {
    text += `\n\n${url}`;
  }

  // Add hashtags for social platforms
  if (platform !== 'email' && platform !== 'generic') {
    text += '\n\n#diving #scubadiving #divemap';

    // Add location hashtag if available
    if (entityData.location) {
      const locationTag = entityData.location.replace(/\s+/g, '').toLowerCase();
      text += ` #${locationTag}`;
    }
  }

  return text;
}

/**
 * Generate Twitter/X share URL
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} description - Description text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Twitter share URL
 */
export function getTwitterShareUrl(url, title, description = '', entityType = '') {
  const entityLabel =
    entityType === 'dive'
      ? 'dive'
      : entityType === 'dive-site'
        ? 'dive site'
        : entityType === 'route'
          ? 'dive route'
          : '';
  const prefix = entityLabel ? `Check out this ${entityLabel} on Divemap: ` : '';
  const text = description
    ? `${prefix}${title}\n\n${description}`.substring(0, 240)
    : `${prefix}${title}`.substring(0, 240);

  const params = new URLSearchParams({
    text: `${text}\n\n`,
    url: url,
    hashtags: 'diving,scubadiving,divemap',
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate Facebook share URL
 * @param {string} url - URL to share
 * @param {string} title - Title text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Facebook share URL
 */
export function getFacebookShareUrl(url, title = '', entityType = '') {
  const params = new URLSearchParams({
    u: url,
  });

  if (title) {
    const entityLabel =
      entityType === 'dive'
        ? 'dive'
        : entityType === 'dive-site'
          ? 'dive site'
          : entityType === 'route'
            ? 'dive route'
            : '';
    const quote = entityLabel ? `Check out this ${entityLabel} on Divemap: ${title}` : title;
    params.append('quote', quote);
  }

  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

/**
 * Generate WhatsApp share URL
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} description - Description text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} WhatsApp share URL
 */
export function getWhatsAppShareUrl(url, title, description = '', entityType = '') {
  const entityLabel =
    entityType === 'dive'
      ? 'dive'
      : entityType === 'dive-site'
        ? 'dive site'
        : entityType === 'route'
          ? 'dive route'
          : '';
  const prefix = entityLabel ? `Check out this ${entityLabel} on Divemap: ` : '';
  const text = description
    ? `${prefix}${title} 🐠\n\n${description}\n\n${url}`
    : `${prefix}${title} 🐠\n\n${url}`;

  const params = new URLSearchParams({
    text: text,
  });

  return `https://wa.me/?${params.toString()}`;
}

/**
 * Generate Viber share URL
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} description - Description text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Viber share URL
 */
export function getViberShareUrl(url, title, description = '', entityType = '') {
  const entityLabel =
    entityType === 'dive'
      ? 'dive'
      : entityType === 'dive-site'
        ? 'dive site'
        : entityType === 'route'
          ? 'dive route'
          : '';
  const prefix = entityLabel ? `Check out this ${entityLabel} on Divemap: ` : '';
  const text = description
    ? `${prefix}${title} 🌊\n\n${description}\n\n${url}`
    : `${prefix}${title} 🌊\n\n${url}`;

  const params = new URLSearchParams({
    text: text,
  });

  return `viber://forward?${params.toString()}`;
}

/**
 * Generate Reddit share URL
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Reddit share URL
 */
export function getRedditShareUrl(url, title, entityType = '') {
  const entityLabel =
    entityType === 'dive'
      ? 'dive'
      : entityType === 'dive-site'
        ? 'dive site'
        : entityType === 'route'
          ? 'dive route'
          : '';
  const redditTitle = entityLabel ? `Check out this ${entityLabel} on Divemap: ${title}` : title;

  const params = new URLSearchParams({
    url: url,
    title: redditTitle,
  });

  return `https://reddit.com/submit?${params.toString()}`;
}

/**
 * Generate Email share URL (mailto link)
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} description - Description text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Email share URL
 */
export function getEmailShareUrl(url, title, description = '', entityType = '') {
  const entityLabel =
    entityType === 'dive'
      ? 'dive'
      : entityType === 'dive-site'
        ? 'dive site'
        : entityType === 'route'
          ? 'dive route'
          : '';
  const subjectText = entityLabel
    ? `Check out this ${entityLabel} on Divemap: ${title}`
    : `Check out this on Divemap: ${title}`;
  const subject = encodeURIComponent(subjectText);
  const body = description
    ? encodeURIComponent(`${description}\n\n${url}`)
    : encodeURIComponent(url);

  return `mailto:?subject=${subject}&body=${body}`;
}

/**
 * Get platform-specific share URL
 * @param {string} platform - Platform name ('twitter', 'facebook', 'whatsapp', etc.)
 * @param {string} url - URL to share
 * @param {string} title - Title text
 * @param {string} description - Description text (optional)
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route' (optional)
 * @returns {string} Platform-specific share URL
 */
export function getPlatformShareUrl(platform, url, title, description = '', entityType = '') {
  switch (platform.toLowerCase()) {
    case 'twitter':
    case 'x':
      return getTwitterShareUrl(url, title, description, entityType);
    case 'facebook':
      return getFacebookShareUrl(url, title, entityType);
    case 'whatsapp':
      return getWhatsAppShareUrl(url, title, description, entityType);
    case 'viber':
      return getViberShareUrl(url, title, description, entityType);
    case 'reddit':
      return getRedditShareUrl(url, title, entityType);
    case 'email':
      return getEmailShareUrl(url, title, description, entityType);
    default:
      return url;
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Open native share dialog (when available on mobile devices)
 * @param {object} data - Share data with title, text, url
 * @returns {Promise<boolean>} Success status
 */
export async function openNativeShare(data) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title || '',
        text: data.text || data.description || '',
        url: data.url || '',
      });
      return true;
    } catch (error) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
      return false;
    }
  }
  return false;
}

/**
 * Generate share content based on entity type and data
 * @param {string} entityType - Type of entity
 * @param {object} entityData - Entity data
 * @returns {object} Share content with title, description, url
 */
export function generateShareContent(entityType, entityData) {
  let title = '';
  let description = '';
  let url = '';

  switch (entityType) {
    case 'dive':
      title =
        entityData.name ||
        `${entityData.dive_site?.name || 'Dive'} - ${entityData.dive_date || ''}`;
      description =
        entityData.dive_information ||
        `Check out this ${entityData.dive_site?.name ? `dive at ${entityData.dive_site.name}` : 'amazing dive'}!`;

      // Add stats if available
      if (entityData.max_depth || entityData.duration || entityData.user_rating) {
        const stats = [];
        if (entityData.max_depth) stats.push(`Max depth: ${entityData.max_depth}m`);
        if (entityData.duration) stats.push(`Duration: ${entityData.duration}min`);
        if (entityData.user_rating) stats.push(`Rating: ${entityData.user_rating}/10`);
        if (stats.length > 0) {
          description += `\n\n${stats.join(' | ')}`;
        }
      }

      url = generateShareUrl('dive', entityData.id, {
        slug: slugify(entityData.name || entityData.dive_site?.name || 'dive'),
      });
      break;

    case 'dive-site':
      title = entityData.name || 'Dive Site';
      description =
        entityData.description || `Discover ${entityData.name || 'this amazing dive site'}!`;

      // Add stats if available
      if (entityData.max_depth || entityData.average_rating || entityData.difficulty_label) {
        const stats = [];
        if (entityData.max_depth) stats.push(`Max depth: ${entityData.max_depth}m`);
        if (entityData.difficulty_label) stats.push(`Difficulty: ${entityData.difficulty_label}`);
        if (entityData.average_rating) stats.push(`Rating: ${entityData.average_rating}/10`);
        if (stats.length > 0) {
          description += `\n\n${stats.join(' | ')}`;
        }
      }

      // Add location if available
      if (entityData.country || entityData.region) {
        const location = [entityData.region, entityData.country].filter(Boolean).join(', ');
        description += location ? `\n📍 ${location}` : '';
      }

      url = generateShareUrl('dive-site', entityData.id, {
        slug: slugify(entityData.name),
      });
      break;

    case 'route':
      title = entityData.name || 'Dive Route';
      description =
        entityData.description ||
        `Check out this dive route${entityData.dive_site ? ` at ${entityData.dive_site.name}` : ''}!`;

      // Add route type and stats if available
      if (entityData.route_type) {
        const routeTypeLabels = {
          walk: 'Walk Route',
          swim: 'Swim Route',
          scuba: 'Scuba Route',
          line: 'Line Route',
        };
        description += `\n\nRoute Type: ${routeTypeLabels[entityData.route_type] || entityData.route_type}`;
      }

      url = generateShareUrl('route', entityData.id, {
        diveSiteId: entityData.dive_site_id,
        slug: slugify(entityData.name),
      });
      break;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }

  return { title, description, url };
}
