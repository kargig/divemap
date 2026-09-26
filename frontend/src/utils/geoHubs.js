import { slugify } from './slugify';

/**
 * Geo hub path helpers (keep in sync with backend/app/seo_geo.py).
 */

export const geoSlug = text => slugify(text || '');

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
