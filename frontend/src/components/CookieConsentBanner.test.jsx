import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as consentUtil from '../utils/consent';

import CookieConsentBanner from './CookieConsentBanner';

describe('CookieConsentBanner Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderBanner = () =>
    render(
      <BrowserRouter>
        <CookieConsentBanner />
      </BrowserRouter>
    );

  it('renders banner when user has not yet made a choice', () => {
    renderBanner();
    expect(screen.getByText(/We value your privacy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject Optional/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customize/i })).toBeInTheDocument();
  });

  it('does not render banner when user has already responded', () => {
    localStorage.setItem(
      'divemap_cookie_consent',
      JSON.stringify({ analytics: true, timestamp: Date.now() })
    );
    renderBanner();
    expect(screen.queryByText(/We value your privacy/i)).not.toBeInTheDocument();
  });

  it('accepts all cookies and hides banner when "Accept All" is clicked', () => {
    const setConsentSpy = vi.spyOn(consentUtil, 'setConsent');
    renderBanner();

    const acceptBtn = screen.getByRole('button', { name: /Accept All/i });
    fireEvent.click(acceptBtn);

    expect(setConsentSpy).toHaveBeenCalledWith({ analytics: true, preferences: true });
    expect(screen.queryByText(/We value your privacy/i)).not.toBeInTheDocument();
  });

  it('rejects optional cookies and hides banner when "Reject Optional" is clicked', () => {
    const setConsentSpy = vi.spyOn(consentUtil, 'setConsent');
    renderBanner();

    const rejectBtn = screen.getByRole('button', { name: /Reject Optional/i });
    fireEvent.click(rejectBtn);

    expect(setConsentSpy).toHaveBeenCalledWith({ analytics: false, preferences: false });
    expect(screen.queryByText(/We value your privacy/i)).not.toBeInTheDocument();
  });

  it('opens customize modal and allows saving granular preferences', () => {
    const setConsentSpy = vi.spyOn(consentUtil, 'setConsent');
    renderBanner();

    const customizeBtn = screen.getByRole('button', { name: /Customize/i });
    fireEvent.click(customizeBtn);

    expect(screen.getByText(/Cookie Preferences/i)).toBeInTheDocument();
    expect(screen.getByText(/Strictly Necessary/i)).toBeInTheDocument();
    expect(screen.getByText(/Analytics Cookies/i)).toBeInTheDocument();

    const analyticsCheckbox = screen.getByRole('checkbox', {
      name: /Analytics Cookies/i,
    });
    expect(analyticsCheckbox).not.toBeChecked();

    // Toggle analytics on
    fireEvent.click(analyticsCheckbox);
    expect(analyticsCheckbox).toBeChecked();

    // Save preferences
    const saveBtn = screen.getByRole('button', { name: /Save Preferences/i });
    fireEvent.click(saveBtn);

    expect(setConsentSpy).toHaveBeenCalledWith({ analytics: true, preferences: false });
    expect(screen.queryByText(/Cookie Preferences/i)).not.toBeInTheDocument();
  });

  it('re-opens preferences modal when divemap-open-cookie-settings event is triggered', () => {
    localStorage.setItem(
      'divemap_cookie_consent',
      JSON.stringify({ analytics: false, timestamp: Date.now() })
    );
    renderBanner();

    expect(screen.queryByText(/Cookie Preferences/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new window.CustomEvent('divemap-open-cookie-settings'));
    });

    expect(screen.getByText(/Cookie Preferences/i)).toBeInTheDocument();
  });
});
