import React from 'react';

import { searchUsers } from '../../api';
import Avatar from '../Avatar';

import AutocompleteDropdown from './AutocompleteDropdown';

export const UserSearchDropdown = ({
  value,
  onChange,
  label = 'User',
  placeholder = 'Search users...',
  includeSelf = true,
  className,
}) => {
  const fetchUsers = async query => {
    try {
      const results = await searchUsers(query, 20, includeSelf);
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('Search users failed', error);
      return [];
    }
  };

  const renderUserItem = user => (
    <div className='flex items-center gap-2'>
      <Avatar
        src={user.avatar_full_url || user.avatar_url}
        alt={user.username}
        size='xs'
        username={user.username}
      />
      <div>
        <div className='font-medium text-gray-900'>{user.username}</div>
        {user.name && <div className='text-xs text-gray-500'>{user.name}</div>}
      </div>
    </div>
  );

  return (
    <AutocompleteDropdown
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={selectedUser => onChange(selectedUser ? selectedUser.username : '')}
      fetchData={fetchUsers}
      renderItem={renderUserItem}
      keyExtractor={user => user.id}
      displayValueExtractor={user => user.username}
      emptyMessage='No users found'
      className={className}
    />
  );
};
