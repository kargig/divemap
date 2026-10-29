import { Mail } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import api from '../api';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import { formatDateForError } from '../utils/dateFormatting';

const CheckYourEmail = () => {
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
    <>
      <SEO
        title='Check Your Email | Divemap'
        description='Please check your email to verify your Divemap account and complete registration.'
      />
      <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-md w-full space-y-8'>
          <div>
            <div className='flex justify-center'>
              <Logo />
            </div>
            <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100'>
              Check Your Email
            </h2>
          </div>

          <div className='bg-white dark:bg-slate-800 py-8 px-6 shadow rounded-lg border border-gray-100 dark:border-slate-700'>
            <div className='text-center'>
              <div className='mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mb-4'>
                <Mail className='w-8 h-8 text-divemap-blue dark:text-sky-400' />
              </div>

              <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100 mb-2'>
                Verification Email Sent
              </h3>

              <p className='text-sm text-gray-600 dark:text-slate-400 mb-4'>
                We've sent a verification link to{' '}
                {email && (
                  <span className='font-medium text-gray-900 dark:text-slate-100'>{email}</span>
                )}
                {!email && (
                  <span className='font-medium text-gray-900 dark:text-slate-100'>
                    your email address
                  </span>
                )}
                . Please check your inbox and click the link to verify your account.
              </p>

              <div className='bg-yellow-50 dark:bg-amber-950/40 border border-yellow-200 dark:border-amber-900 rounded-md p-4 mb-6'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='h-5 w-5 text-yellow-400 dark:text-amber-400'
                      viewBox='0 0 20 20'
                      fill='currentColor'
                    >
                      <path
                        fillRule='evenodd'
                        d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3 text-left'>
                    <p className='text-sm text-yellow-700 dark:text-amber-200'>
                      <strong>Didn't receive the email?</strong> Check your spam folder, or click
                      the button below to resend the verification email.
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                {email && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resending}
                    className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-divemap-blue hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-divemap-sky disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {resending ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}

                <Link
                  to='/login'
                  className='block w-full text-center py-2 px-4 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-750 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-divemap-sky'
                >
                  Go to Login
                </Link>
              </div>

              <p className='mt-6 text-xs text-gray-500 dark:text-slate-400'>
                The verification link will expire in 24 hours. If you need help, please contact
                support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CheckYourEmail;
