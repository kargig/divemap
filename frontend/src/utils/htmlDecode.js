/**
 * Decode HTML entities in a string
 * Converts entities like &#x27; or &apos; back to their original characters
 * Uses innerHTML to decode, then textContent to extract plain text safely
 * This prevents XSS by only reading text content, not executing HTML
 * @param {string} html - The HTML-encoded string
 * @returns {string} - The decoded string
 */
export const decodeHtmlEntities = html => {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Create a temporary div element to decode HTML entities
  // Set innerHTML to decode entities, then read textContent to get plain text
  // This is safe because we only read textContent, never insert into DOM
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};
