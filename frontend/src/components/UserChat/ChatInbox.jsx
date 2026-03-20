import { format } from 'date-fns';
import { Edit3 } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../Avatar';

const ChatInbox = ({ rooms, activeRoomId, onSelectRoom, onNewChat, isLoading, buddyCount }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || parseInt(localStorage.getItem('user_id'));

  if (isLoading) {
    return (
      <div className='flex flex-col space-y-4 p-4'>
        {[1, 2, 3].map(i => (
          <div key={i} className='flex items-center space-x-3 animate-pulse'>
            <div className='w-12 h-12 bg-gray-200 rounded-full'></div>
            <div className='flex-1 space-y-2'>
              <div className='h-4 bg-gray-200 rounded w-1/3'></div>
              <div className='h-3 bg-gray-200 rounded w-2/3'></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className='flex flex-col overflow-y-auto h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'>
      <div className='p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center'>
        <h2 className='text-xl font-bold text-gray-900 dark:text-white'>Messages</h2>
        <button
          onClick={onNewChat}
          className='p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors'
          title='New Conversation'
        >
          <Edit3 className='h-5 w-5' />
        </button>
      </div>
      <div className='flex-1 overflow-y-auto'>
        {rooms.map(room => {
          const isActive = room.id === activeRoomId;
          // Determine display name and avatar (for DMs)
          const otherMembers = room.members.filter(m => m.user_id !== currentUserId);
          const displayName = room.is_group
            ? room.name
            : otherMembers[0]?.user?.username || otherMembers[0]?.username || 'Unknown User';
          // Fallback to the member's avatar_url if the user object isn't fully populated
          const displayAvatar = room.is_group
            ? null
            : otherMembers[0]?.user?.avatar_url || otherMembers[0]?.avatar_url;

          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`w-full flex items-center p-4 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-left border-b border-gray-100 dark:border-gray-700 ${
                isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className='relative shrink-0'>
                {room.is_ai ? (
                  <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      width='24'
                      height='24'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='text-blue-600 dark:text-blue-400'
                    >
                      <path d='M12 8V4H8' />
                      <rect width='16' height='12' x='4' y='8' rx='2' />
                      <path d='M2 14h2' />
                      <path d='M20 14h2' />
                      <path d='M15 13v2' />
                      <path d='M9 13v2' />
                    </svg>
                  </div>
                ) : (
                  <Avatar src={displayAvatar} alt={displayName} size='md' username={displayName} />
                )}
                {room.unread_count > 0 && (
                  <span className='absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-gray-800 animate-bounce'>
                    {room.unread_count}
                  </span>
                )}
              </div>
              <div className='ml-3 flex-1 min-w-0'>
                <div className='flex justify-between items-baseline mb-1'>
                  <h3
                    className={`text-sm font-semibold truncate ${
                      room.unread_count > 0
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {displayName}
                  </h3>
                  <span className='text-[10px] text-gray-400'>
                    {room.last_activity_at
                      ? format(new Date(room.last_activity_at), 'HH:mm')
                      : '--:--'}
                  </span>
                </div>
                <p
                  className={`text-xs truncate ${
                    room.unread_count > 0
                      ? 'text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider'
                      : 'text-gray-500 dark:text-gray-400 italic'
                  }`}
                >
                  {room.unread_count > 0
                    ? `${room.unread_count} new message${room.unread_count > 1 ? 's' : ''}`
                    : room.last_activity_at
                      ? `Last activity: ${format(new Date(room.last_activity_at), 'MMM d, HH:mm')}`
                      : 'No recent activity'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

ChatInbox.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      is_group: PropTypes.bool.isRequired,
      name: PropTypes.string,
      last_activity_at: PropTypes.string,
      unread_count: PropTypes.number,
      latest_message: PropTypes.string,
      members: PropTypes.array.isRequired,
    })
  ).isRequired,
  activeRoomId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelectRoom: PropTypes.func.isRequired,
  onNewChat: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  buddyCount: PropTypes.number,
};

export default ChatInbox;
