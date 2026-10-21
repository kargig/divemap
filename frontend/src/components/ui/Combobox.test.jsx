import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import Combobox from './Combobox';

describe('Combobox Component Accessibility', () => {
  const sampleOptions = [
    { value: '1', label: 'Option One' },
    { value: '2', label: 'Option Two' },
  ];

  it('renders button with accessible name from aria-label', () => {
    render(
      <Combobox
        options={sampleOptions}
        value=''
        onValueChange={vi.fn()}
        aria-label='Search Everything'
        placeholder='Search...'
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Search Everything' });
    expect(combobox).toBeInTheDocument();
    expect(combobox).not.toHaveAttribute('aria-controls', 'undefined-content');
  });

  it('falls back to placeholder as accessible name when no label or aria-label provided', () => {
    render(
      <Combobox
        options={sampleOptions}
        value=''
        onValueChange={vi.fn()}
        placeholder='Select dive site...'
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Select dive site...' });
    expect(combobox).toBeInTheDocument();
  });

  it('sets aria-controls cleanly when id is provided', () => {
    render(
      <Combobox
        id='site-selector'
        options={sampleOptions}
        value=''
        onValueChange={vi.fn()}
        label='Dive Site'
      />
    );

    const combobox = screen.getByRole('combobox', { name: 'Dive Site' });
    expect(combobox).toHaveAttribute('aria-controls', 'site-selector-content');
  });
});
