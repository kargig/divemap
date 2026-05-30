import { Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

/**
 * A sentinel component that triggers a callback when it enters the viewport.
 * Used for implementing infinite scrolling.
 */
const InfiniteScrollTrigger = ({
  onIntersect,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = '200px',
  threshold = 0.1,
  className = '',
}) => {
  const { ref, inView } = useInView({
    rootMargin,
    threshold,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      onIntersect();
    }
  }, [inView, hasNextPage, isFetchingNextPage, onIntersect]);

  if (!hasNextPage && !isFetchingNextPage) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`flex justify-center items-center py-8 w-full ${className}`}
      aria-live='polite'
      aria-busy={isFetchingNextPage}
    >
      {isFetchingNextPage ? (
        <div className='flex flex-col items-center gap-2'>
          <Loader2 className='h-8 w-8 text-blue-500 animate-spin' />
          <span className='text-sm text-gray-500 font-medium'>Loading more...</span>
        </div>
      ) : (
        /* Invisible sentinel when not loading but more pages available */
        <div className='h-4 w-full' />
      )}
    </div>
  );
};

InfiniteScrollTrigger.propTypes = {
  /** Callback function to trigger when the component becomes visible */
  onIntersect: PropTypes.func.isRequired,
  /** Whether there are more pages to load */
  hasNextPage: PropTypes.bool.isRequired,
  /** Whether a fetch for the next page is currently in progress */
  isFetchingNextPage: PropTypes.bool.isRequired,
  /** Margin around the root. Can have values similar to the CSS margin property. */
  rootMargin: PropTypes.string,
  /** Number between 0 and 1 indicating the percentage of the element that should be visible before triggering */
  threshold: PropTypes.number,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default InfiniteScrollTrigger;
