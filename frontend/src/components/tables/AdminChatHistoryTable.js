import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Eye, ChevronUp, ChevronDown } from 'lucide-react';
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

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

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
                    className='hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'
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
    </div>
  );
};

AdminChatHistoryTable.propTypes = {
  data: PropTypes.array,
  columns: PropTypes.array.isRequired,
  pagination: PropTypes.object.isRequired,
  onPaginationChange: PropTypes.func.isRequired,
  sorting: PropTypes.array,
  onSortingChange: PropTypes.func.isRequired,
  onView: PropTypes.func,
  isLoading: PropTypes.bool,
};

export default AdminChatHistoryTable;
