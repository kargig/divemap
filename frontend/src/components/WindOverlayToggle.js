import { Wind, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

/**
 * WindOverlayToggle Component
 * Toggle button to enable/disable wind overlay with zoom level restrictions
 * Only enabled at zoom levels 13-18
 */
const WindOverlayToggle = ({ isOverlayEnabled, onToggle, zoomLevel, isLoading, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Auto-disable when zoom drops below 13
  useEffect(() => {
    if (isOverlayEnabled && zoomLevel < 13) {
      onToggle(false);
    }
  }, [isOverlayEnabled, zoomLevel, onToggle]);

  const isButtonDisabled = disabled || zoomLevel < 13;

  const handleClick = () => {
    if (!isButtonDisabled && !isLoading) {
      onToggle(!isOverlayEnabled);
    }
  };

  const getTooltipText = () => {
    if (isLoading) {
      return 'Loading wind data...';
    }
    if (zoomLevel < 13) {
      return 'Zoom in to level 13 or higher to enable wind overlay';
    }
    if (isOverlayEnabled) {
      return 'Disable wind overlay';
    }
    return 'Enable wind overlay (zoom 13+)';
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

      {/* Tooltip */}
      {isHovered && (
        <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50'>
          {getTooltipText()}
          {zoomLevel >= 13 && (
            <div className='text-gray-300 text-[10px] mt-0.5'>Zoom: {zoomLevel.toFixed(1)}</div>
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

WindOverlayToggle.defaultProps = {
  isLoading: false,
  disabled: false,
};

export default WindOverlayToggle;
