import { describe, it, expect } from 'vitest';

import { isFlickrUrl } from './flickrHelpers';

describe('flickrHelpers', () => {
  describe('isFlickrUrl', () => {
    it('should identify valid Flickr photo page URLs', () => {
      expect(isFlickrUrl('https://www.flickr.com/photos/user/12345')).toBe(true);
      expect(isFlickrUrl('https://flickr.com/photos/user/12345')).toBe(true);
    });

    it('should identify valid short Flickr URLs', () => {
      expect(isFlickrUrl('https://flic.kr/p/abcd')).toBe(true);
    });

    it('should identify Flickr URLs without protocol', () => {
      expect(isFlickrUrl('flickr.com/photos/user/12345')).toBe(true);
      expect(isFlickrUrl('flic.kr/p/abcd')).toBe(true);
    });

    it("should reject direct image URLs (they don't need conversion)", () => {
      // These are valid images but they don't match the /photos/ or /p/ pattern
      // so they return false and are used as-is in the conversion function.
      expect(isFlickrUrl('https://live.staticflickr.com/65535/5123_abc.jpg')).toBe(false);
    });

    it('should reject non-Flickr URLs', () => {
      expect(isFlickrUrl('https://google.com')).toBe(false);
      expect(isFlickrUrl('https://youtube.com/watch?v=123')).toBe(false);
    });

    it('should reject malicious bypass attempts', () => {
      expect(isFlickrUrl('https://evil.com/flickr.com/photos/')).toBe(false);
      expect(isFlickrUrl('https://flickr.com.attacker.com/p/123')).toBe(false);
    });
  });
});
