import { Modal } from 'antd';
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

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title={!isMobileLandscape ? 'Dive Profile - Full View' : null}
      footer={null}
      width={isMobileLandscape ? '100%' : '90%'}
      style={{
        maxWidth: isMobileLandscape ? 'none' : '1280px',
        top: isMobileLandscape ? 0 : 20,
        padding: isMobileLandscape ? 0 : undefined,
      }}
      centered={!isMobileLandscape}
      closable={!isMobileLandscape}
      maskClosable={true}
      destroyOnClose
      styles={{
        body: {
          padding: 0,
          height: isMobileLandscape ? '100vh' : '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
      className='dive-profile-modal'
      zIndex={1050}
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
