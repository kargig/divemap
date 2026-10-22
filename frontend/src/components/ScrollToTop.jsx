import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    // Do not scroll to top when switching between tabs on profile or users
    const isProfileTabSwitch = prev.startsWith('/profile/') && pathname.startsWith('/profile/');
    const isUserTabSwitch = prev.startsWith('/users/') && pathname.startsWith('/users/');

    if (isProfileTabSwitch || isUserTabSwitch) {
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
