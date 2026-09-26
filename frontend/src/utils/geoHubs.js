/**
 * Geo hub path helpers (keep in sync with backend/app/seo_geo.py geo_slug).
 * Uses NFKD→ASCII so diacritics match sitemap/prerender paths
 * (do not reuse slugify() here — it strips accents as non-word chars).
 */

export const geoSlug = text => {
  if (!text) return '';
  const ascii = String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return ascii
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const buildGeoHubPath = (country, region) => {
  const c = geoSlug(country);
  if (!c) return '/dive-sites';
  const r = geoSlug(region);
  if (r) return `/dive-sites/${c}/${r}`;
  return `/dive-sites/${c}`;
};

export const resolveLabelFromSlug = (candidates, slug) => {
  if (!slug) return null;
  const target = String(slug).toLowerCase();
  return (candidates || []).find(value => value && geoSlug(value) === target) || null;
};

/** True when path segment is a numeric dive-site id (not a country slug). */
export const isNumericDiveSiteId = value => /^\d+$/.test(String(value || ''));
