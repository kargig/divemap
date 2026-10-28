import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import DiveSiteExplorerCard from './DiveSiteExplorerCard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('DiveSiteExplorerCard', () => {
  it('renders author profile card with username link', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DiveSiteExplorerCard username='kargig' />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Mapped By Explorer')).toBeInTheDocument();
    expect(screen.getByText('kargig')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^kargig$/i })).toHaveAttribute(
      'href',
      '/users/kargig'
    );
  });
});
