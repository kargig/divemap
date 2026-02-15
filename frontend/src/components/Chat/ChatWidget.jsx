import { MessageCircle } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChat';

import ChatWindow from './ChatWindow';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const location = useLocation();

  // Get user location on mount or when chat opens
  useEffect(() => {
    if (isOpen && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        error => {
          console.debug('Geolocation error:', error);
        },
        { timeout: 10000 }
      );
    }
  }, [isOpen, userLocation]);

  // Extract context from location if possible
  const context = useMemo(() => {
    const pathParts = location.pathname.split('/');
    const result = {};

    if (userLocation) {
      result.user_location = userLocation;
    }

    if (pathParts[1] === 'dive-sites' && pathParts[2] && !isNaN(pathParts[2])) {
      result.context_entity_type = 'dive_site';
      result.context_entity_id = parseInt(pathParts[2], 10);
    } else if (pathParts[1] === 'diving-centers' && pathParts[2] && !isNaN(pathParts[2])) {
      result.context_entity_type = 'diving_center';
      result.context_entity_id = parseInt(pathParts[2], 10);
    } else if (pathParts[1] === 'dives' && pathParts[2] && !isNaN(pathParts[2])) {
      result.context_entity_type = 'dive';
      result.context_entity_id = parseInt(pathParts[2], 10);
    }

    return result;
  }, [location.pathname, userLocation]);

  const { messages, sendMessage, isLoading, giveFeedback, clearChat } = useChat(context);

  return (
    <div className='fixed bottom-4 right-4 z-[9999] flex flex-col items-end pointer-events-none'>
      {/* Chat Window Container */}
      <div
        data-testid='chat-window-container'
        className={`
          transition-all duration-300 ease-in-out transform origin-bottom-right
          ${
            isOpen
              ? `opacity-100 scale-100 translate-y-0 pointer-events-auto mb-4 w-[95vw] h-[80vh] ${
                  isExpanded ? 'md:w-[800px] md:h-[85vh]' : 'md:w-[400px] md:h-[600px]'
                }`
              : 'opacity-0 scale-95 translate-y-10 pointer-events-none h-0 w-0 overflow-hidden'
          }
          shadow-2xl rounded-2xl
        `}
      >
        {isOpen && (
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onClose={() => setIsOpen(false)}
            onSend={sendMessage}
            onClear={clearChat}
            onFeedback={giveFeedback}
            context={context}
            isAuthenticated={isAuthenticated}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />
        )}
      </div>

      {/* FAB (Floating Action Button) */}
      <button
        data-testid='chat-fab'
        onClick={() => setIsOpen(!isOpen)}
        className={`
          pointer-events-auto
          flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95
          ${isOpen ? 'bg-gray-200 text-gray-600 rotate-90' : 'bg-blue-600 text-white'}
        `}
        aria-label={isOpen ? 'Close Chat' : 'Open Chat'}
      >
        <MessageCircle size={28} />
      </button>
    </div>
  );
};

export default ChatWidget;
