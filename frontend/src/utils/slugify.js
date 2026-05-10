/**
 * Converts a string into a URL-friendly slug.
 * @param {string} text - The text to slugify.
 * @returns {string} The slugified text.
 */
export const slugify = text => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-') // Replace spaces, non-word chars and dashes with a single dash
    .replace(/^-+|-+$/g, ''); // Remove leading and trailing dashes
};

/**
 * Generates an SEO-friendly slug for a dive site including geographical hierarchy.
 * @param {Object} site - The dive site object.
 * @returns {string} The slugified text.
 */
/**
 * Generates a clean, deduplicated slug from geographical parts.
 * Strips administrative boilerplate and removes duplicate words.
 */
export const generateCleanSlug = parts => {
  const raw = parts.filter(Boolean).join(' ');
  let slug = slugify(raw);

  // Remove common verbose administrative boilerplate
  const boilerplates = [
    'regional-unit-of-',
    'municipality-of-',
    'region-of-',
    'prefecture-of-',
    'province-of-',
    'department-of-',
    '-and-the-lesser-cyclades',
    'municipal-unit',
  ];

  boilerplates.forEach(b => {
    slug = slug.split(b).join('');
  });

  // Deduplicate words (e.g., "greece-attica-east-attica" -> "greece-attica-east")
  const words = slug.split('-');
  const seen = new Set();
  const deduped = [];

  words.forEach(w => {
    if (w && !seen.has(w)) {
      seen.add(w);
      deduped.push(w);
    }
  });

  return deduped.join('-');
};

/**
 * Generates an SEO-friendly slug for a dive site including geographical hierarchy.
 * @param {Object} site - The dive site object.
 * @returns {string} The slugified text.
 */
export const getDiveSiteSlug = site => {
  if (!site) return '';
  const parts = [site.country, site.region, site.name];
  return generateCleanSlug(parts);
};

/**
 * Generates an SEO-friendly slug for a diving center including geographical hierarchy.
 * @param {Object} center - The diving center object.
 * @returns {string} The slugified text.
 */
export const getDivingCenterSlug = center => {
  if (!center) return '';
  // Prefer city over region to keep the slug concise. Fallback to region if city is missing.
  const localArea = center.city || center.region;
  const parts = [center.country, localArea, center.name];
  return generateCleanSlug(parts);
};
