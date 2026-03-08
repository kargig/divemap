import {
  Filter,
  Layers,
  Search,
  MapPin,
  Plus,
  Minus,
  RotateCcw,
  Wrench,
  Settings,
  X,
  ZoomIn,
  ZoomOut,
  Share,
  Maximize,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import Modal from './ui/Modal';

const MobileMapControls = ({
  onToggleFilters,
  onToggleLayers,
  onResetZoom,
  showFilters,
  showLayers,
  hasActiveFilters = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('tools');

  // Handle map zoom controls
  const handleZoomIn = () => {
    // This would be handled by the parent map component
    // For now, we'll just show a visual feedback
  };

  const handleZoomOut = () => {
    // This would be handled by the parent map component
  };

  const handleResetView = () => {
    if (onResetZoom) {
      onResetZoom();
    }
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
    setActiveTab('tools'); // Reset to tools tab when opening
  };

  // Compact view - just the wrench button
  if (!isExpanded) {
    return (
      <div className='fixed bottom-6 right-6 z-50'>
        <button
          onClick={handleToggleExpanded}
          className='w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 flex items-center justify-center touch-manipulation'
          aria-label='Toggle Map Tools'
        >
          <Wrench className='h-6 w-6' />
        </button>
      </div>
    );
  }

  // Expanded view - full overlay
  return (
    <>
      <div className='fixed bottom-6 right-6 z-50'>
        <button
          onClick={handleToggleExpanded}
          className='w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 flex items-center justify-center touch-manipulation'
          aria-label='Toggle Map Tools'
        >
          <Wrench className='h-6 w-6' />
        </button>
      </div>

      <Modal
        isOpen={isExpanded}
        onClose={handleToggleExpanded}
        title='Map Tools'
        className='w-full h-screen sm:h-auto sm:max-w-xl p-0 flex flex-col'
        showCloseButton={true}
      >
        {/* Tab Navigation */}
        <div className='flex border-b border-gray-200 bg-white'>
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'tools'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Wrench className='h-4 w-4 inline mr-2' />
            Tools
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Settings className='h-4 w-4 inline mr-2' />
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className='flex-1 overflow-y-auto min-h-0'>
          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className='p-4 space-y-6 pb-4'>
              {/* Map Controls */}
              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Map Controls</h4>
                <div className='grid grid-cols-2 gap-3'>
                  <button
                    onClick={onToggleFilters}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors min-h-[80px] ${
                      showFilters
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : hasActiveFilters
                          ? 'bg-orange-50 border-orange-200 text-orange-900'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className='w-6 h-6' />
                    <span className='text-sm font-medium'>Filters</span>
                    {hasActiveFilters && <span className='text-xs text-orange-600'>Active</span>}
                  </button>

                  <button
                    onClick={onToggleLayers}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors min-h-[80px] ${
                      showLayers
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Layers className='w-6 h-6' />
                    <span className='text-sm font-medium'>Layers</span>
                  </button>

                  <button className='flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors min-h-[80px]'>
                    <Search className='w-6 h-6' />
                    <span className='text-sm font-medium'>Search</span>
                  </button>

                  <button className='flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors min-h-[80px]'>
                    <MapPin className='w-6 h-6' />
                    <span className='text-sm font-medium'>Location</span>
                  </button>
                </div>
              </div>

              {/* Zoom Controls */}
              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Zoom Controls</h4>
                <div className='flex gap-3'>
                  <button
                    onClick={handleZoomIn}
                    className='flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]'
                  >
                    <ZoomIn className='w-5 h-5' />
                    <span className='text-sm font-medium'>Zoom In</span>
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className='flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]'
                  >
                    <ZoomOut className='w-5 h-5' />
                    <span className='text-sm font-medium'>Zoom Out</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Quick Actions</h4>
                <div className='space-y-2'>
                  <button
                    onClick={handleResetView}
                    className='w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[48px]'
                  >
                    <RotateCcw className='w-5 h-5 text-gray-600' />
                    <span className='text-sm text-gray-700'>Reset View</span>
                  </button>
                  <button className='w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[48px]'>
                    <Share className='w-5 h-5 text-gray-600' />
                    <span className='text-sm text-gray-700'>Share Map</span>
                  </button>
                  <button className='w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[48px]'>
                    <Maximize className='w-5 h-5 text-gray-600' />
                    <span className='text-sm text-gray-700'>Fullscreen</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className='p-4 space-y-6 pb-4'>
              {/* Map Settings */}
              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Map Settings</h4>
                <div className='space-y-2'>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                      defaultChecked
                    />
                    <span className='text-sm text-gray-700'>Show dive sites</span>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                      defaultChecked
                    />
                    <span className='text-sm text-gray-700'>Show dive centers</span>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                    />
                    <span className='text-sm text-gray-700'>Show my dives</span>
                  </label>
                </div>
              </div>

              {/* Display Options */}
              <div>
                <h4 className='text-sm font-medium text-gray-700 mb-3'>Display Options</h4>
                <div className='space-y-2'>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                      defaultChecked
                    />
                    <span className='text-sm text-gray-700'>Show cluster labels</span>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                    <input
                      type='checkbox'
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                    />
                    <span className='text-sm text-gray-700'>Auto-zoom to fit</span>
                  </label>
                </div>
              </div>

              {/* Gesture Hints */}
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                <h4 className='text-sm font-medium text-blue-900 mb-2'>Touch Gestures</h4>
                <div className='space-y-1 text-sm text-blue-800'>
                  <div className='flex items-center gap-2'>
                    <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                    <span>Pinch to zoom in/out</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                    <span>Drag to pan around</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                    <span>Tap markers for details</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className='border-t border-gray-200 p-4 bg-gray-50'>
          <button
            onClick={handleToggleExpanded}
            className='w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors min-h-[48px]'
          >
            Done
          </button>
        </div>
      </Modal>
    </>
  );
};

MobileMapControls.propTypes = {
  onToggleFilters: PropTypes.func.isRequired,
  onToggleLayers: PropTypes.func.isRequired,
  onResetZoom: PropTypes.func,
  showFilters: PropTypes.bool.isRequired,
  showLayers: PropTypes.bool.isRequired,
  hasActiveFilters: PropTypes.bool,
};

export default MobileMapControls;
