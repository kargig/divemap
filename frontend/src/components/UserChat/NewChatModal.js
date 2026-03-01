import { X, UserPlus, Users, Search, Check } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import { getUserFriendships, createChatRoom } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../Avatar';

const NewChatModal = ({ isOpen, onClose, onRoomCreated }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuddyIds, setSelectedBuddyIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: friendships = [], isLoading } = useQuery(
    ['user-friendships', 'ACCEPTED'],
    () => getUserFriendships('ACCEPTED'),
    { enabled: isOpen }
  );

  const currentUserId = user?.id || parseInt(localStorage.getItem('user_id'));

  const buddies = useMemo(() => {
    return friendships.map(f => {
      // If user.id matches currentUserId, the buddy is 'friend'
      // If friend.id matches currentUserId, the buddy is 'user'
      if (f.user && f.user.id === currentUserId) return f.friend;
      if (f.friend && f.friend.id === currentUserId) return f.user;
      // Fallback in case currentUserId is missing or mismatched
      return f.user.id === currentUserId ? f.friend : f.user;
    });
  }, [friendships, currentUserId]);

  const filteredBuddies = useMemo(() => {
    if (!searchQuery) return buddies;
    const query = searchQuery.toLowerCase();
    return buddies.filter(
      b =>
        b.username.toLowerCase().includes(query) || (b.name && b.name.toLowerCase().includes(query))
    );
  }, [buddies, searchQuery]);

  const toggleBuddy = buddyId => {
    setSelectedBuddyIds(prev =>
      prev.includes(buddyId) ? prev.filter(id => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleCreateChat = async () => {
    if (selectedBuddyIds.length === 0) {
      toast.error('Please select at least one buddy');
      return;
    }

    const isGroup = selectedBuddyIds.length > 1;
    if (isGroup && !groupName.trim()) {
      toast.error('Please provide a group name');
      return;
    }

    setIsCreating(true);
    try {
      const room = await createChatRoom(
        selectedBuddyIds,
        isGroup,
        isGroup ? groupName.trim() : null
      );

      // Invalidate rooms query to update inbox
      queryClient.invalidateQueries('chat-rooms');

      onRoomCreated(room.id);
      onClose();

      // Reset state
      setSelectedBuddyIds([]);
      setGroupName('');
      setSearchQuery('');
    } catch (err) {
      console.error('Error creating chat:', err);
      toast.error(err.response?.data?.detail || 'Failed to create chat');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm'>
      <div className='bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden'>
        {/* Header */}
        <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
          <h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
            <UserPlus className='h-5 w-5 text-blue-600' />
            New Conversation
          </h2>
          <button
            onClick={onClose}
            className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors'
          >
            <X className='h-6 w-6 text-gray-500' />
          </button>
        </div>

        {/* Search */}
        <div className='p-4 border-b border-gray-100 dark:border-gray-700'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='text'
              placeholder='Search buddies...'
              className='w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Buddy List */}
        <div className='flex-1 overflow-y-auto p-2'>
          {isLoading ? (
            <div className='flex justify-center py-8'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : filteredBuddies.length === 0 ? (
            <div className='text-center py-8 text-gray-500'>
              <p>No buddies found.</p>
            </div>
          ) : (
            <div className='space-y-1'>
              {filteredBuddies.map(buddy => {
                const isSelected = selectedBuddyIds.includes(buddy.id);
                return (
                  <button
                    key={buddy.id}
                    onClick={() => toggleBuddy(buddy.id)}
                    className={`w-full flex items-center p-3 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className='relative'>
                      <Avatar
                        src={buddy.avatar_url}
                        alt={buddy.username}
                        size='md'
                        username={buddy.username}
                      />
                      {isSelected && (
                        <div className='absolute -top-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 shadow-sm'>
                          <Check className='h-3 w-3' />
                        </div>
                      )}
                    </div>
                    <div className='ml-3 flex-1 min-w-0'>
                      <p className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
                        {buddy.username}
                      </p>
                      {buddy.name && (
                        <p className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                          {buddy.name}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Group Config */}
        <div className='p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'>
          {selectedBuddyIds.length > 1 && (
            <div className='mb-4'>
              <label className='block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1'>
                Group Name
              </label>
              <div className='flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 px-3'>
                <Users className='h-4 w-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='E.g. Weekend Divers'
                  className='flex-1 py-2 bg-transparent text-sm outline-none'
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <div className='text-xs text-gray-500'>
              {selectedBuddyIds.length === 0
                ? 'Select a buddy to start'
                : `${selectedBuddyIds.length} participant${selectedBuddyIds.length > 1 ? 's' : ''} selected`}
            </div>
            <button
              onClick={handleCreateChat}
              disabled={selectedBuddyIds.length === 0 || isCreating}
              className='px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20'
            >
              {isCreating
                ? 'Creating...'
                : selectedBuddyIds.length > 1
                  ? 'Create Group'
                  : 'Start Chat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
