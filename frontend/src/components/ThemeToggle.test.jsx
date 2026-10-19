import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import * as ThemeContextModule from '../contexts/ThemeContext';

import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders desktop toggle button and opens dropdown menu on click', () => {
    const setThemeMock = vi.fn();
    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle variant='desktop' />);

    const button = screen.getByRole('button', { name: /theme/i });
    expect(button).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(button);

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    // Select Dark
    fireEvent.click(screen.getByText('Dark'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('renders mobile segmented pill and switches theme on segment click', () => {
    const setThemeMock = vi.fn();
    vi.spyOn(ThemeContextModule, 'useTheme').mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle variant='segmented' />);

    const darkBtn = screen.getByRole('button', { name: /switch to dark theme/i });
    expect(darkBtn).toBeInTheDocument();

    fireEvent.click(darkBtn);
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });
});
