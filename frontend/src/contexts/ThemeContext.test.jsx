import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeContext';

describe('ThemeContext', () => {
  let matchMediaMock;
  let mediaQueryListeners = [];

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-prefers-color-scheme');
    mediaQueryListeners = [];

    matchMediaMock = vi.fn(query => ({
      matches: false, // Default: light system theme
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event, cb) => mediaQueryListeners.push(cb)),
      removeEventListener: vi.fn((event, cb) => {
        mediaQueryListeners = mediaQueryListeners.filter(l => l !== cb);
      }),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to system theme when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('light');
  });

  it('initializes with dark resolvedTheme when system prefers dark', () => {
    window.matchMedia = vi.fn(query => ({
      matches: true, // System prefers dark
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('dark');
  });

  it('restores explicit theme from localStorage', () => {
    localStorage.setItem('divemap_theme', 'dark');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('dark');
  });

  it('allows switching to dark mode and updates localStorage and DOM', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('divemap_theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('dark');
  });

  it('allows switching to light mode from dark mode', () => {
    localStorage.setItem('divemap_theme', 'dark');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem('divemap_theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('light');
  });

  it('responds to system theme changes when theme is set to system', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.resolvedTheme).toBe('light');

    // Simulate system change to dark
    act(() => {
      mediaQueryListeners.forEach(cb => cb({ matches: true }));
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-prefers-color-scheme')).toBe('dark');
  });
});
