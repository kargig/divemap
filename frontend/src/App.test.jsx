import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import App from './App';

// Mock dependencies to avoid full app rendering issues in simple test
/* eslint-disable react/prop-types */
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('./contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('react-query', () => ({
  QueryClientProvider: ({ children }) => <div>{children}</div>,
  QueryClient: class {
    clear() {}
  },
}));
/* eslint-enable react/prop-types */

vi.mock('./components/SessionManager', () => ({
  SessionManager: () => <div>SessionManager</div>,
}));

vi.mock('./components/Navbar', () => ({
  default: () => <div>Navbar</div>,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Navbar/i)).toBeInTheDocument();
  });
});
