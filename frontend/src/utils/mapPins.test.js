import { describe, it, expect } from 'vitest';

import {
  generateDivePinSvg,
  createDiveSiteIcon,
  createNearbySiteIcon,
  createUserTargetPinIcon,
  createDivingCenterIcon,
  createDiveTripIcon,
} from './mapPins';

describe('mapPins utilities', () => {
  describe('generateDivePinSvg', () => {
    it('generates a standard dive flag pin with Option B transparent hole mask', () => {
      const svg = generateDivePinSvg({ width: 36, height: 48 });

      expect(svg).toContain('<svg width="36" height="48" viewBox="0 0 36 48"');
      // Red background
      expect(svg).toContain('fill="#dc2626"');
      // White diagonal stripe
      expect(svg).toContain('fill="#ffffff"');
      // Navy border
      expect(svg).toContain('stroke="#0f172a"');
      // Transparent mask with black punch-out circle
      expect(svg).toContain('<mask id="pin-mask-');
      expect(svg).toContain('circle cx="18" cy="17" r="4.8" fill="black"');
    });

    it('generates ground base disc when baseDiscColor is provided', () => {
      const svg = generateDivePinSvg({
        width: 44,
        height: 56,
        baseDiscColor: '#10b981',
      });

      expect(svg).toContain('<svg width="44" height="56" viewBox="0 0 44 56"');
      expect(svg).toContain('fill="#10b981"');
      expect(svg).toContain('ellipse cx="22" cy="49"');
    });

    it('generates radiant gold double-disc when isMain is true', () => {
      const svg = generateDivePinSvg({
        width: 44,
        height: 56,
        isMain: true,
      });

      expect(svg).toContain('fill="#fef3c7"');
      expect(svg).toContain('stroke="#f59e0b"');
      expect(svg).toContain('fill="#f59e0b"');
    });

    it('generates solid color pin with emblem badge when requested (diving center)', () => {
      const svg = generateDivePinSvg({
        width: 30,
        height: 40,
        isSolidColor: true,
        solidFill: '#0284c7',
        badgeText: 'DC',
      });

      expect(svg).toContain('fill="#0284c7"');
      expect(svg).toContain('>DC</text>');
      expect(svg).not.toContain('<mask');
    });
  });

  describe('createDiveSiteIcon', () => {
    it('creates standard Leaflet Icon with anchor at bottom tip', () => {
      const icon = createDiveSiteIcon({ isMain: false });

      expect(icon.options.iconSize).toEqual([28, 37]);
      expect(icon.options.iconAnchor).toEqual([14, 37]);
      expect(icon.options.popupAnchor).toEqual([0, -37]);
      expect(icon.options.className).toBe('dive-site-pin');
      expect(icon.options.iconUrl).toContain('data:image/svg+xml');
    });

    it('creates main dive site Leaflet Icon with golden base disc and proper anchor', () => {
      const icon = createDiveSiteIcon({ isMain: true });

      expect(icon.options.iconSize).toEqual([40, 51]);
      // Anchor adjusted to base disc center: Math.round(51 * 49/56) = 45
      expect(icon.options.iconAnchor).toEqual([20, 45]);
      expect(icon.options.popupAnchor).toEqual([0, -51]);
      expect(icon.options.className).toBe('dive-site-main-pin');
    });

    it('creates dive site icon with weather suitability base disc', () => {
      const icon = createDiveSiteIcon({ suitabilityColor: '#10b981' });

      expect(icon.options.iconSize).toEqual([34, 43]);
      expect(icon.options.iconAnchor).toEqual([17, 38]);
      expect(icon.options.className).toBe('dive-site-pin');
    });
  });

  describe('createNearbySiteIcon', () => {
    it('creates amber nearby dive site icon', () => {
      const icon = createNearbySiteIcon();

      expect(icon.options.iconSize).toEqual([28, 37]);
      expect(icon.options.iconAnchor).toEqual([14, 37]);
      expect(icon.options.className).toBe('nearby-site-pin');
    });
  });

  describe('createUserTargetPinIcon', () => {
    it('creates Leaflet divIcon with target pulse element', () => {
      const icon = createUserTargetPinIcon();

      expect(icon.options.iconSize).toEqual([36, 48]);
      expect(icon.options.iconAnchor).toEqual([18, 48]);
      expect(icon.options.className).toBe('custom-user-target-pin');
      expect(icon.options.html).toContain('animation: ping');
    });
  });

  describe('createDivingCenterIcon', () => {
    it('creates diving center pin with DC emblem', () => {
      const icon = createDivingCenterIcon();

      expect(icon.options.iconSize).toEqual([30, 40]);
      expect(icon.options.iconAnchor).toEqual([15, 40]);
      expect(icon.options.className).toBe('diving-center-pin');
    });
  });

  describe('createDiveTripIcon', () => {
    it('creates trip icon based on date', () => {
      const icon = createDiveTripIcon({ tripDate: '2026-10-28' });

      expect(icon.options.iconSize).toEqual([30, 40]);
      expect(icon.options.className).toBe('dive-trip-pin');
    });
  });
});
