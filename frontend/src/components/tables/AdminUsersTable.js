import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Edit, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * AdminUsersTable - TanStack Table implementation for users
 */
const AdminUsersTable = ({
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
  currentUserId = null, // To disable selection for current user
}) => {
  // Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: pagination.pageCount,
    getRowId: row => row.id.toString(), // Use actual user ID for row selection
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
                      <p className='text-gray-500 text-lg font-medium'>No users found</p>
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
              <p className='text-gray-500 text-lg font-medium'>No users found</p>
            </div>
          ) : (
            table.getRowModel().rows.map(row => {
              const user = row.original;
              const isCurrentUser = user.id === currentUserId;
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
                          disabled={isCurrentUser}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50'
                        />
                        <h3 className='text-sm font-semibold text-gray-900'>{user.username}</h3>
                      </div>
                      <p className='text-xs text-gray-600'>{user.email}</p>
                    </div>
                    <div className='flex space-x-2'>
                      <button
                        onClick={() => onEdit(user)}
                        className='text-blue-600 hover:text-blue-900'
                        title='Edit user'
                      >
                        <Edit className='h-4 w-4' />
                      </button>
                      {!isCurrentUser && (
                        <button
                          onClick={() => onDelete(user)}
                          className='text-red-600 hover:text-red-900'
                          title='Delete user'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-2 text-xs'>
                    <div>
                      <span className='text-gray-500'>Role:</span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_admin
                            ? 'bg-red-100 text-red-800'
                            : user.is_moderator
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.is_admin ? 'Admin' : user.is_moderator ? 'Moderator' : 'User'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                          user.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Email Verified:</span>
                      <span className='ml-2 text-gray-900'>
                        {user.email_verified ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className='text-gray-500'>Created:</span>
                      <span className='ml-2 text-gray-900'>
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
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
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, table.getRowCount())}
                </span>{' '}
                of <span className='font-medium'>{table.getRowCount()}</span> results
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

export default AdminUsersTable;
