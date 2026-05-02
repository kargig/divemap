import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { isSameDay, format, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { Send, Loader2, X, MoreVertical, ChevronLeft, HelpCircle, Smile } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import TextareaAutosize from 'react-textarea-autosize';

import {
  getChatMessages,
  sendUserChatMessage,
  editUserChatMessage,
  markChatRoomRead,
} from '../../api';
import { parseUTCDate } from '../../utils/dateHelpers';
import Avatar from '../Avatar';

import MessageBubble from './MessageBubble';

const CHAT_TIPS = [
  <>
    Tag <span className='font-bold'>@bot</span> to ask about weather or dive sites.
  </>,
  <>
    Tag <span className='font-bold'>@divemap</span> for instant AI assistance.
  </>,
  <>
    Paste a <span className='font-bold'>dive site link</span> for a rich preview.
  </>,
  <>
    Ask <span className='font-bold'>@bot</span> about <span className='font-bold'>MOD</span> or{' '}
    <span className='font-bold'>SAC</span> calculations.
  </>,
  <>
    Ask <span className='font-bold'>@bot</span> for nearby diving centers.
  </>,
];

const ChatRoom = ({ roomId, room, currentUserId, onToggleSettings, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showHints, setShowHints] = useState(() => !localStorage.getItem('chat_hints_dismissed'));
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  const scrollRef = useRef(null);
  const lastSyncTime = useRef(null);

  const activeTip = useMemo(() => {
    return CHAT_TIPS[Math.floor(Math.random() * CHAT_TIPS.length)];
  }, [roomId]);

  // Reset state when room changes to prevent showing old messages or sending wrong cursor
  if (roomId !== prevRoomId) {
    setPrevRoomId(roomId);
    setMessages([]);
    setInputText('');
    setEditingMessage(null);
    setShowEmojiPicker(false);
    lastSyncTime.current = null;
  }

  const dismissHints = () => {
    setShowHints(false);
    localStorage.setItem('chat_hints_dismissed', 'true');
  };

  const handleQuickReply = async text => {
    if (isSending) return;
    setIsSending(true);
    try {
      await sendUserChatMessage(roomId, text);
    } catch (error) {
      toast.error('Failed to send quick reply');
    } finally {
      setIsSending(false);
    }
  };

  const isCustomer = room?.members?.some(m => m.user_id === currentUserId);
  const canPost = !room?.is_broadcast || !isCustomer;

  // 1. Initial Load & Optimized Polling
  const { isFetching } = useQuery(
    ['chat-messages', roomId, lastSyncTime.current],
    () => getChatMessages(roomId, lastSyncTime.current),
    {
      refetchInterval: 3000, // Poll every 3 seconds
      enabled: !!roomId,
      onSuccess: newMessages => {
        if (newMessages.length > 0) {
          // Merge logic: append new, replace edited
          setMessages(prev => {
            const merged = [...prev];
            newMessages.forEach(newMsg => {
              const idx = merged.findIndex(m => m.id === newMsg.id);
              if (idx > -1) {
                merged[idx] = newMsg; // Replace edited message
              } else {
                merged.push(newMsg); // Append new message
              }
            });
            // Sort by creation time to ensure order
            return merged.sort((a, b) => parseUTCDate(a.created_at) - parseUTCDate(b.created_at));
          });

          // Update the high-watermark cursor
          const latestUpdate = newMessages.reduce(
            (max, m) => (parseUTCDate(m.updated_at) > parseUTCDate(max) ? m.updated_at : max),
            lastSyncTime.current || newMessages[0].updated_at
          );
          lastSyncTime.current = latestUpdate;

          // Mark room as read
          markChatRoomRead(roomId).catch(err => console.error('Failed to mark read:', err));
        }
      },
      onError: err => {
        if (err.response?.status !== 304) {
          console.error('Chat sync error:', err);
        }
      },
    }
  );

  // 2. Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. Handle Send / Edit
  const handleSubmit = async e => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    setShowEmojiPicker(false);
    try {
      if (editingMessage) {
        await editUserChatMessage(editingMessage.id, inputText);
        setEditingMessage(null);
      } else {
        await sendUserChatMessage(roomId, inputText);
      }
      setInputText('');
    } catch (error) {
      toast.error(editingMessage ? 'Failed to edit message' : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditInit = msg => {
    setEditingMessage(msg);
    setInputText(msg.content);
    setShowEmojiPicker(false);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const onEmojiSelect = emoji => {
    setInputText(prev => prev + emoji.native);
  };

  if (!roomId) {
    return (
      <div className='flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-gray-400 italic p-8 text-center'>
        Select a conversation to start messaging.
      </div>
    );
  }

  // Determine display name and avatar (for DMs)
  const otherMembers = room?.members?.filter(m => m.user_id !== currentUserId) || [];

  let displayName = room?.name;
  let displayAvatar = null;

  if (!room?.is_group) {
    if (room?.diving_center && !room.is_manager_view) {
      displayName = room.diving_center.name;
      displayAvatar = room.diving_center.logo_url;
    } else {
      displayName = otherMembers[0]?.user?.username || 'Chat';
      displayAvatar =
        otherMembers[0]?.user?.avatar_full_url ||
        otherMembers[0]?.user?.avatar_url ||
        otherMembers[0]?.avatar_full_url ||
        otherMembers[0]?.avatar_url;
    }
  }
  const maxReadAt = otherMembers.length
    ? new Date(Math.max(...otherMembers.map(m => parseUTCDate(m.last_read_at))))
    : null;

  return (
    <div className='flex flex-col h-full bg-[#f0f2f5] dark:bg-gray-900 overflow-hidden relative'>
      {/* Header */}
      <div className='p-3 md:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-10'>
        <div className='flex items-center gap-3 min-w-0'>
          <button
            onClick={onBack}
            className='md:hidden p-1 mr-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors'
          >
            <ChevronLeft className='h-6 w-6' />
          </button>
          <div className='relative shrink-0'>
            <Avatar src={displayAvatar} alt={displayName} size='sm' username={displayName} />
          </div>
          <div className='min-w-0'>
            <h3 className='text-sm font-bold text-gray-900 dark:text-white truncate'>
              {displayName}
            </h3>
            {room?.is_group && (
              <p className='text-[10px] text-gray-500 font-medium uppercase tracking-wider'>
                {room.members.length} participants
              </p>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {showHints && (
            <div className='hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full animate-in fade-in slide-in-from-right-4 duration-300'>
              <HelpCircle size={14} className='text-blue-500 shrink-0' />
              <div className='text-[10px] text-blue-800 dark:text-blue-200 flex items-center gap-2'>
                <span className='whitespace-nowrap'>{activeTip}</span>
                <button
                  onClick={dismissHints}
                  className='text-blue-400 hover:text-blue-600 transition-colors ml-1'
                  title='Dismiss tips'
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
          <button
            onClick={onToggleSettings}
            className='p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors'
            title='More options'
          >
            <MoreVertical className='h-5 w-5' />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        className='flex-1 overflow-y-auto p-4 md:p-6 bg-[#efeae2] dark:bg-gray-900'
      >
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

          const msgDate = parseUTCDate(msg.created_at);
          const prevMsgDate = prevMsg ? parseUTCDate(prevMsg.created_at) : null;
          const nextMsgDate = nextMsg ? parseUTCDate(nextMsg.created_at) : null;

          const showDateDivider = !prevMsg || !isSameDay(msgDate, prevMsgDate);

          const isGrouped =
            Boolean(nextMsg) &&
            Number(nextMsg.sender_id) === Number(msg.sender_id) &&
            isSameDay(msgDate, nextMsgDate) &&
            Math.abs(differenceInMinutes(nextMsgDate, msgDate)) < 5;

          const isLastInGroup =
            !nextMsg ||
            Number(nextMsg.sender_id) !== Number(msg.sender_id) ||
            !isSameDay(msgDate, nextMsgDate) ||
            Math.abs(differenceInMinutes(nextMsgDate, msgDate)) >= 5;

          const showName =
            !prevMsg ||
            Number(prevMsg.sender_id) !== Number(msg.sender_id) ||
            !isSameDay(msgDate, prevMsgDate) ||
            Math.abs(differenceInMinutes(msgDate, prevMsgDate)) >= 5;

          let readStatus = 'sent';
          if (maxReadAt && msgDate <= maxReadAt) {
            readStatus = 'read';
          } else {
            // we could do more checks here like 'delivered' but we only track last_read_at
            readStatus = 'sent';
          }

          let dateLabel = '';
          if (showDateDivider) {
            if (isToday(msgDate)) dateLabel = 'Today';
            else if (isYesterday(msgDate)) dateLabel = 'Yesterday';
            else dateLabel = format(msgDate, 'EEEE, MMMM d, yyyy');
          }

          return (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className='flex justify-center my-4'>
                  <span className='bg-white/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-[11px] font-medium uppercase px-3 py-1 rounded-full shadow-sm'>
                    {dateLabel}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={msg.sender_id === currentUserId}
                onEdit={handleEditInit}
                isGrouped={isGrouped}
                isLastInGroup={isLastInGroup}
                showName={showName}
                showAvatar={isLastInGroup}
                readStatus={readStatus}
              />
            </React.Fragment>
          );
        })}
        {isFetching && messages.length === 0 && (
          <div className='flex items-center justify-center h-full'>
            <Loader2 className='animate-spin text-blue-600' />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className='p-2 md:p-4 bg-[#f0f2f5] dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 relative'>
        {!canPost ? (
          <div className='text-center text-sm text-gray-500 py-3 italic'>
            Only admins can post in this broadcast channel.
          </div>
        ) : (
          <>
            {room?.quick_replies && room.quick_replies.length > 0 && isCustomer && (
              <div className='flex flex-wrap gap-2 mb-3 px-1'>
                {room.quick_replies.map(reply => (
                  <button
                    key={reply}
                    onClick={() => handleQuickReply(reply)}
                    disabled={isSending}
                    className='px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors shadow-sm disabled:opacity-50'
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
            {editingMessage && (
              <div className='flex items-center justify-between mb-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400 rounded'>
                <span className='text-xs text-yellow-700 dark:text-yellow-400 italic'>
                  Editing message...
                </span>
                <button onClick={cancelEdit} className='text-gray-400 hover:text-gray-600'>
                  <X size={14} />
                </button>
              </div>
            )}

            {showEmojiPicker && (
              <div className='absolute bottom-[100%] left-2 mb-2 z-50 shadow-xl rounded-xl border border-gray-200'>
                <Picker data={data} onEmojiSelect={onEmojiSelect} theme='light' />
              </div>
            )}

            <form onSubmit={handleSubmit} className='flex items-end space-x-2'>
              <button
                type='button'
                className='p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-1'
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={24} />
              </button>

              <div className='flex-1 bg-white dark:bg-gray-700 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow'>
                <TextareaAutosize
                  minRows={1}
                  maxRows={5}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder='Type a message...'
                  className='w-full px-4 py-3 bg-transparent border-none focus:ring-0 dark:text-white text-sm outline-none resize-none m-0 focus:outline-none focus:ring-transparent'
                  style={{ boxShadow: 'none' }}
                />
              </div>
              <button
                type='submit'
                disabled={!inputText.trim() || isSending}
                className='p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full transition-colors flex items-center justify-center w-12 h-12 mb-0.5 shadow-sm'
              >
                {isSending ? (
                  <Loader2 size={20} className='animate-spin' />
                ) : (
                  <Send size={20} className='ml-1' />
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

ChatRoom.propTypes = {
  roomId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  room: PropTypes.object,
  currentUserId: PropTypes.number.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ChatRoom;
