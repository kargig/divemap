import { Play } from 'lucide-react';
import React, { useState } from 'react';

import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
} from '../utils/youtubeHelpers';

import Modal from './ui/Modal';

/**
 * YouTube video preview component that shows thumbnail with play button
 * and opens video in modal or new tab on click
 */
const YouTubePreview = ({ url, description, className = '', onPlay, openInNewTab = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId, 'maxres');
  const embedUrl = getYouTubeEmbedUrl(videoId);
  const watchUrl = getYouTubeWatchUrl(videoId);

  const handleClick = () => {
    if (onPlay) {
      onPlay(videoId, url);
    } else if (openInNewTab) {
      window.open(watchUrl, '_blank', 'noopener,noreferrer');
    } else {
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className={`relative group cursor-pointer ${className}`} onClick={handleClick}>
        <div className='aspect-video bg-gray-200 rounded-lg overflow-hidden'>
          <img
            src={thumbnailUrl}
            alt={description || 'YouTube video thumbnail'}
            className='w-full h-full object-cover'
            onError={e => {
              // Fallback to medium quality if maxres fails
              e.target.src = getYouTubeThumbnailUrl(videoId, 'high');
            }}
          />
          <div className='absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center'>
            <div className='bg-red-600 rounded-full p-3 group-hover:scale-110 transition-transform duration-200'>
              <Play className='h-6 w-6 text-white fill-white' />
            </div>
          </div>
          <div className='absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded'>
            YouTube
          </div>
        </div>
        {description && (
          <div className='p-3'>
            <p className='text-sm text-gray-600 line-clamp-2'>{description}</p>
          </div>
        )}
      </div>

      {/* Modal for embedded video */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title='YouTube Video'
        className='max-w-4xl w-full max-h-full'
        overlayClassName='bg-opacity-75'
      >
        <div className='p-0'>
          <div className='aspect-video'>
            <iframe
              src={embedUrl}
              title='YouTube video'
              className='w-full h-full rounded'
              allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
              allowFullScreen
            />
          </div>
          {description && <p className='mt-4 text-gray-600'>{description}</p>}
        </div>
      </Modal>
    </>
  );
};

export default YouTubePreview;
