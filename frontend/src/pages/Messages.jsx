import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useLocation } from 'react-router-dom';

import { getChatRooms, getUserFriendships, getAIChatLastActivity } from '../api';
import ChatWindow from '../components/Chat/ChatWindow';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import ChatInbox from '../components/UserChat/ChatInbox';
import ChatRoom from '../components/UserChat/ChatRoom';
import NewChatModal from '../components/UserChat/NewChatModal';
import RoomSettings from '../components/UserChat/RoomSettings';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';

const Messages = () => {
  const { user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const location = useLocation();
  const [activeRoomId, setActiveRoomId] = useState(
    location.state?.roomId || location.state?.activeRoomId || null
  );
  const currentUserId = user?.id || parseInt(localStorage.getItem('user_id'));

  const {
    messages: aiMessages,
    sendMessage: sendAIMessage,
    isLoading: isAILoading,
    clearChat: clearAIChat,
    giveFeedback: giveAIFeedback,
  } = useChat();

  // Handle room selection from state (e.g. from Profile "Message" button or ChatDropdown)
  useEffect(() => {
    if (location.state?.roomId || location.state?.activeRoomId) {
      setActiveRoomId(location.state.roomId || location.state.activeRoomId);
      // Clear state after reading to prevent re-activation on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery('chat-rooms', getChatRooms, {
    refetchInterval: 10000, // Refresh inbox every 10 seconds
  });

  const { data: friendships = [], isLoading: isFriendshipsLoading } = useQuery(
    ['user-friendships', 'ACCEPTED'],
    () => getUserFriendships('ACCEPTED')
  );

  const { data: aiActivity, isLoading: isAILoadingActivity } = useQuery(
    'ai-chat-activity',
    getAIChatLastActivity,
    { refetchInterval: 10000 }
  );

  const determineLastAiActivity = () => {
    if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].timestamp) {
      return aiMessages[aiMessages.length - 1].timestamp;
    }
    if (aiActivity?.last_activity_at) {
      return aiActivity.last_activity_at;
    }
    return new Date().toISOString(); // Fallback if no history exists at all
  };

  const aiRoom = {
    id: 'ai-assistant',
    is_group: false,
    name: 'Divemap Assistant',
    last_activity_at: determineLastAiActivity(),
    unread_count: 0,
    members: [{ user_id: 'ai', username: 'Divemap Assistant', avatar_url: null }],
    is_ai: true,
  };

  const combinedRooms = [aiRoom, ...rooms];
  const activeRoom = combinedRooms.find(r => r.id === activeRoomId);

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
            rooms={combinedRooms}
            activeRoomId={activeRoomId}
            onSelectRoom={setActiveRoomId}
            onNewChat={() => setIsNewChatOpen(true)}
            isLoading={isRoomsLoading || isFriendshipsLoading}
            buddyCount={friendships.length}
          />
        </div>

        {/* Main Chat Thread */}
        <div
          className={`flex-1 flex flex-col h-full overflow-hidden ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}
        >
          {activeRoomId === 'ai-assistant' ? (
            <div className='flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900'>
              {/* Mobile Back Button Header */}
              <div className='md:hidden flex items-center p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'>
                <button
                  onClick={() => setActiveRoomId(null)}
                  className='mr-3 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500'
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='20'
                    height='20'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <path d='m15 18-6-6 6-6' />
                  </svg>
                </button>
                <h2 className='font-semibold text-gray-900 dark:text-white'>Divemap Assistant</h2>
              </div>
              <div className='flex-1 overflow-hidden'>
                <ChatWindow
                  messages={aiMessages}
                  isLoading={isAILoading}
                  onSend={sendAIMessage}
                  onClear={clearAIChat}
                  onFeedback={giveAIFeedback}
                  isAuthenticated={!!user}
                  isEmbedded={true}
                  onClose={() => setActiveRoomId(null)}
                />
              </div>
            </div>
          ) : (
            <ChatRoom
              roomId={activeRoomId}
              room={activeRoom}
              currentUserId={currentUserId}
              onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
              onBack={() => setActiveRoomId(null)}
            />
          )}
        </div>

        {/* Settings Sidebar (Desktop) or Overlay (Mobile) */}
        {activeRoomId && isSettingsOpen && activeRoomId !== 'ai-assistant' && (
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
