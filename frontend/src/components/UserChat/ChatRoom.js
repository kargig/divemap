import { Send, Loader2, X, Info, ChevronLeft, HelpCircle } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import {
  getChatMessages,
  sendUserChatMessage,
  editUserChatMessage,
  markChatRoomRead,
} from '../../api';
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
    lastSyncTime.current = null;
  }

  const dismissHints = () => {
    setShowHints(false);
    localStorage.setItem('chat_hints_dismissed', 'true');
  };

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
            return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          });

          // Update the high-watermark cursor
          const latestUpdate = newMessages.reduce(
            (max, m) => (new Date(m.updated_at) > new Date(max) ? m.updated_at : max),
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
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
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
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
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
  const displayName = room?.is_group ? room.name : otherMembers[0]?.user?.username || 'Chat';
  const displayAvatar = room?.is_group ? null : otherMembers[0]?.user?.avatar_url;

  return (
    <div className='flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden relative'>
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
            title='Room Settings'
          >
            <Info className='h-5 w-5' />
          </button>
        </div>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto p-4 md:p-6'>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === currentUserId}
            onEdit={handleEditInit}
          />
        ))}
        {isFetching && messages.length === 0 && (
          <div className='flex items-center justify-center h-full'>
            <Loader2 className='animate-spin text-blue-600' />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className='p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700'>
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

        <form onSubmit={handleSubmit} className='flex space-x-2'>
          <input
            type='text'
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder='Type a message...'
            className='flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-full focus:ring-2 focus:ring-blue-500 dark:text-white text-sm outline-none'
          />
          <button
            type='submit'
            disabled={!inputText.trim() || isSending}
            className='p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full transition-colors flex items-center justify-center w-10 h-10'
          >
            {isSending ? <Loader2 size={18} className='animate-spin' /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

ChatRoom.propTypes = {
  roomId: PropTypes.number,
  room: PropTypes.object,
  currentUserId: PropTypes.number.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ChatRoom;
