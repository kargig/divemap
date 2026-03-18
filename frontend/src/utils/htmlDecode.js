/**
 * Decode HTML entities in a string without stripping tags or executing HTML.
 * Converts entities like &#x27; or &apos; back to their original characters.
 * This version uses a regex to only target entities, preserving the rest of the string (including tags).
 * @param {string} html - The string containing HTML entities
 * @returns {string} - The decoded string
 */
export const decodeHtmlEntities = html => {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Create a reusable element for decoding
  // Note: Since this is used in the replace callback, we don't worry about state
  const doc = new DOMParser().parseFromString('', 'text/html');
  const textarea = doc.createElement('textarea');

  // Match entities like &amp;, &#123;, &#xabc;
  return html.replace(/&[#\w]+;/g, entity => {
    textarea.innerHTML = entity;
    return textarea.value;
  });
};
