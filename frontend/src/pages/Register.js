import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';

import Logo from '../components/Logo';
import Turnstile from '../components/Turnstile';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { commonSchemas, createResolver, getErrorMessage } from '../utils/formHelpers';
import googleAuth from '../utils/googleAuth';
import { isTurnstileEnabled, getTurnstileConfig } from '../utils/turnstileConfig';

// Zod schema for registration form with password matching
const registerSchema = z
  .object({
    username: commonSchemas.username,
    email: commonSchemas.email,
    password: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const Register = () => {
  // Set page title
  usePageTitle('Divemap - Register');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileError, setTurnstileError] = useState(false);

  const { register: authRegister, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: createResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Watch email for navigation after registration
  const email = watch('email');

  // Memoize Turnstile configuration to prevent infinite re-renders
  const turnstileConfig = useMemo(() => {
    const config = getTurnstileConfig();
    return {
      isEnabled: config.isEnabled,
      siteKey: config.siteKey,
    };
  }, []);

  const handleGoogleSuccess = useCallback(
    async credential => {
      setGoogleLoading(true);
      try {
        const success = await loginWithGoogle(credential);
        if (success) {
          toast.success(
            'Google registration successful! Your account is now active and ready to use.'
          );
          navigate('/');
        }
      } catch (error) {
      } finally {
        setGoogleLoading(false);
      }
    },
    [loginWithGoogle, navigate]
  );

  const handleGoogleError = useCallback(_error => {
    toast.error('Google Sign-In failed. Please try again.');
    setGoogleLoading(false);
  }, []);

  const handleTurnstileVerify = token => {
    setTurnstileToken(token);
    setTurnstileError(false);
    // Update form value for validation (though Turnstile is handled separately)
    setValue('turnstile_token', token, { shouldValidate: false });
  };

  const handleTurnstileExpire = () => {
    setTurnstileToken(null);
  };

  const handleTurnstileError = () => {
    setTurnstileToken(null);
    setTurnstileError(true);
  };

  useEffect(() => {
    // Initialize Google Sign-In button only if client ID is configured
    const initializeGoogleSignIn = async () => {
      if (
        !process.env.REACT_APP_GOOGLE_CLIENT_ID ||
        process.env.REACT_APP_GOOGLE_CLIENT_ID === 'undefined'
      ) {
        return;
      }

      try {
        await googleAuth.initializeSignInButton(
          'google-signup-button',
          handleGoogleSuccess,
          handleGoogleError
        );
      } catch (error) {}
    };

    initializeGoogleSignIn();
  }, [handleGoogleSuccess, handleGoogleError]);

  const onSubmit = async data => {
    // Only require Turnstile verification if it's enabled
    if (turnstileConfig.isEnabled && !turnstileToken) {
      setTurnstileError(true);
      toast.error('Please complete the verification');
      return;
    }

    setLoading(true);

    try {
      const success = await authRegister(data.username, data.email, data.password, turnstileToken);
      if (success) {
        // Check if user was logged in by checking auth context user state
        // If user object exists, they were logged in (email verification not required)
        // If no user object, email verification is required
        setTimeout(() => {
          if (user) {
            // User is logged in (email verification not required) - go to home
            navigate('/');
          } else {
            // Email verification required - redirect to check email page with email
            navigate('/check-email', { state: { email: data.email } });
          }
        }, 200); // Small delay to allow auth context to update
      }
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
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
            Create your account
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Or{' '}
            <Link to='/login' className='font-medium text-blue-600 hover:text-blue-500'>
              sign in to your existing account
            </Link>
          </p>
        </div>
        <form className='mt-8 space-y-6' onSubmit={handleSubmit(onSubmit)}>
          <div className='space-y-4'>
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-gray-700'>
                Username
              </label>
              <input
                id='username'
                type='text'
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.username ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='Enter your username'
                {...register('username')}
              />
              {errors.username && (
                <p className='mt-1 text-sm text-red-600'>{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
                Email
              </label>
              <input
                id='email'
                type='email'
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='Enter your email'
                {...register('email')}
              />
              {errors.email && <p className='mt-1 text-sm text-red-600'>{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                Password
              </label>
              <div className='relative'>
                <input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 pr-10 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter your password'
                  {...register('password')}
                />
                <button
                  type='button'
                  className='absolute inset-y-0 right-0 pr-3 flex items-center'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className='h-5 w-5 text-gray-400' />
                  ) : (
                    <Eye className='h-5 w-5 text-gray-400' />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className='mt-1 text-sm text-red-600'>{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700'>
                Confirm Password
              </label>
              <div className='relative'>
                <input
                  id='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 pr-10 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Confirm your password'
                  {...register('confirmPassword')}
                />
                <button
                  type='button'
                  className='absolute inset-y-0 right-0 pr-3 flex items-center'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className='h-5 w-5 text-gray-400' />
                  ) : (
                    <Eye className='h-5 w-5 text-gray-400' />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className='mt-1 text-sm text-red-600'>{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          {/* Turnstile Widget */}
          {turnstileConfig.isEnabled && turnstileConfig.siteKey && (
            <div className='space-y-2'>
              <Turnstile
                siteKey={turnstileConfig.siteKey}
                onVerify={handleTurnstileVerify}
                onExpire={handleTurnstileExpire}
                onError={handleTurnstileError}
                theme='light'
                size='normal'
                className='flex justify-center'
              />
              {turnstileError && (
                <p className='text-sm text-red-600 text-center'>
                  Verification failed. Please try again.
                </p>
              )}
            </div>
          )}

          <div>
            <button
              type='submit'
              disabled={loading}
              className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          {process.env.REACT_APP_GOOGLE_CLIENT_ID &&
            process.env.REACT_APP_GOOGLE_CLIENT_ID !== 'undefined' && (
              <>
                <div className='relative'>
                  <div className='absolute inset-0 flex items-center'>
                    <div className='w-full border-t border-gray-300' />
                  </div>
                  <div className='relative flex justify-center text-sm'>
                    <span className='px-2 bg-gray-50 text-gray-500'>Or continue with</span>
                  </div>
                </div>

                <div>
                  <div id='google-signup-button' className='w-full flex justify-center'></div>
                  {googleLoading && (
                    <div className='mt-2 text-center text-sm text-gray-600'>
                      Creating account with Google... (Account will be immediately active)
                    </div>
                  )}
                </div>
              </>
            )}

          <div className='bg-blue-50 border border-blue-200 rounded-md p-4'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg className='h-5 w-5 text-blue-400' viewBox='0 0 20 20' fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h3 className='text-sm font-medium text-blue-800'>Account Activation</h3>
                <div className='mt-2 text-sm text-blue-700'>
                  <p className='mb-2'>
                    <strong>Google Sign-In:</strong> Your account will be automatically activated
                    and ready to use immediately.
                  </p>
                  <p>
                    <strong>Username/Password:</strong> New accounts require admin approval before
                    you can access all features. You&apos;ll be notified once your account is
                    approved.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='text-center'>
            <p className='text-sm text-gray-600'>
              Already have an account?{' '}
              <Link to='/login' className='font-medium text-blue-600 hover:text-blue-500'>
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
