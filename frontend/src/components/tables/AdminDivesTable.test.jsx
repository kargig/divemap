import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi, describe, it, expect, beforeAll } from 'vitest';

import AdminDivesTable from './AdminDivesTable';

// Mock ResizeObserver for Ant Design
beforeAll(() => {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock matchMedia for Ant Design
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('AdminDivesTable', () => {
  const mockData = [
    { id: 1, name: 'Dive 1', user: 'User 1' },
    { id: 2, name: 'Dive 2', user: 'User 2' },
  ];

  const mockColumns = [
    {
      id: 'id',
      accessorKey: 'id',
      header: 'ID',
      size: 50,
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      size: 200,
    },
    {
      id: 'select',
      header: 'Select', // Should be filtered out
    },
  ];

  const mockPagination = {
    pageIndex: 0,
    pageSize: 25,
    totalCount: 100,
  };

  const defaultProps = {
    data: mockData,
    columns: mockColumns,
    pagination: mockPagination,
    onPaginationChange: vi.fn(),
    sorting: [],
    onSortingChange: vi.fn(),
    rowSelection: {},
    onRowSelectionChange: vi.fn(),
    columnVisibility: { id: true, name: true }, // All visible by default
  };

  it('renders table with data', () => {
    render(<AdminDivesTable {...defaultProps} />);
    expect(screen.getByText('Dive 1')).toBeInTheDocument();
    expect(screen.getByText('Dive 2')).toBeInTheDocument();
  });

  it('filters out the "select" column', () => {
    render(<AdminDivesTable {...defaultProps} />);
    // Ant Design renders headers in <th>
    // The "Select" header from mockColumns should NOT be present as a column title
    // However, Ant Design adds its own selection column if rowSelection is provided.
    // We just want to ensure our *manual* 'Select' column definition isn't rendered as a text header
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map(h => h.textContent).filter(t => t === 'Select')).toHaveLength(0);
  });

  it('hides columns based on columnVisibility', () => {
    const props = {
      ...defaultProps,
      columnVisibility: { id: true, name: false }, // Hide 'name' column
    };
    render(<AdminDivesTable {...props} />);

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map(h => h.textContent);
    expect(headerTexts).toContain('ID');
    expect(headerTexts).not.toContain('Name');
  });

  it('renders pagination correctly', () => {
    render(<AdminDivesTable {...defaultProps} />);
    expect(screen.getByText('1-25 of 100 dives')).toBeInTheDocument();
  });
});
