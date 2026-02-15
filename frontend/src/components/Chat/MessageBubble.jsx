import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import FeedbackButtons from './FeedbackButtons';

const MessageBubble = memo(({ message, onFeedback }) => {
  const isUser = message.role === 'user';

  return (
    <div
      data-testid='chat-message-bubble'
      className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
        }`}
      >
        <div
          className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => {
                // Check if internal link
                if (props.href && props.href.startsWith('/')) {
                  return (
                    <Link to={props.href} className='text-blue-500 hover:underline'>
                      {props.children}
                    </Link>
                  );
                }
                return (
                  <a
                    {...props}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-500 hover:underline'
                  />
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {!isUser && message.role === 'assistant' && (
          <div className='mt-2 flex justify-end'>
            <FeedbackButtons
              messageId={message.message_id}
              onFeedback={onFeedback}
              currentRating={message.user_rating}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
