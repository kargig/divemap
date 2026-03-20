import { X, Send, Trash2, Maximize2, Minimize2, Lock, History } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ChatbotIcon from './ChatbotIcon';
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
  isEmbedded = false, // New prop to hide close/expand when embedded in the Messages page
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

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

  // Dynamic suggestions based on context, memoized to prevent changing on every keystroke
  const suggestions = React.useMemo(() => {
    if (messages.length > 0) return [];

    const GOOD_QUESTIONS = [
      'what comes after Open Water in SSI?',
      'best diving in Crete',
      'show me deep dives in Attica',
      'do you know any snorkeling spots in Naxos ?',
      'what are the requirements for the Rescue Diver certification?',
      'what are some good dive sites in Egypt?',
      'what is the difference between PADI TEC45 and SSI XR?',
      'give me a list of 10 dive sites in the South of Athens',
      'give me wrecks near Makronisos island',
      'where can I see monk seals in Greece?',
      'Calculate my SAC rate if I used 140 bar from a 12L tank in 30 mins at 15m depth',
      'What is the MOD for 32% Nitrox?',
      'What are nearby dive sites to legrena car wrecks ?',
      'is it safe to dive at Kyra Leni tomorrow at 10:00?',
      'PADI courses in Greece',
    ];

    // Pick 2 random questions from the list
    const shuffled = [...GOOD_QUESTIONS].sort(() => 0.5 - Math.random());
    const randomQuestions = shuffled.slice(0, 2);

    const baseSuggestions = ['Find dive sites nearby', 'Check weather for today'];

    if (context.context_entity_type === 'dive_site') {
      return [
        'Is this site good for beginners?',
        'What is the maximum depth here?',
        'Best time to dive this site?',
        ...baseSuggestions,
      ].slice(0, 4); // Keep to 4 max
    }

    if (context.context_entity_type === 'diving_center') {
      return [
        'What services do they offer?',
        'Do they have boat dives?',
        'Can I rent equipment here?',
        ...baseSuggestions,
      ].slice(0, 4); // Keep to 4 max
    }

    return [...baseSuggestions, ...randomQuestions];
  }, [messages.length, context.context_entity_type]);

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-gray-900 shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 ${isEmbedded ? 'rounded-none border-0' : 'rounded-t-2xl md:rounded-2xl'}`}
    >
      {/* Header */}
      <div
        className={`flex items-center px-4 py-3 bg-blue-600 text-white shrink-0 ${isEmbedded ? 'justify-center relative' : 'justify-between'}`}
      >
        <div className='flex items-center gap-2'>
          <ChatbotIcon size={20} className='text-blue-100' />
          <h3 className='font-semibold text-sm'>Divemap Assistant</h3>
        </div>

        <div className={`flex items-center gap-1 ${isEmbedded ? 'absolute right-4' : ''}`}>
          {isAuthenticated && (
            <button
              onClick={() => {
                if (onClose) onClose(); // Close the floating widget if it's open
                navigate('/ai-chat-history');
              }}
              className='p-1.5 hover:bg-blue-700 rounded-full transition-colors'
              title='View Chat History'
            >
              <History size={16} />
            </button>
          )}
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
          {!isEmbedded && (
            <button
              data-testid='chat-expand-button'
              onClick={onToggleExpand}
              className='p-1.5 hover:bg-blue-700 rounded-full transition-colors hidden md:block'
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {!isEmbedded && (
            <button
              data-testid='chat-close-button'
              onClick={onClose}
              className='p-1.5 hover:bg-blue-700 rounded-full transition-colors'
              title='Close'
            >
              <X size={18} />
            </button>
          )}
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
