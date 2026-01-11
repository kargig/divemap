import { Table } from 'antd';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';

/**
 * AdminDivesTable - Ant Design Table implementation for dives
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
  // Convert TanStack columns to Ant Design columns
  const antdColumns = useMemo(() => {
    return columns
      .filter(col => col.id !== 'select') // Remove custom selection column
      .filter(col => !columnVisibility || columnVisibility[col.id] !== false) // Filter based on visibility
      .map(col => ({
        title: typeof col.header === 'function' ? col.header({ table: {} }) : col.header,
        dataIndex: col.accessorKey,
        key: col.id,
        render: (text, record) => {
          // Bridge TanStack cell renderer if it exists
          if (col.cell) {
            return col.cell({ row: { original: record } });
          }
          return text;
        },
        sorter: col.enableSorting,
        // Match sorting state to column using col.id
        sortOrder:
          sorting?.find(s => s.id === col.id)?.desc === undefined
            ? false
            : sorting.find(s => s.id === col.id)?.desc
              ? 'descend'
              : 'ascend',
        width: col.size,
      }));
  }, [columns, sorting, columnVisibility]);

  // Handle Table Changes (Pagination, Sorting)
  const handleTableChange = (newPagination, _filters, newSorter) => {
    // Handle Pagination
    if (
      newPagination.current !== pagination.pageIndex + 1 ||
      newPagination.pageSize !== pagination.pageSize
    ) {
      onPaginationChange(prev => ({
        ...prev,
        pageIndex: newPagination.current - 1,
        pageSize: newPagination.pageSize,
      }));
    }

    // Handle Sorting
    const sorter = Array.isArray(newSorter) ? newSorter[0] : newSorter;

    if (sorter && sorter.order) {
      // Use columnKey (mapped from col.id)
      onSortingChange([{ id: sorter.columnKey, desc: sorter.order === 'descend' }]);
    } else {
      onSortingChange([]); // Clear sorting
    }
  };

  // Row Selection Config
  const rowSelectionConfig = {
    selectedRowKeys: Object.keys(rowSelection || {}),
    onChange: selectedRowKeys => {
      // Convert array of keys back to object map { [id]: true }
      const newSelection = selectedRowKeys.reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      onRowSelectionChange(newSelection);
    },
  };

  return (
    <div className='bg-white rounded-lg shadow-md overflow-hidden'>
      <Table
        columns={antdColumns}
        dataSource={data}
        rowKey={record => String(record.id)} // Ensure keys are strings to match Object.keys output
        loading={isLoading}
        pagination={{
          current: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          total: pagination.totalCount,
          showSizeChanger: true,
          pageSizeOptions: ['25', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} dives`,
        }}
        onChange={handleTableChange}
        rowSelection={rowSelectionConfig}
        scroll={{ x: true }} // Enable horizontal scrolling
        className='w-full'
      />
    </div>
  );
};

AdminDivesTable.propTypes = {
  data: PropTypes.array,
  columns: PropTypes.array.isRequired,
  pagination: PropTypes.shape({
    pageIndex: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    totalCount: PropTypes.number,
  }).isRequired,
  onPaginationChange: PropTypes.func.isRequired,
  sorting: PropTypes.array,
  onSortingChange: PropTypes.func.isRequired,
  rowSelection: PropTypes.object,
  onRowSelectionChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  onEdit: PropTypes.func, // Not used directly, passed via columns
  onDelete: PropTypes.func, // Not used directly, passed via columns
  columnVisibility: PropTypes.object, // Unused in this adapter
  onColumnVisibilityChange: PropTypes.func, // Unused in this adapter
};

export default AdminDivesTable;
