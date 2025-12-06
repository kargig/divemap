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
    <div className='absolute bottom-4 right-4 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 max-w-xs'>
      <div className='p-3'>
        {/* Header */}
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Info className='w-4 h-4 text-blue-600' />
            <h3 className='text-sm font-semibold text-gray-900'>Wind Overlay Guide</h3>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className='text-gray-400 hover:text-gray-600 transition-colors'
              aria-label={isExpanded ? 'Collapse legend' : 'Expand legend'}
            >
              {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className='text-gray-400 hover:text-gray-600 transition-colors'
                aria-label='Close legend'
              >
                <X className='w-4 h-4' />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Tab Navigation */}
            <div className='flex gap-1 mb-3 border-b border-gray-200'>
              <button
                onClick={() => setActiveTab('arrows')}
                className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'arrows'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Wind Arrows
              </button>
              <button
                onClick={() => setActiveTab('suitability')}
                className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
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
              <div className='space-y-3'>
                {/* Arrow Direction Explanation */}
                <div className='pb-2 border-b border-gray-200'>
                  <p className='text-xs text-gray-700 mb-1'>
                    <strong>Arrow Direction:</strong> Arrows point in the direction the wind is{' '}
                    <strong>going</strong> (opposite of where it comes from).
                  </p>
                  <p className='text-xs text-gray-600'>
                    Example: A north wind (coming from north) shows an arrow pointing south.
                  </p>
                </div>

                {/* Color Scale */}
                <div className='space-y-2'>
                  <div className='text-xs font-medium text-gray-700'>Wind Speed Colors:</div>

                  {/* Light Blue - < 5 m/s */}
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#60a5fa' }}
                    ></div>
                    <div className='flex-1 text-xs text-gray-700'>
                      <div className='font-medium'>Light Blue</div>
                      <div className='text-gray-600'>&lt; 5 m/s (&lt; 10 knots)</div>
                      <div className='text-gray-500 text-[10px]'>Light winds, ideal conditions</div>
                    </div>
                  </div>

                  {/* Blue - 5-7.7 m/s */}
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#3b82f6' }}
                    ></div>
                    <div className='flex-1 text-xs text-gray-700'>
                      <div className='font-medium'>Blue</div>
                      <div className='text-gray-600'>5-7.7 m/s (10-15 knots)</div>
                      <div className='text-gray-500 text-[10px]'>
                        Moderate winds, caution advised
                      </div>
                    </div>
                  </div>

                  {/* Orange - 7.7-10 m/s */}
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#f97316' }}
                    ></div>
                    <div className='flex-1 text-xs text-gray-700'>
                      <div className='font-medium'>Orange</div>
                      <div className='text-gray-600'>7.7-10 m/s (15-20 knots)</div>
                      <div className='text-gray-500 text-[10px]'>
                        Strong winds, experienced divers only
                      </div>
                    </div>
                  </div>

                  {/* Red - > 10 m/s */}
                  <div className='flex items-center gap-2'>
                    <div
                      className='w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0'
                      style={{ backgroundColor: '#dc2626' }}
                    ></div>
                    <div className='flex-1 text-xs text-gray-700'>
                      <div className='font-medium'>Red</div>
                      <div className='text-gray-600'>&gt; 10 m/s (&gt; 20 knots)</div>
                      <div className='text-gray-500 text-[10px]'>
                        Very strong winds, avoid diving
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow Size Explanation */}
                <div className='pt-2 border-t border-gray-200'>
                  <div className='text-xs font-medium text-gray-700 mb-1'>Arrow Size:</div>
                  <p className='text-xs text-gray-600'>
                    Larger arrows indicate stronger winds. Size increases with wind speed (40px base
                    + 10px per 5 m/s, max 80px).
                  </p>
                </div>
              </div>
            )}

            {/* Suitability Tab */}
            {activeTab === 'suitability' && (
              <div className='space-y-3'>
                {/* Explanation */}
                <div className='pb-2 border-b border-gray-200'>
                  <p className='text-xs text-gray-700'>
                    Colored borders on dive site markers indicate suitability based on current wind
                    conditions and shore direction.
                  </p>
                </div>

                {/* Suitability Levels */}
                <div className='space-y-2'>
                  {suitabilityLevels.map(suitability => {
                    const color = getSuitabilityColor(suitability);
                    const label = getSuitabilityLabel(suitability);
                    const description = getSuitabilityDescription(suitability);

                    return (
                      <div key={suitability} className='flex items-start gap-2'>
                        <div
                          className='w-5 h-5 rounded border-2 border-white shadow-sm flex-shrink-0 mt-0.5'
                          style={{ backgroundColor: color }}
                        ></div>
                        <div className='flex-1 text-xs text-gray-700'>
                          <div className='font-medium'>{label}</div>
                          <div className='text-gray-600 text-[10px]'>{description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wind Speed Reference */}
                <div className='pt-2 border-t border-gray-200'>
                  <div className='text-xs font-medium text-gray-700 mb-1'>
                    Wind Speed Thresholds:
                  </div>
                  <div className='text-xs text-gray-600 space-y-0.5'>
                    <div>• Good: &lt; 6.2 m/s (&lt; 12 knots)</div>
                    <div>• Caution: 6.2-7.7 m/s (12-15 knots)</div>
                    <div>• Difficult: 7.7-10 m/s (15-20 knots)</div>
                    <div>• Avoid: &gt; 10 m/s (&gt; 20 knots)</div>
                  </div>
                  <p className='text-[10px] text-gray-500 mt-2'>
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
