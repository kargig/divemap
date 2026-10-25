import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Help from './Help';

// Mock antd matchMedia and ResizeObserver
beforeEach(() => {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  window.matchMedia =
    window.matchMedia ||
    function () {
      return {
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      };
    };
});

const LocationWatcher = ({ onChange }) => {
  const location = useLocation();
  React.useEffect(() => {
    onChange(location);
  }, [location, onChange]);
  return null;
};

const renderHelp = (initialPath = '/help') => {
  let currentLocation = {};
  const utils = render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationWatcher onChange={loc => (currentLocation = loc)} />
        <Routes>
          <Route path='/help' element={<Help />} />
          <Route path='/help/:section' element={<Help />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
  return {
    ...utils,
    getLocation: () => currentLocation,
  };
};

describe('Help Component Path-Based Navigation', () => {
  it('renders getting-started section by default on /help', () => {
    renderHelp('/help');
    expect(screen.getByText('Welcome to Divemap')).toBeInTheDocument();
  });

  it('renders specific section content when accessed via path slug /help/global-map', () => {
    renderHelp('/help/global-map');
    expect(screen.getByText('Interactive Global Map')).toBeInTheDocument();
  });

  it('redirects legacy query param /help?tab=media_routes to /help/sites-and-media', async () => {
    const { getLocation } = renderHelp('/help?tab=media_routes');
    await waitFor(() => {
      expect(getLocation().pathname).toBe('/help/sites-and-media');
    });
  });

  it('navigates to new path slug when clicking a different tab', async () => {
    const { getLocation } = renderHelp('/help/getting-started');
    const mapTab = screen.getByRole('tab', { name: /Global Map/i });
    fireEvent.click(mapTab);
    await waitFor(() => {
      expect(getLocation().pathname).toBe('/help/global-map');
    });
  });
});
