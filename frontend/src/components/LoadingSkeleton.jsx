import PropTypes from 'prop-types';
import React from 'react';

/**
 * LoadingSkeleton Component
 *
 * Provides skeleton loading states for different content types
 * to improve perceived performance and user experience.
 */
const LoadingSkeleton = ({ type = 'card', count = 1, className = '', compact = false }) => {
  // Card skeleton for dives and dive sites (matching Rev. 8 layout)
  const CardSkeleton = () => (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${compact ? 'p-4' : 'p-6'}`}
    >
      <div className='animate-pulse flex flex-col space-y-4'>
        {/* HEADER ROW */}
        <div className='flex items-start justify-between'>
          <div className='flex-1 space-y-2'>
            {/* Kicker skeleton */}
            <div className='h-3 bg-gray-100 rounded w-1/4'></div>
            {/* Title skeleton */}
            <div className='h-6 bg-gray-200 rounded w-3/4'></div>
            {/* Meta skeleton */}
            <div className='h-3 bg-gray-100 rounded w-1/2'></div>
          </div>
          {/* Rating skeleton */}
          <div className='h-8 bg-gray-100 rounded w-12'></div>
        </div>

        {/* BODY/DESCRIPTION skeleton */}
        {!compact && (
          <div className='space-y-2'>
            <div className='h-3 bg-gray-100 rounded w-full'></div>
            <div className='h-3 bg-gray-100 rounded w-5/6'></div>
          </div>
        )}

        {/* STATS STRIP skeleton */}
        <div className='flex gap-8 py-3 border-y border-gray-50'>
          <div className='h-8 bg-gray-50 rounded w-16'></div>
          <div className='h-8 bg-gray-50 rounded w-16'></div>
          <div className='h-8 bg-gray-50 rounded w-16'></div>
        </div>

        {/* FOOTER skeleton */}
        <div className='flex items-center justify-between'>
          <div className='flex gap-2'>
            <div className='h-6 bg-gray-100 rounded-full w-14'></div>
            <div className='h-6 bg-gray-100 rounded-full w-14'></div>
          </div>
          <div className='h-4 bg-gray-100 rounded w-20'></div>
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
