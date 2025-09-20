import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';

import Logo from '../components/Logo';
import Turnstile from '../components/Turnstile';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import googleAuth from '../utils/googleAuth';
import { isTurnstileEnabled, getTurnstileConfig } from '../utils/turnstileConfig';

const Register = () => {
  // Set page title
  usePageTitle('Divemap - Register');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileError, setTurnstileError] = useState(false);

  const { register: authRegister, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

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

  const validateForm = () => {
    const newErrors = {};

    if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters long';
    }

    if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Only require Turnstile verification if it's enabled
    if (turnstileConfig.isEnabled && !turnstileToken) {
      newErrors.turnstile = 'Please complete the verification';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = e => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const success = await authRegister(
        formData.username,
        formData.email,
        formData.password,
        turnstileToken
      );
      if (success) {
        toast.success(
          "Registration successful! Your account is pending admin approval. You'll be notified once approved."
        );
        navigate('/');
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
        <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-gray-700'>
                Username
              </label>
              <input
                id='username'
                name='username'
                type='text'
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.username ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='Enter your username'
                value={formData.username}
                onChange={handleChange}
              />
              {errors.username && <p className='mt-1 text-sm text-red-600'>{errors.username}</p>}
            </div>

            <div>
              <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
                Email
              </label>
              <input
                id='email'
                name='email'
                type='email'
                required
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='Enter your email'
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <p className='mt-1 text-sm text-red-600'>{errors.email}</p>}
            </div>

            <div>
              <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                Password
              </label>
              <div className='relative'>
                <input
                  id='password'
                  name='password'
                  type={showPassword ? 'text' : 'password'}
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter your password'
                  value={formData.password}
                  onChange={handleChange}
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
              {errors.password && <p className='mt-1 text-sm text-red-600'>{errors.password}</p>}
            </div>

            <div>
              <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700'>
                Confirm Password
              </label>
              <div className='relative'>
                <input
                  id='confirmPassword'
                  name='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Confirm your password'
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
                <p className='mt-1 text-sm text-red-600'>{errors.confirmPassword}</p>
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
              {errors.turnstile && (
                <p className='text-sm text-red-600 text-center'>{errors.turnstile}</p>
              )}
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
