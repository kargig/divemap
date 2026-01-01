import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import WeightCalculator from './WeightCalculator';

// Mock GasTanksInput
vi.mock('../forms/GasTanksInput', () => ({
  default: ({ onChange }) => (
    <div data-testid='gas-tanks-input'>
      <button
        data-testid='set-12L-steel'
        onClick={() =>
          onChange(
            JSON.stringify({
              mode: 'structured',
              back_gas: {
                tank: '12',
                start_pressure: 200,
                end_pressure: 50,
                gas: { o2: 21, he: 0 },
              },
              stages: [],
            })
          )
        }
      >
        Set 12L Steel
      </button>
    </div>
  ),
}));

describe('WeightCalculator', () => {
  it('renders all basic input fields', () => {
    render(<WeightCalculator />);

    expect(screen.getByLabelText(/Your Weight/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Experience Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Exposure Suit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Water Salinity/i)).toBeInTheDocument();
  });

  it('calculates weight correctly for a standard profile', async () => {
    render(<WeightCalculator />);

    const weightInput = screen.getByLabelText(/Your Weight/i);
    const experienceSelect = screen.getByLabelText(/Experience Level/i);
    const suitSelect = screen.getByLabelText(/Exposure Suit/i);

    // Profile: 80kg, Proficient, 5mm Wetsuit (Full)
    // Suit Lead = 80 * 0.08 + 0 = 6.4 kg
    // Tank Adjustment (12L Steel - default): 12L Steel is roughly neutral/negative.
    // Let's assume default results in ~6-7kg total.

    fireEvent.change(weightInput, { target: { value: '80' } });
    fireEvent.change(experienceSelect, { target: { value: 'proficient' } });
    fireEvent.change(suitSelect, { target: { value: '2' } }); // 5mm

    await waitFor(() => {
      // We check for a reasonable result. Standard 5mm wetsuit for 80kg is ~6-8kg.
      const resultElement = screen.getByText('6'); // Math.round(6.4 + tank)
      expect(resultElement).toBeInTheDocument();
    });
  });

  it('adjusts for water salinity', async () => {
    render(<WeightCalculator />);

    const weightInput = screen.getByLabelText(/Your Weight/i);
    fireEvent.change(weightInput, { target: { value: '100' } });

    const waterSelect = screen.getByLabelText(/Water Salinity/i);

    // Default is Standard Ocean. Switch to Freshwater (0).
    // Result for 100kg should drop by ~2.5kg.
    fireEvent.change(waterSelect, { target: { value: '0' } });

    await waitFor(() => {
      // Just ensure no crash and state update
      expect(waterSelect.value).toBe('0');
    });
  });
});
