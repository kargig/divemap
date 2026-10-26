import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as divesService from '../../services/dives';
import ImportDivesModal from '../ImportDivesModal';

vi.mock('../../services/dives', () => ({
  importSubsurfaceXML: vi.fn(),
  confirmImportDives: vi.fn(),
  getCSVHeaders: vi.fn(),
  processCSVImport: vi.fn(),
  importGarminFIT: vi.fn(),
  importSuuntoJSON: vi.fn(),
  importShearwaterDB: vi.fn(),
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

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ImportDivesModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
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

    // Select a file
    const file = new globalThis.File(['<xml></xml>'], 'arsida.xml', { type: 'text/xml' });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Process file
    const processBtn = screen.getByRole('button', { name: /Process Files/i });
    expect(processBtn).not.toBeDisabled();
    fireEvent.click(processBtn);

    // Review step should appear
    await waitFor(() => {
      expect(screen.getByText('Review Dives to Import')).toBeInTheDocument();
    });

    // The diving center combobox trigger should be present
    const centerTrigger = screen.getByRole('combobox', {
      name: /Search for a diving center\.\.\./i,
    });
    expect(centerTrigger).toBeInTheDocument();

    // Open the dropdown
    fireEvent.click(centerTrigger);

    // Amorgos Diving Center option should be visible
    const option = await screen.findByText('Amorgos Diving Center (Greece)');
    expect(option).toBeInTheDocument();

    // Select Amorgos Diving Center
    fireEvent.click(option);

    // The selected center should remain visible in the combobox trigger button and NOT disappear
    await waitFor(() => {
      expect(centerTrigger).toHaveTextContent('Amorgos Diving Center (Greece)');
    });
  });
});
