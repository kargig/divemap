import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import CapacitorBackButtonHandler from './CapacitorBackButtonHandler';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: vi.fn(),
}));

describe('CapacitorBackButtonHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not add listener if not on native platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    
    render(
      <BrowserRouter>
        <CapacitorBackButtonHandler />
      </BrowserRouter>
    );

    expect(App.addListener).not.toHaveBeenCalled();
  });

  it('adds listener if on native platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(App.addListener).mockReturnValue(Promise.resolve({ remove: vi.fn() }));

    render(
      <BrowserRouter>
        <CapacitorBackButtonHandler />
      </BrowserRouter>
    );

    expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });
});
