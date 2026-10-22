import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PROFILE_TABS = ['account', 'credentials', 'operations', 'preferences'];

const getUsername = path => {
  const match = path.match(/^\/users\/([^/]+)/);
  return match ? match[1] : null;
};

const getProfileTab = path => {
  const match = path.match(/^\/profile\/([^/]+)/);
  return match && PROFILE_TABS.includes(match[1]) ? match[1] : null;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    // Only suppress scroll-to-top when switching tabs on the SAME user profile
    const prevUser = getUsername(prev);
    const nextUser = getUsername(pathname);
    const isSameUserTabSwitch = Boolean(prevUser && nextUser && prevUser === nextUser);

    // Only suppress scroll-to-top when switching between the 4 account hub tabs
    const isProfileHubTabSwitch = Boolean(getProfileTab(prev) && getProfileTab(pathname));

    if (isSameUserTabSwitch || isProfileHubTabSwitch) {
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
