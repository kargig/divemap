import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import * as AuthContext from '../contexts/AuthContext';

import DiveTrips from './DiveTrips';

// Mock contexts and hooks
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null })),
}));

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: mockSearchParams.toString(), pathname: '/dive-trips' }),
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

vi.mock('react-query', async () => {
  const actual = await vi.importActual('react-query');
  return {
    ...actual,
    useInfiniteQuery: vi.fn(),
  };
});

vi.mock('../services/newsletters', () => ({
  getParsedTrips: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    size: 20,
    pages: 1,
  }),
}));

describe('DiveTrips - Instant Booking Filter', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    queryClient = new QueryClient();

    // Default mock for useInfiniteQuery
    useInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: 1,
                trip_date: '2026-10-25',
                diving_center_name: 'Athens Riviera Divers',
                is_bookable: true,
                octo_slot_id: 'slot-123',
                destination_name: 'Fleves Island',
              },
              {
                id: 2,
                trip_date: '2026-10-25',
                diving_center_name: 'Regular Divers',
                is_bookable: false,
                octo_slot_id: null,
                destination_name: 'Vouliagmeni',
              },
            ],
            total: 2,
          },
        ],
      },
      isLoading: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      error: null,
    });
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <DiveTrips />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  };

  it('includes filters.bookable_only in the useInfiniteQuery query key', () => {
    renderComponent();

    expect(useInfiniteQuery).toHaveBeenCalled();
    const lastCallQueryKey = useInfiniteQuery.mock.calls[0][0];

    // Check that boolean false is included in the query key when not active
    expect(lastCallQueryKey).toContain(false);
  });

  it('updates query key when Instant Online Booking Only filter is toggled', async () => {
    renderComponent();

    const instantBookingButton = screen.getByRole('button', {
      name: /Instant Online Booking Only/i,
    });
    expect(instantBookingButton).toBeInTheDocument();

    fireEvent.click(instantBookingButton);

    // After click, the component should re-render with bookable_only=true in query key
    await waitFor(() => {
      const calls = useInfiniteQuery.mock.calls;
      const latestQueryKey = calls[calls.length - 1][0];
      expect(latestQueryKey).toContain(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('?bookable_only=true', { replace: true });
  });

  it('initializes bookable_only from URL search parameters', () => {
    mockSearchParams = new URLSearchParams('bookable_only=true');

    renderComponent();

    const firstQueryKey = useInfiniteQuery.mock.calls[0][0];
    expect(firstQueryKey).toContain(true);
  });
});
