# Frontend Rate Limiting Error Handling

This document provides comprehensive documentation for the frontend rate limiting error handling implementation in the Divemap application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Details](#implementation-details)
4. [Components](#components)
5. [Usage Examples](#usage-examples)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Related Documentation](#related-documentation)

## Overview

The frontend implements comprehensive error handling for rate limiting responses (HTTP 429) to provide a better user experience when API rate limits are exceeded. This system automatically detects rate limiting errors, provides immediate feedback to users, and offers clear guidance on when to retry their requests.

### Key Features

- **Automatic Detection**: API interceptor automatically detects 429 responses
- **User-Friendly Display**: RateLimitError component with countdown timer and retry functionality
- **Immediate Feedback**: Toast notifications for instant user awareness
- **Consistent Experience**: Same error handling across all components
- **Retry Functionality**: Automatic retry button after countdown expires
- **Visual Indicators**: Warning icons, clock icons, and clear messaging

## Architecture

### Error Handling Flow

```
1. API Call Fails → 429 response received
2. API Interceptor → Marks error as rate-limited, extracts retry-after time
3. Component useEffect → Detects rate-limited error, shows toast notification
4. UI Rendering → Shows RateLimitError component with countdown
5. User Experience → Clear message, countdown timer, retry option after timeout
```

### Component Hierarchy

```
API Response (429) → API Interceptor → Error Object → Component useEffect → Toast + RateLimitError Component
```

## Implementation Details

### 1. API Interceptor Enhancement

**File**: `frontend/src/api.js`

The API interceptor automatically detects 429 responses and enhances error objects with rate limiting information.

```javascript
// Response interceptor to handle errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 429) {
      // Rate limiting - extract retry after information if available
      const retryAfter = error.response.headers['retry-after'] || 
                        error.response.data?.retry_after || 30;
      error.retryAfter = retryAfter;
      error.isRateLimited = true;
    }
    return Promise.reject(error);
  }
);
```

**Features**:
- Automatically detects 429 status codes
- Extracts retry-after time from headers or response data
- Sets `error.isRateLimited = true` for consistent handling
- Sets `error.retryAfter` with the wait time in seconds

### 2. RateLimitError Component

**File**: `frontend/src/components/RateLimitError.js`

A reusable React component that displays rate limiting errors with a countdown timer and retry functionality.

```javascript
import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

const RateLimitError = ({ retryAfter = 30, onRetry, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState(retryAfter);
  const [canRetry, setCanRetry] = useState(false);

  // Countdown timer implementation
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

  // Component rendering with visual indicators
  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}>
      {/* Component content with icons, countdown, and retry button */}
    </div>
  );
};
```

**Features**:
- Countdown timer showing remaining wait time
- Retry button that appears after countdown expires
- Visual indicators (warning icon, clock icon, refresh icon)
- Responsive design with Tailwind CSS
- Customizable styling via className prop
- Optional retry callback function

### 3. Rate Limit Handler Utility

**File**: `frontend/src/utils/rateLimitHandler.js`

A centralized utility function for handling rate limiting errors consistently across the application.

```javascript
import { toast } from 'react-hot-toast';

export const handleRateLimitError = (error, context = 'data', onRetry = null) => {
  if (error?.isRateLimited) {
    const retryAfter = error.retryAfter || 30;
    
    // Show toast notification
    toast.error(
      `Rate limiting in effect for ${context}. Please wait ${retryAfter} seconds before trying again.`,
      {
        duration: 5000,
        position: 'top-center',
        id: `rate-limit-${context}`, // Prevent duplicate toasts
      }
    );
    
    // Execute retry callback if provided
    if (onRetry && typeof onRetry === 'function') {
      onRetry();
    }
  }
};
```

**Features**:
- Centralized error handling logic
- Toast notifications with consistent messaging
- Context-aware error messages
- Optional retry callback execution
- Duplicate toast prevention

## Components

### Integration in DiveSites.js

**File**: `frontend/src/pages/DiveSites.js`

Full integration of rate limiting error handling for dive sites API calls.

```javascript
import RateLimitError from '../components/RateLimitError';
import { handleRateLimitError } from '../utils/rateLimitHandler';

const DiveSites = () => {
  // ... existing component code ...

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive sites', () => window.location.reload());
  }, [error]);

  useEffect(() => {
    handleRateLimitError(totalCountResponse?.error, 'dive sites count', () =>
      window.location.reload()
    );
  }, [totalCountResponse?.error]);

  // Error handling in render
  if (error) {
    return (
      <div className='py-6'>
        {error.isRateLimited ? (
          <RateLimitError
            retryAfter={error.retryAfter}
            onRetry={() => {
              // Refetch the query when user clicks retry
              window.location.reload();
            }}
          />
        ) : (
          <div className='text-center py-12'>
            <p className='text-red-600'>Error loading dive sites. Please try again.</p>
            <p className='text-sm text-gray-500 mt-2'>
              {error.response?.data?.detail || error.message || 'An unexpected error occurred'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ... rest of component
};
```

### Integration in DiveTrips.js

**File**: `frontend/src/pages/DiveTrips.js`

Similar integration for dive trips API calls with consistent error handling.

## Usage Examples

### Basic Component Usage

```javascript
import RateLimitError from '../components/RateLimitError';

// In your component
if (error?.isRateLimited) {
  return (
    <RateLimitError
      retryAfter={error.retryAfter}
      onRetry={() => {
        // Your retry logic here
        refetch();
      }}
    />
  );
}
```

### Using the Utility Function

```javascript
import { handleRateLimitError } from '../utils/rateLimitHandler';

// In useEffect
useEffect(() => {
  handleRateLimitError(error, 'your context', () => {
    // Optional retry callback
    console.log('Rate limit exceeded, retrying...');
  });
}, [error]);
```

### Custom Styling

```javascript
<RateLimitError
  retryAfter={30}
  onRetry={handleRetry}
  className="my-custom-class bg-blue-50 border-blue-200"
/>
```

## Testing

### ESLint Validation

```bash
# Check frontend container logs for ESLint errors
docker logs divemap_frontend --tail 20

# Run ESLint on rate limiting error handling files
docker exec divemap_frontend npm run lint -- src/components/RateLimitError.js
docker exec divemap_frontend npm run lint -- src/pages/DiveSites.js
docker exec divemap_frontend npm run lint -- src/utils/rateLimitHandler.js
```

### Manual Testing

1. **Navigate to `/dive-sites`** - Verify component loads without errors
2. **Trigger rate limiting** (if possible) by making many rapid requests
3. **Verify error handling** shows RateLimitError component instead of generic error message
4. **Check toast notifications** appear when rate limiting occurs
5. **Test countdown timer** functionality
6. **Verify retry button** appears after countdown expires

### Testing Checklist

- [ ] ESLint validation passes for all rate limiting files
- [ ] RateLimitError component renders correctly
- [ ] Countdown timer works as expected
- [ ] Retry button appears after countdown
- [ ] Toast notifications display properly
- [ ] Error handling works in both DiveSites and DiveTrips components
- [ ] No console errors in browser developer tools

## Troubleshooting

### Common Issues

#### 1. ESLint Errors

**Problem**: ESLint validation fails for rate limiting files
**Solution**: 
- Check for proper import order
- Ensure no trailing whitespace
- Verify proper React hooks usage
- Run `npm run lint:fix` to auto-fix issues

#### 2. Component Not Rendering

**Problem**: RateLimitError component doesn't display
**Solution**:
- Verify error object has `isRateLimited: true`
- Check that `error.retryAfter` is set
- Ensure component is properly imported
- Check browser console for JavaScript errors

#### 3. Toast Notifications Not Showing

**Problem**: Toast notifications don't appear for rate limiting errors
**Solution**:
- Verify `react-hot-toast` is properly imported
- Check that `handleRateLimitError` is called
- Ensure error object has correct structure
- Verify toast configuration in component

#### 4. Countdown Timer Issues

**Problem**: Countdown timer doesn't work correctly
**Solution**:
- Check `retryAfter` prop value
- Verify useEffect dependencies
- Ensure timer cleanup is working
- Check for state update issues

### Debug Steps

1. **Check Browser Console**: Look for JavaScript errors
2. **Verify API Response**: Ensure 429 responses include proper headers
3. **Check Component Props**: Verify RateLimitError receives correct props
4. **Test Utility Function**: Verify `handleRateLimitError` works independently
5. **Check ESLint Output**: Ensure no linting errors prevent compilation

## Related Documentation

- **[Development README](./README.md)** - Overall development setup and workflow
- **[API Documentation](./api.md)** - Backend rate limiting implementation
- **[Testing Documentation](./testing.md)** - Frontend testing procedures
- **[Architecture Documentation](./architecture.md)** - System design and components

## File Structure

```
frontend/src/
├── api.js                           # API interceptor with 429 handling
├── components/
│   └── RateLimitError.js           # Rate limiting error component
├── utils/
│   └── rateLimitHandler.js         # Rate limiting error utility
└── pages/
    ├── DiveSites.js                # Component with rate limiting error handling
    └── DiveTrips.js                # Component with rate limiting error handling
```

## Summary

The frontend rate limiting error handling system provides a comprehensive solution for managing API rate limiting responses. It automatically detects rate limiting errors, provides immediate user feedback through toast notifications, and displays user-friendly error components with countdown timers and retry functionality.

This implementation ensures a consistent and professional user experience across all components while maintaining clean, maintainable code through centralized error handling utilities.
