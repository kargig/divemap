import { UserCheck, UserX, Clock, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { getUserFriendships, acceptFriendRequest, rejectFriendRequest } from '../api';
import { useAuth } from '../contexts/AuthContext';

import Avatar from './Avatar';

const BuddyRequests = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id || parseInt(localStorage.getItem('user_id'));

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

  // Separate incoming and outgoing requests
  const incomingRequests = requests.filter(
    r => r.initiator_id !== currentUserId && r.status === 'PENDING'
  );
  const outgoingRequests = requests.filter(
    r => r.initiator_id === currentUserId && r.status === 'PENDING'
  );

  if (isLoading)
    return (
      <div className='p-4 flex justify-center'>
        <Loader2 className='animate-spin text-blue-600' />
      </div>
    );

  if (incomingRequests.length === 0 && outgoingRequests.length === 0) return null;

  return (
    <div className='mb-6 space-y-4'>
      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-blue-100 dark:border-blue-900/30'>
          <div className='bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-100 dark:border-blue-900/30'>
            <h3 className='text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center'>
              <Clock size={16} className='mr-2' />
              Incoming Buddy Requests ({incomingRequests.length})
            </h3>
          </div>
          <div className='divide-y divide-gray-100 dark:divide-gray-700'>
            {incomingRequests.map(req => {
              const sender = req.initiator_id === req.user_id ? req.user : req.friend;
              return (
                <div
                  key={req.id}
                  className='p-4 flex items-center justify-between gap-4 hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark transition-colors'
                >
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
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-700'>
          <div className='bg-gray-50 dark:bg-gray-900/40 px-4 py-2 border-b border-gray-100 dark:border-gray-700'>
            <h3 className='text-sm font-bold text-gray-600 dark:text-gray-400 flex items-center'>
              <Clock size={16} className='mr-2' />
              Sent Buddy Requests ({outgoingRequests.length})
            </h3>
          </div>
          <div className='divide-y divide-gray-100 dark:divide-gray-700'>
            {outgoingRequests.map(req => {
              // The target is the one who is NOT the initiator
              const target = req.user_id === req.initiator_id ? req.friend : req.user;
              return (
                <div
                  key={req.id}
                  className='p-4 flex items-center justify-between gap-4 hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark transition-colors'
                >
                  <div className='flex items-center space-x-3 min-w-0'>
                    <Avatar src={target?.avatar_url} username={target?.username} size='md' />
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
                        {target?.username}
                      </p>
                      <p className='text-xs text-gray-500 truncate'>Request pending...</p>
                    </div>
                  </div>
                  <div className='flex space-x-2 shrink-0'>
                    <button
                      onClick={() => rejectMutation.mutate(req.id)}
                      className='p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors'
                      title='Cancel Request'
                    >
                      <UserX size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuddyRequests;
