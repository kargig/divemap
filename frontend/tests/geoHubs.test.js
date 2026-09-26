import { expect, test, describe } from 'vitest';

import { buildGeoHubPath, geoSlug, resolveLabelFromSlug } from '../src/utils/geoHubs';

describe('geoHubs (NFKD parity with backend seo_geo.geo_slug)', () => {
  test('basic geoSlug', () => {
    expect(geoSlug('Greece')).toBe('greece');
    expect(geoSlug('East Attica')).toBe('east-attica');
    expect(geoSlug('')).toBe('');
    expect(geoSlug(null)).toBe('');
  });

  test('diacritics fold to ASCII (not stripped as \\W)', () => {
    expect(geoSlug('São Tomé and Príncipe')).toBe('sao-tome-and-principe');
    expect(geoSlug("Côte d'Ivoire")).toBe('cote-d-ivoire');
    expect(geoSlug('Réunion')).toBe('reunion');
  });

  test('hub path and resolve round-trip', () => {
    expect(buildGeoHubPath('São Tomé and Príncipe')).toBe(
      '/dive-sites/sao-tome-and-principe'
    );
    expect(
      resolveLabelFromSlug(['São Tomé and Príncipe', 'Greece'], 'sao-tome-and-principe')
    ).toBe('São Tomé and Príncipe');
  });
});
