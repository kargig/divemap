import { format } from 'date-fns';
import { Edit2, Check, CheckCheck, Clock, MapPin, TrendingUp } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { parseUTCDate } from '../../utils/dateHelpers';
import { slugify } from '../../utils/slugify';
import Avatar from '../Avatar';
import ChatbotIcon from '../Chat/ChatbotIcon.jsx';
import CurrencyIcon from '../ui/CurrencyIcon';

import LinkPreview from './LinkPreview';

const MessageBubble = ({
  message,
  isOwn,
  onEdit,
  isGrouped,
  isLastInGroup = true,
  showName = true,
  showAvatar = true,
  readStatus,
}) => {
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
    <div
      className={`flex w-full ${isGrouped ? 'mb-[2px]' : 'mb-4'} ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {/* Received Message Avatar (Left) */}
      {!isOwn && (
        <div className='mr-2 mt-auto flex-shrink-0 w-8 h-8'>
          {showAvatar &&
            (isBot ? (
              <div className='w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100'>
                <ChatbotIcon className='w-5 h-5 text-blue-600' />
              </div>
            ) : (
              <Avatar
                src={message.sender?.avatar_url}
                size='sm'
                username={message.sender?.username}
              />
            ))}
        </div>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      >
        {!isOwn && showName && (
          <span className='text-[10px] text-gray-400 mb-1 ml-1 uppercase tracking-wider font-semibold'>
            {isBot ? 'Divemap AI' : message.sender?.username}
          </span>
        )}

        <div className='group relative flex items-end'>
          <div
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm shadow-sm transition-colors ${
              isOwn
                ? `bg-blue-600 text-white rounded-2xl ${!showName ? 'rounded-tr-[4px]' : ''} ${isLastInGroup ? 'rounded-br-sm' : 'rounded-br-[4px]'}`
                : isBot
                  ? `bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-100 border border-blue-100 dark:border-blue-800 rounded-2xl ${!showName ? 'rounded-tl-[4px]' : ''} ${isLastInGroup ? 'rounded-bl-sm' : 'rounded-bl-[4px]'}`
                  : `bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-600 rounded-2xl ${!showName ? 'rounded-tl-[4px]' : ''} ${isLastInGroup ? 'rounded-bl-sm' : 'rounded-bl-[4px]'}`
            }`}
          >
            {message.message_type === 'TRIP_AD' ? (
              (() => {
                let tripData;
                try {
                  tripData = JSON.parse(message.content);
                } catch (e) {
                  tripData = {};
                }

                const spotsAvailable =
                  tripData.spots_total !== null && tripData.spots_total !== undefined
                    ? Math.max(0, tripData.spots_total - (tripData.spots_booked || 0))
                    : null;

                return (
                  <div className='bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md mt-1 mb-2 border border-gray-200 dark:border-gray-700 min-w-[180px] sm:min-w-[280px] max-w-sm'>
                    <div className='p-1.5 sm:p-3 border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 flex justify-between items-center'>
                      <span className='text-[9px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide'>
                        {tripData.is_update ? 'Updated Trip Announcement' : 'New Trip Announcement'}
                      </span>
                      {tripData.status === 'confirmed' && (
                        <span className='text-[8px] sm:text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1 sm:px-2 py-0.5 rounded-full uppercase'>
                          Confirmed
                        </span>
                      )}
                    </div>
                    <div className='p-2 sm:p-4'>
                      <h4 className='font-bold text-gray-900 dark:text-white mb-1.5 sm:mb-2 text-xs sm:text-base leading-snug'>
                        {tripData.name || 'Dive Trip'}
                      </h4>

                      {tripData.dive_sites && tripData.dive_sites.length > 0 && (
                        <div className='flex items-start gap-1 mb-2 sm:mb-3 text-[10px] sm:text-sm text-gray-700 dark:text-gray-300'>
                          <MapPin className='w-3 h-3 sm:w-4 sm:h-4 text-blue-500 mt-0.5 shrink-0' />
                          <div className='font-medium line-clamp-2'>
                            {tripData.dive_sites.map((site, index) => {
                              // Handle both old string format and new object format gracefully
                              const isString = typeof site === 'string';
                              const siteName = isString ? site : site.name;
                              const siteLink = isString
                                ? null
                                : `/dive-sites/${site.id}/${slugify(site.name)}`;

                              return (
                                <React.Fragment key={index}>
                                  {siteLink ? (
                                    <Link
                                      to={siteLink}
                                      className='text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors'
                                    >
                                      {siteName}
                                    </Link>
                                  ) : (
                                    <span>{siteName}</span>
                                  )}
                                  {index < tripData.dive_sites.length - 1 && ', '}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className='grid grid-cols-2 gap-x-1.5 gap-y-1 sm:gap-2 mb-3 sm:mb-4 text-[10px] sm:text-sm text-gray-700 dark:text-gray-300'>
                        {' '}
                        {tripData.date && (
                          <div className='flex items-center space-x-1'>
                            <span className='text-blue-500 w-3 text-center'>📅</span>
                            <span className='truncate'>
                              {new Date(tripData.date).toLocaleDateString(undefined, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                        {tripData.time && (
                          <div className='flex items-center space-x-1'>
                            <span className='text-blue-500 w-3 text-center'>🕒</span>
                            <span className='truncate'>{tripData.time.substring(0, 5)}</span>
                          </div>
                        )}
                        {tripData.price && (
                          <div className='flex items-center space-x-1'>
                            <CurrencyIcon
                              currencyCode={tripData.currency}
                              className='w-3 h-3 sm:w-4 sm:h-4 text-blue-500 shrink-0'
                            />
                            <span className='font-semibold text-gray-900 dark:text-gray-100 truncate'>
                              {tripData.price}
                            </span>
                          </div>
                        )}
                        {tripData.difficulty && (
                          <div className='flex items-center space-x-1'>
                            <span className='text-blue-500 w-3 text-center'>⭐</span>
                            <span
                              className='truncate capitalize'
                              title={tripData.difficulty.replace(/_/g, ' ').toLowerCase()}
                            >
                              {tripData.difficulty.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          </div>
                        )}
                        {tripData.max_depth && (
                          <div className='flex items-center space-x-1'>
                            <TrendingUp className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-blue-500 shrink-0' />
                            <span className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {tripData.max_depth}m
                            </span>
                          </div>
                        )}
                      </div>
                      {spotsAvailable !== null && (
                        <div className='mb-3 sm:mb-4 text-[9px] sm:text-xs font-medium px-1.5 sm:px-3 py-1 sm:py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-center'>
                          {spotsAvailable > 0 ? (
                            <span className='text-green-600 dark:text-green-400'>
                              {spotsAvailable} spot{spotsAvailable !== 1 && 's'} remaining
                            </span>
                          ) : (
                            <span className='text-red-500 dark:text-red-400'>Fully Booked</span>
                          )}
                        </div>
                      )}

                      <Link
                        to={`/dive-trips/${tripData.trip_id}`}
                        className='block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 sm:py-2.5 text-[10px] sm:text-sm rounded-lg transition-colors shadow-sm'
                      >
                        View Trip Details
                      </Link>
                    </div>
                  </div>
                );
              })()
            ) : (
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
            )}

            {uniqueDiveSiteUrls.map((url, idx) => (
              <LinkPreview key={idx} url={url} />
            ))}

            <div
              className={`flex items-center space-x-1 mt-1 text-[9px] ${isOwn ? 'text-blue-100' : 'text-gray-400'} justify-end`}
            >
              <span title={format(parseUTCDate(message.created_at), 'MMM d, yyyy HH:mm:ss')}>
                {format(parseUTCDate(message.created_at), 'HH:mm')}
              </span>
              {message.is_edited && <span>• (Edited)</span>}
              {isOwn && readStatus && (
                <span className='ml-0.5 flex items-center'>
                  {readStatus === 'read' ? (
                    <CheckCheck size={12} className='text-blue-300' />
                  ) : readStatus === 'delivered' ? (
                    <CheckCheck size={12} className='text-blue-100/70' />
                  ) : readStatus === 'sent' ? (
                    <Check size={12} className='text-blue-100/70' />
                  ) : (
                    <Clock size={10} className='text-blue-100/70' />
                  )}
                </span>
              )}
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

      {/* Sent Message Avatar (Right) */}
      {isOwn && (
        <div className='ml-2 mt-auto flex-shrink-0 w-8 h-8'>
          {showAvatar && (
            <Avatar
              src={message.sender?.avatar_url}
              size='sm'
              username={message.sender?.username}
            />
          )}
        </div>
      )}
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
  isGrouped: PropTypes.bool,
  isLastInGroup: PropTypes.bool,
  showName: PropTypes.bool,
  showAvatar: PropTypes.bool,
  readStatus: PropTypes.string,
};

export default MessageBubble;
