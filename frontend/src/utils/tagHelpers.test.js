import { describe, it, expect } from 'vitest';

import { getTagColor } from './tagHelpers';

describe('tagHelpers', () => {
  describe('getTagColor', () => {
    it('returns exact match for known tags', () => {
      expect(getTagColor('beginner')).toBe('tag-color-okabe-green');
      expect(getTagColor('intermediate')).toBe('tag-color-okabe-yellow');
      expect(getTagColor('advanced')).toBe('tag-color-okabe-orange');
      expect(getTagColor('expert')).toBe('tag-color-okabe-vermillion');
      expect(getTagColor('photography')).toBe('tag-color-okabe-yellow');
      expect(getTagColor('deep')).toBe('tag-color-okabe-blue');
      expect(getTagColor('wreck')).toBe('tag-color-okabe-purple');
      expect(getTagColor('drift')).toBe('tag-color-okabe-sky');
    });

    it('is case-insensitive', () => {
      expect(getTagColor('PHOTOGRAPHY')).toBe('tag-color-okabe-yellow');
      expect(getTagColor('Beginner')).toBe('tag-color-okabe-green');
      expect(getTagColor('Wreck Dive')).toBe('tag-color-okabe-purple');
    });

    it('matches partial tag names', () => {
      expect(getTagColor('Underwater Photography')).toBe('tag-color-okabe-yellow');
      expect(getTagColor('Boat Dive')).toBe('tag-color-okabe-blue');
      expect(getTagColor('Shore Diving')).toBe('tag-color-okabe-green');
      expect(getTagColor('Deep Sea')).toBe('tag-color-okabe-blue');
    });

    it('returns a deterministic Okabe-Ito color class for unknown tags', () => {
      const validClasses = [
        'tag-color-okabe-blue',
        'tag-color-okabe-orange',
        'tag-color-okabe-green',
        'tag-color-okabe-vermillion',
        'tag-color-okabe-purple',
        'tag-color-okabe-yellow',
        'tag-color-okabe-sky',
      ];

      const color1 = getTagColor('custom-xyz-123');
      const color2 = getTagColor('custom-xyz-123');

      expect(validClasses).toContain(color1);
      expect(color1).toBe(color2); // Deterministic
    });
  });
});
