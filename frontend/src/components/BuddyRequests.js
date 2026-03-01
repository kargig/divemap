import { UserCheck, UserX, Clock, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { getUserFriendships, acceptFriendRequest, rejectFriendRequest } from '../api';

import Avatar from './Avatar';

const BuddyRequests = () => {
  const queryClient = useQueryClient();
  const currentUserId = parseInt(localStorage.getItem('user_id'));

  const { data: requests = [], isLoading } = useQuery(
    ['buddy-requests', 'PENDING'],
    () => getUserFriendships('PENDING'),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const acceptMutation = useMutation(acceptFriendRequest, {
    onSuccess: () => {
      queryClient.invalidateQueries('buddy-requests');
      queryClient.invalidateQueries('user-friendships');
      toast.success('Buddy request accepted!');
    },
    onError: () => toast.error('Failed to accept request'),
  });

  const rejectMutation = useMutation(rejectFriendRequest, {
    onSuccess: () => {
      queryClient.invalidateQueries('buddy-requests');
      toast.success('Request ignored');
    },
    onError: () => toast.error('Failed to reject request'),
  });

  // Filter for requests received by the current user
  const incomingRequests = requests.filter(
    r => r.initiator_id !== currentUserId && r.status === 'PENDING'
  );

  if (isLoading)
    return (
      <div className='p-4 flex justify-center'>
        <Loader2 className='animate-spin text-blue-600' />
      </div>
    );
  if (incomingRequests.length === 0) return null;

  return (
    <div className='mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-blue-100 dark:border-blue-900/30'>
      <div className='bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between'>
        <h3 className='text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center'>
          <Clock size={16} className='mr-2' />
          Buddy Requests ({incomingRequests.length})
        </h3>
      </div>
      <div className='divide-y divide-gray-100 dark:divide-gray-700'>
        {incomingRequests.map(req => {
          const sender = req.initiator_id === req.user_id ? req.user : req.friend;
          return (
            <div key={req.id} className='p-4 flex items-center justify-between gap-4'>
              <div className='flex items-center space-x-3 min-w-0'>
                <Avatar src={sender?.avatar_url} username={sender?.username} size='md' />
                <div className='min-w-0'>
                  <p className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
                    {sender?.username}
                  </p>
                  <p className='text-xs text-gray-500 truncate'>wants to be your buddy</p>
                </div>
              </div>
              <div className='flex space-x-2 shrink-0'>
                <button
                  onClick={() => acceptMutation.mutate(req.id)}
                  className='p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm'
                  title='Accept'
                >
                  <UserCheck size={18} />
                </button>
                <button
                  onClick={() => rejectMutation.mutate(req.id)}
                  className='p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-lg transition-colors'
                  title='Ignore'
                >
                  <UserX size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BuddyRequests;
