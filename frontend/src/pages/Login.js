import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';

import api from '../api';
import Logo from '../components/Logo';
import Turnstile from '../components/Turnstile';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import googleAuth from '../utils/googleAuth';
import { isTurnstileEnabled, getTurnstileConfig } from '../utils/turnstileConfig';
import { formatDateForError } from '../utils/dateFormatting';

const Login = () => {
  // Set page title
  usePageTitle('Divemap - Login');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const { login: authLogin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Memoize Turnstile configuration to prevent infinite re-renders
  const turnstileConfig = useMemo(
    () => ({
      isEnabled: isTurnstileEnabled(),
      siteKey: getTurnstileConfig()?.siteKey,
    }),
    []
  );

  const handleGoogleSuccess = useCallback(
    async credential => {
      setGoogleLoading(true);
      try {
        const success = await loginWithGoogle(credential);
        if (success) {
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
          'google-signin-button',
          handleGoogleSuccess,
          handleGoogleError
        );
      } catch (error) {}
    };

    initializeGoogleSignIn();
  }, [handleGoogleSuccess, handleGoogleError]);

  const handleChange = e => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Only require Turnstile verification if it's enabled
    if (turnstileConfig.isEnabled && !turnstileToken) {
      setTurnstileError(true);
      toast.error('Please complete the verification');
      return;
    }

    setLoading(true);

    try {
      const { success, error } = await Promise.race([
        authLogin(formData.username, formData.password, turnstileToken),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Login timed out. Please try again.')), 10000)
        ),
      ]);
      if (success) {
        navigate('/');
      } else {
        // Check if error is due to unverified email
        if (error?.requiresEmailVerification) {
          toast.error(error.error || 'Please verify your email address before logging in.');
          // Show resend verification option
          setShowResendVerification(true);
        } else {
          toast.error(error?.error || error || 'Invalid username or password');
        }
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-6 sm:space-y-8'>
        <div>
          <div className='mx-auto flex items-center justify-center'>
            <Logo size='large' showText={false} />
          </div>
          <h2 className='mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900'>
            Sign in to your account
          </h2>
          <p className='mt-2 text-center text-sm text-gray-600'>
            Or{' '}
            <Link to='/register' className='font-medium text-blue-600 hover:text-blue-500'>
              create a new account
            </Link>
          </p>
        </div>

        <form className='mt-8 space-y-6' onSubmit={handleSubmit}>
          <div className='space-y-4'>
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-gray-700'>
                Username or Email
              </label>
              <div className='mt-1'>
                <input
                  id='username'
                  name='username'
                  type='text'
                  autoComplete='username'
                  required
                  className='appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'
                  placeholder='Enter your username or email'
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                Password
              </label>
              <div className='mt-1 relative'>
                <input
                  id='password'
                  name='password'
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className='block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                  placeholder='Enter your password'
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
                  Please complete the verification to continue
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {/* Resend Verification Email */}
          {showResendVerification && (
            <div className='mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md'>
              <p className='text-sm text-yellow-800 mb-2'>
                Your email address hasn't been verified yet. Check your inbox for the verification
                link.
              </p>
              <button
                type='button'
                onClick={async () => {
                  setResendingVerification(true);
                  try {
                    await api.post('/api/v1/auth/resend-verification', {
                      email: formData.username.includes('@') ? formData.username : null,
                    });
                    toast.success(
                      'If your email is not verified, a verification email has been sent.'
                    );
                    setShowResendVerification(false);
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
                      toast.success(
                        'If your email is not verified, a verification email has been sent.'
                      );
                    }
                  } finally {
                    setResendingVerification(false);
                  }
                }}
                disabled={resendingVerification || !formData.username.includes('@')}
                className='text-sm text-yellow-800 underline hover:text-yellow-900 disabled:opacity-50'
              >
                {resendingVerification ? 'Sending...' : 'Resend verification email'}
              </button>
              {!formData.username.includes('@') && (
                <p className='text-xs text-yellow-700 mt-2'>
                  Please enter your email address above to resend verification.
                </p>
              )}
            </div>
          )}

          {/* Google Sign-In Button */}
          {process.env.REACT_APP_GOOGLE_CLIENT_ID &&
            process.env.REACT_APP_GOOGLE_CLIENT_ID !== 'undefined' && (
              <div className='mt-4'>
                <div
                  id='google-signin-button'
                  className='w-full flex justify-center'
                  style={{ minHeight: '40px' }}
                ></div>
              </div>
            )}
        </form>
      </div>
    </div>
  );
};

export default Login;
