import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Edit, Trash2, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * AdminDivingCentersTable - TanStack Table implementation for diving centers
 */
const AdminDivingCentersTable = ({
  data = [],
  columns,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  onColumnVisibilityChange,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  // Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: pagination.pageCount,
    getRowId: row => row.id.toString(), // Use actual diving center ID for row selection
    state: {
      pagination: {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
      sorting,
      rowSelection,
      columnVisibility,
    },
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true, // Server-side pagination
    manualSorting: true, // Server-side sorting
    enableRowSelection: true,
    enableMultiRowSelection: true,
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

  return (
    <div className='space-y-4'>
      {/* Table */}
      <div className='bg-white rounded-lg shadow-md overflow-hidden'>
        {/* Mobile: Card View, Desktop: Table View */}
        <div className='hidden md:block overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                      style={{
                        width: header.getSize() ? `${header.getSize()}px` : undefined,
                        minWidth: header.getSize() ? `${header.getSize()}px` : undefined,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center ${
                            header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className='ml-2'>
                              {{
                                asc: <ChevronUp className='h-4 w-4 text-blue-600' />,
                                desc: <ChevronDown className='h-4 w-4 text-blue-600' />,
                              }[header.column.getIsSorted()] ?? (
                                <ChevronUp className='h-4 w-4 text-gray-400' />
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
            <tbody className='bg-white divide-y divide-gray-200'>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getAllColumns().filter(col => col.getIsVisible()).length}
                    className='px-6 py-12 text-center'
                  >
                    <div className='flex flex-col items-center justify-center'>
                      <div className='text-gray-400 mb-2'>
                        <Eye className='h-12 w-12' />
                      </div>
                      <p className='text-gray-500 text-lg font-medium'>No diving centers found</p>
                      <p className='text-gray-400 text-sm mt-1'>
                        Try adjusting your filters or search criteria
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className='hover:bg-gray-50'>
                    {row.getVisibleCells().map(cell => {
                      const columnId = cell.column.id;
                      // Allow wrapping for name, contact, and location columns
                      const shouldWrap =
                        columnId === 'name' || columnId === 'contact' || columnId === 'location';
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-3 text-sm text-gray-900 ${
                            shouldWrap ? '' : 'whitespace-nowrap'
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className='md:hidden divide-y divide-gray-200'>
          {table.getRowModel().rows.length === 0 ? (
            <div className='p-8 text-center'>
              <div className='flex flex-col items-center justify-center'>
                <div className='text-gray-400 mb-2'>
                  <Eye className='h-12 w-12' />
                </div>
                <p className='text-gray-500 text-lg font-medium'>No diving centers found</p>
                <p className='text-gray-400 text-sm mt-1'>
                  Try adjusting your filters or search criteria
                </p>
              </div>
            </div>
          ) : (
            table.getRowModel().rows.map(row => {
              const center = row.original;
              return (
                <div key={row.id} className='p-4 hover:bg-gray-50'>
                  <div className='flex items-start justify-between mb-2'>
                    <div className='flex-1 min-w-0'>
                      <h3 className='text-sm font-semibold text-gray-900 truncate'>
                        {center.name}
                      </h3>
                      {center.description && (
                        <p className='text-xs text-gray-500 mt-1 line-clamp-2'>
                          {center.description}
                        </p>
                      )}
                    </div>
                    <div className='flex items-center gap-2 ml-2 flex-shrink-0'>
                      <button
                        onClick={() => onView(center)}
                        className='text-green-600 hover:text-green-900 p-1'
                        title='View'
                      >
                        <Eye className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => onEdit(center)}
                        className='text-blue-600 hover:text-blue-900 p-1'
                        title='Edit'
                      >
                        <Edit className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => onDelete(center)}
                        className='text-red-600 hover:text-red-900 p-1'
                        title='Delete'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-2 mt-3 text-xs'>
                    <div>
                      <span className='text-gray-500'>ID:</span>{' '}
                      <span className='text-gray-900'>{center.id}</span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Contact:</span>{' '}
                      <span className='text-gray-900'>{center.email || 'N/A'}</span>
                    </div>
                    {center.latitude && center.longitude && (
                      <div>
                        <span className='text-gray-500'>Location:</span>{' '}
                        <span className='text-gray-900'>
                          {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className='text-gray-500'>Rating:</span>{' '}
                      <span className='text-gray-900'>
                        {center.average_rating
                          ? `${center.average_rating.toFixed(1)}/10`
                          : 'No ratings'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Views:</span>{' '}
                      <span className='text-gray-900'>
                        {center.view_count !== undefined
                          ? center.view_count.toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    {center.country && (
                      <div>
                        <span className='text-gray-500'>Country:</span>{' '}
                        <span className='text-gray-900'>{center.country}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className='flex flex-col sm:flex-row justify-between items-center gap-4'>
        {/* Page Size Selection */}
        <div className='flex items-center gap-2'>
          <label htmlFor='page-size-select' className='text-sm font-medium text-gray-700'>
            Show:
          </label>
          <select
            id='page-size-select'
            value={pagination.pageSize}
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className='text-sm text-gray-600'>per page</span>
        </div>

        {/* Pagination Info */}
        {pagination.totalCount !== undefined && (
          <div className='text-sm text-gray-600'>
            Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, pagination.totalCount)} of{' '}
            {pagination.totalCount} diving centers
          </div>
        )}

        {/* Pagination Navigation */}
        {pagination.totalCount !== undefined && (
          <div className='flex items-center gap-2'>
            <button
              onClick={() => handlePageChange(pagination.pageIndex - 1)}
              disabled={!table.getCanPreviousPage()}
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>

            <span className='text-sm text-gray-700'>
              Page {pagination.pageIndex + 1} of {pagination.pageCount || 1}
            </span>

            <button
              onClick={() => handlePageChange(pagination.pageIndex + 1)}
              disabled={!table.getCanNextPage()}
              className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDivingCentersTable;
