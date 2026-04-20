import { describe, it, expect } from 'vitest';

import {
  extractYouTubeVideoId,
  isYouTubeUrl,
  isVimeoUrl,
  getYouTubeEmbedUrl,
} from './youtubeHelpers';

describe('youtubeHelpers', () => {
  describe('isYouTubeUrl', () => {
    it('should identify valid YouTube watch URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('should identify valid short YouTube URLs', () => {
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('should identify valid YouTube embed URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
    });

    it('should identify URLs without protocol', () => {
      expect(isYouTubeUrl('youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('should reject non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://google.com')).toBe(false);
      expect(isYouTubeUrl('https://vimeo.com/12345')).toBe(false);
    });

    it('should reject malicious bypass attempts', () => {
      // Substring attacks
      expect(isYouTubeUrl('https://evil-site.com/youtube.com/watch?v=123')).toBe(false);
      expect(isYouTubeUrl('https://youtube.com.evil.com')).toBe(false);
      expect(isYouTubeUrl('https://evil.com?q=youtube.com')).toBe(false);
    });
  });

  describe('extractYouTubeVideoId', () => {
    it('should extract ID from standard watch URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'dQw4w9WgXcQ'
      );
    });

    it('should extract ID from short URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from URLs without protocol', () => {
      expect(extractYouTubeVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URLs', () => {
      expect(extractYouTubeVideoId('https://google.com')).toBe(null);
      expect(extractYouTubeVideoId('Not a URL')).toBe(null);
    });
  });

  describe('isVimeoUrl', () => {
    it('should identify valid Vimeo URLs', () => {
      expect(isVimeoUrl('https://vimeo.com/123456789')).toBe(true);
      expect(isVimeoUrl('https://player.vimeo.com/video/123456789')).toBe(true);
    });

    it('should identify Vimeo URLs without protocol', () => {
      expect(isVimeoUrl('vimeo.com/123456789')).toBe(true);
    });

    it('should reject malicious bypass attempts', () => {
      expect(isVimeoUrl('https://evil.com/vimeo.com')).toBe(false);
      expect(isVimeoUrl('https://vimeo.com.attacker.com')).toBe(false);
    });
  });

  describe('getYouTubeEmbedUrl', () => {
    it('should generate a correct embed URL', () => {
      expect(getYouTubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('should handle options like autoplay', () => {
      const url = getYouTubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true });
      expect(url).toContain('autoplay=1');
      expect(url).toContain('mute=1');
    });
  });
});
