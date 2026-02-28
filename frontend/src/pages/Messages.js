import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useLocation } from 'react-router-dom';

import { getChatRooms } from '../api';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import ChatInbox from '../components/UserChat/ChatInbox';
import ChatRoom from '../components/UserChat/ChatRoom';

const Messages = () => {
  const location = useLocation();
  const [activeRoomId, setActiveRoomId] = useState(null);
  const currentUserId = parseInt(localStorage.getItem('user_id'));

  // Handle room selection from state (e.g. from Profile "Message" button)
  useEffect(() => {
    if (location.state?.roomId) {
      setActiveRoomId(location.state.roomId);
    }
  }, [location.state]);

  const { data: rooms = [], isLoading } = useQuery('chat-rooms', getChatRooms, {
    refetchInterval: 10000, // Refresh inbox every 10 seconds
  });

  return (
    <div className='flex flex-col h-screen max-h-[calc(100vh-64px)]'>
      <SEO title='Messages' description='Your private conversations on Divemap' />

      <div className='flex flex-1 overflow-hidden'>
        {/* Sidebar / Inbox */}
        <div
          className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${activeRoomId ? 'hidden md:flex' : 'flex'} flex-col h-full overflow-hidden`}
        >
          <ChatInbox
            rooms={rooms}
            activeRoomId={activeRoomId}
            onSelectRoom={setActiveRoomId}
            isLoading={isLoading}
          />
        </div>

        {/* Main Chat Thread */}
        <div
          className={`flex-1 flex flex-col h-full overflow-hidden ${!activeRoomId ? 'hidden md:flex' : 'flex'}`}
        >
          {activeRoomId && (
            <div className='md:hidden p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700'>
              <button
                onClick={() => setActiveRoomId(null)}
                className='text-blue-600 font-medium flex items-center'
              >
                ← Back to inbox
              </button>
            </div>
          )}
          <ChatRoom roomId={activeRoomId} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
};

export default Messages;
