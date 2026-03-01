import { format } from 'date-fns';
import { MessageSquare, ExternalLink, Loader2 } from 'lucide-react';
import React, { useState, useRef, useMemo } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getChatRooms, getTotalUnreadChatMessages } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import useClickOutside from '../../hooks/useClickOutside';
import Avatar from '../Avatar';

const ChatDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Total Unread Count for the Badge
  const { data: unreadChatData } = useQuery('unreadChatCount', getTotalUnreadChatMessages, {
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  const unreadChatCount = unreadChatData?.unread_count || 0;

  // 2. Fetch Recent Rooms for the dropdown
  const { data: rooms = [], isLoading } = useQuery('chat-rooms-dropdown', getChatRooms, {
    enabled: showDropdown && !!user,
    staleTime: 60000, // 1 minute
  });

  // Sort rooms by last activity and pick top 5
  const recentRooms = useMemo(() => {
    return [...rooms]
      .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
      .slice(0, 5);
  }, [rooms]);

  // Close dropdown when clicking outside
  useClickOutside(dropdownRef, () => setShowDropdown(false), showDropdown);

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleRoomClick = roomId => {
    setShowDropdown(false);
    navigate('/messages', { state: { activeRoomId: roomId } });
  };

  const handleViewAll = () => {
    setShowDropdown(false);
    navigate('/messages');
  };

  if (!user) return null;

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className='relative flex items-center justify-center p-2 text-white hover:text-blue-200 transition-colors'
        aria-label='Messages'
        title='Messages'
      >
        <MessageSquare className='h-5 w-5' />
        {unreadChatCount > 0 && (
          <span className='absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center min-w-[1rem] border-2 border-blue-800 translate-x-1/4 -translate-y-1/4'>
            {unreadChatCount > 9 ? '9+' : unreadChatCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className='fixed left-2 right-2 top-16 mt-2 w-auto sm:absolute sm:right-0 sm:top-full sm:left-auto sm:w-80 bg-white rounded-xl shadow-2xl z-[9999] border border-gray-200 dark:border-gray-700 dark:bg-gray-800 max-h-[70vh] sm:max-h-96 flex flex-col overflow-hidden'>
          {/* Header */}
          <div className='p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'>
            <div className='flex items-center justify-between'>
              <h3
                className='text-lg font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors'
                onClick={handleViewAll}
              >
                Messages
              </h3>
              {unreadChatCount > 0 && (
                <span className='px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase tracking-wider'>
                  {unreadChatCount} New
                </span>
              )}
            </div>
          </div>

          {/* Room List */}
          <div className='flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50'>
            {isLoading ? (
              <div className='p-8 flex justify-center'>
                <Loader2 className='h-6 w-6 text-blue-500 animate-spin' />
              </div>
            ) : recentRooms.length > 0 ? (
              recentRooms.map(room => {
                const otherMembers = room.members.filter(m => m.user_id !== user.id);
                const displayName = room.is_group
                  ? room.name
                  : otherMembers[0]?.user?.username || 'Chat';
                const displayAvatar = room.is_group ? null : otherMembers[0]?.user?.avatar_url;

                return (
                  <button
                    key={room.id}
                    onClick={() => handleRoomClick(room.id)}
                    className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                      room.unread_count > 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className='relative shrink-0'>
                      <Avatar
                        src={displayAvatar}
                        alt={displayName}
                        size='sm'
                        username={displayName}
                      />
                      {room.unread_count > 0 && (
                        <div className='absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-blue-600 rounded-full border-2 border-white dark:border-gray-800' />
                      )}
                    </div>
                    <div className='ml-3 flex-1 min-w-0'>
                      <div className='flex justify-between items-baseline'>
                        <p
                          className={`text-sm truncate ${room.unread_count > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}
                        >
                          {displayName}
                        </p>
                        <span className='text-[10px] text-gray-400 whitespace-nowrap ml-2'>
                          {format(new Date(room.last_activity_at), 'HH:mm')}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${room.unread_count > 0 ? 'text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider' : 'text-gray-400 italic'}`}
                      >
                        {room.unread_count > 0
                          ? `${room.unread_count} new message${room.unread_count > 1 ? 's' : ''}`
                          : `Last active ${format(new Date(room.last_activity_at), 'MMM d, HH:mm')}`}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className='p-8 text-center text-gray-400'>
                <MessageSquare className='h-10 w-10 mx-auto mb-2 opacity-20' />
                <p className='text-sm italic'>No recent activity</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className='p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700'>
            <button
              onClick={handleViewAll}
              className='w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors'
            >
              View All Messages
              <ExternalLink className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatDropdown;
