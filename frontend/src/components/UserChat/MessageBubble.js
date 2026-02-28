import { format } from 'date-fns';
import { Edit2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import Avatar from '../Avatar';

const MessageBubble = ({ message, isOwn, onEdit }) => {
  return (
    <div className={`flex w-full mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className='mr-2 mt-auto'>
          <Avatar src={message.sender?.avatar_url} size='sm' username={message.sender?.username} />
        </div>
      )}

      <div
        className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      >
        {!isOwn && (
          <span className='text-[10px] text-gray-400 mb-1 ml-1 uppercase tracking-wider font-semibold'>
            {message.sender?.username}
          </span>
        )}

        <div className='group relative'>
          <div
            className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
              isOwn
                ? 'bg-blue-600 text-white rounded-br-none'
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-600'
            }`}
          >
            <p className='whitespace-pre-wrap break-words'>{message.content}</p>

            <div
              className={`flex items-center space-x-1 mt-1 text-[9px] ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}
            >
              <span>{format(new Date(message.created_at), 'HH:mm')}</span>
              {message.is_edited && <span>• (Edited)</span>}
            </div>
          </div>

          {isOwn && onEdit && (
            <button
              onClick={() => onEdit(message)}
              className='absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500'
              title='Edit message'
            >
              <Edit2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.number.isRequired,
    content: PropTypes.string.isRequired,
    created_at: PropTypes.string.isRequired,
    is_edited: PropTypes.bool,
    sender: PropTypes.shape({
      username: PropTypes.string,
      avatar_url: PropTypes.string,
    }),
  }).isRequired,
  isOwn: PropTypes.bool.isRequired,
  onEdit: PropTypes.func,
};

export default MessageBubble;
