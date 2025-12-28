import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

import AdvancedDiveProfileChart from './AdvancedDiveProfileChart';
import Modal from './ui/Modal';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={!isMobileLandscape ? 'Dive Profile - Full View' : null}
      showCloseButton={!isMobileLandscape}
      className={`flex flex-col w-full ${
        isMobileLandscape ? 'max-h-[98vh] max-w-none p-1' : 'max-w-7xl max-h-[95vh] p-0'
      }`}
      overlayClassName='z-[9999]' // Keep high z-index
    >
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
    </Modal>
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
