import { X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

import AdvancedDiveProfileChart from './AdvancedDiveProfileChart';

const DiveProfileModal = ({
  isOpen,
  onClose,
  profileData,
  isLoading,
  error,
  showTemperature,
  screenSize,
  onDecoStatusChange,
}) => {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  // Detect mobile landscape mode
  useEffect(() => {
    const checkMobileLandscape = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobile = window.innerWidth <= 1024; // Consider mobile if width <= 1024px
      setIsMobileLandscape(isLandscape && isMobile);
    };

    checkMobileLandscape();
    window.addEventListener('resize', checkMobileLandscape);
    return () => window.removeEventListener('resize', checkMobileLandscape);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = event => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] ${
        isMobileLandscape ? 'p-1' : 'p-4'
      }`}
      role='dialog'
      aria-modal='true'
      aria-label='Dive Profile Modal'
    >
      {/* Backdrop click to close */}
      <button
        className='absolute inset-0 w-full h-full bg-transparent'
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClose();
          }
        }}
        aria-label='Close modal'
      />

      {/* Modal content */}
      <div
        className={`relative bg-white rounded-lg shadow-2xl w-full flex flex-col ${
          isMobileLandscape ? 'max-h-[98vh] max-w-none' : 'max-w-7xl max-h-[95vh]'
        }`}
      >
        {/* Header - only show for desktop */}
        {!isMobileLandscape && (
          <div className='flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 flex-shrink-0'>
            <h2 className='text-2xl font-semibold text-gray-900'>Dive Profile - Full View</h2>
            <button
              onClick={onClose}
              className='text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100'
              aria-label='Close dive profile modal'
            >
              <X className='h-6 w-6' />
            </button>
          </div>
        )}

        {/* Chart content - scrollable */}
        <div className={`flex-1 overflow-y-auto min-h-0 ${isMobileLandscape ? 'p-1' : 'p-6'}`}>
          <AdvancedDiveProfileChart
            profileData={profileData}
            isLoading={isLoading}
            error={error}
            showTemperature={showTemperature}
            screenSize={isMobileLandscape ? 'mobile' : screenSize}
            onDecoStatusChange={onDecoStatusChange}
            onClose={isMobileLandscape ? onClose : undefined}
          />
        </div>
      </div>
    </div>
  );
};

DiveProfileModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  profileData: PropTypes.object,
  isLoading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  showTemperature: PropTypes.bool,
  screenSize: PropTypes.string,
  onDecoStatusChange: PropTypes.func,
};

export default DiveProfileModal;
