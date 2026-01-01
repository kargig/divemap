/**
 * Converts Flickr URLs (short or full) to direct image URLs using Flickr's oEmbed API
 * @param {string} flickrUrl - Flickr URL (short or full)
 * @returns {Promise<string>} Direct image URL or original URL if conversion fails
 */
export async function convertFlickrUrlToDirectImage(flickrUrl) {
  if (!flickrUrl || typeof flickrUrl !== 'string') {
    return flickrUrl;
  }

  // Check if it's a Flickr URL
  const isFlickrShort = flickrUrl.includes('flic.kr/p/');
  const isFlickrFull = flickrUrl.includes('flickr.com/photos/');

  if (!isFlickrShort && !isFlickrFull) {
    return flickrUrl; // Not a Flickr URL, return as-is
  }

  try {
    // Use backend proxy endpoint to avoid CORS issues
    const { getFlickrOembed } = await import('../api');
    const result = await getFlickrOembed(flickrUrl);

    // Return the direct image URL if available
    if (result.direct_image_url) {
      return result.direct_image_url;
    }

    // Fallback: try to extract from oembed_data HTML
    if (result.oembed_data?.html) {
      const imgMatch = result.oembed_data.html.match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

    // Fallback: if HTML extraction fails, try data.url (though it's usually the page URL)
    if (result.oembed_data?.url && result.oembed_data.url.includes('staticflickr.com')) {
      return result.oembed_data.url;
    }

    return flickrUrl; // Return original if we can't extract
  } catch (error) {
    console.warn('Error converting Flickr URL:', error);
    return flickrUrl; // Return original URL on error
  }
}

/**
 * Checks if a URL is a Flickr URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isFlickrUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('flic.kr/p/') || url.includes('flickr.com/photos/');
}
