import { User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import { searchUsers } from '../api';

/**
 * UserSearchInput - Reusable component for searching and selecting users (e.g., for dive buddies)
 *
 * Features:
 * - Debounced search (0.5 seconds)
 * - Displays user avatar, username, and name
 * - Filters out excluded users (e.g., already selected buddies)
 * - Loading and error states
 * - Keyboard navigation support
 *
 * @param {Function} onSelect - Callback when user is selected: (user) => void
 * @param {Array<number>} excludeUserIds - Array of user IDs to exclude from results
 * @param {string} placeholder - Placeholder text for input
 * @param {string} className - Additional CSS classes
 * @param {string} label - Label for the input field
 */
const UserSearchInput = ({
  onSelect,
  excludeUserIds = [],
  placeholder = 'Search for users...',
  className = '',
  label = 'Search Users',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle search input change with debouncing
  const handleSearchChange = value => {
    // Validate input length
    if (value && value.length > 100) {
      setError('Search query too long (max 100 characters)');
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    setSearchQuery(value);
    setIsDropdownOpen(true);
    setSelectedIndex(-1);
    setError(null);

    if (!value || value.trim().length === 0) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search: wait 0.5 seconds after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const results = await searchUsers(value.trim(), 25);

        // Filter out excluded users
        const filteredResults = Array.isArray(results)
          ? results.filter(user => !excludeUserIds.includes(user.id))
          : [];

        setSearchResults(filteredResults);
      } catch (err) {
        console.error('User search failed:', err);
        setError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  // Handle user selection
  const handleUserSelect = user => {
    if (onSelect) {
      onSelect(user);
    }
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = e => {
    if (!isDropdownOpen || searchResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleUserSelect(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        if (inputRef.current) {
          inputRef.current.blur();
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && <label className='block text-sm font-medium text-gray-700 mb-2'>{label}</label>}
      <div className='relative'>
        <input
          ref={inputRef}
          type='text'
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (searchQuery && searchResults.length > 0) {
              setIsDropdownOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
        />
        {isLoading && (
          <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500'></div>
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isDropdownOpen && (searchResults.length > 0 || error) && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
          {error && <div className='px-4 py-2 text-sm text-red-600'>{error}</div>}
          {searchResults.length === 0 && !error && searchQuery.trim() && (
            <div className='px-4 py-2 text-sm text-gray-500'>
              No users found matching "{searchQuery}"
            </div>
          )}
          {searchResults.map((user, index) => (
            <div
              key={user.id}
              onClick={() => handleUserSelect(user)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-100 flex items-center gap-3 ${
                selectedIndex === index ? 'bg-gray-100' : ''
              }`}
            >
              {/* Avatar */}
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className='w-10 h-10 rounded-full object-cover'
                />
              ) : (
                <div className='w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center'>
                  <User size={20} className='text-gray-500' />
                </div>
              )}

              {/* User Info */}
              <div className='flex-1 min-w-0'>
                <div className='text-sm font-medium text-gray-900 truncate'>{user.username}</div>
                {user.name && <div className='text-xs text-gray-500 truncate'>{user.name}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSearchInput;
