import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from '../api';

import QuickCreateDiveSiteModal from './QuickCreateDiveSiteModal';

vi.mock('./LocationPickerMap', () => ({
  default: ({ latitude, longitude, onChange, onSelectNearbySite }) => (
    <div data-testid='location-picker-map' data-lat={latitude} data-lng={longitude}>
      <button type='button' onClick={() => onChange({ lat: 27.7281, lng: 34.2519 })}>
        Set Coordinates
      </button>
      <button
        type='button'
        onClick={() => onSelectNearbySite({ id: 99, name: 'Shark Reef & Yolanda Reef' })}
      >
        Pick Nearby Site
      </button>
    </div>
  ),
}));

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('QuickCreateDiveSiteModal', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderModal = (props = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <QuickCreateDiveSiteModal
          isOpen={true}
          onClose={vi.fn()}
          initialData={{
            name: 'Shark Reef',
            latitude: 27.7281,
            longitude: 34.2519,
            country: 'Egypt',
          }}
          matchingCount={4}
          onSuccess={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );

  it('pre-fills site name, coordinates, and country from initialData', () => {
    renderModal();
    expect(screen.getByDisplayValue('Shark Reef')).toBeInTheDocument();
    expect(screen.getByDisplayValue('27.7281')).toBeInTheDocument();
    expect(screen.getByDisplayValue('34.2519')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Egypt')).toBeInTheDocument();
  });

  it('displays batch apply checkbox with the correct matching count', () => {
    renderModal({ matchingCount: 4 });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(
      screen.getByText(
        (content, element) =>
          element?.tagName?.toLowerCase() === 'span' &&
          element.textContent.includes('Apply this site to all 4 dives')
      )
    ).toBeInTheDocument();
  });

  it('submits new dive site to API and calls onSuccess', async () => {
    const handleSuccess = vi.fn();
    api.post.mockResolvedValueOnce({
      data: {
        id: 105,
        name: 'Shark Reef',
        country: 'Egypt',
        latitude: 27.7281,
        longitude: 34.2519,
      },
    });

    renderModal({ onSuccess: handleSuccess });

    const submitBtn = screen.getByRole('button', { name: /create & link site/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/dive-sites/',
        expect.objectContaining({
          name: 'Shark Reef',
          country: 'Egypt',
          latitude: 27.7281,
          longitude: 34.2519,
        })
      );
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 105, name: 'Shark Reef' }),
      true // applyToAll is true
    );
  });

  it('invokes onSuccess directly when a nearby site is selected from map', () => {
    const handleSuccess = vi.fn();
    renderModal({ onSuccess: handleSuccess });

    const pickNearbyBtn = screen.getByText('Pick Nearby Site');
    fireEvent.click(pickNearbyBtn);

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, name: 'Shark Reef & Yolanda Reef' }),
      true
    );
  });
});
