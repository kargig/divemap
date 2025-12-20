import { X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { formatDateForError } from '../utils/dateFormatting';

const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  // Check if banner was dismissed in localStorage
  useEffect(() => {
    if (user && !user.email_verified) {
      const dismissedKey = `email_verification_dismissed_${user.id}`;
      const isDismissed = localStorage.getItem(dismissedKey) === 'true';
      setDismissed(isDismissed);
    }
  }, [user]);

  // Don't show if user is verified, doesn't exist, or banner was dismissed
  if (!user || user.email_verified || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    const dismissedKey = `email_verification_dismissed_${user.id}`;
    localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  };

  const handleResend = async () => {
    if (!user?.email) {
      toast.error('Email address not found');
      return;
    }

    setResending(true);
    try {
      await api.post('/api/v1/auth/resend-verification', {
        email: user.email,
      });
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      // Handle rate limit error (429)
      if (error.response?.status === 429) {
        const errorData = error.response?.data;
        const resetAt = errorData?.reset_at_iso || errorData?.reset_at;
        let message = errorData?.message || 'You have reached the maximum number of verification email requests.';
        
        if (resetAt) {
          const formattedDate = formatDateForError(resetAt);
          if (formattedDate) {
            message = `Rate limit exceeded. You can request a new verification email after ${formattedDate}.`;
          }
        }
        
        toast.error(message, { duration: 6000 });
      } else {
        // Backend always returns success to prevent enumeration, but log error
        console.error('Resend verification error:', error);
        toast.success('If your email is not verified, a verification email has been sent.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className='bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4'>
      <div className='flex items-start'>
        <div className='flex-shrink-0'>
          <svg className='h-5 w-5 text-yellow-400' viewBox='0 0 20 20' fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          </svg>
        </div>
        <div className='ml-3 flex-1'>
          <p className='text-sm text-yellow-700'>
            <strong>Please verify your email address.</strong> Check your inbox for the verification
            link. If you didn't receive it, you can{' '}
            <button
              onClick={handleResend}
              disabled={resending}
              className='font-medium text-yellow-800 underline hover:text-yellow-900 disabled:opacity-50'
            >
              {resending ? 'Sending...' : 'resend the verification email'}
            </button>
            .
          </p>
        </div>
        <div className='ml-4 flex-shrink-0'>
          <button
            onClick={handleDismiss}
            className='inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none'
          >
            <X className='h-5 w-5' />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
