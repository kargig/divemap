import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import InFeedPromoCard from './InFeedPromoCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('InFeedPromoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders default desktop layout when platform is desktop or not specified', () => {
    // Mock Math.random to return 0.0, selecting the first item (Log Your Dive Computer Profiles)
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    render(
      <Router>
        <InFeedPromoCard platform='desktop' />
      </Router>
    );

    expect(screen.getByText('Log Your Dive Computer Profiles')).toBeInTheDocument();
    expect(screen.getByText(/Visualize your dive data! Upload Subsurface XML/)).toBeInTheDocument();

    const signUpButton = screen.getByRole('button', { name: 'Sign Up Free' });
    expect(signUpButton).toBeInTheDocument();

    fireEvent.click(signUpButton);
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  it('renders android layout when platform is android', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const mockOpen = vi.spyOn(window, 'open').mockImplementation(() => {});

    render(
      <Router>
        <InFeedPromoCard platform='android' />
      </Router>
    );

    expect(screen.getByText('Install Divemap App')).toBeInTheDocument();
    expect(screen.getByText(/Visualize your dive data!/)).toBeInTheDocument();
    expect(
      screen.getByText(/Install the app for fast access and offline support!/)
    ).toBeInTheDocument();

    const installButton = screen.getByRole('button', { name: 'Install App' });
    expect(installButton).toBeInTheDocument();

    fireEvent.click(installButton);
    expect(mockOpen).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=gr.divemap.twa',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('renders ios layout and toggles instruction modal when platform is ios', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);

    render(
      <Router>
        <InFeedPromoCard platform='ios' />
      </Router>
    );

    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
    expect(screen.getByText(/Visualize your dive data!/)).toBeInTheDocument();
    expect(
      screen.getByText(/Install on your iPhone to access your offline dive logs anytime./)
    ).toBeInTheDocument();

    const showButton = screen.getByRole('button', { name: 'How to Install' });
    expect(showButton).toBeInTheDocument();

    expect(screen.queryByText('Install on iPhone')).not.toBeInTheDocument();

    fireEvent.click(showButton);
    expect(screen.getByText('Install on iPhone')).toBeInTheDocument();
    expect(screen.getByText(/Tap Safari's/)).toBeInTheDocument();
    expect(screen.getByText(/Scroll down and select/)).toBeInTheDocument();

    const svg = document.querySelector('svg.lucide-x');
    const closeBtn = svg.closest('button');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Install on iPhone')).not.toBeInTheDocument();
  });

  it('returns null when platform is standalone', () => {
    const { container } = render(
      <Router>
        <InFeedPromoCard platform='standalone' />
      </Router>
    );

    expect(container.firstChild).toBeNull();
  });
});
