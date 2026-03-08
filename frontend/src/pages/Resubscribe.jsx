import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';

const Resubscribe = () => {
  usePageTitle('Divemap - Re-subscribe');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [resubscribing, setResubscribing] = useState(false);
  const [category, setCategory] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const categoryParam = searchParams.get('category');

    if (!token) {
      setStatus('error');
      setErrorMessage('No re-subscribe token provided.');
      return;
    }

    setCategory(categoryParam || 'all');
    // Auto-resubscribe when page loads
    handleResubscribe(token, categoryParam);
  }, [searchParams]);

  const handleResubscribe = async (token, categoryParam) => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No re-subscribe token provided.');
      return;
    }

    setResubscribing(true);
    try {
      const url =
        categoryParam && categoryParam !== 'all'
          ? `/api/v1/unsubscribe/resubscribe?token=${token}&category=${categoryParam}`
          : `/api/v1/unsubscribe/resubscribe?token=${token}`;

      const response = await api.post(url);

      if (response.data.success) {
        setStatus('success');
        toast.success('Successfully re-subscribed!');
      }
    } catch (error) {
      setStatus('error');
      if (error.response?.status === 400) {
        setErrorMessage(
          'This re-subscribe link is invalid or has expired. Please use the "Manage Preferences" page to update your email settings.'
        );
      } else {
        setErrorMessage('Failed to re-subscribe. Please try again later.');
      }
    } finally {
      setResubscribing(false);
    }
  };

  const getCategoryDisplayName = cat => {
    if (!cat || cat === 'all') return 'all emails';
    const categoryMap = {
      new_dive_sites: 'dive site',
      new_dives: 'dive',
      new_diving_centers: 'diving center',
      new_dive_trips: 'dive trip',
      daily_digest: 'daily digest',
      weekly_digest: 'weekly digest',
    };
    return categoryMap[cat] || cat;
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <div className='mx-auto flex items-center justify-center'>
            <Logo size='large' showText={false} />
          </div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>Re-subscribe</h2>
        </div>

        <div className='bg-white py-8 px-6 shadow rounded-lg'>
          {status === 'loading' && (
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
              <p className='mt-4 text-gray-600'>Re-subscribing...</p>
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
              <h3 className='mt-4 text-lg font-medium text-gray-900'>Re-subscribed Successfully</h3>
              <p className='mt-2 text-sm text-gray-600'>
                You have been re-subscribed to {getCategoryDisplayName(category)} notifications. You
                will now receive email notifications from Divemap.
              </p>
              <div className='mt-6 space-y-3'>
                <button
                  onClick={() => navigate('/profile/notifications')}
                  className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Manage Preferences
                </button>
                <button
                  onClick={() => navigate('/')}
                  className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Go to Home
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
              <h3 className='mt-4 text-lg font-medium text-gray-900'>Re-subscribe Failed</h3>
              <p className='mt-2 text-sm text-gray-600'>{errorMessage}</p>
              <div className='mt-6'>
                <button
                  onClick={() => navigate('/profile/notifications')}
                  className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Manage Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Resubscribe;
