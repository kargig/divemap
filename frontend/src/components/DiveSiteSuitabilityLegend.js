import { Info, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {
  getSuitabilityColor,
  getSuitabilityLabel,
  getSuitabilityDescription,
} from '../utils/windSuitabilityHelpers';

/**
 * DiveSiteSuitabilityLegend Component
 * Legend explaining dive site suitability colors based on wind conditions
 */
const DiveSiteSuitabilityLegend = ({ onClose }) => {
  const suitabilityLevels = ['good', 'caution', 'difficult', 'avoid', 'unknown'];

  return (
    <div className='absolute bottom-4 right-4 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 max-w-xs'>
      <div className='p-3'>
        {/* Header */}
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Info className='w-4 h-4 text-blue-600' />
            <h3 className='text-sm font-semibold text-gray-900'>Dive Site Suitability</h3>
          </div>
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

        {/* Explanation */}
        <p className='text-xs text-gray-700 mb-3 pb-3 border-b border-gray-200'>
          Colored borders on dive site markers indicate suitability based on current wind conditions
          and shore direction.
        </p>

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
        <div className='mt-3 pt-3 border-t border-gray-200'>
          <div className='text-xs font-medium text-gray-700 mb-1'>Wind Speed Thresholds:</div>
          <div className='text-xs text-gray-600 space-y-0.5'>
            <div>• Good: &lt; 6.2 m/s (&lt; 12 knots)</div>
            <div>• Caution: 6.2-7.7 m/s (12-15 knots)</div>
            <div>• Difficult: 7.7-10 m/s (15-20 knots)</div>
            <div>• Avoid: &gt; 10 m/s (&gt; 20 knots)</div>
          </div>
          <p className='text-[10px] text-gray-500 mt-2'>
            Suitability also considers wind direction relative to shore direction. Wind blowing
            directly onto shore makes entry/exit dangerous.
          </p>
        </div>
      </div>
    </div>
  );
};

DiveSiteSuitabilityLegend.propTypes = {
  onClose: PropTypes.func,
};

DiveSiteSuitabilityLegend.defaultProps = {
  onClose: null,
};

export default DiveSiteSuitabilityLegend;
