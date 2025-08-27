import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for responsive behavior and scroll detection
 * Provides viewport detection, scroll direction, and scroll position tracking
 */
export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Check viewport size and device type
  const checkViewport = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set viewport dimensions
    setViewport({ width, height });

    // Determine device type
    const mobile = width <= 768 || height <= 650;
    const tablet = width > 768 && width < 1024;
    const desktop = width >= 1024;

    setIsMobile(mobile);
    setIsTablet(tablet);
    setIsDesktop(desktop);
  }, []);

  useEffect(() => {
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [checkViewport]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    viewport,
    // Helper for specific mobile viewport (355x605)
    isTargetMobile: isMobile && viewport.width <= 400 && viewport.height <= 650,
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
