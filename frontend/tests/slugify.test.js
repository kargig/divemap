import { expect, test, describe } from 'vitest';
import { slugify, getDiveSiteSlug, getDivingCenterSlug, generateCleanSlug } from '../src/utils/slugify';

describe('slugify utility', () => {
  test('basic slugify works', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  Trim Me  ')).toBe('trim-me');
    expect(slugify('Special@#$Chars')).toBe('special-chars');
  });

  describe('generateCleanSlug', () => {
    test('removes administrative boilerplate', () => {
      expect(generateCleanSlug(['Greece', 'regional-unit-of-east-attica', 'Katafygi']))
        .toBe('greece-east-attica-katafygi');
    });

    test('deduplicates words', () => {
      expect(generateCleanSlug(['Greece', 'Attica', 'East Attica', 'East Attica Bay']))
        .toBe('greece-attica-east-bay');
    });

    test('handles Naxos boilerplate specifically', () => {
      expect(generateCleanSlug(['Greece', 'Naxos and the lesser cyclades', 'Nima Dive Center']))
        .toBe('greece-naxos-nima-dive-center');
    });
  });

  describe('getDiveSiteSlug', () => {
    test('combines country and name, ignoring missing fields', () => {
      const site = { country: 'Greece', name: 'Blue Hole' };
      expect(getDiveSiteSlug(site)).toBe('greece-blue-hole');
    });

    test('strips verbose region from dive site', () => {
      const site = { country: 'Greece', region: 'regional unit of east attica', name: 'Katafygi' };
      expect(getDiveSiteSlug(site)).toBe('greece-east-attica-katafygi');
    });
  });

  describe('getDivingCenterSlug', () => {
    test('prefers city over region', () => {
      const center = { 
        country: 'Greece', 
        region: 'South Aegean', 
        city: 'Naxos and the lesser cyclades', 
        name: 'Nima Dive Center' 
      };
      expect(getDivingCenterSlug(center)).toBe('greece-naxos-nima-dive-center');
    });

    test('falls back to region if city is missing', () => {
      const center = { 
        country: 'Egypt', 
        region: 'Red Sea', 
        city: null, 
        name: 'Deep Blue' 
      };
      expect(getDivingCenterSlug(center)).toBe('egypt-red-sea-deep-blue');
    });
  });
});
