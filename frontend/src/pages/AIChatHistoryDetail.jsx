import { ChevronLeft, Loader2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { Link, useParams } from 'react-router-dom';

import { getAIChatSessionDetail } from '../api';
import MessageBubble from '../components/Chat/MessageBubble';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';

const AIChatHistoryDetail = () => {
  const { id } = useParams();
  const {
    data: session,
    isLoading,
    error,
  } = useQuery(['ai-chat-session', id], () => getAIChatSessionDetail(id));
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 text-blue-600 animate-spin' />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className='min-h-screen bg-gray-50 py-8 px-4'>
        <div className='max-w-4xl mx-auto bg-white rounded-lg shadow p-6 text-center text-red-600'>
          Error loading chat session. Please try again later.
        </div>
      </div>
    );
  }

  // Filter out pure internal reasoning chunks without response text if needed
  const displayMessages = session.messages.filter(m => m.role !== 'system' && m.content);

  return (
    <div className='min-h-screen bg-gray-50 py-8 flex flex-col'>
      <SEO title='Divemap Assistant Session' description='Chat session details' />

      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col'>
        <div className='mb-6 flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <Link
              to='/ai-chat-history'
              className='p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors'
              title='Back to History'
            >
              <ChevronLeft size={24} />
            </Link>
            <h1 className='text-2xl font-bold text-gray-900'>Session Transcript</h1>
          </div>
        </div>

        <div className='bg-white shadow rounded-lg flex-1 overflow-hidden flex flex-col mb-8'>
          <div className='flex-1 overflow-y-auto p-4 space-y-4'>
            {displayMessages.map((msg, index) => (
              <MessageBubble
                key={msg.id || index}
                message={{
                  role: msg.role,
                  content: msg.content,
                  sources: msg.debug_data?.sources || [],
                }}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatHistoryDetail;
