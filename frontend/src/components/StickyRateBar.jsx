import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import ShellRating from './ui/ShellRating';

const StickyRateBar = ({ diveSite, onRate, isSubmitting }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [localRating, setLocalRating] = useState(0);

  // Sync local rating with user's existing rating
  useEffect(() => {
    if (diveSite?.user_rating) {
      setLocalRating(diveSite.user_rating);
    }
  }, [diveSite]);

  const handleRate = value => {
    if (!user) {
      // Redirect to login with return path
      navigate('/login', { state: { from: location } });
      return;
    }
    setLocalRating(value);
    onRate(value);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className='fixed bottom-0 left-0 right-0 z-[100] lg:hidden transition-transform duration-300 ease-in-out transform translate-y-0'>
      <div className='bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-lg pb-safe'>
        <div className='px-4 py-3 flex items-center justify-between max-w-lg mx-auto relative'>
          {/* Close button for scenarios where it obstructs view */}
          <button
            onClick={handleClose}
            className='absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full'
          >
            <X size={16} />
          </button>

          <div className='flex flex-col w-full items-center'>
            <span className='text-sm font-semibold text-gray-800 mb-2'>
              {user
                ? diveSite?.user_rating
                  ? 'Your rating'
                  : 'Rate this site'
                : 'Been here? Rate it!'}
            </span>

            <div className='flex items-center justify-center w-full'>
              <ShellRating
                value={localRating}
                onChange={handleRate}
                disabled={isSubmitting}
                size={24} // Restored to a legible size that should fit
                gap={2} // Keep tight gap
                className='justify-center'
              />
              {isSubmitting && (
                <span className='ml-2 text-xs text-blue-600 animate-pulse whitespace-nowrap absolute right-4'>
                  Saving...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

StickyRateBar.propTypes = {
  diveSite: PropTypes.object.isRequired,
  onRate: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

export default StickyRateBar;
