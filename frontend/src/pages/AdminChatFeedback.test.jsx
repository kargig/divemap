import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import AdminChatFeedback from './AdminChatFeedback';

// Mock API
vi.mock('../api', () => ({
  getAdminChatFeedback: vi.fn(() => Promise.resolve([])),
  getAdminChatFeedbackStats: vi.fn(() =>
    Promise.resolve({
      total_feedback: 10,
      positive_count: 8,
      negative_count: 2,
      satisfaction_rate: 80,
      category_breakdown: {},
    })
  ),
}));

const queryClient = new QueryClient();

describe('AdminChatFeedback', () => {
  it('renders the dashboard with stats', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminChatFeedback />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Chatbot Feedback Dashboard')).toBeInTheDocument();

    // Wait for stats to load
    const totalFeedback = await screen.findByText('10');
    expect(totalFeedback).toBeInTheDocument();

    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
