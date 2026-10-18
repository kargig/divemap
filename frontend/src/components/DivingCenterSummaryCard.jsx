import { MessageSquare, Bell, ArrowLeft, MapPin, Phone, Mail, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import { createChatRoom } from '../api';
import {
  followDivingCenter,
  unfollowDivingCenter,
  getFollowStatus,
} from '../services/divingCenters';

import Avatar from './Avatar';
import MaskedEmail from './MaskedEmail';
import Button from './ui/Button';
import RichText from './ui/RichText';

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
      onError: () => {
        toast.error('Failed to update follow status');
      },
    }
  );

  const startChatMutation = useMutation(() => createChatRoom([], false, null, id), {
    onSuccess: data => {
      navigate(`/messages?room=${data.id}`);
    },
    onError: () => {
      toast.error('Failed to start conversation');
    },
  });

  if (!center) return null;

  const locationString = [center.city, center.country].filter(Boolean).join(', ');

  return (
    <div className='bg-white rounded-xl shadow-xs p-4 sm:p-5 mb-4 border border-gray-100'>
      {/* Top Header: Identity on Left, Contact Info on Right */}
      <div className='flex flex-col md:flex-row justify-between items-start gap-4'>
        {/* Left: Logo, Name, Location, Buttons */}
        <div className='flex items-start gap-3.5 flex-1 min-w-0'>
          {onBack && (
            <button
              onClick={onBack}
              className='text-gray-600 hover:text-gray-800 p-1 mt-1 shrink-0'
              aria-label='Go back'
            >
              <ArrowLeft size={18} className='sm:w-5 sm:h-5' />
            </button>
          )}

          <Avatar
            src={center.logo_full_url || center.logo_url}
            alt={center.name}
            size='xl'
            shape='rounded'
            fallbackText={center.name}
            className='border border-gray-200 shadow-xs shrink-0'
          />

          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2 mb-0.5'>
              <h1 className='text-xl sm:text-2xl font-bold text-gray-900 leading-tight'>
                {center.name}
              </h1>
              {center.average_rating && reviewsEnabled !== false && (
                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0'>
                  ★ {center.average_rating.toFixed(1)}/5
                  <span className='text-[10px] font-normal text-gray-500'>
                    ({center.total_ratings})
                  </span>
                </span>
              )}
            </div>

            {locationString && (
              <div className='flex items-center gap-1 text-xs text-gray-500 mb-2'>
                <MapPin size={12} className='text-gray-400 shrink-0' />
                <span>{locationString}</span>
              </div>
            )}

            {user && (
              <div className='flex items-center gap-2 flex-wrap'>
                <Button
                  onClick={() => startChatMutation.mutate()}
                  disabled={startChatMutation.isLoading}
                  variant='white'
                  size='sm'
                  className='shadow-2xs text-xs py-1 px-2.5 h-8'
                  icon={<MessageSquare className='h-3.5 w-3.5 mr-1 text-blue-600' />}
                >
                  {startChatMutation.isLoading ? 'Loading...' : 'Message'}
                </Button>
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isLoading}
                  variant='secondary'
                  size='sm'
                  className='shadow-2xs text-xs py-1 px-2.5 h-8'
                  icon={
                    <Bell
                      className={`h-3.5 w-3.5 mr-1 ${
                        isFollowing ? 'fill-current text-blue-500' : ''
                      }`}
                    />
                  }
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Compact Contact Information */}
        <div className='flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-1.5 shrink-0 text-xs sm:text-sm text-gray-600 pt-1'>
          {center.phone && (
            <a
              href={`tel:${center.phone}`}
              className='inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-blue-600 transition-colors'
            >
              <Phone className='w-3.5 h-3.5 text-blue-600 shrink-0' />
              <span>{center.phone}</span>
            </a>
          )}
          {center.email && (
            <div className='inline-flex items-center gap-1.5 font-medium text-gray-700'>
              <Mail className='w-3.5 h-3.5 text-blue-600 shrink-0' />
              <MaskedEmail email={center.email} className='hover:text-blue-600 transition-colors' />
            </div>
          )}
          {center.website && (
            <a
              href={center.website}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors'
            >
              <Globe className='w-3.5 h-3.5 text-blue-600 shrink-0' />
              <span>Visit Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Bottom: Full-Width Description */}
      {center.description && (
        <div className='mt-3 pt-3 border-t border-gray-100 text-xs sm:text-sm text-gray-600 leading-relaxed'>
          <RichText content={center.description} className='text-gray-600' />
        </div>
      )}
    </div>
  );
};

export default DivingCenterSummaryCard;
