import { useState } from 'react';
import {
  isImageFitCover,
  isImageSlide,
  useLightboxProps,
  useLightboxState,
} from 'yet-another-react-lightbox';

function isReactImage(slide) {
  return isImageSlide(slide) && typeof slide.width === 'number' && typeof slide.height === 'number';
}

export default function ReactImage({ slide, offset, rect }) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps();

  const { currentIndex } = useLightboxState();
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState(slide.src);

  const cover = isImageSlide(slide) && isImageFitCover(slide, imageFit);

  if (!isReactImage(slide)) return undefined;

  const width = !cover
    ? Math.round(Math.min(rect.width, (rect.height / slide.height) * slide.width))
    : rect.width;

  const height = !cover
    ? Math.round(Math.min(rect.height, (rect.width / slide.width) * slide.height))
    : rect.height;

  const handleImageError = () => {
    if (!imageError) {
      setImageError(true);
      // Try to show a fallback or error message
    }
  };

  return (
    <div style={{ position: 'relative', width, height }}>
      {imageError ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1f2937',
            color: '#9ca3af',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖼️</div>
          <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Failed to load image</div>
          {slide.src && (
            <a
              href={slide.src}
              target='_blank'
              rel='noopener noreferrer'
              style={{
                color: '#3b82f6',
                textDecoration: 'underline',
                fontSize: '0.875rem',
              }}
            >
              Open in new tab
            </a>
          )}
        </div>
      ) : (
        <img
          alt={slide.alt || ''}
          src={imageSrc}
          loading='eager'
          draggable={false}
          onError={handleImageError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: cover ? 'cover' : 'contain',
            cursor: click ? 'pointer' : undefined,
          }}
          onClick={offset === 0 ? () => click?.({ index: currentIndex }) : undefined}
        />
      )}
    </div>
  );
}

