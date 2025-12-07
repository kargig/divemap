import { Play, Pause, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactSlider from 'react-slider';

/**
 * WindDateTimePicker Component
 * Clean, floating slider-based date/time picker for wind data
 * Features:
 * - Floating on top of map without interfering with map interaction
 * - Play/pause animation (3-hour increments, waits for data to load)
 * - Manual slider control within 2 days bounds
 * - Clean, minimal design
 * - Single timezone display (user's browser time)
 * - Close button to hide the slider
 */
const WindDateTimePicker = ({
  value = null,
  onChange,
  disabled = false,
  isFetchingWind = false,
  onClose = null,
  onPrefetch = null,
}) => {
  const [sliderValue, setSliderValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const lastAdvanceTimeRef = useRef(null);
  const isWaitingForDataRef = useRef(false);

  // Calculate time range: -1 hour to +2 days (total 49 hours)
  const now = new Date();
  const minTime = new Date(now.getTime() - 60 * 60 * 1000); // -1 hour
  const maxTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days
  const totalHours = Math.floor((maxTime - minTime) / (60 * 60 * 1000)); // Total hours in range

  // Get timezone info (user's browser time)
  const timezoneOffset = -now.getTimezoneOffset() / 60; // Offset in hours
  const timezoneLabel = `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;

  // Convert slider value (0 to totalHours) to datetime
  const sliderToDateTime = useCallback(
    hours => {
      const targetTime = new Date(minTime.getTime() + hours * 60 * 60 * 1000);
      // Round to nearest hour
      targetTime.setMinutes(0, 0, 0);
      return targetTime;
    },
    [minTime]
  );

  // Convert datetime to slider value (hours from minTime)
  const dateTimeToSlider = useCallback(
    dateTime => {
      if (!dateTime) {
        // "Now" - use current time
        const currentTime = new Date();
        const hoursFromMin = (currentTime - minTime) / (60 * 60 * 1000);
        return Math.min(totalHours, Math.max(0, Math.round(hoursFromMin)));
      }
      const dateObj = new Date(dateTime);
      const hoursFromMin = (dateObj - minTime) / (60 * 60 * 1000);
      return Math.min(totalHours, Math.max(0, Math.round(hoursFromMin)));
    },
    [minTime, totalHours]
  );

  // Initialize slider value from prop
  useEffect(() => {
    const newSliderValue = dateTimeToSlider(value);
    setSliderValue(newSliderValue);
  }, [value, dateTimeToSlider]);

  // Handle slider change
  const handleSliderChange = value => {
    setSliderValue(value);
    const targetDateTime = sliderToDateTime(value);
    const isoString = `${targetDateTime.getFullYear()}-${String(targetDateTime.getMonth() + 1).padStart(2, '0')}-${String(targetDateTime.getDate()).padStart(2, '0')}T${String(targetDateTime.getHours()).padStart(2, '0')}:00:00`;
    console.log(
      '[WindDateTimePicker] Slider changed, calling onChange with:',
      isoString,
      'from slider value:',
      value
    );
    onChange(isoString);
  };

  // Track when data fetching starts - mark that we're waiting
  useEffect(() => {
    if (isFetchingWind && isPlaying) {
      isWaitingForDataRef.current = true;
    }
  }, [isFetchingWind, isPlaying]);

  // Track when data fetching completes - clear waiting flag when data is loaded
  // This allows the interval to advance (after 3 second minimum pause)
  useEffect(() => {
    if (!isFetchingWind && isWaitingForDataRef.current && isPlaying) {
      // Data finished loading, clear the waiting flag
      // The interval will check if 3 seconds have also passed
      isWaitingForDataRef.current = false;
    }
  }, [isFetchingWind, isPlaying]);

  // Play/pause functionality - advances by 3 hours, waits for data to load + minimum 3 second pause
  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
      isWaitingForDataRef.current = false;
      lastAdvanceTimeRef.current = null;
    } else {
      // Play - advance by 3 hours, but wait for:
      // 1. Data to finish loading (if it was fetching)
      // 2. Minimum 3 seconds since last advance
      // Advance happens at the maximum of these two conditions (whichever comes later)
      setIsPlaying(true);

      // OPTIMIZATION: Prefetch immediately when play is pressed
      // This ensures upcoming hours are already in cache before slider advances
      if (onPrefetch && value) {
        onPrefetch(value);
      }

      // Initialize timestamp if starting fresh
      if (!lastAdvanceTimeRef.current) {
        lastAdvanceTimeRef.current = Date.now();
      }

      // If data is currently being fetched, mark that we're waiting
      if (isFetchingWind) {
        isWaitingForDataRef.current = true;
      }

      // Start checking interval - advances when both conditions are met
      playIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLastAdvance = lastAdvanceTimeRef.current
          ? now - lastAdvanceTimeRef.current
          : 0;
        const minPauseElapsed = timeSinceLastAdvance >= 3000; // 3 seconds minimum
        const dataNotFetching = !isFetchingWind;
        const notWaitingForData = !isWaitingForDataRef.current;

        // Only advance if:
        // 1. Data is not currently being fetched (finished loading)
        // 2. We're not waiting for data to finish loading
        // 3. At least 3 seconds have passed since last advance
        // This means we advance at max(3 seconds, data fetch time) - whichever is later
        if (dataNotFetching && notWaitingForData && minPauseElapsed) {
          setSliderValue(prev => {
            const newValue = Math.min(totalHours, prev + 3); // 3-hour increments
            if (newValue >= totalHours) {
              // Reached end, stop
              setIsPlaying(false);
              isWaitingForDataRef.current = false;
              if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
                playIntervalRef.current = null;
              }
              return totalHours;
            }

            // Update timestamp for next advance (record when we advanced)
            // This starts the 3-second minimum timer
            lastAdvanceTimeRef.current = now;

            // Update to new datetime - this will trigger a fetch
            const targetDateTime = sliderToDateTime(newValue);
            const isoString = `${targetDateTime.getFullYear()}-${String(targetDateTime.getMonth() + 1).padStart(2, '0')}-${String(targetDateTime.getDate()).padStart(2, '0')}T${String(targetDateTime.getHours()).padStart(2, '0')}:00:00`;

            // Mark that we're waiting for data BEFORE triggering the fetch
            // This ensures we wait for the fetch to complete
            isWaitingForDataRef.current = true;

            // Trigger the fetch - isFetchingWind will become true shortly
            onChange(isoString);

            return newValue;
          });
        }
        // If fetching, waiting for data, or not enough time passed, wait
      }, 200); // Check every 200ms for responsive updates
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Handle "Now" button
  const handleNowClick = () => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
    isWaitingForDataRef.current = false;
    lastAdvanceTimeRef.current = null;
    onChange(null); // null means "now"
  };

  // Get current datetime from slider
  const getCurrentDateTime = () => {
    return sliderToDateTime(sliderValue);
  };

  // Format date for display
  const formatDateLabel = date => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.getDate()}`;
  };

  // Get date labels for timeline (one per day)
  const getDateLabels = () => {
    const labels = [];
    const currentDate = new Date(minTime);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= maxTime) {
      labels.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return labels;
  };

  const dateLabels = getDateLabels();
  const currentDateTime = getCurrentDateTime();
  const isNow = value === null;

  // Calculate position of day boundary (midnight) on slider (0 to totalHours)
  const getDayBoundaryPosition = date => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const hoursFromMin = (dayStart - minTime) / (60 * 60 * 1000);
    return Math.max(0, Math.min(totalHours, hoursFromMin));
  };

  // Calculate position of each date label on slider (0 to totalHours)
  // Position labels at the center of each day's range, not at the day boundary
  const getDateLabelPosition = date => {
    // Get start of day (midnight)
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    // Get end of day (next midnight, or maxTime if it's the last day)
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayEndTime = dayEnd > maxTime ? maxTime : dayEnd;

    // Calculate center of day range
    const dayCenter = new Date((dayStart.getTime() + dayEndTime.getTime()) / 2);

    const hoursFromMin = (dayCenter - minTime) / (60 * 60 * 1000);
    return Math.max(0, Math.min(totalHours, hoursFromMin));
  };

  return (
    <div
      className='absolute top-4 left-1/2 transform -translate-x-1/2 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-4 py-2'
      style={{
        pointerEvents: 'auto', // Allow interaction with slider
        minWidth: '600px',
        maxWidth: '95vw',
      }}
      onMouseDown={e => e.stopPropagation()} // Prevent map panning when interacting with slider
      onTouchStart={e => e.stopPropagation()} // Prevent map panning on touch
    >
      <div className='flex flex-col gap-2'>
        {/* Header with play/pause, now button, and close button */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={handlePlayPause}
              disabled={disabled}
              className='flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors'
              title={isPlaying ? 'Pause' : 'Play (3-hour increments)'}
            >
              {isPlaying ? (
                <Pause className='w-3.5 h-3.5' />
              ) : (
                <Play className='w-3.5 h-3.5 ml-0.5' />
              )}
            </button>
            <button
              type='button'
              onClick={handleNowClick}
              disabled={disabled}
              className='px-2.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors'
              title='Use current time'
            >
              Now
            </button>
          </div>

          {/* Current date/time display and close button */}
          <div className='flex items-center gap-2'>
            <div className='text-[10px] text-gray-700 font-medium'>
              {isNow
                ? 'Now'
                : `${formatDateLabel(currentDateTime)} ${String(currentDateTime.getHours()).padStart(2, '0')}:00`}
              <span className='text-gray-500 ml-1'>{timezoneLabel}</span>
            </div>
            {onClose && (
              <button
                type='button'
                onClick={onClose}
                className='flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors'
                title='Hide slider'
                aria-label='Hide slider'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            )}
          </div>
        </div>

        {/* Slider Container */}
        <div className='relative pb-1'>
          {/* Day boundary lines and date labels */}
          <div className='relative h-6 mb-1'>
            {/* Day boundary vertical lines - full height (at midnight boundaries) */}
            {dateLabels.map((date, idx) => {
              const position = getDayBoundaryPosition(date);
              const percent = (position / totalHours) * 100;
              return (
                <div
                  key={`line-${idx}`}
                  className='absolute top-0 bottom-0 w-px bg-gray-300 z-0'
                  style={{ left: `${percent}%` }}
                />
              );
            })}

            {/* Date labels - positioned with smart spacing to prevent overlap */}
            {dateLabels.map((date, idx) => {
              const position = getDateLabelPosition(date);
              const percent = (position / totalHours) * 100;

              // Calculate spacing from neighbors
              const prevPercent =
                idx > 0 ? (getDateLabelPosition(dateLabels[idx - 1]) / totalHours) * 100 : -20;
              const nextPercent =
                idx < dateLabels.length - 1
                  ? (getDateLabelPosition(dateLabels[idx + 1]) / totalHours) * 100
                  : 120;

              // Minimum spacing: 12% to prevent overlap (accounts for label width ~40px on 400px slider = 10%)
              const minSpacing = 12;
              let adjustedPercent = percent;

              // Adjust if too close to previous label
              if (idx > 0 && percent - prevPercent < minSpacing) {
                adjustedPercent = Math.max(percent, prevPercent + minSpacing);
              }

              // Adjust if too close to next label (but don't go past it)
              if (idx < dateLabels.length - 1 && nextPercent - adjustedPercent < minSpacing) {
                adjustedPercent = Math.min(adjustedPercent, nextPercent - minSpacing);
              }

              // Clamp to visible range
              adjustedPercent = Math.max(2, Math.min(98, adjustedPercent));

              return (
                <div
                  key={`label-${idx}`}
                  className='absolute transform -translate-x-1/2 text-[10px] text-gray-600 font-medium whitespace-nowrap z-10 bg-white/80 px-1 rounded'
                  style={{ left: `${adjustedPercent}%`, top: '50%', marginTop: '-5px' }}
                >
                  {formatDateLabel(date)}
                </div>
              );
            })}
          </div>

          {/* React Slider with day boundary markers */}
          <div className='relative'>
            {/* Day boundary markers on slider track (at midnight boundaries) */}
            {dateLabels.map((date, idx) => {
              const position = getDayBoundaryPosition(date);
              const percent = (position / totalHours) * 100;
              return (
                <div
                  key={`marker-${idx}`}
                  className='absolute top-1/2 transform -translate-y-1/2 w-0.5 h-3 bg-gray-400 z-0'
                  style={{ left: `${percent}%` }}
                />
              );
            })}

            <ReactSlider
              value={sliderValue}
              onChange={handleSliderChange}
              min={0}
              max={totalHours}
              step={1}
              disabled={disabled}
              className='horizontal-slider'
              thumbClassName='slider-thumb'
              trackClassName='slider-track'
            />

            {/* Tooltip above slider thumb */}
            <div
              className='absolute top-0 transform -translate-x-1/2 pointer-events-none z-20'
              style={{ left: `${(sliderValue / totalHours) * 100}%` }}
            >
              <div className='-mt-10 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap'>
                <div className='font-medium'>
                  {formatDateLabel(currentDateTime)}{' '}
                  {String(currentDateTime.getHours()).padStart(2, '0')}:00
                </div>
                <div className='absolute top-full left-1/2 transform -translate-x-1/2'>
                  <div className='border-[3px] border-transparent border-t-orange-500'></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

WindDateTimePicker.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Date),
    PropTypes.oneOf([null]),
  ]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isFetchingWind: PropTypes.bool,
  onClose: PropTypes.func,
};

export default WindDateTimePicker;
