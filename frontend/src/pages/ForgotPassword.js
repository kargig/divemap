import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../components/forms/FormField';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';
import { forgotPassword } from '../services/auth';
import { createResolver } from '../utils/formHelpers';

const forgotPasswordSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
});

const ForgotPassword = () => {
  usePageTitle('Divemap - Forgot Password');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const methods = useForm({
    resolver: createResolver(forgotPasswordSchema),
    defaultValues: {
      emailOrUsername: '',
    },
  });

  const { handleSubmit } = methods;

  const onSubmit = async data => {
    setLoading(true);
    try {
      await forgotPassword(data.emailOrUsername);
      setIsSuccess(true);
      toast.success('If an account exists, a reset link has been sent.');
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please try again later.');
      } else {
        // For security, behave as if success or show generic error
        // But for UX, if it's a network error, we should probably tell them
        console.error(error);
        toast.error('Unable to process request. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-md w-full text-center space-y-8'>
          <div>
            <div className='mx-auto flex items-center justify-center'>
              <Logo size='large' showText={false} />
            </div>
            <h2 className='mt-6 text-3xl font-extrabold text-gray-900'>Check your email</h2>
            <p className='mt-2 text-sm text-gray-600'>
              If an account exists with that email or username, we've sent instructions to reset
              your password.
            </p>
          </div>
          <div className='mt-4'>
            <Link to='/login' className='text-blue-600 hover:text-blue-500 font-medium'>
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        <div>
          <div className='mx-auto flex items-center justify-center'>
            <Logo size='large' showText={false} />
          </div>
          <h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>
            Reset your password
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Enter your email address or username and we'll send you a link to reset your password.
          </p>
        </div>

        <FormProvider {...methods}>
          <form className='mt-8 space-y-6' onSubmit={handleSubmit(onSubmit)}>
            <FormField name='emailOrUsername' label='Email or Username'>
              {({ register, name }) => (
                <input
                  id={name}
                  type='text'
                  className='appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                  placeholder='Enter email or username'
                  {...register(name)}
                />
              )}
            </FormField>

            <div>
              <button
                type='submit'
                disabled={loading}
                className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>

            <div className='text-center'>
              <Link to='/login' className='font-medium text-blue-600 hover:text-blue-500'>
                Back to Sign In
              </Link>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

export default ForgotPassword;
