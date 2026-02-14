import {
  History,
  Calendar,
  User as UserIcon,
  Eye,
  Search,
  MessageCircle,
  MessageSquare,
  Clock,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';

import { getAdminChatSessions, getAdminChatSessionDetail, deleteAdminChatSession } from '../api';
import AdminChatHistoryTable from '../components/tables/AdminChatHistoryTable';
import Modal from '../components/ui/Modal';
import usePageTitle from '../hooks/usePageTitle';
import { formatDate, formatTimeAgo } from '../utils/dateHelpers';

const AdminChatHistory = () => {
  usePageTitle('Divemap - Admin - Chat History');
  const queryClient = useQueryClient();

  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [userIdFilter, setUserIdFilter] = useState('');

  // Table state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [sorting, setSorting] = useState([]);

  // Query for sessions list
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery(['adminChatSessions', userIdFilter, pagination], () =>
    getAdminChatSessions({
      user_id: userIdFilter || undefined,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    })
  );

  // Query for selected session detail
  const { data: sessionDetail, isLoading: detailLoading } = useQuery(
    ['adminChatSessionDetail', selectedSessionId],
    () => getAdminChatSessionDetail(selectedSessionId),
    { enabled: !!selectedSessionId }
  );

  // Delete mutation
  const deleteMutation = useMutation(deleteAdminChatSession, {
    onSuccess: () => {
      toast.success('Chat session deleted successfully');
      queryClient.invalidateQueries('adminChatSessions');
    },
    onError: error => {
      toast.error(`Failed to delete session: ${error.message}`);
    },
  });

  const handleDeleteSession = sessionId => {
    if (
      window.confirm('Are you sure you want to delete this chat session? This cannot be undone.')
    ) {
      deleteMutation.mutate(sessionId);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'Session ID',
        cell: ({ row }) => (
          <span className='font-mono text-gray-500 truncate max-w-[120px] block'>
            {row.original.id}
          </span>
        ),
      },
      {
        accessorKey: 'user_id',
        header: 'User',
        cell: ({ row }) => (
          <div className='flex items-center gap-2 font-medium'>
            <UserIcon size={14} className='text-gray-400' />
            {row.original.user?.username || `User #${row.original.user_id}`}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Started',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            <Calendar size={14} />
            {formatDate(row.original.created_at)}
          </div>
        ),
      },
      {
        accessorKey: 'updated_at',
        header: 'Last Active',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            <Clock size={14} />
            {formatTimeAgo(row.original.updated_at)}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <div className='flex justify-end gap-2'>
            <button
              onClick={e => {
                e.stopPropagation();
                setSelectedSessionId(row.original.id);
              }}
              className='p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1'
              title='View Transcript'
            >
              <Eye size={18} />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                handleDeleteSession(row.original.id);
              }}
              className='p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1'
              title='Delete Session'
            >
              <Trash2 size={18} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className='max-w-7xl mx-auto p-4 sm:p-6 lg:p-8'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3'>
            <History className='text-blue-600' />
            Chat Session History
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-2'>
            Browse and review full chat transcripts between users and the AI assistant.
          </p>
        </div>
        <Link
          to='/admin/chat-feedback'
          className='flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
        >
          <MessageSquare size={16} />
          View Feedback
          <ArrowRight size={16} className='text-gray-400' />
        </Link>
      </div>

      {/* Filters */}
      <div className='bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex items-center gap-4'>
        <div className='relative flex-1 max-w-xs'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' size={18} />
          <input
            type='number'
            placeholder='Filter by User ID...'
            value={userIdFilter}
            onChange={e => {
              setUserIdFilter(e.target.value);
              setPagination(prev => ({ ...prev, pageIndex: 0 }));
            }}
            className='w-full bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg text-sm pl-10 pr-3 py-2'
          />
        </div>
      </div>

      {/* Sessions Table */}
      <AdminChatHistoryTable
        data={sessions || []}
        columns={columns}
        pagination={{
          ...pagination,
          pageCount: -1,
        }}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={sessionsLoading}
      />

      {/* Transcript Modal */}
      {selectedSessionId && (
        <Modal
          isOpen={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          title='Chat Transcript'
          className='max-w-4xl max-h-[90vh] flex flex-col'
        >
          {detailLoading ? (
            <div className='p-12 text-center text-gray-500'>Loading transcript...</div>
          ) : (
            <div className='flex flex-col h-full overflow-hidden'>
              <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg'>
                <div className='mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs'>
                  <span className='font-bold'>User:</span>{' '}
                  {sessionDetail?.user?.username || `ID: ${sessionDetail?.user_id}`}
                  <span className='mx-2 text-gray-300'>|</span>
                  <span className='font-bold'>Started:</span>{' '}
                  {new Date(sessionDetail?.created_at).toLocaleString()}
                </div>
                {sessionDetail?.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                      }`}
                    >
                      <div className='font-bold text-[10px] uppercase mb-1 opacity-70'>
                        {msg.role === 'user' ? 'User' : 'Assistant'} •{' '}
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                      <div className='whitespace-pre-wrap'>{msg.content}</div>

                      {msg.debug_data && (
                        <details className='mt-2 pt-2 border-t border-white/20 dark:border-gray-700'>
                          <summary className='text-[10px] cursor-pointer hover:opacity-100 opacity-60'>
                            Debug Info
                          </summary>
                          <pre className='text-[10px] mt-1 font-mono p-2 bg-black/10 dark:bg-black/40 rounded overflow-x-auto'>
                            {JSON.stringify(msg.debug_data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className='pt-4 flex justify-between items-center text-xs text-gray-400'>
                <span>Session ID: {selectedSessionId}</span>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className='px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors'
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default AdminChatHistory;
