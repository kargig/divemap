import { Users, Trash2, MessageSquare, ArrowLeft } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';

import { getUserFriendships, removeFriendship, createChatRoom } from '../api';
import Avatar from '../components/Avatar';
import BuddyRequests from '../components/BuddyRequests';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const Buddies = () => {
  usePageTitle('Divemap - My Buddies');
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: buddies = [],
    isLoading,
    error,
  } = useQuery(['user-friendships', 'ACCEPTED'], () => getUserFriendships('ACCEPTED'), {
    enabled: !!currentUser,
  });

  const removeMutation = useMutation(removeFriendship, {
    onSuccess: () => {
      queryClient.invalidateQueries(['user-friendships', 'ACCEPTED']);
    },
    onError: () => toast.error('Failed to remove buddy'),
  });

  const handleRemoveBuddy = async (friendshipId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from your buddies?`)) {
      return;
    }

    removeMutation.mutate(friendshipId, {
      onSuccess: () => {
        toast.success(`${username} removed from buddies`);
      },
    });
  };

  const handleMessageBuddy = async buddyUser => {
    try {
      const room = await createChatRoom([buddyUser.id], false);
      navigate('/messages', { state: { roomId: room.id } });
    } catch (err) {
      console.error('Error starting chat:', err);
      toast.error('Failed to start chat');
    }
  };

  if (!currentUser) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-600'>Please log in to view your buddies.</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='mb-6'>
        <Link
          to='/profile'
          className='inline-flex items-center text-blue-600 hover:text-blue-700 mb-4'
        >
          <ArrowLeft className='h-4 w-4 mr-2' />
          Back to Profile
        </Link>
        <div className='flex items-center gap-3'>
          <Users className='h-8 w-8 text-blue-600' />
          <h1 className='text-3xl font-bold text-gray-900'>My Buddies</h1>
        </div>
        <p className='text-gray-600 mt-2'>Manage your dive buddies and friendship requests.</p>
      </div>

      <div className='space-y-8'>
        {/* Pending Requests Section */}
        <section>
          <BuddyRequests />
        </section>

        {/* Accepted Buddies Section */}
        <section className='bg-white rounded-lg shadow-md overflow-hidden'>
          <div className='p-6 border-b border-gray-200'>
            <h2 className='text-xl font-semibold text-gray-900'>Current Buddies</h2>
          </div>

          <div className='p-6'>
            {isLoading ? (
              <div className='flex justify-center py-8'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
              </div>
            ) : error ? (
              <div className='text-center py-8 text-red-600'>{error}</div>
            ) : buddies.length === 0 ? (
              <div className='text-center py-12'>
                <Users className='h-12 w-12 text-gray-400 mx-auto mb-4' />
                <p className='text-gray-500'>You don't have any buddies yet.</p>
                <p className='text-sm text-gray-400 mt-2'>
                  Find divers on their profile pages and send them a buddy request!
                </p>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {buddies.map(friendship => {
                  // Determine which user in the friendship is the buddy (not the current user)
                  const buddyUser =
                    friendship.user.id === currentUser.id ? friendship.friend : friendship.user;

                  return (
                    <div
                      key={friendship.id}
                      className='flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors'
                    >
                      <Link
                        to={`/users/${buddyUser.username}`}
                        className='flex items-center gap-3 flex-1 min-w-0 group'
                      >
                        <Avatar
                          src={buddyUser.avatar_url}
                          alt={buddyUser.username}
                          size='md'
                          fallbackText={buddyUser.username}
                        />
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate'>
                            {buddyUser.username}
                          </p>
                          {buddyUser.name && (
                            <p className='text-xs text-gray-500 truncate'>{buddyUser.name}</p>
                          )}
                        </div>
                      </Link>

                      <div className='flex items-center gap-2 ml-4 shrink-0'>
                        <button
                          onClick={() => handleMessageBuddy(buddyUser)}
                          className='p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors'
                          title='Message Buddy'
                        >
                          <MessageSquare className='h-5 w-5' />
                        </button>
                        <button
                          onClick={() => handleRemoveBuddy(friendship.id, buddyUser.username)}
                          className='p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors'
                          title='Remove Buddy'
                        >
                          <Trash2 className='h-5 w-5' />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Buddies;
