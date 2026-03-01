import { format } from 'date-fns';
import { Edit2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import Avatar from '../Avatar';
import ChatbotIcon from '../Chat/ChatbotIcon.jsx';

import LinkPreview from './LinkPreview';

const MessageBubble = ({ message, isOwn, onEdit }) => {
  const isBot = !message.sender_id && !message.sender;

  // Custom link component for Markdown
  const MarkdownLink = ({ href, children }) => {
    const isInternal = href?.startsWith('/');
    if (isInternal) {
      return (
        <Link
          to={href}
          className='text-blue-600 dark:text-blue-400 font-semibold hover:underline decoration-blue-500/30 underline-offset-2'
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        className='text-blue-600 dark:text-blue-400 font-semibold hover:underline decoration-blue-500/30 underline-offset-2'
      >
        {children}
      </a>
    );
  };

  // Custom text component to support @mentions within Markdown
  const MarkdownText = ({ children }) => {
    if (typeof children !== 'string') return children;

    const parts = children.split(/( @[a-zA-Z0-9_]+|^@[a-zA-Z0-9_]+)/);

    return parts.map((part, i) => {
      const mentionMatch = part.match(/^ ?@([a-zA-Z0-9_]+)$/);
      if (mentionMatch) {
        return (
          <span
            key={i}
            className={`font-semibold cursor-pointer hover:underline ${isOwn ? 'text-blue-200 hover:text-white' : 'text-blue-600 dark:text-blue-400'}`}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  // Find all internal links for previews
  const uniqueDiveSiteUrls = useMemo(() => {
    const origin = window.location.origin;
    // Matches relative links (/dive-sites/...) OR absolute links matching our domain
    // We escape the origin to use it safely in the Regex
    const escapedOrigin = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:${escapedOrigin})?(\\/dive-sites\\/\\d+[\\w-]*)`, 'g');

    const matches = [];
    let match;
    while ((match = regex.exec(message.content)) !== null) {
      matches.push(match[1]); // Always use the relative path for the preview component
    }
    return [...new Set(matches)];
  }, [message.content]);

  return (
    <div className={`flex w-full mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className='mr-2 mt-auto'>
          {isBot ? (
            <div className='w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100'>
              <ChatbotIcon className='w-5 h-5 text-blue-600' />
            </div>
          ) : (
            <Avatar
              src={message.sender?.avatar_url}
              size='sm'
              username={message.sender?.username}
            />
          )}
        </div>
      )}

      <div
        className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      >
        {!isOwn && (
          <span className='text-[10px] text-gray-400 mb-1 ml-1 uppercase tracking-wider font-semibold'>
            {isBot ? 'Divemap AI' : message.sender?.username}
          </span>
        )}

        <div className='group relative'>
          <div
            className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
              isOwn
                ? 'bg-blue-600 text-white rounded-br-none'
                : isBot
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-100 rounded-bl-none border border-blue-100 dark:border-blue-800'
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-600'
            }`}
          >
            <div className='markdown-content break-words'>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: MarkdownLink,
                  p: ({ children }) => <p className='mb-2 last:mb-0'>{children}</p>,
                  text: MarkdownText,
                  ul: ({ children }) => <ul className='list-disc ml-4 mb-2'>{children}</ul>,
                  ol: ({ children }) => <ol className='list-decimal ml-4 mb-2'>{children}</ol>,
                  li: ({ children }) => <li className='mb-1'>{children}</li>,
                  strong: ({ children }) => <strong className='font-bold'>{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {uniqueDiveSiteUrls.map((url, idx) => (
              <LinkPreview key={idx} url={url} />
            ))}

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
