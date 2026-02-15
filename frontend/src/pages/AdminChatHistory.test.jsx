import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import AdminChatHistory from './AdminChatHistory';

// Mock API
vi.mock('../api', () => ({
  getAdminChatSessions: vi.fn(() =>
    Promise.resolve([
      {
        id: 'session-123',
        user_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  ),
  getAdminChatSessionDetail: vi.fn(() =>
    Promise.resolve({
      id: 'session-123',
      user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
    })
  ),
}));

const queryClient = new QueryClient();

describe('AdminChatHistory', () => {
  it('renders the history list', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminChatHistory />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Chat Session History')).toBeInTheDocument();

    // Wait for session to load
    const sessionId = await screen.findByText('session-123');
    expect(sessionId).toBeInTheDocument();
  });
});
