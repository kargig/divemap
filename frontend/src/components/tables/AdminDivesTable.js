import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Edit,
  Trash2,
  Anchor,
  User,
  MapPin,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * AdminDivesTable - TanStack Table implementation for dives
 */
const AdminDivesTable = ({
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
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  // Table instance
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
                      <p className='text-gray-500 text-lg font-medium'>No dives found</p>
                      <p className='text-gray-400 text-sm mt-1'>
                        Try adjusting your filters or search criteria
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className='hover:bg-gray-50'>
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className='px-4 py-3 text-sm text-gray-900 whitespace-nowrap'
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

        {/* Mobile Card View */}
        <div className='md:hidden space-y-4 p-4'>
          {table.getRowModel().rows.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-gray-500 text-lg font-medium'>No dives found</p>
            </div>
          ) : (
            table.getRowModel().rows.map(row => {
              const dive = row.original;
              return (
                <div key={row.id} className='bg-gray-50 rounded-lg p-4 space-y-3'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <input
                          type='checkbox'
                          checked={rowSelection[row.id] || false}
                          onChange={e =>
                            onRowSelectionChange(prev => ({
                              ...prev,
                              [row.id]: e.target.checked,
                            }))
                          }
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />
                        <div className='flex items-center'>
                          <Anchor className='h-4 w-4 text-blue-600 mr-2' />
                          <h3 className='text-sm font-semibold text-gray-900'>
                            {dive.name || `Dive #${dive.id}`}
                          </h3>
                        </div>
                      </div>
                      <div className='text-xs text-gray-600 space-y-1'>
                        {dive.max_depth && <div>Max Depth: {dive.max_depth}m</div>}
                        {dive.duration && <div>Duration: {dive.duration}min</div>}
                      </div>
                    </div>
                    <div className='flex space-x-2'>
                      <button
                        onClick={() => onEdit(dive)}
                        className='text-blue-600 hover:text-blue-900'
                        title='Edit dive'
                      >
                        <Edit className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => onDelete(dive)}
                        className='text-red-600 hover:text-red-900'
                        title='Delete dive'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div className='flex items-center'>
                      <User className='h-3 w-3 text-gray-400 mr-1' />
                      <span className='text-gray-500'>User:</span>
                      <span className='ml-1 text-gray-900'>{dive.user_username}</span>
                    </div>
                    <div className='flex items-center'>
                      <Calendar className='h-3 w-3 text-gray-400 mr-1' />
                      <span className='text-gray-500'>Date:</span>
                      <span className='ml-1 text-gray-900'>{dive.dive_date}</span>
                    </div>
                    {dive.dive_site && (
                      <div className='flex items-center col-span-2'>
                        <MapPin className='h-3 w-3 text-gray-400 mr-1' />
                        <span className='text-gray-500'>Dive Site:</span>
                        <span className='ml-1 text-gray-900'>{dive.dive_site.name}</span>
                      </div>
                    )}
                    <div>
                      <span className='text-gray-500'>Rating:</span>
                      <span className='ml-1 text-gray-900'>
                        {dive.user_rating ? `${dive.user_rating}/10` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Privacy:</span>
                      <span
                        className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                          dive.is_private
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {dive.is_private ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Views:</span>
                      <span className='ml-1 text-gray-900'>{dive.view_count || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className='flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6'>
          <div className='flex-1 flex justify-between sm:hidden'>
            <button
              onClick={() => handlePageChange(pagination.pageIndex - 1)}
              disabled={!table.getCanPreviousPage()}
              className='relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.pageIndex + 1)}
              disabled={!table.getCanNextPage()}
              className='ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Next
            </button>
          </div>
          <div className='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm text-gray-700'>
                Showing{' '}
                <span className='font-medium'>
                  {pagination.pageIndex * pagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className='font-medium'>
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    pagination.totalCount || 0
                  )}
                </span>{' '}
                of <span className='font-medium'>{pagination.totalCount || 0}</span> results
              </p>
            </div>
            <div>
              <nav
                className='relative z-0 inline-flex rounded-md shadow-sm -space-x-px'
                aria-label='Pagination'
              >
                <button
                  onClick={() => handlePageChange(0)}
                  disabled={!table.getCanPreviousPage()}
                  className='relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.pageIndex - 1)}
                  disabled={!table.getCanPreviousPage()}
                  className='relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <span className='relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700'>
                  Page {pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.pageIndex + 1)}
                  disabled={!table.getCanNextPage()}
                  className='relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
                <button
                  onClick={() => handlePageChange(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className='relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDivesTable;
