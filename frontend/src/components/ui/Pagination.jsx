import { ChevronLeft, ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

export const Pagination = ({
  currentPage,
  pageSize,
  totalCount,
  itemName = 'items',
  onPageChange,
  onPageSizeChange,
  className = '',
  pageSizeOptions = [25, 50, 100],
}) => {
  if (totalCount === undefined || totalCount === null) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const startItem = Math.max(1, (currentPage - 1) * pageSize + 1);
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 ${className}`}>
      <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
        <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto'>
          {/* Page Size Selection */}
          <div className='flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start'>
            <label className='text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap'>
              Show:
            </label>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(parseInt(e.target.value))}
              className='px-2 py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[36px] sm:min-h-0 touch-manipulation'
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className='text-xs sm:text-sm text-gray-600 whitespace-nowrap'>per page</span>
          </div>

          {/* Pagination Info */}
          {totalCount > 0 && (
            <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
              Showing {startItem} to {endItem} of {totalCount} {itemName}
            </div>
          )}

          {/* Pagination Navigation */}
          {totalCount > 0 && (
            <div className='flex items-center gap-1 sm:gap-2 justify-center w-full sm:w-auto mt-2 sm:mt-0'>
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={!hasPrevPage}
                className='px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                aria-label='Previous Page'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>

              <span className='text-xs sm:text-sm text-gray-700 px-2'>
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={!hasNextPage}
                className='px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[36px] sm:min-h-0 touch-manipulation transition-colors'
                aria-label='Next Page'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  totalCount: PropTypes.number,
  itemName: PropTypes.string,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
};

export default Pagination;
