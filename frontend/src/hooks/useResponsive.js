import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for responsive behavior and scroll detection
 * Provides viewport detection, scroll direction, and scroll position tracking
 */
export const useResponsive = () => {
  // Initialize state based on window if available to prevent flash of wrong content
  const getInitialState = () => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      const height = window.innerHeight;
      return {
        width,
        height,
        isMobile: width <= 768 || height <= 650,
        isTablet: width > 768 && width < 1024,
        isDesktop: width >= 1024,
      };
    }
    // Default fallback for SSR or initial render if window not available
    return {
      width: 0,
      height: 0,
      isMobile: false,
      isTablet: false,
      isDesktop: false,
    };
  };

  const [state, setState] = useState(getInitialState);

  // Check viewport size and device type
  const checkViewport = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    setState({
      width,
      height,
      isMobile: width <= 768 || height <= 650,
      isTablet: width > 768 && width < 1024,
      isDesktop: width >= 1024,
    });
  }, []);

  useEffect(() => {
    // Ensure we sync on mount just in case (e.g. hydration mismatch, though rare with window init)
    // Actually, initializing with window.innerWidth causes hydration mismatch in SSR (Next.js),
    // but this project seems to be Client-Side React (Vite).
    // If CSR, this is fine. If SSR, we should default to false and useLayoutEffect/useEffect.
    // Assuming CSR given 'vite' and 'index.html'.

    // We add listener
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [checkViewport]);

  return {
    isMobile: state.isMobile,
    isTablet: state.isTablet,
    isDesktop: state.isDesktop,
    viewport: { width: state.width, height: state.height },
    // Helper for specific mobile viewport (355x605)
    isTargetMobile: state.isMobile && state.width <= 400 && state.height <= 650,
  };
};

/**
 * Custom hook for scroll-based behavior
 * Tracks scroll direction, position, and provides responsive UI state
 */
export const useScrollBehavior = () => {
  const [scrollDirection, setScrollDirection] = useState('none');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [navbarVisible, setNavbarVisible] = useState(true);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [quickFiltersVisible, setQuickFiltersVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentPosition = window.pageYOffset;
      const direction = currentPosition > lastScrollPosition ? 'down' : 'up';

      setScrollPosition(currentPosition);
      setScrollDirection(direction);
      setLastScrollPosition(currentPosition);

      // Navbar behavior
      if (currentPosition <= 0) {
        // At the top: show navbar, hide search bar and quick filters
        setNavbarVisible(true);
        setSearchBarVisible(false);
        setQuickFiltersVisible(false);
      } else if (direction === 'up') {
        // Scrolling up: hide navbar, show only quick filters at top
        setNavbarVisible(false);
        setQuickFiltersVisible(true);
        setSearchBarVisible(false);
      } else {
        // Scrolling down: hide navbar, show search bar at top with quick filters below
        setNavbarVisible(false);
        setSearchBarVisible(true);
        setQuickFiltersVisible(true);
      }
    };

    // Throttle scroll events for performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            handleScroll();
            ticking = false;
          });
        } else {
          // Fallback for environments without requestAnimationFrame
          setTimeout(() => {
            handleScroll();
            ticking = false;
          }, 16); // ~60fps
        }
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledHandleScroll);
  }, [lastScrollPosition]);

  return {
    scrollDirection,
    scrollPosition,
    navbarVisible,
    searchBarVisible,
    quickFiltersVisible,
    // Helper to check if we're at the top
    isAtTop: scrollPosition <= 0,
  };
};

/**
 * Combined hook that provides both responsive and scroll behavior
 */
export const useResponsiveScroll = () => {
  const responsive = useResponsive();
  const scroll = useScrollBehavior();

  return {
    ...responsive,
    ...scroll,
  };
};
