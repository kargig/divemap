import { useEffect } from 'react';

/**
 * Hook that alerts clicks outside of the passed ref
 * @param {React.RefObject} ref - The ref to the element to detect clicks outside of
 * @param {Function} handler - Function to call when a click outside occurs
 * @param {boolean} enabled - Whether the listener should be active
 */
const useClickOutside = (ref, handler, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = event => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };

    const handleEscapeKey = event => {
      if (event.key === 'Escape') {
        handler(event);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [ref, handler, enabled]);
};

export default useClickOutside;
