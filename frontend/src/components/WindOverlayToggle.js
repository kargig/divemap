import { Wind, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

/**
 * WindOverlayToggle Component
 * Toggle button to enable/disable wind overlay with zoom level restrictions
 * Only enabled at zoom levels 12-18
 */
const WindOverlayToggle = ({
  isOverlayEnabled,
  onToggle,
  zoomLevel,
  isLoading = false,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Auto-disable when zoom drops below 12
  useEffect(() => {
    if (isOverlayEnabled && zoomLevel < 12) {
      onToggle(false);
    }
  }, [isOverlayEnabled, zoomLevel, onToggle]);

  const isButtonDisabled = disabled || zoomLevel < 12;

  const handleClick = () => {
    if (!isButtonDisabled && !isLoading) {
      onToggle(!isOverlayEnabled);
    }
  };

  const getTooltipText = () => {
    if (isLoading) {
      return 'Loading wind data...';
    }
    if (zoomLevel < 12) {
      return 'Zoom in to level 12 or higher to enable wind overlay';
    }
    if (isOverlayEnabled) {
      return 'Disable wind overlay';
    }
    return 'Enable wind overlay (zoom 12+)';
  };

  const getDetailedTooltip = () => {
    if (isLoading) {
      return {
        title: 'Loading wind data...',
        description: 'Fetching current wind conditions from weather service',
      };
    }
    if (zoomLevel < 12) {
      return {
        title: 'Zoom Required',
        description:
          'Wind overlay requires zoom level 12 or higher to avoid excessive API calls. Zoom in to see wind speed, direction, and dive site suitability.',
      };
    }
    if (isOverlayEnabled) {
      return {
        title: 'Wind Overlay Enabled',
        description:
          'Shows wind arrows (direction wind is going) and dive site suitability colors. Click to disable.',
      };
    }
    return {
      title: 'Enable Wind Overlay',
      description:
        'Display real-time wind speed and direction with arrows. Arrows point where wind is going. Colored borders on dive sites show suitability based on wind conditions.',
    };
  };

  return (
    <div className='relative'>
      <button
        onClick={handleClick}
        disabled={isButtonDisabled || isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          p-2 rounded-lg transition-colors
          ${
            isButtonDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : isOverlayEnabled
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
          }
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
        `}
        title={getTooltipText()}
        aria-label={getTooltipText()}
      >
        {isLoading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Wind className='w-4 h-4' />}
      </button>

      {/* Enhanced Tooltip */}
      {isHovered && (
        <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50 max-w-xs'>
          <div className='font-medium mb-1'>{getDetailedTooltip().title}</div>
          <div className='text-gray-300 text-[10px] leading-relaxed'>
            {getDetailedTooltip().description}
          </div>
          {zoomLevel >= 12 && (
            <div className='text-gray-400 text-[10px] mt-1.5 pt-1.5 border-t border-gray-700'>
              Current zoom: {zoomLevel.toFixed(1)}
            </div>
          )}
          {zoomLevel < 12 && (
            <div className='text-gray-400 text-[10px] mt-1.5 pt-1.5 border-t border-gray-700'>
              Required: Zoom 12+ (current: {zoomLevel.toFixed(1)})
            </div>
          )}
        </div>
      )}
    </div>
  );
};

WindOverlayToggle.propTypes = {
  isOverlayEnabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  zoomLevel: PropTypes.number.isRequired,
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default WindOverlayToggle;
