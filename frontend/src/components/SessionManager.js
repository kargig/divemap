import { useEffect, useState } from 'react';

import { healthCheck } from '../api';
import { useAuth } from '../contexts/AuthContext';

export const SessionManager = () => {
  const { user, token } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Keep backend warm to prevent Fly.io cold starts
  useEffect(() => {
    if (!user) {
      return;
    }

    // Ping health endpoint every 4 minutes to keep backend alive
    // Fly.io auto_stop_machines = 'stop' shuts down after inactivity
    // Health checks run every 4 seconds, so 4 minutes is safe
    const keepAliveInterval = window.setInterval(
      () => {
        healthCheck().catch(() => {
          // Silently fail - this is just a keepalive
        });
      },
      4 * 60 * 1000
    ); // 4 minutes

    // Also ping immediately when user logs in
    healthCheck().catch(() => {
      // Silently fail
    });

    return () => {
      window.clearInterval(keepAliveInterval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !token) return;

    const checkSessionStatus = () => {
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = tokenData.exp * 1000;
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;

        // Show warning 5 minutes before expiry
        if (timeUntilExpiry <= 300000 && timeUntilExpiry > 0) {
          setShowWarning(true);
          setTimeLeft(Math.ceil(timeUntilExpiry / 1000));
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    };

    const interval = window.setInterval(checkSessionStatus, 1000);
    checkSessionStatus();

    return () => window.clearInterval(interval);
  }, [user, token]);

  if (!showWarning) return null;

  return (
    <div className='fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded shadow-lg z-50'>
      <div className='flex items-center'>
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
          <p className='text-sm font-medium'>Your session will expire in {timeLeft} seconds</p>
          <p className='text-sm mt-1'>
            Please save your work. Your session will be automatically renewed if you're active.
          </p>
        </div>
        <div className='ml-auto pl-3'>
          <button
            onClick={() => setShowWarning(false)}
            className='text-yellow-400 hover:text-yellow-600'
          >
            <span className='sr-only'>Dismiss</span>
            <svg className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
