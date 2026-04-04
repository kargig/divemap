import { MessageSquare, Bell, ArrowLeft, Edit, MapPin, Phone, Mail, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from 'react-query';
import { useNavigate, Link } from 'react-router-dom';

import { createChatRoom } from '../api';
import {
  followDivingCenter,
  unfollowDivingCenter,
  getFollowStatus,
} from '../services/divingCenters';
import { decodeHtmlEntities } from '../utils/htmlDecode';

import MaskedEmail from './MaskedEmail';
import Button from './ui/Button';

const DivingCenterSummaryCard = ({ center, user, onBack, reviewsEnabled }) => {
  const navigate = useNavigate();
  const id = center?.id;

  const { data: followData, refetch: refetchFollowStatus } = useQuery(
    ['diving-center-follow', id],
    () => getFollowStatus(id),
    { enabled: !!id && !!user }
  );

  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (followData) {
      setIsFollowing(followData.is_following);
    }
  }, [followData]);

  const followMutation = useMutation(
    () => (isFollowing ? unfollowDivingCenter(id) : followDivingCenter(id)),
    {
      onSuccess: () => {
        setIsFollowing(!isFollowing);
        refetchFollowStatus();
        toast.success(
          isFollowing ? 'Unfollowed diving center' : 'Following diving center for updates'
        );
      },
      onError: error => {
        toast.error('Failed to update follow status');
      },
    }
  );

  const startChatMutation = useMutation(() => createChatRoom([], false, null, id), {
    onSuccess: data => {
      navigate(`/messages?room=${data.id}`);
    },
    onError: error => {
      toast.error('Failed to start conversation');
    },
  });

  const isOwner = Boolean(
    user && user.id && (user.id === center?.created_by || user.id === center?.owner_id)
  );
  const isAdmin = Boolean(user?.is_admin);
  const isModerator = Boolean(user?.is_moderator);
  const shouldShowEdit = isOwner || isAdmin || isModerator;

  if (!center) return null;

  return (
    <div className='bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-100'>
      <div className='flex flex-col sm:flex-row justify-between items-start mb-6 gap-4'>
        <div className='flex items-start gap-3 sm:gap-4 flex-1 w-full'>
          {onBack && (
            <button
              onClick={onBack}
              className='text-gray-600 hover:text-gray-800 p-1 mt-1 shrink-0'
            >
              <ArrowLeft size={20} className='sm:w-6 sm:h-6' />
            </button>
          )}
          <div className='min-w-0 flex-1'>
            {center.logo_url && (
              <img
                src={center.logo_url}
                alt={`${center.name} logo`}
                className='w-16 h-16 object-cover rounded-lg border border-gray-200 mb-3'
              />
            )}
            <h1 className='text-3xl font-bold text-gray-900 mb-2 break-words'>{center.name}</h1>

            {user && (
              <div className='flex flex-wrap gap-2 mt-3 w-full'>
                <button
                  onClick={() => startChatMutation.mutate()}
                  disabled={startChatMutation.isLoading}
                  className='inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 transition-colors flex-1 sm:flex-none'
                >
                  <MessageSquare className='h-4 w-4 mr-1.5' />
                  {startChatMutation.isLoading ? 'Loading...' : 'Message'}
                </button>
                <button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isLoading}
                  className={`inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm border transition-colors flex-1 sm:flex-none ${
                    isFollowing
                      ? 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300'
                      : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  <Bell className={`h-4 w-4 mr-1.5 ${isFollowing ? 'fill-current text-blue-500' : ''}`} />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                {shouldShowEdit && (
                  <Link
                    to={`/diving-centers/${id}/edit`}
                    className='inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 border border-transparent transition-colors flex-1 sm:flex-none'
                  >
                    <Edit className='h-4 w-4 mr-1.5' />
                    Edit Center
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className='flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto space-x-4 sm:space-x-0 sm:space-y-4 shrink-0'>
          {center.average_rating && reviewsEnabled !== false ? (
            <div className='text-right'>
              <div className='flex items-center space-x-2 mb-1 justify-end'>
                <span className='text-3xl font-bold text-gray-900 leading-none'>
                  {center.average_rating.toFixed(1)}
                  <span className='text-xl text-gray-400'>/10</span>
                </span>
              </div>
              <p className='text-sm text-gray-600'>
                {center.total_ratings} rating{center.total_ratings !== 1 ? 's' : ''}
              </p>
            </div>
          ) : reviewsEnabled !== false ? (
            <div className='text-sm text-gray-500 italic'>No ratings yet</div>
          ) : null}
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100'>
        <div className='col-span-2'>
          {center.description ? (
            <p className='text-gray-700 leading-relaxed whitespace-pre-wrap'>
              {decodeHtmlEntities(center.description)}
            </p>
          ) : (
            <p className='text-gray-400 italic'>No description available.</p>
          )}
        </div>

        <div className='space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 h-fit'>
          <h3 className='font-semibold text-gray-900 text-sm uppercase tracking-wider mb-3'>
            Contact Info
          </h3>
          {center.phone && (
            <div className='flex items-center space-x-3'>
              <div className='bg-white p-2 rounded-lg shadow-sm border border-gray-100'>
                <Phone className='w-4 h-4 text-blue-600' />
              </div>
              <a
                href={`tel:${center.phone}`}
                className='text-gray-700 hover:text-blue-600 transition-colors font-medium'
              >
                {center.phone}
              </a>
            </div>
          )}
          {center.email && (
            <div className='flex items-center space-x-3'>
              <div className='bg-white p-2 rounded-lg shadow-sm border border-gray-100'>
                <Mail className='w-4 h-4 text-blue-600' />
              </div>
              <MaskedEmail
                email={center.email}
                className='text-gray-700 hover:text-blue-600 transition-colors font-medium'
              />
            </div>
          )}
          {center.website && (
            <div className='flex items-center space-x-3'>
              <div className='bg-white p-2 rounded-lg shadow-sm border border-gray-100'>
                <Globe className='w-4 h-4 text-blue-600' />
              </div>
              <a
                href={center.website}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 hover:text-blue-800 transition-colors font-medium truncate'
              >
                Visit Website
              </a>
            </div>
          )}
          {!center.phone && !center.email && !center.website && (
            <p className='text-sm text-gray-500 italic'>No contact details provided.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DivingCenterSummaryCard;
