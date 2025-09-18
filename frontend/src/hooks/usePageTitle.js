import { useEffect } from 'react';

/**
 * Custom hook for managing page titles
 * @param {string} title - The page title to set
 * @param {boolean} enabled - Whether to update the title (default: true)
 */
const usePageTitle = (title, enabled = true) => {
  useEffect(() => {
    if (enabled && title) {
      document.title = title;
    }
  }, [title, enabled]);
};

export default usePageTitle;
