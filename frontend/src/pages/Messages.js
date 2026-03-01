import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useLocation } from 'react-router-dom';

import { getChatRooms } from '../api';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import ChatInbox from '../components/UserChat/ChatInbox';
import ChatRoom from '../components/UserChat/ChatRoom';
import NewChatModal from '../components/UserChat/NewChatModal';
import RoomSettings from '../components/UserChat/RoomSettings';

const Messages = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const location = useLocation();
  const [activeRoomId, setActiveRoomId] = useState(
    location.state?.roomId || location.state?.activeRoomId || null
  );
  const currentUserId = parseInt(localStorage.getItem('user_id'));

  // Handle room selection from state (e.g. from Profile "Message" button or ChatDropdown)
  useEffect(() => {
    if (location.state?.roomId || location.state?.activeRoomId) {
      setActiveRoomId(location.state.roomId || location.state.activeRoomId);
      // Clear state after reading to prevent re-activation on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: rooms = [], isLoading } = useQuery('chat-rooms', getChatRooms, {
    refetchInterval: 10000, // Refresh inbox every 10 seconds
  });

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const handleRoomCreated = roomId => {
    setActiveRoomId(roomId);
    setIsNewChatOpen(false);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
    setIsSettingsOpen(false);
  };

  return (
    <div className='flex flex-col h-screen max-h-[calc(100vh-64px)]'>
      <SEO title='Messages' description='Your private conversations on Divemap' />

      <div className='flex flex-1 overflow-hidden relative'>
        {/* Sidebar / Inbox */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${activeRoomId ? 'hidden md:flex' : 'flex'} flex-col h-full overflow-hidden border-r border-gray-200 dark:border-gray-700`}
        >
          <ChatInbox
            rooms={rooms}
            activeRoomId={activeRoomId}
            onSelectRoom={setActiveRoomId}
            onNewChat={() => setIsNewChatOpen(true)}
            isLoading={isLoading}
          />
        </div>

        {/* Main Chat Thread */}
        <div
          className={`flex-1 flex flex-col h-full overflow-hidden ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}
        >
          <ChatRoom
            roomId={activeRoomId}
            room={activeRoom}
            currentUserId={currentUserId}
            onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
            onBack={() => setActiveRoomId(null)}
          />
        </div>

        {/* Settings Sidebar (Desktop) or Overlay (Mobile) */}
        {activeRoomId && isSettingsOpen && (
          <div className='absolute md:relative inset-0 md:inset-auto z-20 md:z-0 w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl'>
            <RoomSettings
              room={activeRoom}
              currentUserId={currentUserId}
              onClose={didLeave => (didLeave ? handleLeaveRoom() : setIsSettingsOpen(false))}
            />
          </div>
        )}

        <NewChatModal
          isOpen={isNewChatOpen}
          onClose={() => setIsNewChatOpen(false)}
          onRoomCreated={handleRoomCreated}
        />
      </div>
    </div>
  );
};

export default Messages;
