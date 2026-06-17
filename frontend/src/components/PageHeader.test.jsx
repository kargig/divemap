import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders title and acts as container', () => {
    render(
      <BrowserRouter>
        <PageHeader title='Test Title' />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('passes string badge to PageTitle and renders it', () => {
    render(
      <BrowserRouter>
        <PageHeader title='Test Title' badge='New' />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('passes number badge to PageTitle and renders it formatted', () => {
    render(
      <BrowserRouter>
        <PageHeader title='Test Title' badge={1234} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
