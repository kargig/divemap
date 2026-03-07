import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';
import { formatDateForError } from '../utils/dateFormatting';

const VerifyEmail = () => {
  usePageTitle('Divemap - Verify Email');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    // If success parameter is present, show success (from backend redirect)
    if (success === 'true') {
      setStatus('success');
      toast.success('Email verified successfully!');
      return;
    }

    // If error parameter is present, show error (from backend redirect)
    if (error) {
      setStatus('error');
      if (error === 'invalid_or_expired') {
        setErrorMessage(
          'This verification link is invalid or has expired. Please request a new verification email.'
        );
      } else {
        setErrorMessage('An error occurred during email verification.');
      }
      return;
    }

    // If token is present, verify it (for direct frontend access)
    // Note: This should only happen if user navigates directly to /verify-email?token=...
    // Normal flow: email link -> backend API -> redirect to frontend with success/error
    if (token) {
      verifyEmail(token);
    } else if (!success && !error) {
      // Only show error if no success/error params and no token
      setStatus('error');
      setErrorMessage('No verification token provided.');
    }
  }, [searchParams]);

  const verifyEmail = async token => {
    try {
      // Call API with format=json to get JSON response instead of redirect
      const response = await api.get(`/api/v1/auth/verify-email?token=${token}&format=json`);
      if (response.data.success) {
        setStatus('success');
        toast.success('Email verified successfully!');
      }
    } catch (error) {
      setStatus('error');
      if (error.response?.status === 400) {
        setErrorMessage(
          'This verification link is invalid or has expired. Please request a new verification email.'
        );
      } else {
        setErrorMessage('An error occurred during email verification. Please try again.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!resendEmail || !resendEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setResending(true);
    try {
      await api.post('/api/v1/auth/resend-verification', {
        email: resendEmail,
      });
      toast.success(
        'If your email is registered, a verification email has been sent. Please check your inbox.'
      );
      setShowResendForm(false);
      setResendEmail('');
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
        setShowResendForm(false);
        setResendEmail('');
      } else {
        // Backend returns success even for non-existent emails to prevent enumeration
        // So we show success message regardless for other errors
        toast.success(
          'If your email is registered, a verification email has been sent. Please check your inbox.'
        );
        setShowResendForm(false);
        setResendEmail('');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <div className='mx-auto flex items-center justify-center'>
            <Logo size='large' showText={false} />
          </div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Email Verification
          </h2>
        </div>

        <div className='bg-white py-8 px-6 shadow rounded-lg'>
          {status === 'verifying' && (
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
              <p className='mt-4 text-gray-600'>Verifying your email address...</p>
            </div>
          )}

          {status === 'success' && (
            <div className='text-center'>
              <div className='mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100'>
                <svg
                  className='w-6 h-6 text-green-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              </div>
              <h3 className='mt-4 text-lg font-medium text-gray-900'>Email Verified!</h3>
              <p className='mt-2 text-sm text-gray-600'>
                Your email address has been successfully verified. You can now log in to your
                account.
              </p>
              <div className='mt-6'>
                <button
                  onClick={() => navigate('/login')}
                  className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className='text-center'>
              <div className='mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100'>
                <svg
                  className='w-6 h-6 text-red-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </div>
              <h3 className='mt-4 text-lg font-medium text-gray-900'>Verification Failed</h3>
              <p className='mt-2 text-sm text-gray-600'>{errorMessage}</p>

              {!showResendForm ? (
                <div className='mt-6 space-y-3'>
                  <button
                    onClick={() => setShowResendForm(true)}
                    className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    Request New Verification Email
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    Go to Login
                  </button>
                </div>
              ) : (
                <div className='mt-6 space-y-3'>
                  <div>
                    <label
                      htmlFor='resend-email'
                      className='block text-sm font-medium text-gray-700 mb-1'
                    >
                      Email Address
                    </label>
                    <input
                      id='resend-email'
                      type='email'
                      value={resendEmail}
                      onChange={e => setResendEmail(e.target.value)}
                      placeholder='Enter your email address'
                      className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                      disabled={resending}
                    />
                  </div>
                  <button
                    onClick={handleResendVerification}
                    disabled={resending || !resendEmail.includes('@')}
                    className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {resending ? 'Sending...' : 'Send Verification Email'}
                  </button>
                  <button
                    onClick={() => {
                      setShowResendForm(false);
                      setResendEmail('');
                    }}
                    className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
