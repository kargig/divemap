import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import * as ApiHooks from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';

import * as AuthContext from '../contexts/AuthContext';

import DivingCenterDetail from './DivingCenterDetail';

// Mock the AuthContext
vi.mock('../contexts/AuthContext');

// Mock react-query
vi.mock('react-query', async () => {
  const actual = await vi.importActual('react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1', slug: 'test-center' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ search: '', state: {} }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock the Lightbox component to avoid deep rendering issues
vi.mock('../components/Lightbox/Lightbox', () => {
  const MockLightbox = () => <div data-testid='mock-lightbox'>Lightbox</div>;
  return {
    __esModule: true,
    default: MockLightbox,
  };
});

describe('DivingCenterDetail - Media Tab', () => {
  const queryClient = new QueryClient();

  const renderComponent = (user = null) => {
    AuthContext.useAuth.mockReturnValue({ user, loading: false });

    // Mock the useQuery returns for diving center and related data
    ApiHooks.useQuery.mockImplementation(key => {
      if (key[0] === 'diving-center') {
        return {
          data: {
            id: 1,
            name: 'Test Center',
            owner_id: 10,
            ownership_status: 'approved',
            media: [{ id: 1, full_url: 'img1.jpg', full_thumbnail_url: 'thumb1.jpg' }],
          },
          isLoading: false,
          error: null,
        };
      }
      return { data: null, isLoading: false };
    });

    return render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <DivingCenterDetail />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Media tab button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /Media/i })).toBeInTheDocument();
  });

  it('displays the photo gallery when the Media tab is clicked', () => {
    renderComponent();

    // Click the Media tab
    const mediaTab = screen.getByRole('button', { name: /Media/i });
    fireEvent.click(mediaTab);

    // Verify gallery elements are present (Lightbox component should render)
    expect(screen.getByTestId('mock-lightbox')).toBeInTheDocument();
  });

  it('shows Management tab for owners', () => {
    const ownerUser = { id: 10, is_admin: false };
    renderComponent(ownerUser);

    expect(screen.getByRole('button', { name: /Management/i })).toBeInTheDocument();
  });

  it('hides Management tab for regular users', () => {
    const regularUser = { id: 99, is_admin: false };
    renderComponent(regularUser);

    expect(screen.queryByRole('button', { name: /Management/i })).not.toBeInTheDocument();
  });
});
