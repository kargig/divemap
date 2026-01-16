import { useRef, useEffect } from 'react';
import LightboxComponent from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';

import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import ReactImage from './ReactImage';

/**
 * The purpose of this intermediate component is to load the Lightbox and
 * its CSS dynamically only when the lightbox becomes interactive
 */
// Default plugins configuration - available for children to extend
export const defaultPlugins = [Inline, Counter];

export default function Lightbox(props) {
  // Extract styles, thumbnails, plugins, and counter from props to merge them properly
  const {
    styles: propsStyles,
    thumbnails: propsThumbnails,
    plugins: propsPlugins,
    counter: propsCounter,
    ...restProps
  } = props;

  // Create captions ref to control visibility
  const captionsRef = useRef(null);

  // Extract on handlers from props to merge with our handlers
  const { on: propsOn, ...otherRestProps } = restProps;

  // Hide captions by default in inline mode, show in fullscreen
  const handleFullscreenChange = fullscreen => {
    if (captionsRef.current) {
      if (fullscreen) {
        captionsRef.current.show();
      } else {
        captionsRef.current.hide();
      }
    }
  };

  // Merge on handlers
  const mergedOn = {
    ...propsOn,
    fullscreen: fullscreen => {
      handleFullscreenChange(fullscreen);
      propsOn?.fullscreen?.(fullscreen);
    },
  };

  // Hide captions by default when component mounts (inline mode)
  useEffect(() => {
    // Small delay to ensure captions ref is initialized
    const timer = setTimeout(() => {
      if (captionsRef.current && captionsRef.current.visible) {
        captionsRef.current.hide();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // CSS for active thumbnail
  useEffect(() => {
    const styleId = 'lightbox-active-thumbnail';
    let styleElement = document.getElementById(styleId);
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      .yarl__thumbnails .yarl__thumbnail.yarl__thumbnail_active,
      .yarl__thumbnails .yarl__thumbnail_active,
      .yarl__thumbnail.yarl__thumbnail_active,
      .yarl__thumbnails .yarl__thumbnail[aria-current="true"],
      [class*="yarl__thumbnail"][class*="active"],
      [class*="thumbnail"][class*="active"] {
        border: 4px solid #2d6b8a !important;
      }
    `;
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);

  // Merge plugins config - default plugins are merged with children plugins
  const pluginsConfig =
    propsPlugins !== undefined ? [...defaultPlugins, ...propsPlugins] : defaultPlugins;

  // Merge thumbnails config - always enforce 40x40 size
  const thumbnailsConfig = {
    position: 'bottom',
    showToggle: true,
    vignette: false,
    ...propsThumbnails,
  };

  // Merge styles - always enforce 40x40 thumbnail size
  const defaultThumbnailStyle = {
    width: 50,
    height: 50,
    minWidth: 50,
    minHeight: 50,
    maxWidth: 50,
    maxHeight: 50,
  };
  const mergedStyles = {
    container: {
      background: 'transparent',
    },
    ...propsStyles,
    thumbnail: {
      ...defaultThumbnailStyle,
      ...(propsStyles?.thumbnail || {}),
    },
    thumbnailsContainer: {
      background: 'transparent',
      padding: '2x', // Reduced from default 16px to decrease container height
      paddingTop: '2px',
      paddingBottom: '2px',
      paddingLeft: '2px',
      paddingRight: '2px',
      ...(propsStyles?.thumbnailsContainer || {}), // Merge with any existing thumbnailsContainer styles
    },
    // Disable thumbnail navigation buttons/fade effects
    thumbnailsPrev: {
      display: 'none',
    },
    thumbnailsNext: {
      display: 'none',
    }
  };

  // Counter config - always blue
  const counterConfig = {
    container: {
      style: {
        color: '#2563eb', // blue-600 (like links)
      },
    },
    ...propsCounter,
  };

  return (
    <LightboxComponent
      inline={{
        style: { width: '100%', maxWidth: '900px', aspectRatio: '16 / 9' },
      }}
      carousel={{
        // finite: true,
        preload: 4
      }}
      plugins={pluginsConfig}
      render={{ slide: ReactImage, thumbnail: ReactImage }}
      thumbnails={thumbnailsConfig}
      counter={counterConfig}
      styles={mergedStyles}
      captions={{
        ref: captionsRef,
        showToggle: true,
        descriptionTextAlign: 'start',
        descriptionMaxLines: 3,
      }}
      on={mergedOn}
      {...otherRestProps}
    />
  );
}
