import { Info, X, ChevronDown, ChevronUp } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

import {
  getSuitabilityColor,
  getSuitabilityLabel,
  getSuitabilityDescription,
} from '../utils/windSuitabilityHelpers';

/**
 * WindOverlayLegend Component
 * Combined legend explaining both wind arrows and dive site suitability
 * Can be collapsed/expanded for better UX
 */
const WindOverlayLegend = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('arrows'); // 'arrows' or 'suitability'

  const suitabilityLevels = ['good', 'caution', 'difficult', 'avoid', 'unknown'];

  return (
    <div
      className='bg-white sm:bg-white/95 sm:backdrop-blur-sm shadow-lg border border-gray-200 sm:rounded-lg sm:max-w-xs flex flex-col w-full h-full sm:w-80 sm:h-auto'
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 100000,
        isolation: 'isolate',
      }}
    >
      {/* Header - Always visible, fixed at top with high z-index */}
      <div
        className='flex items-center justify-between p-4 sm:p-3 border-b-2 border-gray-300 sm:border-gray-200 flex-shrink-0 bg-white'
        style={{ position: 'sticky', top: 0, zIndex: 10000 }}
      >
        <div className='flex items-center gap-2 sm:gap-2 flex-1 min-w-0'>
          <Info className='w-5 h-5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0' />
          <h3 className='text-lg sm:text-sm font-bold text-gray-900 truncate'>
            Wind Overlay Guide
          </h3>
        </div>
        <div className='flex items-center gap-2 flex-shrink-0 ml-2'>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='text-gray-400 hover:text-gray-600 transition-colors p-1 hidden sm:block'
            aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
          >
            {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className='text-gray-800 hover:text-gray-900 hover:bg-red-50 active:bg-red-100 transition-colors p-3 sm:p-1 rounded-full sm:rounded flex items-center justify-center'
              aria-label='Close legend'
              title='Close'
              style={{ minWidth: '48px', minHeight: '48px' }}
            >
              <X className='w-7 h-7 sm:w-4 sm:h-4 stroke-2' />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content area - properly constrained */}
      <div
        className='overflow-y-auto overflow-x-hidden p-4 sm:p-3 flex-1'
        style={{
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {isExpanded && (
          <>
            {/* Tab Navigation */}
            <div className='flex gap-2 mb-4 sm:mb-3 border-b border-gray-200'>
              <button
                onClick={() => setActiveTab('arrows')}
                className={`flex-1 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs font-medium transition-colors ${
                  activeTab === 'arrows'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Wind Arrows
              </button>
              <button
                onClick={() => setActiveTab('suitability')}
                className={`flex-1 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs font-medium transition-colors ${
                  activeTab === 'suitability'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Suitability
              </button>
            </div>

            {/* Wind Arrows Tab */}
            {activeTab === 'arrows' && (
              <div className='space-y-4 sm:space-y-3'>
                {/* Arrow Direction Explanation */}
                <div className='pb-3 sm:pb-2 border-b border-gray-200'>
                  <p className='text-sm sm:text-xs text-gray-700 mb-2 sm:mb-1'>
                    <strong>Arrow Direction:</strong> Arrows point in the direction the wind is{' '}
                    <strong>going</strong> (opposite of where it comes from).
                  </p>
                  <p className='text-sm sm:text-xs text-gray-600'>
                    Example: A north wind (coming from north) shows an arrow pointing south.
                  </p>
                </div>

                {/* Color Scale */}
                <div className='space-y-3 sm:space-y-2'>
                  <div className='text-base sm:text-xs font-medium text-gray-700'>
                    Wind Speed Colors:
                  </div>

                  {/* Light Blue - < 5 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#60a5fa' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700'>
                      <div className='font-medium'>Light Blue</div>
                      <div className='text-gray-600'>&lt; 5 m/s (&lt; 10 knots)</div>
                      <div className='text-gray-500 text-xs sm:text-[10px]'>
                        Light winds, ideal conditions
                      </div>
                    </div>
                  </div>

                  {/* Blue - 5-7.7 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#3b82f6' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700'>
                      <div className='font-medium'>Blue</div>
                      <div className='text-gray-600'>5-7.7 m/s (10-15 knots)</div>
                      <div className='text-gray-500 text-xs sm:text-[10px]'>
                        Moderate winds, caution advised
                      </div>
                    </div>
                  </div>

                  {/* Orange - 7.7-10 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#f97316' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700'>
                      <div className='font-medium'>Orange</div>
                      <div className='text-gray-600'>7.7-10 m/s (15-20 knots)</div>
                      <div className='text-gray-500 text-xs sm:text-[10px]'>
                        Strong winds, experienced divers only
                      </div>
                    </div>
                  </div>

                  {/* Red - > 10 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#dc2626' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700'>
                      <div className='font-medium'>Red</div>
                      <div className='text-gray-600'>&gt; 10 m/s (&gt; 20 knots)</div>
                      <div className='text-gray-500 text-xs sm:text-[10px]'>
                        Very strong winds, avoid diving
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow Size Explanation */}
                <div className='pt-3 sm:pt-2 border-t border-gray-200'>
                  <div className='text-base sm:text-xs font-medium text-gray-700 mb-2 sm:mb-1'>
                    Arrow Size:
                  </div>
                  <p className='text-sm sm:text-xs text-gray-600'>
                    Larger arrows indicate stronger winds. Size increases with wind speed.
                  </p>
                </div>
              </div>
            )}

            {/* Suitability Tab */}
            {activeTab === 'suitability' && (
              <div className='space-y-4 sm:space-y-3'>
                {/* Explanation */}
                <div className='pb-3 sm:pb-2 border-b border-gray-200'>
                  <p className='text-sm sm:text-xs text-gray-700'>
                    Colored borders on dive site markers indicate suitability based on current wind
                    conditions and shore direction.
                  </p>
                </div>

                {/* Suitability Levels */}
                <div className='space-y-3 sm:space-y-2'>
                  {suitabilityLevels.map(suitability => {
                    const color = getSuitabilityColor(suitability);
                    const label = getSuitabilityLabel(suitability);
                    const description = getSuitabilityDescription(suitability);

                    return (
                      <div key={suitability} className='flex items-start gap-3 sm:gap-2'>
                        <div
                          className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-white shadow-sm flex-shrink-0 mt-0.5'
                          style={{ backgroundColor: color }}
                        ></div>
                        <div className='flex-1 text-sm sm:text-xs text-gray-700'>
                          <div className='font-medium'>{label}</div>
                          <div className='text-gray-600 text-xs sm:text-[10px]'>{description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wind Speed Reference */}
                <div className='pt-3 sm:pt-2 border-t border-gray-200'>
                  <div className='text-base sm:text-xs font-medium text-gray-700 mb-2 sm:mb-1'>
                    Wind Speed Thresholds:
                  </div>
                  <div className='text-sm sm:text-xs text-gray-600 space-y-1'>
                    <div>• Good: &lt; 6.2 m/s (&lt; 12 knots)</div>
                    <div>• Caution: 6.2-7.7 m/s (12-15 knots)</div>
                    <div>• Difficult: 7.7-10 m/s (15-20 knots)</div>
                    <div>• Avoid: &gt; 10 m/s (&gt; 20 knots)</div>
                  </div>
                  <p className='text-xs sm:text-[10px] text-gray-500 mt-3 sm:mt-2'>
                    Suitability also considers wind direction relative to shore direction. Wind
                    blowing directly onto shore makes entry/exit dangerous.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

WindOverlayLegend.propTypes = {
  onClose: PropTypes.func,
};

WindOverlayLegend.defaultProps = {
  onClose: null,
};

export default WindOverlayLegend;
