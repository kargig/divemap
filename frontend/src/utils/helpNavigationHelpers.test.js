import { describe, it, expect } from 'vitest';

import {
  HELP_SECTIONS,
  DEFAULT_HELP_SECTION,
  getSectionBySlug,
  getSlugByLegacyTab,
} from './helpNavigationHelpers';

describe('helpNavigationHelpers', () => {
  it('defines all required help sections with kebab-case slugs', () => {
    expect(HELP_SECTIONS.length).toBeGreaterThanOrEqual(8);
    HELP_SECTIONS.forEach(section => {
      expect(section.slug).toMatch(/^[a-z0-9-]+$/);
      expect(section.metaTitle).toBeTruthy();
      expect(section.metaDescription).toBeTruthy();
    });
  });

  it('maps legacy query tab keys to canonical kebab-case slugs', () => {
    expect(getSlugByLegacyTab('start')).toBe('getting-started');
    expect(getSlugByLegacyTab('map')).toBe('global-map');
    expect(getSlugByLegacyTab('directories')).toBe('directories');
    expect(getSlugByLegacyTab('log')).toBe('log-and-import');
    expect(getSlugByLegacyTab('media_routes')).toBe('sites-and-media');
    expect(getSlugByLegacyTab('tools')).toBe('tools-and-planning');
    expect(getSlugByLegacyTab('community')).toBe('community');
    expect(getSlugByLegacyTab('business')).toBe('business-portal');
  });

  it('retrieves section details by modern slug', () => {
    const mapSection = getSectionBySlug('global-map');
    expect(mapSection).toBeDefined();
    expect(mapSection.id).toBe('map');
    expect(mapSection.slug).toBe('global-map');

    const invalid = getSectionBySlug('unknown-section');
    expect(invalid).toBeUndefined();
  });

  it('provides default help section as getting-started', () => {
    expect(DEFAULT_HELP_SECTION.slug).toBe('getting-started');
    expect(DEFAULT_HELP_SECTION.id).toBe('start');
  });
});
