import { Mail } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import api from '../api';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';
import { formatDateForError } from '../utils/dateFormatting';

const CheckYourEmail = () => {
  usePageTitle('Divemap - Check Your Email');
  const location = useLocation();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);

  // Get email from location state (passed from Register page)
  const email = location.state?.email || '';

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('Email address not found. Please register again.');
      navigate('/register');
      return;
    }

    setResending(true);
    try {
      await api.post('/api/v1/auth/resend-verification', {
        email: email,
      });
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      // Handle rate limit error (429)
      if (error.response?.status === 429) {
        const errorData = error.response?.data;
        const resetAt = errorData?.reset_at_iso || errorData?.reset_at;
        let message =
          errorData?.message ||
          'You have reached the maximum number of verification email requests.';

        if (resetAt) {
          const formattedDate = formatDateForError(resetAt);
          if (formattedDate) {
            message = `Rate limit exceeded. You can request a new verification email after ${formattedDate}.`;
          }
        }

        toast.error(message, { duration: 6000 });
      } else {
        // Backend returns success even for non-existent emails to prevent enumeration
        // So we show success message regardless for other errors
        toast.success('If your email is registered, a verification email has been sent.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <div className='flex justify-center'>
            <Logo />
          </div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Check Your Email
          </h2>
        </div>

        <div className='bg-white py-8 px-6 shadow rounded-lg'>
          <div className='text-center'>
            <div className='mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4'>
              <Mail className='w-8 h-8 text-blue-600' />
            </div>

            <h3 className='text-lg font-medium text-gray-900 mb-2'>Verification Email Sent</h3>

            <p className='text-sm text-gray-600 mb-4'>
              We've sent a verification link to{' '}
              {email && <span className='font-medium text-gray-900'>{email}</span>}
              {!email && <span className='font-medium text-gray-900'>your email address</span>}.
              Please check your inbox and click the link to verify your account.
            </p>

            <div className='bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6'>
              <div className='flex'>
                <div className='flex-shrink-0'>
                  <svg className='h-5 w-5 text-yellow-400' viewBox='0 0 20 20' fill='currentColor'>
                    <path
                      fillRule='evenodd'
                      d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                      clipRule='evenodd'
                    />
                  </svg>
                </div>
                <div className='ml-3'>
                  <p className='text-sm text-yellow-700'>
                    <strong>Didn't receive the email?</strong> Check your spam folder, or click the
                    button below to resend the verification email.
                  </p>
                </div>
              </div>
            </div>

            <div className='space-y-3'>
              {email && (
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>
              )}

              <Link
                to='/login'
                className='block w-full text-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                Go to Login
              </Link>
            </div>

            <p className='mt-6 text-xs text-gray-500'>
              The verification link will expire in 24 hours. If you need help, please contact
              support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckYourEmail;
