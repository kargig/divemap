import { X, Send, Trash2, Maximize2, Minimize2, Lock } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

import MessageBubble from './MessageBubble';
import SuggestionChips from './SuggestionChips';

const ChatWindow = ({
  messages,
  isLoading,
  onClose,
  onSend,
  onClear,
  onFeedback,
  context = {},
  isAuthenticated = false,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Focus input on mount if authenticated
    if (isAuthenticated) {
      inputRef.current?.focus();
    }
  }, [isAuthenticated]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Dynamic suggestions based on context
  const getSuggestions = () => {
    if (messages.length > 0) return [];

    const baseSuggestions = ['Find dive sites nearby', 'Check weather for today'];

    if (context.context_entity_type === 'dive_site') {
      return [
        'Is this site good for beginners?',
        'What is the maximum depth here?',
        'Best time to dive this site?',
        ...baseSuggestions,
      ];
    }

    if (context.context_entity_type === 'diving_center') {
      return [
        'What services do they offer?',
        'Do they have boat dives?',
        'Can I rent equipment here?',
        ...baseSuggestions,
      ];
    }

    return [...baseSuggestions, 'Suggest a wreck dive', 'Safety tips for deep diving'];
  };

  const suggestions = getSuggestions();

  return (
    <div className='flex flex-col h-full bg-white dark:bg-gray-900 shadow-2xl rounded-t-2xl md:rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 bg-blue-600 text-white shrink-0'>
        <div className='flex items-center gap-2'>
          <div className='w-2 h-2 rounded-full bg-green-400 animate-pulse' />
          <h3 className='font-semibold text-sm'>Divemap Assistant</h3>
        </div>
        <div className='flex items-center gap-1'>
          {isAuthenticated && messages.length > 0 && (
            <button
              data-testid='chat-clear-button'
              onClick={onClear}
              className='p-1.5 hover:bg-blue-700 rounded-full transition-colors'
              title='Clear Chat'
            >
              <Trash2 size={16} />
            </button>
          )}
          {/* Expand/Collapse Button (Desktop only) */}
          <button
            data-testid='chat-expand-button'
            onClick={onToggleExpand}
            className='p-1.5 hover:bg-blue-700 rounded-full transition-colors hidden md:block'
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            data-testid='chat-close-button'
            onClick={onClose}
            className='p-1.5 hover:bg-blue-700 rounded-full transition-colors'
            title='Close'
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        data-testid='chat-message-list'
        className='flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50'
      >
        {!isAuthenticated ? (
          <div className='h-full flex flex-col items-center justify-center text-gray-500 text-center p-6 space-y-4'>
            <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2'>
              <Lock size={32} className='text-blue-600' />
            </div>
            <h4 className='font-bold text-gray-900 dark:text-white'>Authentication Required</h4>
            <p className='text-sm max-w-xs'>
              Please{' '}
              <Link to='/login' className='text-blue-600 hover:underline'>
                log in
              </Link>{' '}
              or{' '}
              <Link to='/register' className='text-blue-600 hover:underline'>
                register
              </Link>{' '}
              to use the AI discovery assistant.
            </p>
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className='h-full flex flex-col items-center justify-center text-gray-400 text-center p-6 space-y-4'>
                <div className='w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-2'>
                  <span className='text-2xl'>🤖</span>
                </div>
                <p className='text-sm'>
                  Hi! I'm your AI dive buddy. Ask me about dive sites, weather conditions, or marine
                  life!
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} onFeedback={onFeedback} />
            ))}

            {isLoading && (
              <div className='flex justify-start mb-4'>
                <div className='bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm'>
                  <div className='flex space-x-1'>
                    <div
                      className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className='w-2 h-2 bg-gray-400 rounded-full animate-bounce'
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      {isAuthenticated && (
        <div className='p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shrink-0'>
          <SuggestionChips suggestions={suggestions} onSelect={text => onSend(text)} />

          <div className='flex gap-2 items-end mt-2'>
            <textarea
              ref={inputRef}
              data-testid='chat-input'
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Ask anything...'
              className='flex-1 max-h-32 min-h-[44px] py-2.5 px-4 bg-gray-100 dark:bg-gray-800 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 resize-none text-sm dark:text-white scrollbar-hide'
              rows={1}
              style={{ height: 'auto' }} // Adjust height logic if needed
            />
            <button
              data-testid='chat-send-button'
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className='p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-0.5'
            >
              <Send size={18} />
            </button>
          </div>
          <div className='text-xs text-center text-gray-400 mt-2'>
            AI can make mistakes. Verify important information.
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
