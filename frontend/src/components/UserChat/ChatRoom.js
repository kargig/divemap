import { Send, Loader2, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import {
  getChatMessages,
  sendUserChatMessage,
  editUserChatMessage,
  markChatRoomRead,
} from '../../api';

import MessageBubble from './MessageBubble';

const ChatRoom = ({ roomId, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const scrollRef = useRef(null);
  const lastSyncTime = useRef(null);

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

  return (
    <div className='flex flex-col h-full bg-gray-50 dark:bg-gray-900'>
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
  currentUserId: PropTypes.number.isRequired,
};

export default ChatRoom;
