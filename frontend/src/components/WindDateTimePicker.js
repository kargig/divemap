import { Clock } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

/**
 * WindDateTimePicker Component
 * Allows users to select a date and time for wind data (current time or up to +2 days ahead)
 */
const WindDateTimePicker = ({ value, onChange, disabled = false }) => {
  const [date, setDate] = useState('');
  const [hour, setHour] = useState(0);
  const [error, setError] = useState('');

  // Initialize from value prop (ISO string or null)
  useEffect(() => {
    if (value === null) {
      // "Now" - use current date/time
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setHour(now.getHours());
      setError('');
    } else if (value) {
      // Parse ISO string
      try {
        const dateObj = new Date(value);
        setDate(dateObj.toISOString().split('T')[0]);
        // Extract hour only
        setHour(dateObj.getHours());
        setError('');
      } catch (e) {
        setError('Invalid date format');
      }
    }
  }, [value]);

  // Calculate min/max dates
  const now = new Date();
  const minDate = new Date(now.getTime() - 60 * 60 * 1000); // -1 hour
  const maxDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days

  const minDateStr = minDate.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  // Get min/max hours based on selected date
  const getMinHour = () => {
    if (date === minDateStr) {
      // If selected date is min date (today - 1 hour), limit hour to 1 hour ago
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return oneHourAgo.getHours();
    }
    return 0;
  };

  const getMaxHour = () => {
    if (date === maxDateStr) {
      // If selected date is max date, limit hour to current hour
      return now.getHours();
    }
    return 23;
  };

  const handleDateChange = e => {
    const newDate = e.target.value;
    setDate(newDate);
    // Adjust hour if it's out of bounds for the new date
    const minH = getMinHour();
    const maxH = getMaxHour();
    const adjustedHour = Math.max(minH, Math.min(maxH, hour));
    setHour(adjustedHour);
    validateAndEmit(newDate, adjustedHour);
  };

  const handleHourChange = e => {
    const newHour = parseInt(e.target.value, 10);
    if (isNaN(newHour)) return;
    
    // Clamp hour to valid range
    const minH = getMinHour();
    const maxH = getMaxHour();
    const clampedHour = Math.max(minH, Math.min(maxH, newHour));
    setHour(clampedHour);
    validateAndEmit(date, clampedHour);
  };

  const validateAndEmit = (dateVal, hourVal) => {
    if (!dateVal || hourVal === undefined || hourVal === null) {
      setError('');
      return;
    }

    try {
      const hourStr = hourVal.toString().padStart(2, '0');
      const selectedDateTime = new Date(`${dateVal}T${hourStr}:00:00`);
      const now = new Date();
      const maxFuture = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const minPast = new Date(now.getTime() - 60 * 60 * 1000);

      if (selectedDateTime > maxFuture) {
        setError('Cannot be more than 2 days ahead');
        return;
      }

      if (selectedDateTime < minPast) {
        setError('Cannot be more than 1 hour in the past');
        return;
      }

      setError('');
      // Emit ISO string without timezone (backend expects local time)
      const hourStrPadded = hourVal.toString().padStart(2, '0');
      const isoString = `${dateVal}T${hourStrPadded}:00:00`;
      onChange(isoString);
    } catch (e) {
      setError('Invalid date/time');
    }
  };

  const handleNowClick = () => {
    onChange(null); // null means "now"
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Clock className='w-4 h-4 text-gray-600' />
        <label className='text-xs font-medium text-gray-700'>Wind Data Time</label>
      </div>
      <div className='flex gap-2 items-center'>
        <input
          type='date'
          value={date}
          onChange={handleDateChange}
          min={minDateStr}
          max={maxDateStr}
          disabled={disabled}
          className='px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed'
        />
        <select
          value={hour}
          onChange={handleHourChange}
          disabled={disabled || !date}
          className='px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed'
        >
          {Array.from({ length: 24 }, (_, i) => {
            const h = i;
            const minH = getMinHour();
            const maxH = getMaxHour();
            // Only show hours within valid range for selected date
            if (h < minH || h > maxH) return null;
            return (
              <option key={h} value={h}>
                {h.toString().padStart(2, '0')}:00
              </option>
            );
          }).filter(Boolean)}
        </select>
        <button
          type='button'
          onClick={handleNowClick}
          disabled={disabled}
          className='px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors'
          title='Use current time'
        >
          Now
        </button>
      </div>
      {error && <div className='text-xs text-red-600'>{error}</div>}
    </div>
  );
};

WindDateTimePicker.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date), PropTypes.oneOf([null])]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

WindDateTimePicker.defaultProps = {
  value: null,
  disabled: false,
};

export default WindDateTimePicker;

