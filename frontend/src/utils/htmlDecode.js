/**
 * Decode HTML entities in a string
 * Converts entities like &#x27; or &apos; back to their original characters
 * Uses innerHTML to decode, then textContent to extract plain text safely
 * This prevents XSS by only reading text content, not executing HTML
 * Performs multiple passes to handle double-encoded entities (e.g. &amp;#x27;)
 * @param {string} html - The HTML-encoded string
 * @returns {string} - The decoded string
 */
export const decodeHtmlEntities = html => {
  if (!html || typeof html !== 'string') {
    return html;
  }

  let decoded = html;
  // Limit to 3 iterations to prevent infinite loops with malformed entities
  // This handles cases like &amp;#x27; which decodes to &#x27; and then to '
  for (let i = 0; i < 3; i++) {
    const div = document.createElement('div');
    div.innerHTML = decoded;
    const text = div.textContent || div.innerText || '';

    // If no change, we are done
    if (text === decoded) {
      break;
    }
    decoded = text;
  }

  return decoded;
};
