import { Camera, Video, Play, ExternalLink } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import { decodeHtmlEntities } from '../utils/htmlDecode';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isYouTubeUrl,
} from '../utils/youtubeHelpers';

const DiveSiteMediaPreview = ({
  media = [],
  featuredItem = null,
  photosCount = 0,
  videosCount = 0,
  onOpenPhoto,
  onOpenVideo,
  onViewAll,
  getImageUrl = url => url,
}) => {
  const [imageError, setImageError] = useState(false);

  if (!featuredItem || !media || media.length === 0) {
    return null;
  }

  const isVideo =
    featuredItem.media_type === 'video' ||
    isYouTubeUrl(featuredItem.url) ||
    featuredItem.url?.includes('.mp4');

  const handleClick = () => {
    if (isVideo) {
      if (onOpenVideo) onOpenVideo(featuredItem);
    } else {
      if (onOpenPhoto) onOpenPhoto(featuredItem);
    }
  };

  // Resolve thumbnail source
  let mediaSrc = '';
  if (isVideo) {
    if (isYouTubeUrl(featuredItem.url)) {
      const videoId = extractYouTubeVideoId(featuredItem.url);
      mediaSrc = getYouTubeThumbnailUrl(videoId, 'hq');
    } else {
      mediaSrc = getImageUrl(featuredItem.thumbnail_url || featuredItem.url);
    }
  } else {
    mediaSrc = getImageUrl(
      featuredItem.medium_url || featuredItem.thumbnail_url || featuredItem.url
    );
  }

  const rawDesc = decodeHtmlEntities(featuredItem.description) || '';
  const cleanDesc = rawDesc.replace(/^By:\s*None\s*/i, '').trim();
  const altText = cleanDesc || 'Dive site media preview';
  const labelText = cleanDesc || (isVideo ? 'Watch video' : 'Tap to enlarge');
  const totalCount = photosCount + videosCount;

  return (
    <div className='w-full md:w-5/12 lg:w-2/5 shrink-0'>
      <div
        onClick={handleClick}
        className='group relative aspect-[16/10] sm:aspect-[4/3] md:aspect-[16/10] w-full rounded-2xl overflow-hidden border border-gray-200/80 dark:border-gray-700/80 bg-gray-900 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer'
        role='button'
        tabIndex={0}
        aria-label={isVideo ? 'Play video' : 'View photo in gallery'}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {!imageError ? (
          <img
            src={mediaSrc}
            alt={altText}
            onError={() => setImageError(true)}
            className='w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105'
            loading='lazy'
          />
        ) : (
          <div className='w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-blue-200 p-4 text-center'>
            <Camera className='w-10 h-10 mb-2 opacity-60' />
            <span className='text-xs font-semibold opacity-80'>Photo preview</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none' />

        {/* Video Play Button Overlay */}
        {isVideo && (
          <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
            <div className='w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl transform transition-transform duration-300 group-hover:scale-110 group-hover:bg-red-600'>
              <Play className='w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-current' />
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className='absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none'>
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-sm'>
            {isVideo ? (
              <>
                <Video className='w-3 h-3 text-red-400' />
                <span>
                  {videosCount} {videosCount === 1 ? 'Video' : 'Videos'}
                </span>
              </>
            ) : (
              <>
                <Camera className='w-3 h-3 text-blue-300' />
                <span>
                  {photosCount} {photosCount === 1 ? 'Photo' : 'Photos'}
                </span>
              </>
            )}
          </span>
        </div>

        {/* Bottom Bar: Action prompt */}
        <div className='absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white pointer-events-none'>
          <span className='text-xs font-medium truncate drop-shadow-sm max-w-[70%]'>
            {labelText}
          </span>
          {totalCount > 1 && (
            <span className='inline-flex items-center gap-1 text-[11px] font-semibold text-blue-200 group-hover:text-white drop-shadow-sm transition-colors'>
              <span>All ({totalCount})</span>
              <ExternalLink className='w-3 h-3' />
            </span>
          )}
        </div>
      </div>

      {totalCount > 1 && onViewAll && (
        <div className='mt-2 text-right'>
          <button
            type='button'
            onClick={e => {
              e.stopPropagation();
              onViewAll();
            }}
            className='text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1'
          >
            <span>View all photos & videos ({totalCount})</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
};

DiveSiteMediaPreview.propTypes = {
  media: PropTypes.array,
  featuredItem: PropTypes.object,
  photosCount: PropTypes.number,
  videosCount: PropTypes.number,
  onOpenPhoto: PropTypes.func,
  onOpenVideo: PropTypes.func,
  onViewAll: PropTypes.func,
  getImageUrl: PropTypes.func,
};

export default DiveSiteMediaPreview;
