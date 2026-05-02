import { format } from 'date-fns';
import { ChevronLeft, MessageSquare, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import { getAIChatSessions } from '../api';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import Pagination from '../components/ui/Pagination';

const AIChatHistory = () => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });

  const { data, isLoading, error } = useQuery(
    ['ai-chat-sessions', pagination],
    () =>
      getAIChatSessions({
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      }),
    { keepPreviousData: true }
  );

  const sessions = data?.sessions || [];
  const totalCount = data?.totalCount || 0;

  if (isLoading && !data) {
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
        <PageHeader
          title='Assistant History'
          titleIcon={MessageSquare}
          breadcrumbItems={[{ label: 'Messages', to: '/messages' }, { label: 'Assistant History' }]}
        />

        <div className='space-y-4'>
          {sessions && sessions.length > 0 ? (
            <div className='grid grid-cols-1 gap-4'>
              {sessions.map(session => (
                <Link
                  key={session.id}
                  to={`/ai-chat-history/${session.id}`}
                  className='block bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] hover:shadow-md transition-all duration-200 p-4 sm:p-6 group'
                >
                  <div className='flex gap-4 sm:gap-6'>
                    <div className='shrink-0'>
                      <div className='h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors'>
                        <MessageSquare className='h-6 w-6 text-blue-600' />
                      </div>
                    </div>
                    <div className='flex flex-col flex-1 min-w-0 space-y-2'>
                      <div className='flex items-start justify-between gap-2'>
                        <h3 className='font-semibold text-gray-900 text-base sm:text-lg leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors'>
                          {session.first_question
                            ? `"${session.first_question}"`
                            : `Session ${session.id.slice(0, 8)}...`}
                        </h3>
                        <div className='hidden sm:block shrink-0'>
                          <div className='w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-all'>
                            <ChevronLeft className='w-4 h-4 rotate-180' />
                          </div>
                        </div>
                      </div>

                      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500'>
                        <div className='flex items-center gap-1.5'>
                          <span className='font-medium text-gray-700'>
                            {format(new Date(session.updated_at), 'PPP')}
                          </span>
                          <span className='text-gray-400'>at</span>
                          <span className='text-gray-600'>
                            {format(new Date(session.updated_at), 'p')}
                          </span>
                        </div>
                        <div className='flex items-center gap-1.5 border-l border-gray-200 pl-4 h-4 hidden sm:flex'>
                          <span className='font-bold text-blue-600'>{session.prompt_count}</span>
                          <span className='text-xs uppercase tracking-wider font-semibold'>
                            {session.prompt_count === 1 ? 'Prompt' : 'Prompts'}
                          </span>
                        </div>
                        {/* Mobile prompt count */}
                        <div className='sm:hidden flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full'>
                          <span className='text-xs font-bold text-blue-700'>
                            {session.prompt_count}
                          </span>
                          <span className='text-[10px] uppercase tracking-tighter font-bold text-blue-600'>
                            {session.prompt_count === 1 ? 'Prompt' : 'Prompts'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className='p-8 text-center text-gray-500'>
              You have no past conversations with the Divemap Assistant.
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className='mt-6'>
            <Pagination
              currentPage={pagination.pageIndex + 1}
              pageSize={pagination.pageSize}
              totalCount={totalCount}
              itemName='chat sessions'
              onPageChange={newPage => setPagination(prev => ({ ...prev, pageIndex: newPage - 1 }))}
              onPageSizeChange={newPageSize =>
                setPagination(prev => ({ ...prev, pageIndex: 0, pageSize: newPageSize }))
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AIChatHistory;
