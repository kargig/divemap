import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChat';

import ChatbotIcon from './ChatbotIcon';
import ChatWindow from './ChatWindow';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isInactive, setIsInactive] = useState(false);
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const location = useLocation();

  // Handle inactivity timeout to trigger "edge peek"
  useEffect(() => {
    if (isOpen) {
      setIsInactive(false);
      return;
    }

    let timeout;
    const resetTimer = () => {
      setIsInactive(false);
      clearTimeout(timeout);
      // Wait 3 seconds of inactivity before sliding out
      timeout = setTimeout(() => setIsInactive(true), 3000);
    };

    // Attach to scroll and touch events
    window.addEventListener('scroll', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('mousemove', resetTimer, { passive: true });

    // Start timer on mount
    resetTimer();

    return () => {
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timeout);
    };
  }, [isOpen]);

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
    const pathParts = location.pathname.split('/').filter(Boolean);
    const searchParams = new URLSearchParams(location.search);
    const result = {
      page_context: {
        path: location.pathname,
        params: Object.fromEntries(searchParams.entries()),
      },
    };

    if (userLocation) {
      result.user_location = userLocation;
    }

    // 1. Map Context
    if (pathParts[0] === 'map') {
      const lat = parseFloat(searchParams.get('lat'));
      const lng = parseFloat(searchParams.get('lng'));
      const zoom = parseFloat(searchParams.get('zoom'));
      if (!isNaN(lat) && !isNaN(lng)) {
        result.map_context = { lat, lng, zoom: !isNaN(zoom) ? zoom : undefined };
      }
    }

    // 2. Entity Context (Dive Sites, Centers, Dives, Trips)
    if (pathParts[0] === 'dive-sites' && pathParts[1] && !isNaN(pathParts[1])) {
      result.context_entity_type = 'dive_site';
      result.context_entity_id = parseInt(pathParts[1], 10);

      // Check for nested route (e.g., /dive-sites/:id/route/:rid)
      if (pathParts[2] === 'route' && pathParts[3] && !isNaN(pathParts[3])) {
        result.page_context.route_id = parseInt(pathParts[3], 10);
      }
    } else if (pathParts[0] === 'diving-centers' && pathParts[1] && !isNaN(pathParts[1])) {
      result.context_entity_type = 'diving_center';
      result.context_entity_id = parseInt(pathParts[1], 10);
    } else if (pathParts[0] === 'dives' && pathParts[1] && !isNaN(pathParts[1])) {
      result.context_entity_type = 'dive';
      result.context_entity_id = parseInt(pathParts[1], 10);
    } else if (pathParts[0] === 'dive-trips' && pathParts[1] && !isNaN(pathParts[1])) {
      result.context_entity_type = 'dive_trip';
      result.context_entity_id = parseInt(pathParts[1], 10);
    }

    // 3. Category Context (Resources, Admin)
    if (pathParts[0] === 'resources') {
      result.page_context.category = 'resources';
      result.page_context.subcategory = pathParts[1];
    } else if (pathParts[0] === 'admin') {
      result.page_context.category = 'admin';
      result.page_context.subcategory = pathParts[1];
    }

    return result;
  }, [location.pathname, location.search, userLocation]);

  const { messages, sendMessage, isLoading, giveFeedback, clearChat } = useChat(context);

  return (
    <>
      {/* Chat Window Container */}
      <div
        data-testid='chat-window-container'
        className={`
          fixed z-[9999] transition-all duration-300 ease-in-out transform flex flex-col
          ${
            isOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-10 pointer-events-none invisible'
          }
          /* Mobile: Bottom Sheet (Size to content up to 85dvh) */
          inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)]
          /* Desktop: Floating Window */
          md:inset-auto md:right-5 md:bottom-24 md:max-h-none md:rounded-2xl md:shadow-2xl md:origin-bottom-right
          ${isExpanded ? 'md:w-[800px] md:h-[80dvh]' : 'md:w-[400px] md:h-[600px]'}
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
      <div
        className={`fixed right-5 z-[9999] pointer-events-none transition-all duration-300 ${
          context?.context_entity_type === 'dive_site' ? 'bottom-24 md:bottom-5' : 'bottom-5'
        }`}
      >
        <button
          data-testid='chat-fab'
          onClick={() => {
            if (isInactive && !isOpen) {
              // First tap when inactive just wakes it up
              setIsInactive(false);
            } else {
              setIsOpen(!isOpen);
              setIsInactive(false);
            }
          }}
          className={`
            pointer-events-auto
            items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-110 active:scale-95
            ${isOpen ? 'hidden md:flex bg-gray-200 text-gray-600 rotate-90' : 'flex bg-blue-600 text-white'}
            ${isInactive && !isOpen ? 'translate-x-12 opacity-75 hover:opacity-100 hover:translate-x-0' : 'translate-x-0 opacity-100'}
          `}
          aria-label={isOpen ? 'Close Chat' : 'Open Chat'}
        >
          <ChatbotIcon size={28} />
        </button>
      </div>
    </>
  );
};

export default ChatWidget;
