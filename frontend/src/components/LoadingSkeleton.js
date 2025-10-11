import PropTypes from 'prop-types';
import React from 'react';

/**
 * LoadingSkeleton Component
 *
 * Provides skeleton loading states for different content types
 * to improve perceived performance and user experience.
 */
const LoadingSkeleton = ({ type = 'card', count = 1, className = '', compact = false }) => {
  // Card skeleton for dive sites/diving centers
  const CardSkeleton = () => (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${
        compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4'
      }`}
    >
      <div className='animate-pulse'>
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-start gap-2 mb-2'>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-col gap-0'>
                  {/* Title skeleton */}
                  <div
                    className={`h-4 bg-gray-200 rounded w-3/4 mb-2 ${compact ? 'h-3' : 'h-4'}`}
                  ></div>
                  {/* Subtitle skeleton */}
                  <div
                    className={`h-3 bg-gray-200 rounded w-1/2 mb-2 ${compact ? 'h-2' : 'h-3'}`}
                  ></div>
                </div>
              </div>
            </div>

            {/* Description skeleton */}
            <div className='space-y-2 mb-3'>
              <div className='h-3 bg-gray-200 rounded w-full'></div>
              <div className='h-3 bg-gray-200 rounded w-5/6'></div>
            </div>

            {/* Tags skeleton */}
            <div className='flex flex-wrap gap-1 mb-3'>
              <div className='h-6 bg-gray-200 rounded-full w-16'></div>
              <div className='h-6 bg-gray-200 rounded-full w-20'></div>
              <div className='h-6 bg-gray-200 rounded-full w-14'></div>
            </div>

            {/* Stats skeleton */}
            <div className='flex flex-wrap gap-3 text-sm text-gray-600'>
              <div className='h-4 bg-gray-200 rounded w-12'></div>
              <div className='h-4 bg-gray-200 rounded w-16'></div>
              <div className='h-4 bg-gray-200 rounded w-14'></div>
            </div>
          </div>

          {/* Action button skeleton */}
          <div className='sm:hidden'>
            <div className='h-8 bg-gray-200 rounded w-16'></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Pagination skeleton
  const PaginationSkeleton = () => (
    <div className='bg-white rounded-lg shadow-md p-2 sm:p-4 lg:p-6'>
      <div className='animate-pulse'>
        <div className='flex flex-col lg:flex-row justify-between items-center gap-2 sm:gap-4'>
          <div className='flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto'>
            {/* Page size selection skeleton */}
            <div className='flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-start'>
              <div className='h-4 bg-gray-200 rounded w-8'></div>
              <div className='h-8 bg-gray-200 rounded w-12'></div>
              <div className='h-4 bg-gray-200 rounded w-16'></div>
            </div>

            {/* Pagination info skeleton */}
            <div className='h-4 bg-gray-200 rounded w-32'></div>

            {/* Pagination navigation skeleton */}
            <div className='flex items-center gap-1 sm:gap-2'>
              <div className='h-8 bg-gray-200 rounded w-8'></div>
              <div className='h-4 bg-gray-200 rounded w-20'></div>
              <div className='h-8 bg-gray-200 rounded w-8'></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Filter skeleton
  const FilterSkeleton = () => (
    <div className='animate-pulse'>
      {/* Desktop search bar skeleton */}
      <div className='hidden sm:block mb-4'>
        <div className='h-10 bg-gray-200 rounded-lg'></div>
      </div>

      {/* Filter controls skeleton */}
      <div className='flex flex-wrap gap-2 mb-4'>
        <div className='h-8 bg-gray-200 rounded w-20'></div>
        <div className='h-8 bg-gray-200 rounded w-24'></div>
        <div className='h-8 bg-gray-200 rounded w-16'></div>
        <div className='h-8 bg-gray-200 rounded w-28'></div>
      </div>

      {/* Quick filters skeleton */}
      <div className='flex flex-wrap gap-2'>
        <div className='h-8 bg-gray-200 rounded-full w-16'></div>
        <div className='h-8 bg-gray-200 rounded-full w-20'></div>
        <div className='h-8 bg-gray-200 rounded-full w-18'></div>
      </div>
    </div>
  );

  // Map skeleton
  const MapSkeleton = () => (
    <div className='bg-white rounded-lg shadow-md p-4 mb-6'>
      <div className='animate-pulse'>
        <div className='h-6 bg-gray-200 rounded w-1/3 mb-4'></div>
        <div className='h-96 sm:h-[500px] lg:h-[600px] bg-gray-200 rounded-lg'></div>
      </div>
    </div>
  );

  // Render appropriate skeleton based on type
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return <CardSkeleton />;
      case 'pagination':
        return <PaginationSkeleton />;
      case 'filter':
        return <FilterSkeleton />;
      case 'map':
        return <MapSkeleton />;
      default:
        return <CardSkeleton />;
    }
  };

  // Render multiple skeletons if count > 1
  if (count > 1) {
    return (
      <div className={`space-y-2 sm:space-y-3 ${className}`}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index}>{renderSkeleton()}</div>
        ))}
      </div>
    );
  }

  return <div className={className}>{renderSkeleton()}</div>;
};

LoadingSkeleton.propTypes = {
  type: PropTypes.oneOf(['card', 'pagination', 'filter', 'map']),
  count: PropTypes.number,
  className: PropTypes.string,
  compact: PropTypes.bool,
};

export default LoadingSkeleton;
