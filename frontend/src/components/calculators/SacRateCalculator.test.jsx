import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import SacRateCalculator from './SacRateCalculator';

// Mock GasMixInput to simplify testing
vi.mock('../forms/GasMixInput', () => ({
  default: ({ value, onChange }) => (
    <div data-testid='gas-mix-input'>
      <input
        data-testid='gas-o2'
        type='number'
        value={value?.o2 || 21}
        onChange={e => onChange({ ...value, o2: parseInt(e.target.value) })}
      />
    </div>
  ),
}));

describe('SacRateCalculator', () => {
  it('renders all input fields', () => {
    render(<SacRateCalculator />);

    expect(screen.getByLabelText(/Average Depth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bottom Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cylinder Size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Pressure/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Pressure/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Gas Mix/i).length).toBeGreaterThan(0);
  });

  it('calculates SAC rate correctly', async () => {
    render(<SacRateCalculator />);

    const depthInput = screen.getByLabelText(/Average Depth/i);
    const timeInput = screen.getByLabelText(/Bottom Time/i);
    const startPressureInput = screen.getByLabelText(/Start Pressure/i);
    const endPressureInput = screen.getByLabelText(/End Pressure/i);
    const tankSizeSelect = screen.getByLabelText(/Cylinder Size/i);

    // Set values: 20m, 30min, 200bar start, 100bar end, 12L tank
    // 20m = 3 ATA
    // Used: 100 bar * 12L = 1200L
    // SAC = 1200 / 30 / 3 = 400 / 30 = 13.33 L/min

    fireEvent.change(depthInput, { target: { value: '20' } });
    fireEvent.change(timeInput, { target: { value: '30' } });
    fireEvent.change(tankSizeSelect, { target: { value: '12' } });
    fireEvent.change(startPressureInput, { target: { value: '200' } });
    fireEvent.change(endPressureInput, { target: { value: '100' } });

    // Allow effects to run
    await waitFor(() => {
      // Ideal SAC should be around 13.3
      const idealElement = screen.getByText('13.3');
      expect(idealElement).toBeInTheDocument();
    });
  });
});
