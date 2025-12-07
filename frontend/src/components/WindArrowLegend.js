import { Info, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState } from 'react';

/**
 * WindArrowLegend Component
 * Legend explaining wind arrow colors, sizes, and direction
 */
const WindArrowLegend = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='absolute bottom-4 right-4 z-40 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 max-w-xs'>
      <div className='p-3'>
        {/* Header */}
        <div className='flex items-center justify-between mb-2'>
          <div className='flex items-center gap-2'>
            <Info className='w-4 h-4 text-blue-600' />
            <h3 className='text-sm font-semibold text-gray-900'>Wind Arrows</h3>
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

        {/* Arrow Direction Explanation */}
        <div className='mb-3 pb-3 border-b border-gray-200'>
          <p className='text-xs text-gray-700 mb-2'>
            <strong>Arrow Direction:</strong> Arrows point in the direction the wind is{' '}
            <strong>going</strong> (opposite of where it comes from).
          </p>
          <p className='text-xs text-gray-600'>
            Example: A north wind (coming from north) shows an arrow pointing south.
          </p>
        </div>

        {/* Color Scale */}
        <div className='space-y-2'>
          <div className='text-xs font-medium text-gray-700 mb-2'>Wind Speed Colors:</div>

          {/* Light Blue - < 5 m/s */}
          <div className='flex items-center gap-2'>
            <div
              className='w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center'
              style={{ backgroundColor: '#60a5fa' }}
            >
              <div className='w-3 h-3 bg-white rounded-full'></div>
            </div>
            <div className='flex-1 text-xs text-gray-700'>
              <div className='font-medium'>Light Blue</div>
              <div className='text-gray-600'>&lt; 5 m/s (&lt; 10 knots)</div>
              <div className='text-gray-500 text-[10px]'>Light winds, ideal conditions</div>
            </div>
          </div>

          {/* Blue - 5-7.7 m/s */}
          <div className='flex items-center gap-2'>
            <div
              className='w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center'
              style={{ backgroundColor: '#3b82f6' }}
            >
              <div className='w-3 h-3 bg-white rounded-full'></div>
            </div>
            <div className='flex-1 text-xs text-gray-700'>
              <div className='font-medium'>Blue</div>
              <div className='text-gray-600'>5-7.7 m/s (10-15 knots)</div>
              <div className='text-gray-500 text-[10px]'>Moderate winds, caution advised</div>
            </div>
          </div>

          {/* Orange - 7.7-10 m/s */}
          <div className='flex items-center gap-2'>
            <div
              className='w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center'
              style={{ backgroundColor: '#f97316' }}
            >
              <div className='w-3 h-3 bg-white rounded-full'></div>
            </div>
            <div className='flex-1 text-xs text-gray-700'>
              <div className='font-medium'>Orange</div>
              <div className='text-gray-600'>7.7-10 m/s (15-20 knots)</div>
              <div className='text-gray-500 text-[10px]'>Strong winds, experienced divers only</div>
            </div>
          </div>

          {/* Red - > 10 m/s */}
          <div className='flex items-center gap-2'>
            <div
              className='w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center'
              style={{ backgroundColor: '#dc2626' }}
            >
              <div className='w-3 h-3 bg-white rounded-full'></div>
            </div>
            <div className='flex-1 text-xs text-gray-700'>
              <div className='font-medium'>Red</div>
              <div className='text-gray-600'>&gt; 10 m/s (&gt; 20 knots)</div>
              <div className='text-gray-500 text-[10px]'>Very strong winds, avoid diving</div>
            </div>
          </div>
        </div>

        {/* Arrow Size Explanation */}
        <div className='mt-3 pt-3 border-t border-gray-200'>
          <div className='text-xs font-medium text-gray-700 mb-1'>Arrow Size:</div>
          <p className='text-xs text-gray-600'>
            Larger arrows indicate stronger winds. Size increases with wind speed.
          </p>
        </div>
      </div>
    </div>
  );
};

WindArrowLegend.propTypes = {
  onClose: PropTypes.func,
};

WindArrowLegend.defaultProps = {
  onClose: null,
};

export default WindArrowLegend;
