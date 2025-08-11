import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

const RateLimitError = ({ retryAfter = 30, onRetry, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState(retryAfter);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanRetry(true);
    }
  }, [timeRemaining]);

  const handleRetry = () => {
    if (canRetry && onRetry) {
      onRetry();
    }
  };

  const formatTime = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-orange-50 border border-orange-200 rounded-lg p-6 ${className}`}>
      <div className='flex items-start'>
        <div className='flex-shrink-0'>
          <AlertTriangle className='h-6 w-6 text-orange-600' />
        </div>
        <div className='ml-3 flex-1'>
          <h3 className='text-lg font-medium text-orange-800 mb-2'>Rate Limiting in Effect</h3>
          <p className='text-orange-700 mb-4'>
            You&apos;ve made too many requests too quickly. Please wait before trying again.
          </p>

          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <Clock className='h-5 w-5 text-orange-600' />
              <span className='text-orange-700 font-medium'>
                {canRetry ? 'Ready to retry' : `Wait ${formatTime(timeRemaining)}`}
              </span>
            </div>

            {canRetry && onRetry && (
              <button
                onClick={handleRetry}
                className='inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors'
              >
                <RefreshCw className='h-4 w-4 mr-2' />
                Try Again
              </button>
            )}
          </div>

          <div className='mt-4 text-sm text-orange-600'>
            💡 Tip: This helps protect our servers and ensure fair access for all users.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitError;
