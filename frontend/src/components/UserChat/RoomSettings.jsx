import { X, Users, LogOut, Edit, Check, Settings } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';

import { leaveChatRoom, updateChatRoom } from '../../api';
import Avatar from '../Avatar';

const RoomSettings = ({ room, currentUserId, onClose }) => {
  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(room?.name || '');

  const isAdmin = room?.members?.find(m => m.user_id === currentUserId)?.role === 'ADMIN';

  const leaveMutation = useMutation(() => leaveChatRoom(room.id), {
    onSuccess: () => {
      queryClient.invalidateQueries('chat-rooms');
      toast.success('You have left the group chat');
      onClose(true); // Signal that we left the room
    },
    onError: err => {
      toast.error(err.response?.data?.detail || 'Failed to leave group chat');
    },
  });

  const updateMutation = useMutation(() => updateChatRoom(room.id, newName), {
    onSuccess: () => {
      queryClient.invalidateQueries('chat-rooms');
      toast.success('Group name updated');
      setIsEditingName(false);
    },
    onError: err => {
      toast.error(err.response?.data?.detail || 'Failed to update group name');
    },
  });

  const handleLeave = () => {
    if (window.confirm('Are you sure you want to leave this group chat?')) {
      leaveMutation.mutate();
    }
  };

  const handleUpdateName = () => {
    if (!newName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }
    updateMutation.mutate();
  };

  if (!room) return null;

  return (
    <div className='flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden'>
      {/* Header */}
      <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900'>
        <h2 className='text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2'>
          <Settings className='h-5 w-5 text-gray-500' />
          Room Details
        </h2>
        <button
          onClick={() => onClose()}
          className='p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors'
        >
          <X className='h-5 w-5 text-gray-500' />
        </button>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-6'>
        {/* Room Info */}
        <div className='text-center space-y-3'>
          <div className='flex justify-center'>
            <div className='w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400'>
              <Users className='h-10 w-10' />
            </div>
          </div>

          <div className='space-y-1'>
            {isEditingName && isAdmin ? (
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  className='flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500'
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={handleUpdateName}
                  className='p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                >
                  <Check className='h-4 w-4' />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className='p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg hover:bg-gray-200'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            ) : (
              <div className='flex items-center justify-center gap-2'>
                <h3 className='text-xl font-bold text-gray-900 dark:text-white'>
                  {room.is_group ? room.name : 'Direct Message'}
                </h3>
                {room.is_group && isAdmin && (
                  <button
                    onClick={() => setIsEditingName(true)}
                    className='p-1 text-gray-400 hover:text-blue-600 transition-colors'
                  >
                    <Edit className='h-4 w-4' />
                  </button>
                )}
              </div>
            )}
            <p className='text-sm text-gray-500'>
              {room.is_group ? 'Group Chat' : 'Private Message'} • {room.members.length}{' '}
              participants
            </p>
          </div>
        </div>

        {/* Participants */}
        <div className='space-y-3'>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider px-1'>
            Participants
          </h4>
          <div className='space-y-2'>
            {room.members.map(member => (
              <div
                key={member.user_id}
                className='flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <Avatar
                    src={member.user?.avatar_url}
                    alt={member.user?.username}
                    size='sm'
                    username={member.user?.username}
                  />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {member.user?.username}
                      {member.user_id === currentUserId && (
                        <span className='ml-1.5 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded'>
                          You
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {member.role === 'ADMIN' && (
                  <span className='text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase'>
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className='pt-6 border-t border-gray-100 dark:border-gray-700'>
          {room.is_group && (
            <button
              onClick={handleLeave}
              disabled={leaveMutation.isLoading}
              className='w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-semibold border border-red-100 dark:border-red-900/30'
            >
              <LogOut className='h-5 w-5' />
              {leaveMutation.isLoading ? 'Leaving...' : 'Leave Group'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomSettings;
