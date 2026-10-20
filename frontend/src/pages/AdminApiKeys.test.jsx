import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as api from '../api';

import AdminApiKeys from './AdminApiKeys';

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', is_admin: true },
  }),
}));

// Mock API
vi.mock('../api', () => ({
  getAdminApiKeys: vi.fn(),
  createAdminApiKey: vi.fn(),
  updateAdminApiKey: vi.fn(),
  deleteAdminApiKey: vi.fn(),
}));

const mockKeys = [
  {
    id: 1,
    name: 'AWS Lambda Processor',
    description: 'Worker key for push notifications',
    created_by_user_id: 1,
    created_by_username: 'admin',
    expires_at: null,
    last_used_at: '2026-10-20T12:00:00Z',
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Old Dev Key',
    description: 'Expired test key',
    created_by_user_id: 1,
    created_by_username: 'admin',
    expires_at: null,
    last_used_at: null,
    is_active: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

describe('AdminApiKeys', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.mocked(api.getAdminApiKeys).mockResolvedValue(mockKeys);
  });

  const renderComponent = () =>
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AdminApiKeys />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

  it('renders API Keys dashboard and lists existing keys', async () => {
    renderComponent();

    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(
      screen.getByText('Manage service tokens and backend API credentials.')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('AWS Lambda Processor')).toBeInTheDocument();
      expect(screen.getByText('Old Dev Key')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Revoked').length).toBeGreaterThanOrEqual(1);
  });

  it('opens generate key modal when clicking button', async () => {
    renderComponent();

    const generateBtn = screen.getByRole('button', { name: /Generate New Key/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText('Generate API Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., AWS Lambda Notification Worker')).toBeInTheDocument();
  });
});
