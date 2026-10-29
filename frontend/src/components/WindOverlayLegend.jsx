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
      className='bg-white dark:bg-slate-800 sm:bg-white/95 sm:dark:bg-slate-800/95 sm:backdrop-blur-sm shadow-lg border border-gray-200 dark:border-slate-700 sm:rounded-lg sm:max-w-xs flex flex-col w-full h-full sm:w-80 sm:h-auto'
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
        className='flex items-center justify-between p-4 sm:p-3 border-b-2 border-gray-300 dark:border-slate-600 sm:border-gray-200 flex-shrink-0 bg-white dark:bg-slate-800'
        style={{ position: 'sticky', top: 0, zIndex: 10000 }}
      >
        <div className='flex items-center gap-2 sm:gap-2 flex-1 min-w-0'>
          <Info className='w-5 h-5 sm:w-4 sm:h-4 text-blue-600 dark:text-sky-400 flex-shrink-0' />
          <h3 className='text-lg sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate'>
            Wind Overlay Guide
          </h3>
        </div>
        <div className='flex items-center gap-2 flex-shrink-0 ml-2'>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hidden sm:block'
            aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
          >
            {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className='text-gray-800 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white hover:bg-red-50 dark:hover:bg-red-950/40 active:bg-red-100 transition-colors p-3 sm:p-1 rounded-full sm:rounded flex items-center justify-center'
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
            <div className='flex gap-2 mb-4 sm:mb-3 border-b border-gray-200 dark:border-slate-700'>
              <button
                onClick={() => setActiveTab('arrows')}
                className={`flex-1 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs font-medium transition-colors ${
                  activeTab === 'arrows'
                    ? 'text-blue-600 dark:text-sky-400 border-b-2 border-blue-600 dark:border-sky-400'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                Wind Arrows
              </button>
              <button
                onClick={() => setActiveTab('suitability')}
                className={`flex-1 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs font-medium transition-colors ${
                  activeTab === 'suitability'
                    ? 'text-blue-600 dark:text-sky-400 border-b-2 border-blue-600 dark:border-sky-400'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                Suitability
              </button>
            </div>

            {/* Wind Arrows Tab */}
            {activeTab === 'arrows' && (
              <div className='space-y-4 sm:space-y-3'>
                {/* Arrow Direction Explanation */}
                <div className='pb-3 sm:pb-2 border-b border-gray-200 dark:border-slate-700'>
                  <p className='text-sm sm:text-xs text-gray-700 dark:text-slate-300 mb-2 sm:mb-1'>
                    <strong>Arrow Direction:</strong> Arrows point in the direction the wind is{' '}
                    <strong>going</strong> (opposite of where it comes from).
                  </p>
                  <p className='text-sm sm:text-xs text-gray-600 dark:text-slate-400'>
                    Example: A north wind (coming from north) shows an arrow pointing south.
                  </p>
                </div>

                {/* Color Scale */}
                <div className='space-y-3 sm:space-y-2'>
                  <div className='text-base sm:text-xs font-medium text-gray-700 dark:text-slate-300'>
                    Wind Speed Colors:
                  </div>

                  {/* Light Blue - < 5 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 dark:border-slate-600 flex-shrink-0'
                      style={{ backgroundColor: '#60a5fa' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                      <div className='font-medium text-gray-900 dark:text-slate-100'>
                        Light Blue
                      </div>
                      <div className='text-gray-600 dark:text-slate-400'>
                        &lt; 5 m/s (&lt; 10 knots)
                      </div>
                      <div className='text-gray-500 dark:text-slate-400 text-xs sm:text-[10px]'>
                        Light winds, ideal conditions
                      </div>
                    </div>
                  </div>

                  {/* Blue - 5-7.7 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 dark:border-slate-600 flex-shrink-0'
                      style={{ backgroundColor: '#3b82f6' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                      <div className='font-medium text-gray-900 dark:text-slate-100'>Blue</div>
                      <div className='text-gray-600 dark:text-slate-400'>
                        5-7.7 m/s (10-15 knots)
                      </div>
                      <div className='text-gray-500 dark:text-slate-400 text-xs sm:text-[10px]'>
                        Moderate winds, caution advised
                      </div>
                    </div>
                  </div>

                  {/* Orange - 7.7-10 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 dark:border-slate-600 flex-shrink-0'
                      style={{ backgroundColor: '#f97316' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                      <div className='font-medium text-gray-900 dark:text-slate-100'>Orange</div>
                      <div className='text-gray-600 dark:text-slate-400'>
                        7.7-10 m/s (15-20 knots)
                      </div>
                      <div className='text-gray-500 dark:text-slate-400 text-xs sm:text-[10px]'>
                        Strong winds, experienced divers only
                      </div>
                    </div>
                  </div>

                  {/* Red - > 10 m/s */}
                  <div className='flex items-center gap-3 sm:gap-2'>
                    <div
                      className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-gray-300 dark:border-slate-600 flex-shrink-0'
                      style={{ backgroundColor: '#dc2626' }}
                    ></div>
                    <div className='flex-1 text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                      <div className='font-medium text-gray-900 dark:text-slate-100'>Red</div>
                      <div className='text-gray-600 dark:text-slate-400'>
                        &gt; 10 m/s (&gt; 20 knots)
                      </div>
                      <div className='text-gray-500 dark:text-slate-400 text-xs sm:text-[10px]'>
                        Very strong winds, avoid diving
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow Size Explanation */}
                <div className='pt-3 sm:pt-2 border-t border-gray-200 dark:border-slate-700'>
                  <div className='text-base sm:text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 sm:mb-1'>
                    Arrow Size:
                  </div>
                  <p className='text-sm sm:text-xs text-gray-600 dark:text-slate-400'>
                    Larger arrows indicate stronger winds. Size increases with wind speed.
                  </p>
                </div>
              </div>
            )}

            {/* Suitability Tab */}
            {activeTab === 'suitability' && (
              <div className='space-y-4 sm:space-y-3'>
                {/* Explanation */}
                <div className='pb-3 sm:pb-2 border-b border-gray-200 dark:border-slate-700'>
                  <p className='text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                    Colored borders on dive site markers indicate suitability based on current wind
                    conditions, wave height, and shore direction.
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
                          className='w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-white dark:border-slate-700 shadow-sm flex-shrink-0 mt-0.5'
                          style={{ backgroundColor: color }}
                        ></div>
                        <div className='flex-1 text-sm sm:text-xs text-gray-700 dark:text-slate-300'>
                          <div className='font-medium text-gray-900 dark:text-slate-100'>
                            {label}
                          </div>
                          <div className='text-gray-600 dark:text-slate-400 text-xs sm:text-[10px]'>
                            {description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wind Speed Reference */}
                <div className='pt-3 sm:pt-2 border-t border-gray-200 dark:border-slate-700'>
                  <div className='text-base sm:text-xs font-medium text-gray-700 dark:text-slate-300 mb-2 sm:mb-1'>
                    Conditions Thresholds:
                  </div>
                  <div className='text-sm sm:text-xs text-gray-600 dark:text-slate-400 space-y-1'>
                    <div>• Good: Wind &lt; 6.2 m/s, Waves &lt; 0.5m</div>
                    <div>• Caution: Wind 6.2-7.7 m/s OR Waves 0.5-1.0m</div>
                    <div>• Difficult: Wind 7.7-10 m/s OR Waves 1.0-1.5m</div>
                    <div>• Avoid: Wind &gt; 10 m/s OR Waves &gt; 1.5m</div>
                  </div>
                  <p className='text-xs sm:text-[10px] text-gray-500 dark:text-slate-400 mt-3 sm:mt-2'>
                    Suitability uses the worst-case scenario between wind and waves. Wind blowing
                    directly onto shore also downgrades suitability.
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

export default WindOverlayLegend;
