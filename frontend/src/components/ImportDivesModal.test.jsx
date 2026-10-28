import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as divesService from '../services/dives';

import ImportDivesModal from './ImportDivesModal';

vi.mock('../services/dives', () => ({
  importSubsurfaceXML: vi.fn(),
  confirmImportDives: vi.fn(),
  getCSVHeaders: vi.fn(),
  processCSVImport: vi.fn(),
  importGarminFIT: vi.fn(),
  importSuuntoJSON: vi.fn(),
  importShearwaterDB: vi.fn(),
}));

vi.mock('./QuickCreateDiveSiteModal', () => ({
  default: ({ isOpen, onClose, initialData, matchingCount, onSuccess }) => {
    if (!isOpen) return null;
    return (
      <div data-testid='quick-create-modal'>
        <span>Quick Create: {initialData?.name}</span>
        <span>Matching: {matchingCount}</span>
        <button
          type='button'
          onClick={() =>
            onSuccess(
              { id: 200, name: initialData?.name || 'New Site' },
              true // applyToAll
            )
          }
        >
          Mock Create Success
        </button>
        <button type='button' onClick={onClose}>
          Mock Close
        </button>
      </div>
    );
  },
}));

describe('ImportDivesModal - Diving Center Selection', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (props = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ImportDivesModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} {...props} />
      </QueryClientProvider>
    );

  it('populates available diving centers on XML import and retains center selection', async () => {
    divesService.importSubsurfaceXML.mockResolvedValueOnce({
      message: 'Successfully parsed 1 dives',
      dives: [
        {
          dive_date: '2026-06-28',
          dive_time: '12:18:14',
          duration: 73,
          max_depth: 41.6,
          dive_site_id: 22,
          diving_center_id: null,
          is_private: false,
        },
      ],
      available_dive_sites: [{ id: 22, name: 'Arsida wall' }],
      available_diving_centers: [
        { id: 61, name: 'Amorgos Diving Center', country: 'Greece' },
        { id: 62, name: 'Athens Divers Club', country: 'Greece' },
      ],
    });

    renderComponent();

    const file = new globalThis.File(['<xml></xml>'], 'arsida.xml', { type: 'text/xml' });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    const processBtn = screen.getByRole('button', { name: /Process Files/i });
    expect(processBtn).not.toBeDisabled();
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText('Review Dives to Import')).toBeInTheDocument();
    });

    const centerTrigger = screen.getByRole('combobox', {
      name: /Search for a diving center\.\.\./i,
    });
    expect(centerTrigger).toBeInTheDocument();

    fireEvent.click(centerTrigger);

    const option = await screen.findByText('Amorgos Diving Center (Greece)');
    expect(option).toBeInTheDocument();

    fireEvent.click(option);

    await waitFor(() => {
      expect(centerTrigger).toHaveTextContent('Amorgos Diving Center (Greece)');
    });
  });

  it('allows importing dives with unmatched dive sites as unlinked dives without blocking', async () => {
    divesService.importSubsurfaceXML.mockResolvedValueOnce({
      message: 'Successfully parsed 1 dives',
      dives: [
        {
          dive_date: '2026-06-28',
          dive_time: '12:18:14',
          duration: 45,
          max_depth: 25.0,
          dive_site_id: null,
          unmatched_dive_site: {
            name: 'Unknown Secret Reef',
            latitude: 37.88,
            longitude: 23.75,
          },
          is_private: false,
        },
      ],
      available_dive_sites: [{ id: 1, name: 'Arsida' }],
      available_diving_centers: [],
    });

    divesService.confirmImportDives.mockResolvedValueOnce({
      message: 'Successfully imported 1 dives',
      imported_dives: [{ id: 101, name: 'Dive - 2026-06-28 - Unknown Secret Reef' }],
    });

    renderComponent();

    const file = new globalThis.File(['<xml></xml>'], 'dive.xml', { type: 'text/xml' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const processBtn = screen.getByRole('button', { name: /Process Files/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText('Review Dives to Import')).toBeInTheDocument();
    });

    // Unmatched site warning is rendered
    expect(screen.getByText('Unknown Secret Reef')).toBeInTheDocument();

    // Confirm import button is clicked
    const confirmBtn = screen.getByRole('button', { name: /Import 1 Dives/i });
    fireEvent.click(confirmBtn);

    // Should NOT be blocked; should call confirmImportDives with unlinked_site_name
    await waitFor(() => {
      expect(divesService.confirmImportDives).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dive_site_id: null,
            unlinked_site_name: 'Unknown Secret Reef',
          }),
        ])
      );
    });
  });

  it('opens QuickCreateDiveSiteModal and batch-applies new site to matching dives', async () => {
    divesService.importSubsurfaceXML.mockResolvedValueOnce({
      message: 'Successfully parsed 2 dives',
      dives: [
        {
          dive_date: '2026-06-28',
          dive_site_id: null,
          unmatched_dive_site: {
            name: 'Shark Reef',
            latitude: 27.7281,
            longitude: 34.2519,
          },
          is_private: false,
        },
        {
          dive_date: '2026-06-29',
          dive_site_id: null,
          unmatched_dive_site: {
            name: 'Shark Reef',
            latitude: 27.7281,
            longitude: 34.2519,
          },
          is_private: false,
        },
      ],
      available_dive_sites: [],
      available_diving_centers: [],
    });

    renderComponent();

    const file = new globalThis.File(['<xml></xml>'], 'dives.xml', { type: 'text/xml' });
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /Process Files/i }));

    await waitFor(() => {
      expect(screen.getByText('Review Dives to Import')).toBeInTheDocument();
    });

    // Find and click the "Quick Create" button for Shark Reef
    const quickCreateButtons = screen.getAllByRole('button', { name: /quick create/i });
    fireEvent.click(quickCreateButtons[0]);

    // Quick create modal should open
    expect(await screen.findByTestId('quick-create-modal')).toBeInTheDocument();
    expect(screen.getByText('Matching: 2')).toBeInTheDocument();

    // Trigger mock create success
    const mockSuccessBtn = screen.getByText('Mock Create Success');
    fireEvent.click(mockSuccessBtn);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('quick-create-modal')).not.toBeInTheDocument();
    });

    // Unmatched warnings should now be resolved for both dives
    expect(screen.queryByText(/not found in database/i)).not.toBeInTheDocument();
  });
});
