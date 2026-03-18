import escape from 'lodash/escape';

/**
 * Utility functions for text processing and formatting
 */

/**
 * Checks if a string is a valid URL with an allowed protocol
 * @param {string} urlString - The URL string to check
 * @returns {boolean} True if valid and safe
 */
export const isValidUrl = urlString => {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (e) {
    return false;
  }
};

/**
 * Converts URLs in text to clickable links
 * @param {string} text - The text to process
 * @param {Object} options - Configuration options
 * @param {string} options.linkClassName - CSS classes for links
 * @param {boolean} options.targetBlank - Whether to open links in new tab
 * @returns {Array} Array of objects representing text and link parts
 */
export const linkifyUrls = (text, options = {}) => {
  const {
    linkClassName = 'text-blue-600 hover:text-blue-800 underline break-all',
    targetBlank = true,
    isUGC = false,
  } = options;

  if (!text || typeof text !== 'string') {
    return text;
  }

  // Split text by URLs (http/https), excluding angle brackets and quotes to prevent XSS breakouts
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/);

  return parts.map((part, index) => {
    // Check if this part is a URL and is valid
    if (part.match(/^https?:\/\//) && isValidUrl(part)) {
      let rel = targetBlank ? 'noopener noreferrer' : '';
      if (isUGC) {
        rel = rel ? `${rel} nofollow ugc` : 'nofollow ugc';
      }

      return {
        type: 'link',
        key: index,
        href: part, // React handles href safely
        text: part,
        className: linkClassName,
        target: targetBlank ? '_blank' : '_self',
        rel: rel || undefined,
        title: escape(part), // Explicitly escape for title attribute using lodash
      };
    }
    return {
      type: 'text',
      key: index,
      text: part,
    };
  });
};

/**
 * Renders text with clickable URLs as React elements
 * @param {string} text - The text to process
 * @param {Object} options - Configuration options
 * @param {string} options.linkClassName - CSS classes for links
 * @param {boolean} options.targetBlank - Whether to open links in new tab
 * @param {boolean} options.shorten - Whether to shorten URL text (e.g. to [Link])
 * @param {boolean} options.isUGC - Whether the content is user-generated (adds nofollow ugc)
 * @returns {Array} Array of React elements and strings
 */
export const renderTextWithLinks = (text, options = {}) => {
  const { shorten = true } = options;
  const linkifiedParts = linkifyUrls(text, options);

  if (typeof linkifiedParts === 'string') {
    return linkifiedParts;
  }

  return linkifiedParts.map(part => {
    if (part.type === 'link') {
      const displayText = shorten ? '[Link]' : part.text;
      return (
        <a
          key={part.key}
          href={part.href}
          target={part.target}
          rel={part.rel}
          className={part.className}
          title={part.title}
        >
          {displayText}
        </a>
      );
    }
    return part.text;
  });
};
