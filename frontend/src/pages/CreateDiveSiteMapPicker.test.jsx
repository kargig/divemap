import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CreateDiveSite from './CreateDiveSite';

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

vi.mock('../components/ui/MarkdownEditor', () => ({
  default: ({ value, onChange, placeholder }) => (
    <textarea
      placeholder={placeholder}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, is_admin: false },
    isAuthenticated: true,
  }),
}));

vi.mock('../components/LocationPickerMap', () => ({
  default: ({ latitude, longitude, onChange }) => (
    <div data-testid='mock-location-picker' data-latitude={latitude} data-longitude={longitude}>
      <button type='button' onClick={() => onChange({ lat: 37.8812, lng: 23.7548 })}>
        Click Map Pin
      </button>
    </div>
  ),
}));

vi.mock('../api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('CreateDiveSite - LocationPickerMap Integration', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <CreateDiveSite />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

  it('renders LocationPickerMap and syncs coordinates from map click to form inputs', () => {
    renderPage();

    const picker = screen.getByTestId('mock-location-picker');
    expect(picker).toBeInTheDocument();

    const mapPinBtn = screen.getByRole('button', { name: /click map pin/i });
    fireEvent.click(mapPinBtn);

    const latInput = screen.getByLabelText(/latitude/i);
    const lngInput = screen.getByLabelText(/longitude/i);

    expect(latInput).toHaveValue('37.881200');
    expect(lngInput).toHaveValue('23.754800');
  });

  it('syncs coordinates typed into form inputs to LocationPickerMap', () => {
    renderPage();

    const latInput = screen.getByLabelText(/latitude/i);
    const lngInput = screen.getByLabelText(/longitude/i);

    fireEvent.change(latInput, { target: { value: '27.7281' } });
    fireEvent.change(lngInput, { target: { value: '34.2519' } });

    const picker = screen.getByTestId('mock-location-picker');
    expect(picker).toHaveAttribute('data-latitude', '27.7281');
    expect(picker).toHaveAttribute('data-longitude', '34.2519');
  });
});
