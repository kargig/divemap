import { useQuery } from 'react-query';

import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';

/**
 * Hook to convert Flickr URLs to direct image URLs
 * @param {Array} mediaItems - List of media items to process
 * @param {Function} isVideoUrl - Helper to check if URL is video (optional)
 * @returns {Map} Map of original URL to converted URL
 */
export const useFlickrImages = (mediaItems = [], isVideoUrl = () => false) => {
  return useQuery(
    ['flickr-conversions', mediaItems.map(m => m.id)], // Use IDs for stability
    async () => {
      const convertedMap = new Map();

      if (!mediaItems || mediaItems.length === 0) return convertedMap;

      // Filter for Flickr photos
      const flickrPhotos = mediaItems.filter(
        item => item.media_type === 'photo' && !isVideoUrl(item.url) && isFlickrUrl(item.url)
      );

      if (flickrPhotos.length === 0) return convertedMap;

      // Process in parallel
      await Promise.all(
        flickrPhotos.map(async photo => {
          try {
            const directUrl = await convertFlickrUrlToDirectImage(photo.url);
            if (directUrl !== photo.url) {
              convertedMap.set(photo.url, directUrl);
            }
          } catch (error) {
            console.warn('Failed to convert Flickr URL:', photo.url, error);
          }
        })
      );

      return convertedMap;
    },
    {
      enabled: !!mediaItems && mediaItems.length > 0,
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      placeholderData: new Map(),
    }
  );
};

export default useFlickrImages;
