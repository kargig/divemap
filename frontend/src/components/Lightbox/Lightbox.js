import { useRef, useEffect } from 'react';
import LightboxComponent from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';


import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import ReactImage from './ReactImage';

/**
 * The purpose of this intermediate component is to load the Lightbox and
 * its CSS dynamically only when the lightbox becomes interactive
 */
// Default plugins configuration - available for children to extend
export const defaultPlugins = [Inline];

export default function Lightbox(props) {
  // Extract styles, thumbnails, and plugins from props to merge them properly
  const { styles: propsStyles, thumbnails: propsThumbnails, plugins: propsPlugins, ...restProps } = props;
  
  // Create captions ref to control visibility
  const captionsRef = useRef(null);
  
  // Extract on handlers from props to merge with our handlers
  const { on: propsOn, ...otherRestProps } = restProps;
  
  // Hide captions by default in inline mode, show in fullscreen
  const handleFullscreenChange = (fullscreen) => {
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
    fullscreen: (fullscreen) => {
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

  // Merge plugins config - default plugins are merged with children plugins
  const pluginsConfig = propsPlugins !== undefined 
    ? [...defaultPlugins, ...propsPlugins]
    : defaultPlugins;

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
    minHeight:50,
    maxWidth: 50, 
    maxHeight: 50 
  };
  const mergedStyles = {
    container: { 
      background: 'linear-gradient(to bottom, rgba(164, 204, 255, 0.98), rgba(76, 123, 253, 0.98))' // White crystal to beige gradient
    },
    ...propsStyles,
    thumbnail: {
      ...defaultThumbnailStyle,
      ...(propsStyles?.thumbnail || {})
    },
    thumbnailsContainer: {
      background: 'linear-gradient(to right, rgba(164, 204, 255, 0.98), rgba(76, 123, 253, 0.98))',
      padding: '2x', // Reduced from default 16px to decrease container height
      paddingTop: '2px',
      paddingBottom: '2px',
      paddingLeft: '2px',
      paddingRight: '2px',
      ...(propsStyles?.thumbnailsContainer || {}) // Merge with any existing thumbnailsContainer styles
    },
    // Disable thumbnail navigation buttons/fade effects
    thumbnailsPrev: {
      display: 'none'
    },
    thumbnailsNext: {
      display: 'none'
    }
  };

  return (
    <LightboxComponent
      // add plugins here
      // plugins={[]}
      inline={{
        style: { width: '100%', maxWidth: '900px', aspectRatio: '16 / 9' },
      }}
      carousel={{
        finite: true,
      }}
      plugins={pluginsConfig}
      render={{ slide: ReactImage, thumbnail: ReactImage }}
      thumbnails={thumbnailsConfig}
      styles={mergedStyles}
      captions={{ 
        ref: captionsRef,
        showToggle: true, 
        descriptionTextAlign: 'start', 
        descriptionMaxLines: 3
      }}
      on={mergedOn}
      {...otherRestProps}
    />
  );
}
