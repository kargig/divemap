import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  User as UserIcon,
  Filter,
  BarChart2,
  Eye,
  Trash2,
  ArrowRight,
  History,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';

import { getAdminChatFeedback, getAdminChatFeedbackStats, deleteAdminChatFeedback } from '../api';
import AdminChatFeedbackTable from '../components/tables/AdminChatFeedbackTable';
import Modal from '../components/ui/Modal';
import usePageTitle from '../hooks/usePageTitle';
import { formatDate } from '../utils/dateHelpers';

const AdminChatFeedback = () => {
  usePageTitle('Divemap - Admin - Chat Feedback');
  const queryClient = useQueryClient();

  const [ratingFilter, setRatingFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Table state
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [sorting, setSorting] = useState([]);

  // Query for stats
  const { data: stats } = useQuery('adminChatFeedbackStats', getAdminChatFeedbackStats);

  // Query for feedback list
  const { data: feedbackList, isLoading: listLoading } = useQuery(
    ['adminChatFeedback', ratingFilter, categoryFilter, pagination],
    () =>
      getAdminChatFeedback({
        rating: ratingFilter === 'positive' ? 1 : ratingFilter === 'negative' ? 0 : undefined,
        category: categoryFilter || undefined,
        limit: pagination.pageSize,
        offset: pagination.pageIndex * pagination.pageSize,
      })
  );

  // Delete mutation
  const deleteMutation = useMutation(deleteAdminChatFeedback, {
    onSuccess: () => {
      toast.success('Feedback deleted successfully');
      queryClient.invalidateQueries('adminChatFeedback');
      queryClient.invalidateQueries('adminChatFeedbackStats');
    },
    onError: error => {
      toast.error(`Failed to delete feedback: ${error.message}`);
    },
  });

  const handleDeleteFeedback = feedbackId => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      deleteMutation.mutate(feedbackId);
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Date',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            <Calendar size={14} />
            {formatDate(row.original.created_at)}
          </div>
        ),
      },
      {
        accessorKey: 'user_id',
        header: 'User',
        cell: ({ row }) => (
          <div className='flex items-center gap-2 font-medium'>
            <UserIcon size={14} className='text-gray-400' />
            {row.original.user?.username ||
              (row.original.user_id ? `User #${row.original.user_id}` : 'Anonymous')}
          </div>
        ),
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        cell: ({ row }) =>
          row.original.rating ? (
            <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
              <ThumbsUp size={10} /> Positive
            </span>
          ) : (
            <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'>
              <ThumbsDown size={10} /> Negative
            </span>
          ),
      },
      {
        accessorKey: 'query',
        header: 'Query Preview',
        cell: ({ row }) => (
          <div className='max-w-md truncate text-gray-600 dark:text-gray-400'>
            {row.original.query || <span className='text-gray-300 italic'>No query data</span>}
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
                setSelectedFeedback(row.original);
              }}
              className='p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1'
              title='View Details'
            >
              <Eye size={18} />
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                handleDeleteFeedback(row.original.id);
              }}
              className='p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1'
              title='Delete Feedback'
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
            <MessageSquare className='text-blue-600' />
            Chatbot Feedback Dashboard
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-2'>
            Review and analyze user feedback to improve chatbot responses.
          </p>
        </div>
        <Link
          to='/admin/chat-history'
          className='flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
        >
          <History size={16} />
          View History
          <ArrowRight size={16} className='text-gray-400' />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
        <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-500'>Total Feedback</span>
            <MessageSquare className='text-blue-500' size={20} />
          </div>
          <div className='text-2xl font-bold dark:text-white'>{stats?.total_feedback || 0}</div>
        </div>

        <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-500'>Satisfaction Rate</span>
            <BarChart2 className='text-green-500' size={20} />
          </div>
          <div className='text-2xl font-bold dark:text-white'>{stats?.satisfaction_rate || 0}%</div>
        </div>

        <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-500'>Positive</span>
            <ThumbsUp className='text-blue-500' size={20} />
          </div>
          <div className='text-2xl font-bold text-blue-600'>{stats?.positive_count || 0}</div>
        </div>

        <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-500'>Negative</span>
            <ThumbsDown className='text-red-500' size={20} />
          </div>
          <div className='text-2xl font-bold text-red-600'>{stats?.negative_count || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className='bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-wrap gap-4 items-center'>
        <div className='flex items-center gap-2'>
          <Filter size={18} className='text-gray-400' />
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>Filters:</span>
        </div>

        <select
          value={ratingFilter}
          onChange={e => {
            setRatingFilter(e.target.value);
            setPagination(prev => ({ ...prev, pageIndex: 0 }));
          }}
          className='bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2'
        >
          <option value=''>All Ratings</option>
          <option value='positive'>Positive Only</option>
          <option value='negative'>Negative Only</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => {
            setCategoryFilter(e.target.value);
            setPagination(prev => ({ ...prev, pageIndex: 0 }));
          }}
          className='bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2'
        >
          <option value=''>All Categories</option>
          <option value='accuracy'>Accuracy</option>
          <option value='tone'>Tone</option>
          <option value='safety'>Safety</option>
          <option value='other'>Other</option>
        </select>
      </div>

      {/* Table */}
      <AdminChatFeedbackTable
        data={feedbackList || []}
        columns={columns}
        pagination={{
          ...pagination,
          pageCount: -1, // Server-side pagination total count not returned by endpoint yet, infinite scroll logic or -1
        }}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={listLoading}
      />

      {/* Details Modal */}
      {selectedFeedback && (
        <Modal
          isOpen={!!selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          title='Feedback Details'
          className='max-w-4xl'
        >
          <div className='space-y-6 py-4'>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>Rating</label>
                <div className='mt-1'>
                  {selectedFeedback.rating ? (
                    <span className='text-blue-600 font-semibold flex items-center gap-2'>
                      <ThumbsUp size={16} /> Positive
                    </span>
                  ) : (
                    <span className='text-red-600 font-semibold flex items-center gap-2'>
                      <ThumbsDown size={16} /> Negative
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>Category</label>
                <div className='mt-1 capitalize dark:text-white'>
                  {selectedFeedback.category || 'N/A'}
                </div>
              </div>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>User</label>
                <div className='mt-1 dark:text-white'>
                  {selectedFeedback.user?.username ||
                    (selectedFeedback.user_id ? `User #${selectedFeedback.user_id}` : 'Anonymous')}
                </div>
              </div>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>Date</label>
                <div className='mt-1 dark:text-white'>
                  {formatDate(selectedFeedback.created_at)}
                </div>
              </div>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>User Query</label>
                <div className='mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-sm dark:text-gray-200'>
                  {selectedFeedback.query || 'N/A'}
                </div>
              </div>

              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Assistant Response
                </label>
                <div className='mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 text-sm dark:text-gray-200 whitespace-pre-wrap'>
                  {selectedFeedback.response || 'N/A'}
                </div>
              </div>
            </div>

            {selectedFeedback.comments && (
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Feedback Comments
                </label>
                <div className='mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800 text-sm dark:text-gray-200 italic'>
                  "{selectedFeedback.comments}"
                </div>
              </div>
            )}

            {selectedFeedback.debug_data && (
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase'>
                  Debug Data (JSON)
                </label>
                <div className='mt-1 p-3 bg-gray-900 rounded-lg overflow-x-auto'>
                  <pre className='text-xs text-green-400 font-mono'>
                    {JSON.stringify(selectedFeedback.debug_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className='pt-4 flex justify-between items-center'>
              <span className='text-[10px] text-gray-400 font-mono uppercase tracking-tighter'>
                Message ID: {selectedFeedback.message_id}
              </span>
              <button
                onClick={() => setSelectedFeedback(null)}
                className='px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors'
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminChatFeedback;
