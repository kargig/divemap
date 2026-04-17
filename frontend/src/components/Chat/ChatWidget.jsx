import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const dragJustFinishedRef = useRef(false);
  const fabRef = useRef(null);

  const { user } = useAuth();
  const isAuthenticated = !!user;
  const location = useLocation();

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('divemap_chat_widget_pos');
    const defaultPos = { x: 20, y: window.innerHeight - 80, side: 'right' };
    if (!saved) return defaultPos;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.y > window.innerHeight) parsed.y = window.innerHeight - 80;
      if (parsed.y < 0) parsed.y = 80;
      return parsed;
    } catch (e) {
      return defaultPos;
    }
  });

  // Handle inactivity timeout to trigger "edge peek"
  useEffect(() => {
    if (isOpen || isDragging) {
      setIsInactive(false);
      return;
    }

    let timeout;
    const resetTimer = () => {
      setIsInactive(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsInactive(true), 3000);
    };

    window.addEventListener('scroll', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('mousemove', resetTimer, { passive: true });

    resetTimer();

    return () => {
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timeout);
    };
  }, [isOpen, isDragging]);

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

  const handlePointerDown = e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (isOpen) return; // Disable dragging when chat is open

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const handlePointerMove = moveEvent => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
        setIsDragging(true);
      }

      if (hasMoved) {
        setPosition({
          x: moveEvent.clientX - 28, // center offset
          y: moveEvent.clientY - 28,
          side: 'moving',
        });
      }
    };

    const handlePointerUp = upEvent => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (hasMoved) {
        setIsDragging(false);
        dragJustFinishedRef.current = true;
        setTimeout(() => {
          dragJustFinishedRef.current = false;
        }, 100);

        const screenWidth = window.innerWidth;
        const margin = 20;
        const isRightSide = upEvent.clientX > screenWidth / 2;

        const finalPos = {
          x: margin,
          y: Math.max(margin, Math.min(upEvent.clientY - 28, window.innerHeight - 80)),
          side: isRightSide ? 'right' : 'left',
        };

        setPosition(finalPos);
        localStorage.setItem('divemap_chat_widget_pos', JSON.stringify(finalPos));
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const getTranslation = () => {
    if (!isInactive || isDragging || isOpen) return 'translate-x-0 opacity-100';
    return position.side === 'left'
      ? '-translate-x-12 opacity-75 hover:translate-x-0 hover:opacity-100'
      : 'translate-x-12 opacity-75 hover:translate-x-0 hover:opacity-100';
  };

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
          /* Mobile: Bottom Sheet */
          inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)]
          /* Desktop: Floating Window */
          md:inset-auto md:max-h-none md:rounded-2xl md:shadow-2xl
          ${position.side === 'left' ? 'md:left-5 md:origin-bottom-left' : 'md:right-5 md:origin-bottom-right'}
          ${isExpanded ? 'md:w-[800px] md:h-[80dvh]' : 'md:w-[400px] md:h-[600px]'}
        `}
        style={{
          bottom: '100px', // Offset from the FAB
        }}
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
        ref={fabRef}
        onPointerDown={handlePointerDown}
        className={`fixed z-[9999] pointer-events-none transition-all duration-300 ${isDragging ? 'transition-none' : ''}`}
        style={{
          left: position.side === 'right' ? 'auto' : `${position.x}px`,
          right: position.side === 'right' ? `${position.x}px` : 'auto',
          top: `${position.y}px`,
          touchAction: 'none',
        }}
      >
        <button
          data-testid='chat-fab'
          onClick={e => {
            if (isDragging || dragJustFinishedRef.current) {
              e.preventDefault();
              return;
            }
            if (isInactive && !isOpen) {
              setIsInactive(false);
            } else {
              setIsOpen(!isOpen);
              setIsInactive(false);
            }
          }}
          className={`
            pointer-events-auto
            flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-in-out hover:scale-110 active:scale-95
            ${isOpen ? 'bg-gray-200 text-gray-600 rotate-90' : 'bg-blue-600 text-white'}
            ${isDragging ? 'cursor-grabbing scale-110 shadow-2xl' : 'cursor-grab'}
            ${getTranslation()}
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
