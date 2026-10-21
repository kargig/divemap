import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import ScubaToolsSkeleton from './ScubaToolsSkeleton';

describe('ScubaToolsSkeleton Component', () => {
  it('renders accessible loading state with status role', () => {
    render(<ScubaToolsSkeleton />);

    const skeleton = screen.getByRole('status', { name: /loading dive planning tools/i });
    expect(skeleton).toBeInTheDocument();
    expect(screen.getByText('Scuba Tools')).toBeInTheDocument();
  });
});
