import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NotificationBell from './NotificationBell';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('../contexts/NotificationContext', () => ({
  useNotificationContext: () => ({ unreadCount: 5 }),
  useNotifications: () => ({ markRead: vi.fn() }),
}));

vi.mock('react-query', () => ({
  useQuery: () => ({ 
    data: [
      { id: 1, title: 'Test Notification', message: 'Test Message', is_read: false, created_at: new Date().toISOString() }
    ] 
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('NotificationBell', () => {
  it('renders and opens dropdown with correct responsive classes', () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );

    // Find bell button
    const bellButton = screen.getByLabelText('Notifications');
    expect(bellButton).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(bellButton);

    // Find dropdown content
    // We can search for text inside the dropdown
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('5 unread')).toBeInTheDocument();

    // Find the dropdown container by inspecting the parent of a known element or by role if applicable
    // The dropdown has "fixed left-2 right-2..."
    // Let's find the text "Notifications" which is in the header of the dropdown, 
    // and traverse up to the container.
    const headerTitle = screen.getByText('Notifications');
    // The structure is: div(dropdown) > div(header) > div > Link(Title)
    const dropdownContainer = headerTitle.closest('.fixed'); // searching for the fixed class we added

    expect(dropdownContainer).toBeInTheDocument();
    
    // Check for the specific classes we added
    expect(dropdownContainer).toHaveClass('fixed', 'left-2', 'right-2', 'top-16', 'mt-2', 'w-auto');
    expect(dropdownContainer).toHaveClass('sm:absolute', 'sm:right-0', 'sm:top-full', 'sm:left-auto', 'sm:w-80');
    expect(dropdownContainer).toHaveClass('max-h-[70vh]', 'sm:max-h-96');
  });
});
