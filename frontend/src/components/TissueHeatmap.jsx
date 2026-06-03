import PropTypes from 'prop-types';
import { useMemo } from 'react';

import { formatGases } from '../utils/textHelpers';

const COMPARTMENTS = 16;
const HALFTIMES = [5, 8, 12.5, 18.5, 27, 38.3, 54.3, 77, 109, 146, 187, 239, 305, 390, 498, 635];

/**
 * Renders a tissue saturation heatmap similar to octo-deco.nl.
 * Shows time on X-axis and 16 Bühlmann compartments on Y-axis.
 */
const TissueHeatmap = ({ heatmapData, samples, events }) => {
  // We need to downsample heatmapData if it's too large (e.g. > 1000 points)
  // to maintain browser performance while keeping visual accuracy.
  const processedData = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0 || !samples || samples.length === 0) return null;

    // Ensure lengths match
    const dataLen = Math.min(heatmapData.length, samples.length);
    const targetPoints = 200; // Resolution of the heatmap
    const step = Math.max(1, Math.floor(dataLen / targetPoints));

    const rows = [];
    for (let i = 0; i < dataLen; i += step) {
      rows.push({
        time: samples[i].time_minutes,
        values: heatmapData[i],
      });
    }
    return rows;
  }, [heatmapData, samples]);

  // Extract and position gas change events
  const gasMarkers = useMemo(() => {
    if (!events || !samples || samples.length === 0) return [];
    const duration = samples[samples.length - 1].time_minutes;
    if (!duration) return [];

    return events
      .filter(e => (e.name === 'gaschange' || e.type === '25') && e.time_minutes > 0.5)
      .map(e => ({
        time: e.time_minutes,
        left: (e.time_minutes / duration) * 100,
        label: e.o2 ? formatGases(e.o2) : null,
      }));
  }, [events, samples]);

  if (!processedData) return null;

  // Color mapping: Blue (Ongassing) -> Green (Safe Offgassing) -> Yellow (Caution) -> Red (Deco/Violation)
  const getColor = val => {
    if (val < -100) return '#1e3a8a'; // Deep Blue (Fast ongassing)
    if (val < -50) return '#3b82f6'; // Blue (Moderate ongassing)
    if (val < 0) return '#93c5fd'; // Light Blue (Slow ongassing)
    if (val === 0) return '#f3f4f6'; // Equilibrium (Gray)
    if (val < 50) return '#bbf7d0'; // Safe Offgassing (Light Green)
    if (val < 80) return '#22c55e'; // Safe Offgassing (Green)
    if (val < 99) return '#eab308'; // Caution (Yellow)
    return '#ef4444'; // Deco/M-Value (Red)
  };

  return (
    <div className='mt-2 px-1 sm:px-0'>
      <div className='flex items-center justify-between mb-1 px-1'>
        <h3 className='text-[10px] font-bold text-gray-500 uppercase tracking-wider'>
          Tissue Loading (ZH-L16)
        </h3>
        <p className='text-[10px] text-gray-400'>GF99% Evolution</p>
      </div>

      <div className='relative overflow-hidden border border-gray-200 rounded-md bg-gray-50'>
        {/* The Heatmap Grid */}
        <div className='flex h-32 w-full'>
          {/* Y-Axis Labels (Compartments) */}
          <div className='flex flex-col justify-between h-full py-1 text-[7px] font-mono text-gray-400 select-none w-10 text-right pr-1'>
            {HALFTIMES.slice()
              .reverse()
              .map((ht, i) => (
                <span key={i}>{ht}m</span>
              ))}
          </div>

          {/* Heatmap Columns */}
          <div className='flex-1 flex h-full border-l border-gray-200 mr-8 relative'>
            {processedData.map((col, colIdx) => (
              <div key={colIdx} className='flex-1 flex flex-col-reverse h-full group relative'>
                {col.values.map((val, rowIdx) => (
                  <div
                    key={rowIdx}
                    className='flex-1 w-full border-[0.5px] border-white/10'
                    style={{ backgroundColor: getColor(val) }}
                  >
                    {/* Simple Tooltip on hover */}
                    <div className='hidden group-hover:block absolute z-10 bottom-full left-0 bg-gray-900 text-white p-2 rounded text-[10px] whitespace-nowrap pointer-events-none mb-1 shadow-xl'>
                      Time: {col.time.toFixed(1)}m<br />
                      Comp: {HALFTIMES[rowIdx]}m<br />
                      Load: {val}%
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Gas Change Markers */}
            {gasMarkers.map((m, i) => (
              <div
                key={`gas-${i}`}
                className='absolute top-0 bottom-0 border-l-2 border-dashed border-white/40 pointer-events-none'
                style={{ left: `${m.left}%` }}
              >
                {m.label && (
                  <div className='absolute top-1 left-1 bg-white/20 backdrop-blur-sm text-[8px] font-bold text-white px-1 rounded'>
                    {m.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* X-Axis Legend */}
        <div className='flex justify-between mt-1 text-[8px] font-mono text-gray-400 border-t border-gray-200 pt-1'>
          <span>0 min</span>
          <span>{processedData[processedData.length - 1].time.toFixed(0)} min</span>
        </div>
      </div>

      {/* Legend */}
      <div className='mt-2 flex flex-wrap gap-4 justify-center text-[10px] text-gray-500'>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-[#1e3a8a] rounded-sm'></div>
          <span>Ongassing</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-[#93c5fd] rounded-sm'></div>
          <span>Near Equilibrium</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-[#22c55e] rounded-sm'></div>
          <span>Safe Offgassing</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-yellow-500 rounded-sm'></div>
          <span>Caution (80-99%)</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-red-500 rounded-sm'></div>
          <span>&gt;100% (Deco)</span>
        </div>
        {gasMarkers.length > 0 && (
          <div className='flex items-center gap-1'>
            <div className='w-4 h-0.5 border-l-2 border-dashed border-gray-400'></div>
            <span>Gas Change</span>
          </div>
        )}
      </div>
    </div>
  );
};

TissueHeatmap.propTypes = {
  heatmapData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  samples: PropTypes.arrayOf(PropTypes.object),
  events: PropTypes.arrayOf(PropTypes.object),
};

export default TissueHeatmap;
