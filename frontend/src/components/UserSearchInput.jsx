import { User } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useMemo } from 'react';

import { searchUsers } from '../api';

import Combobox from './ui/Combobox';

/**
 * UserSearchInput - Reusable component for searching and selecting users
 */
const UserSearchInput = ({
  onSelect,
  excludeUserIds = [],
  placeholder = 'Search for users...',
  className = '',
  label = 'Search Users',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchChange = value => {
    setSearchTerm(value);

    if (!value || value.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const results = await searchUsers(value.trim(), 25);
        const filteredResults = Array.isArray(results)
          ? results.filter(user => !excludeUserIds.includes(user.id))
          : [];
        setSearchResults(filteredResults);
      } catch (err) {
        console.error('User search failed:', err);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  const options = useMemo(() => {
    return searchResults.map(user => ({
      value: user.id.toString(),
      label: user.username,
      user: user, // Keep full user object for rendering and selection
    }));
  }, [searchResults]);

  const handleValueChange = value => {
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption && onSelect) {
      onSelect(selectedOption.user);
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  const renderUserItem = option => {
    const { user } = option;
    return (
      <div className='flex items-center gap-3 w-full'>
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className='w-8 h-8 rounded-full object-cover'
          />
        ) : (
          <div className='w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center'>
            <User size={16} className='text-gray-500' />
          </div>
        )}
        <div className='flex flex-col min-w-0'>
          <div className='text-sm font-medium text-gray-900 truncate'>{user.username}</div>
          {user.name && <div className='text-xs text-gray-500 truncate'>{user.name}</div>}
        </div>
      </div>
    );
  };

  return (
    <Combobox
      label={label}
      placeholder={placeholder}
      searchPlaceholder='Type to search users...'
      options={options}
      value='' // Always empty because we clear on selection
      onValueChange={handleValueChange}
      onSearchChange={handleSearchChange}
      searchTerm={searchTerm}
      isLoading={isLoading}
      renderItem={renderUserItem}
      className={className}
      emptyMessage={searchTerm ? `No users found matching "${searchTerm}"` : 'Type to search...'}
    />
  );
};

UserSearchInput.propTypes = {
  onSelect: PropTypes.func.isRequired,
  excludeUserIds: PropTypes.arrayOf(PropTypes.number),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  label: PropTypes.string,
};

export default UserSearchInput;
