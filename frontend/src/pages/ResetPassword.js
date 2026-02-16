import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';

import { FormField } from '../components/forms/FormField';
import Logo from '../components/Logo';
import usePageTitle from '../hooks/usePageTitle';
import { verifyResetToken, resetPassword } from '../services/auth';
import { commonSchemas, createResolver } from '../utils/formHelpers';

const resetPasswordSchema = z
  .object({
    password: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const ResetPassword = () => {
  usePageTitle('Divemap - Reset Password');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const methods = useForm({
    resolver: createResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const { handleSubmit } = methods;

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setVerifying(false);
        return;
      }

      try {
        await verifyResetToken(token);
        setValidToken(true);
      } catch (error) {
        setValidToken(false);
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const onSubmit = async data => {
    if (!token) return;

    setLoading(true);
    try {
      await resetPassword(token, data.password);
      toast.success('Password reset successfully. Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(
        error.response?.data?.detail || 'Failed to reset password. Token may have expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Verifying link...</p>
        </div>
      </div>
    );
  }

  if (!validToken || !token) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-md w-full text-center space-y-8'>
          <div>
            <div className='mx-auto flex items-center justify-center'>
              <Logo size='large' showText={false} />
            </div>
            <h2 className='mt-6 text-3xl font-extrabold text-gray-900'>Invalid Link</h2>
            <p className='mt-2 text-sm text-red-600'>
              This password reset link is invalid or has expired.
            </p>
          </div>
          <div className='mt-4'>
            <Link to='/forgot-password' className='text-blue-600 hover:text-blue-500 font-medium'>
              Request a new reset link
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
            Set new password
          </h2>
        </div>

        <FormProvider {...methods}>
          <form className='mt-8 space-y-6' onSubmit={handleSubmit(onSubmit)}>
            <div className='space-y-4'>
              <FormField name='password' label='New Password'>
                {({ register, name }) => (
                  <div className='relative'>
                    <input
                      id={name}
                      type={showPassword ? 'text' : 'password'}
                      className='block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                      placeholder='Enter new password'
                      {...register(name)}
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    >
                      {showPassword ? (
                        <EyeOff className='h-4 w-4 text-gray-400' />
                      ) : (
                        <Eye className='h-4 w-4 text-gray-400' />
                      )}
                    </button>
                  </div>
                )}
              </FormField>

              <FormField name='confirmPassword' label='Confirm Password'>
                {({ register, name }) => (
                  <div className='relative'>
                    <input
                      id={name}
                      type={showConfirmPassword ? 'text' : 'password'}
                      className='block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                      placeholder='Confirm new password'
                      {...register(name)}
                    />
                    <button
                      type='button'
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className='absolute inset-y-0 right-0 pr-3 flex items-center'
                    >
                      {showConfirmPassword ? (
                        <EyeOff className='h-4 w-4 text-gray-400' />
                      ) : (
                        <Eye className='h-4 w-4 text-gray-400' />
                      )}
                    </button>
                  </div>
                )}
              </FormField>
            </div>

            <div>
              <button
                type='submit'
                disabled={loading}
                className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

export default ResetPassword;
