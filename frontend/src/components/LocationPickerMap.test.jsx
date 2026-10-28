import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from '../api';

import LocationPickerMap from './LocationPickerMap';

// Mock react-leaflet components for JSDOM
let mapClickHandler = null;
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, className }) => (
    <div
      data-testid='map-container'
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      className={className}
      onClick={() => mapClickHandler && mapClickHandler({ latlng: { lat: 37.88, lng: 23.75 } })}
    >
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution }) => (
    <div data-testid='tile-layer' data-url={url} data-attribution={attribution} />
  ),
  Marker: ({ position, draggable, children }) => (
    <div
      data-testid='map-marker'
      data-position={JSON.stringify(position)}
      data-draggable={draggable ? 'true' : 'false'}
    >
      {children}
    </div>
  ),
  Tooltip: ({ children }) => <div data-testid='map-tooltip'>{children}</div>,
  Popup: ({ children }) => <div data-testid='map-popup'>{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
    flyTo: vi.fn(),
    getZoom: vi.fn().mockReturnValue(13),
    invalidateSize: vi.fn(),
  }),
  useMapEvents: handlers => {
    mapClickHandler = handlers?.click;
    return null;
  },
}));

vi.mock('leaflet', () => {
  const MockIcon = vi.fn(function (options) {
    this.options = options;
  });
  MockIcon.Default = {
    prototype: {},
    mergeOptions: vi.fn(),
  };

  return {
    default: {
      Icon: MockIcon,
      divIcon: vi.fn(() => ({})),
    },
    Icon: MockIcon,
  };
});

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('LocationPickerMap', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mapClickHandler = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderComponent = props =>
    render(
      <QueryClientProvider client={queryClient}>
        <LocationPickerMap latitude={37.8812} longitude={23.7548} onChange={vi.fn()} {...props} />
      </QueryClientProvider>
    );

  it('defaults to the Satellite map layer (ESRI World Imagery)', () => {
    renderComponent();
    const tileLayer = screen.getByTestId('tile-layer');
    expect(tileLayer).toHaveAttribute(
      'data-url',
      expect.stringContaining('World_Imagery/MapServer')
    );
  });

  it('renders map layers button and toggles MapLayersPanel', () => {
    renderComponent();
    const layersBtn = screen.getByRole('button', { name: /layers/i });
    expect(layersBtn).toBeInTheDocument();

    fireEvent.click(layersBtn);
    expect(screen.getByText('Map Layers')).toBeInTheDocument();
    expect(screen.getByText('Street Map')).toBeInTheDocument();
  });

  it('calls onChange when clicking on the map', () => {
    const handleChange = vi.fn();
    renderComponent({ onChange: handleChange });

    const mapContainer = screen.getByTestId('map-container');
    fireEvent.click(mapContainer);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: expect.any(Number),
        lng: expect.any(Number),
      })
    );
  });

  it('queries check-proximity with 1km radius when coordinates are provided', async () => {
    api.get.mockResolvedValueOnce({
      data: [
        {
          id: 10,
          name: 'Shark Reef & Yolanda Reef',
          distance_m: 85,
          country: 'Egypt',
        },
      ],
    });

    const handleSelectNearby = vi.fn();
    renderComponent({ onSelectNearbySite: handleSelectNearby });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/v1/dive-sites/check-proximity', {
        params: expect.objectContaining({
          lat: 37.8812,
          lng: 23.7548,
          radius_m: 1000,
        }),
      });
    });

    // Check suggestion banner
    expect(await screen.findByText('Shark Reef & Yolanda Reef')).toBeInTheDocument();
    expect(screen.getByText(/85m away/i)).toBeInTheDocument();

    // Click "Use This Site"
    const useBtn = screen.getByRole('button', { name: /use this site/i });
    fireEvent.click(useBtn);
    expect(handleSelectNearby).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, name: 'Shark Reef & Yolanda Reef' })
    );
  });

  it('queries backend search-places endpoint as primary geocoder', async () => {
    api.get.mockImplementation(url => {
      if (url.includes('/api/v1/dive-sites/search-places')) {
        return Promise.resolve({
          data: [
            {
              name: 'Sydney',
              display_name: 'Sydney, NSW, Australia',
              latitude: -33.869,
              longitude: 151.208,
              country: 'Australia',
              region: 'New South Wales',
              type: 'city',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderComponent({ latitude: 37.88, longitude: 23.75 });
    const searchInput = screen.getByPlaceholderText(/search island, bay, town/i);
    fireEvent.change(searchInput, { target: { value: 'Sydney' } });
    fireEvent.click(screen.getByRole('button', { name: /find/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/dive-sites/search-places',
        expect.objectContaining({
          params: expect.objectContaining({ q: 'Sydney' }),
        })
      );
    });
  });

  it('triggers onLocationResolved on coordinates update via reverse-geocode', async () => {
    const handleLocationResolved = vi.fn();
    api.get.mockImplementation(url => {
      if (url.includes('/api/v1/dive-sites/reverse-geocode')) {
        return Promise.resolve({
          data: {
            country: 'Greece',
            region: 'Attica',
            city: 'Glyfada',
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderComponent({
      latitude: 37.88,
      longitude: 23.75,
      onLocationResolved: handleLocationResolved,
    });

    await waitFor(() => {
      expect(handleLocationResolved).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'Greece',
          region: 'Attica',
        })
      );
    });
  });
});
