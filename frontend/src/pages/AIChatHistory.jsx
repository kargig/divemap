import { format } from 'date-fns';
import { ChevronLeft, MessageSquare, Loader2 } from 'lucide-react';
import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getAIChatSessions } from '../api';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';

const AIChatHistory = () => {
  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery(['ai-chat-sessions'], () => getAIChatSessions());

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 text-blue-600 animate-spin' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 py-8 px-4'>
        <div className='max-w-4xl mx-auto bg-white rounded-lg shadow p-6 text-center text-red-600'>
          Error loading chat history. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <SEO
        title='Divemap Assistant History'
        description='Your past conversations with the Divemap AI Assistant'
      />
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='mb-6 flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <Link
              to='/messages'
              className='p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors'
              title='Back to Messages'
            >
              <ChevronLeft size={24} />
            </Link>
            <h1 className='text-2xl font-bold text-gray-900'>Divemap Assistant History</h1>
          </div>
        </div>

        <div className='bg-white shadow rounded-lg overflow-hidden'>
          {sessions && sessions.length > 0 ? (
            <ul className='divide-y divide-gray-200'>
              {sessions.map(session => (
                <li key={session.id}>
                  <Link
                    to={`/ai-chat-history/${session.id}`}
                    className='block hover:bg-gray-50 transition duration-150 ease-in-out'
                  >
                    <div className='px-4 py-4 sm:px-6 flex items-center justify-between'>
                      <div className='flex items-center min-w-0 flex-1'>
                        <div className='flex-shrink-0'>
                          <div className='h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center'>
                            <MessageSquare className='h-6 w-6 text-blue-600' />
                          </div>
                        </div>
                        <div className='min-w-0 flex-1 px-4'>
                          <div>
                            <p className='text-sm font-medium text-blue-600 truncate'>
                              Session {session.id.slice(0, 8)}...
                            </p>
                            <p className='mt-1 flex items-center text-sm text-gray-500'>
                              {format(new Date(session.updated_at), 'PPP p')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className='ml-5 flex-shrink-0'>
                        <ChevronLeft className='h-5 w-5 text-gray-400 rotate-180' />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className='p-8 text-center text-gray-500'>
              You have no past conversations with the Divemap Assistant.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatHistory;
