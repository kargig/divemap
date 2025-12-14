/**
 * Decode HTML entities in a string
 * Converts entities like &#x27; or &apos; back to their original characters
 * Uses textContent for security (prevents XSS attacks)
 * @param {string} html - The HTML-encoded string
 * @returns {string} - The decoded string
 */
export const decodeHtmlEntities = html => {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Create a temporary textarea element to decode HTML entities
  // Use textContent instead of innerHTML for security (prevents XSS)
  const textarea = document.createElement('textarea');
  textarea.textContent = html;
  return textarea.value;
};
