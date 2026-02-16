import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const AdminChatHistoryTable = ({
  data = [],
  columns,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  onView,
  isLoading = false,
}) => {
  const table = useReactTable({
    data,
    columns,
    pageCount: pagination.pageCount,
    state: {
      pagination: {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
      sorting,
    },
    onPaginationChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  // Pagination handlers
  const handlePageChange = newPage => {
    onPaginationChange(prev => ({ ...prev, pageIndex: newPage }));
  };

  const handlePageSizeChange = newPageSize => {
    onPaginationChange(prev => ({ ...prev, pageIndex: 0, pageSize: newPageSize }));
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  // Determine if next page is available based on data length matching page size
  // (since API doesn't return total count)
  const hasNextPage = data.length === pagination.pageSize;
  const hasPreviousPage = pagination.pageIndex > 0;

  return (
    <div className='space-y-4'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-gray-700/50'>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className='px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider'
                      style={{
                        width: header.getSize() ? `${header.getSize()}px` : undefined,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center ${
                            header.column.getCanSort()
                              ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'
                              : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className='ml-2'>
                              {{
                                asc: <ChevronUp className='h-4 w-4' />,
                                desc: <ChevronDown className='h-4 w-4' />,
                              }[header.column.getIsSorted()] ?? (
                                <div className='h-4 w-4' /> // Spacer
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700'>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className='px-6 py-12 text-center'>
                    <div className='flex flex-col items-center justify-center'>
                      <div className='text-gray-400 mb-2'>
                        <Eye className='h-12 w-12' />
                      </div>
                      <p className='text-gray-500 dark:text-gray-400 text-lg font-medium'>
                        No sessions found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className='hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer'
                    onClick={() => onView && onView(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className='px-6 py-4 text-sm text-gray-900 dark:text-gray-100'
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className='flex flex-col sm:flex-row justify-between items-center gap-4 px-2'>
        {/* Page Size Selection */}
        <div className='flex items-center gap-2'>
          <label
            htmlFor='page-size-select'
            className='text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            Show:
          </label>
          <select
            id='page-size-select'
            value={pagination.pageSize}
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            className='px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500'
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className='text-sm text-gray-600 dark:text-gray-400'>per page</span>
        </div>

        {/* Pagination Info */}
        <div className='text-sm text-gray-600 dark:text-gray-400'>
          Page {pagination.pageIndex + 1}
        </div>

        {/* Pagination Navigation */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => handlePageChange(pagination.pageIndex - 1)}
            disabled={!hasPreviousPage}
            className='px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>

          <button
            onClick={() => handlePageChange(pagination.pageIndex + 1)}
            disabled={!hasNextPage}
            className='px-3 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>
      </div>
    </div>
  );
};

AdminChatHistoryTable.propTypes = {
  data: PropTypes.array,
  columns: PropTypes.array.isRequired,
  pagination: PropTypes.shape({
    pageIndex: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    pageCount: PropTypes.number,
  }).isRequired,
  onPaginationChange: PropTypes.func.isRequired,
  sorting: PropTypes.array,
  onSortingChange: PropTypes.func.isRequired,
  onView: PropTypes.func,
  isLoading: PropTypes.bool,
};

export default AdminChatHistoryTable;
