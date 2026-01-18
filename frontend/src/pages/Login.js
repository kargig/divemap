import { Eye, EyeOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { z } from 'zod';

import api, { healthCheck } from '../api';
import { FormField } from '../components/forms/FormField';
import Logo from '../components/Logo';
import Turnstile from '../components/Turnstile';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { formatDateForError } from '../utils/dateFormatting';
import { createResolver } from '../utils/formHelpers';
import googleAuth from '../utils/googleAuth';
import { isTurnstileEnabled, getTurnstileConfig } from '../utils/turnstileConfig';

// Zod schema for login form
const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

// Validate redirect URL to prevent open redirects
const getSafeRedirect = path => {
  if (!path) return '/';
  // If path is an object (location object), extract pathname
  const redirectPath = typeof path === 'object' ? path.pathname : String(path);

  // Check if path is relative (starts with / and not //)
  if (redirectPath.startsWith('/') && !redirectPath.startsWith('//')) {
    return redirectPath;
  }
  return '/';
};

const Login = () => {
  // Set page title
  usePageTitle('Divemap - Login');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [isBackendReady, setIsBackendReady] = useState(false);

  const { login: authLogin, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || location.state?.from || '/';

  const methods = useForm({
    resolver: createResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = methods;

  // Watch username for resend verification logic
  const username = watch('username');

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
          navigate(getSafeRedirect(from), { replace: true });
        }
      } catch (error) {
      } finally {
        setGoogleLoading(false);
      }
    },
    [loginWithGoogle, navigate, from]
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
    // Warm up the backend and wait for it to be ready
    let mounted = true;
    const waitForBackend = async () => {
      // Try up to 10 times (approx 30-60s depending on timeouts)
      for (let i = 0; i < 10; i++) {
        const result = await healthCheck();
        if (!mounted) return;
        if (result) {
          setIsBackendReady(true);
          return;
        }
        // Wait 1s before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!mounted) return;
      }
      // Failsafe: enable buttons anyway if backend is stubbornly unreachable
      // so user can at least try and get a proper error message
      if (mounted) setIsBackendReady(true);
    };

    waitForBackend();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Initialize Google Sign-In button only if client ID is configured
    const initializeGoogleSignIn = async () => {
      if (
        !import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        import.meta.env.VITE_GOOGLE_CLIENT_ID === 'undefined'
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

  const onSubmit = async data => {
    // Only require Turnstile verification if it's enabled
    if (turnstileConfig.isEnabled && !turnstileToken) {
      setTurnstileError(true);
      toast.error('Please complete the verification');
      return;
    }

    setLoading(true);

    try {
      const { success, error } = await Promise.race([
        authLogin(data.username, data.password, turnstileToken),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Login timed out. Please try again.')), 10000)
        ),
      ]);
      if (success) {
        navigate(getSafeRedirect(from), { replace: true });
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

        <FormProvider {...methods}>
          <form className='mt-8 space-y-6' onSubmit={handleSubmit(onSubmit)}>
            <div className='space-y-4'>
              <FormField name='username' label='Username or Email'>
                {({ register, name }) => (
                  <input
                    id={name}
                    type='text'
                    autoComplete='username'
                    className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      errors.username ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='Enter your username or email'
                    {...register(name)}
                  />
                )}
              </FormField>

              <FormField name='password' label='Password'>
                {({ register, name }) => (
                  <div className='relative'>
                    <input
                      id={name}
                      type={showPassword ? 'text' : 'password'}
                      className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='Enter your password'
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
                disabled={loading || !isBackendReady}
                className='group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading
                  ? 'Signing in...'
                  : !isBackendReady
                    ? 'Connecting to server...'
                    : 'Sign in'}
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
                        email: username.includes('@') ? username : null,
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
                        toast.success(
                          'If your email is not verified, a verification email has been sent.'
                        );
                      }
                    } finally {
                      setResendingVerification(false);
                    }
                  }}
                  disabled={resendingVerification || !username.includes('@')}
                  className='text-sm text-yellow-800 underline hover:text-yellow-900 disabled:opacity-50'
                >
                  {resendingVerification ? 'Sending...' : 'Resend verification email'}
                </button>
                {!username.includes('@') && (
                  <p className='text-xs text-yellow-700 mt-2'>
                    Please enter your email address above to resend verification.
                  </p>
                )}
              </div>
            )}

            {/* Google Sign-In Button */}
            {import.meta.env.VITE_GOOGLE_CLIENT_ID &&
              import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'undefined' && (
                <div
                  className={`mt-4 transition-opacity duration-200 ${
                    !isBackendReady ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div
                    id='google-signin-button'
                    className='w-full flex justify-center'
                    style={{ minHeight: '40px' }}
                  ></div>
                </div>
              )}
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

export default Login;
