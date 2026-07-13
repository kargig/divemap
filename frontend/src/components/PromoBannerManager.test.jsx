import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import PromoBannerManager from './PromoBannerManager';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, loading: false }),
}));

// Also mock promoStorage to prevent real storage access / missing import errors
vi.mock('../utils/promoStorage', () => ({
  incrementSessionPageViews: vi.fn(),
  incrementCumulativePageViews: vi.fn(),
  getPromoEligibility: () => ({ isEligible: false, platform: 'desktop' }),
  dismissPromo: vi.fn(),
}));

describe('PromoBannerManager', () => {
  it('suppresses render if logged in', () => {
    const { container } = render(
      <Router>
        <PromoBannerManager />
      </Router>
    );
    expect(container.firstChild).toBeNull();
  });
});
