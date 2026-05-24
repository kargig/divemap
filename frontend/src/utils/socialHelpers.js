import api from '../api';

import { extractErrorMessage } from './apiErrors';

/**
 * Generates a social media image for a dive.
 *
 * @param {number|string} diveId - The ID of the dive
 * @param {string} mediaUrl - The URL of the image to use
 * @param {number|string} mediaId - The ID of the media record (for trusted lookup)
 * @param {object} crop - Crop parameters {x, y, width, height, unit}
 * @returns {Promise<Blob>} The generated image as a blob
 */
export const generateSocialImage = async (diveId, mediaUrl, mediaId, crop) => {
  try {
    const response = await api.post(
      `/api/v1/dives/${diveId}/social-image`,
      {
        media_url: mediaUrl,
        media_id: mediaId,
        crop: crop,
      },
      {
        responseType: 'blob', // Crucial for binary image data
      }
    );
    return response.data;
  } catch (error) {
    throw extractErrorMessage(error);
  }
};

/**
 * Downloads a blob as a file.
 *
 * @param {Blob} blob - The blob to download
 * @param {string} fileName - The name of the file
 */
export const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};
