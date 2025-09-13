import { Filter, Layers, Search, MapPin, Plus, Minus, RotateCcw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const MobileMapControls = ({ onToggleFilters, onToggleLayers, showFilters, showLayers }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastTouchTime, setLastTouchTime] = useState(0);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [lastTouchTime]);

  // Show controls on touch
  const handleTouch = () => {
    setLastTouchTime(Date.now());
    setIsVisible(true);
  };

  // Handle map zoom controls
  const handleZoomIn = () => {
    // This would be handled by the parent map component
    // For now, we'll just show a visual feedback
  };

  const handleZoomOut = () => {
    // This would be handled by the parent map component
  };

  const handleResetView = () => {
    // This would be handled by the parent map component
  };

  return (
    <div className='absolute inset-0 pointer-events-none z-30' style={{ zIndex: 30 }}>
      {/* Touch overlay to show controls */}
      <div
        className='absolute inset-0 pointer-events-auto'
        onTouchStart={handleTouch}
        onClick={handleTouch}
      />

      {/* Top controls */}
      <div
        className={`absolute top-4 left-4 right-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className='flex justify-between items-center'>
          {/* Left side - Filter and Layers */}
          <div className='flex space-x-2'>
            <button
              onClick={onToggleFilters}
              className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              <Filter className='w-5 h-5' />
            </button>

            <button
              onClick={onToggleLayers}
              className={`p-3 rounded-full shadow-lg transition-all duration-200 ${
                showLayers ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              <Layers className='w-5 h-5' />
            </button>
          </div>

          {/* Right side - Search */}
          <button className='p-3 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-50 transition-colors'>
            <Search className='w-5 h-5' />
          </button>
        </div>
      </div>

      {/* Bottom controls - Zoom and Reset */}
      <div
        className={`absolute bottom-4 right-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className='flex flex-col space-y-2'>
          {/* Zoom controls */}
          <div className='flex flex-col space-y-1'>
            <button
              onClick={handleZoomIn}
              className='p-3 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-50 transition-colors'
            >
              <Plus className='w-5 h-5' />
            </button>

            <button
              onClick={handleZoomOut}
              className='p-3 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-50 transition-colors'
            >
              <Minus className='w-5 h-5' />
            </button>
          </div>

          {/* Reset view */}
          <button
            onClick={handleResetView}
            className='p-3 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-50 transition-colors'
          >
            <RotateCcw className='w-5 h-5' />
          </button>
        </div>
      </div>

      {/* Center - Location indicator */}
      <div
        className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button className='p-3 bg-white text-gray-700 rounded-full shadow-lg hover:bg-gray-50 transition-colors'>
          <MapPin className='w-5 h-5' />
        </button>
      </div>

      {/* Gesture hints */}
      <div
        className={`absolute bottom-4 left-4 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className='bg-black bg-opacity-75 text-white text-xs px-3 py-2 rounded-lg'>
          <div className='flex items-center space-x-2'>
            <div className='w-2 h-2 bg-white rounded-full'></div>
            <span>Pinch to zoom • Drag to pan</span>
          </div>
        </div>
      </div>
    </div>
  );
};

MobileMapControls.propTypes = {
  onToggleFilters: PropTypes.func.isRequired,
  onToggleLayers: PropTypes.func.isRequired,
  showFilters: PropTypes.bool.isRequired,
  showLayers: PropTypes.bool.isRequired,
};

export default MobileMapControls;
