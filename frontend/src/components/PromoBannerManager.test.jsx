import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import PromoBannerManager from './PromoBannerManager';

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetPromoEligibility = vi.fn();
vi.mock('../utils/promoStorage', () => ({
  incrementSessionPageViews: vi.fn(),
  incrementCumulativePageViews: vi.fn(),
  getPromoEligibility: () => mockGetPromoEligibility(),
  dismissPromo: vi.fn(),
}));

const mockGetConsentStatus = vi.fn();
vi.mock('../utils/consent', () => ({
  CONSENT_UPDATED_EVENT: 'divemap-consent-updated',
  getConsentStatus: () => mockGetConsentStatus(),
}));

describe('PromoBannerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConsentStatus.mockReturnValue({
      hasResponded: true,
      analytics: false,
      preferences: false,
      necessary: true,
    });
  });

  it('suppresses render if logged in', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, loading: false });
    mockGetPromoEligibility.mockReturnValue({ isEligible: true, platform: 'desktop' });

    const { container } = render(
      <MemoryRouter>
        <PromoBannerManager />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders promo banner if not logged in and eligible on default route', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockGetPromoEligibility.mockReturnValue({ isEligible: true, platform: 'desktop' });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PromoBannerManager />
      </MemoryRouter>
    );
    expect(screen.getByText('Join the Divemap Community!')).toBeInTheDocument();
  });

  it('suppresses promo while cookie consent banner is still pending', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockGetPromoEligibility.mockReturnValue({ isEligible: true, platform: 'desktop' });
    mockGetConsentStatus.mockReturnValue({
      hasResponded: false,
      analytics: false,
      preferences: false,
      necessary: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PromoBannerManager />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('suppresses render if on /login route even if eligible', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockGetPromoEligibility.mockReturnValue({ isEligible: true, platform: 'desktop' });

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <PromoBannerManager />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('suppresses render if on /register route even if eligible', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockGetPromoEligibility.mockReturnValue({ isEligible: true, platform: 'desktop' });

    const { container } = render(
      <MemoryRouter initialEntries={['/register']}>
        <PromoBannerManager />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
