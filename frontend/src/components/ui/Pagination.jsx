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
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-2 sm:p-6 ${className}`}>
      <div className='flex flex-row justify-between items-center gap-2'>
        <div className='flex items-center gap-2 sm:gap-4 flex-1'>
          {/* Page Size Selection - Simplified for mobile */}
          <div className='flex items-center gap-1 sm:gap-2'>
            <label className='text-[10px] sm:text-sm font-medium text-gray-700 whitespace-nowrap hidden xs:inline'>
              Show:
            </label>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(parseInt(e.target.value))}
              className='px-1 sm:px-2 py-0.5 sm:py-1 border border-gray-300 rounded text-[10px] sm:text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-h-[28px] sm:min-h-0'
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Pagination Info - Compact for mobile */}
          {totalCount > 0 && (
            <div className='text-[10px] sm:text-sm text-gray-500 truncate'>
              <span className='hidden sm:inline'>Showing </span>
              {startItem}-{endItem} <span className='hidden xs:inline'>of {totalCount}</span>
            </div>
          )}
        </div>

        {/* Pagination Navigation */}
        {totalCount > 0 && (
          <div className='flex items-center gap-1 sm:gap-2'>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!hasPrevPage}
              className='p-1 sm:px-3 sm:py-1.5 border border-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[28px] min-w-[28px] flex items-center justify-center transition-colors'
              aria-label='Previous Page'
            >
              <ChevronLeft className='h-3 w-3 sm:h-4 sm:w-4' />
            </button>

            <span className='text-[10px] sm:text-sm font-medium text-gray-700 min-w-[60px] text-center'>
              Pg {currentPage}/{totalPages}
            </span>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasNextPage}
              className='p-1 sm:px-3 sm:py-1.5 border border-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 min-h-[28px] min-w-[28px] flex items-center justify-center transition-colors'
              aria-label='Next Page'
            >
              <ChevronRight className='h-3 w-3 sm:h-4 sm:w-4' />
            </button>
          </div>
        )}
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
