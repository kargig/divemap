import { HelpCircle } from 'lucide-react';
import React from 'react';

const GAS_MIXES = [
  'Trimix',
  'Deco Gas (49+)',
  'Nitrox 43-48',
  'Nitrox 37-42',
  'Nitrox 36',
  'Nitrox 33-35',
  'Nitrox 32',
  'Nitrox 29-31',
  'Nitrox 28',
  'Nitrox 22-27',
  'Air',
];
const DEPTH_BINS = ['0-18m', '18-30m', '30-40m', '40-50m', '50m+'];

const GasMixHeatmap = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <p className='text-gray-500 text-sm mt-2'>
        Not enough gas bottle details to generate heatmap.
      </p>
    );
  }

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Helper for color intensity matching existing standards
  const getColor = count => {
    if (count === 0) return 'bg-gray-50';
    const ratio = count / maxCount;
    if (ratio <= 0.2) return 'bg-blue-100';
    if (ratio <= 0.4) return 'bg-blue-300';
    if (ratio <= 0.6) return 'bg-blue-500';
    if (ratio <= 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  // Convert array to dictionary for easy lookup
  const dataMap = data.reduce((acc, item) => {
    acc[`${item.mix}|${item.depth_bin}`] = item.count;
    return acc;
  }, {});

  // Check safe Maximum Operating Depth (MOD) based on PO2 limit of 1.4 bar
  const isMODExceeded = (mix, bin) => {
    const deepBins = ['30-40m', '40-50m', '50m+'];
    const midDeepBins = ['18-30m', '30-40m', '40-50m', '50m+'];

    if (mix === 'Air' && bin === '50m+') return true;
    if (mix === 'Nitrox 22-27' && ['40-50m', '50m+'].includes(bin)) return true;
    if (mix === 'Nitrox 28' && deepBins.includes(bin)) return true;
    if (mix === 'Nitrox 29-31' && deepBins.includes(bin)) return true;
    if (mix === 'Nitrox 32' && deepBins.includes(bin)) return true;
    if (mix === 'Nitrox 33-35' && deepBins.includes(bin)) return true;
    if (mix === 'Nitrox 36' && midDeepBins.includes(bin)) return true;
    if (mix === 'Nitrox 37-42' && midDeepBins.includes(bin)) return true;
    if (mix === 'Nitrox 43-48' && midDeepBins.includes(bin)) return true;
    if (mix === 'Deco Gas (49+)' && midDeepBins.includes(bin)) return true;
    return false;
  };

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow text-center animate-fade-in'>
      <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center justify-center gap-2'>
        Gas Mix vs. Maximum Depth Heatmap
      </h3>
      <p className='text-xs text-gray-500 mb-6'>
        Breathing gas usage counts mapped to maximum depth ranges.
      </p>

      <div className='flex justify-center overflow-x-auto pb-4'>
        <div className='flex min-w-max'>
          {/* Y-Axis Labels (Gas Mixes) */}
          <div className='flex flex-col gap-1 pr-3 mt-[52px] sm:mt-[64px]'>
            {GAS_MIXES.map(mix => {
              const isStandardMix = ['Nitrox 28', 'Nitrox 32', 'Nitrox 36'].includes(mix);
              return (
                <div
                  key={mix}
                  className='h-8 sm:h-12 lg:h-14 flex items-center justify-end w-28 sm:w-32'
                >
                  <span
                    className={`text-[9px] sm:text-xs text-right whitespace-nowrap ${
                      isStandardMix
                        ? 'font-extrabold text-blue-700 bg-blue-50/70 border border-blue-100 rounded px-1.5 py-0.5 shadow-sm'
                        : 'font-semibold text-gray-500'
                    }`}
                  >
                    {mix}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid Matrix Area */}
          <div>
            {/* X-Axis Labels (Depth bins) */}
            <div className='flex gap-1 mb-2'>
              {DEPTH_BINS.map(bin => (
                <div key={bin} className='w-8 sm:w-16 lg:w-20 relative h-10 sm:h-12'>
                  <span className='absolute bottom-0 left-1/2 text-[10px] sm:text-xs text-gray-500 origin-bottom-left -rotate-45 whitespace-nowrap font-semibold'>
                    {bin}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix Cells */}
            <div className='flex gap-1'>
              {DEPTH_BINS.map(bin => (
                <div key={bin} className='flex flex-col gap-1'>
                  {GAS_MIXES.map(mix => {
                    const count = dataMap[`${mix}|${bin}`] || 0;
                    const modViolation = isMODExceeded(mix, bin) && count > 0;
                    const isStandardRow = ['Nitrox 28', 'Nitrox 32', 'Nitrox 36'].includes(mix);
                    const standardHighlight =
                      isStandardRow && count > 0 && !modViolation
                        ? 'ring-1 ring-blue-500/50 ring-offset-[1px]'
                        : '';

                    return (
                      <div
                        key={`${mix}-${bin}`}
                        className={`w-8 h-8 sm:w-16 sm:h-12 lg:w-20 lg:h-14 rounded-sm transition-all hover:ring-2 hover:ring-blue-400 group relative cursor-help flex flex-col items-center justify-center ${standardHighlight} ${
                          modViolation
                            ? 'bg-rose-50 border-2 border-rose-300 hover:ring-rose-400'
                            : getColor(count)
                        }`}
                        title={
                          count > 0
                            ? `${count} dive(s): ${mix} used at Max depth ${bin}${modViolation ? ' (⚠️ Exceeds safe 1.4 bar MOD)' : ''}`
                            : '0 dives'
                        }
                      >
                        {count > 0 && (
                          <span
                            className={`text-[10px] sm:text-xs font-semibold ${
                              modViolation
                                ? 'text-rose-700'
                                : count > maxCount * 0.4
                                  ? 'text-white'
                                  : 'text-gray-700'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                        {modViolation && (
                          <span className='text-[7px] sm:text-[9px] text-rose-600 font-bold bg-white px-0.5 rounded shadow-sm scale-90 sm:scale-100 mt-0.5'>
                            ⚠️ MOD
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-gray-500 mt-4 border-t border-gray-50 pt-4'>
        <HelpCircle className='w-4 h-4 text-gray-400' />
        <span>
          MOD warning dynamically flags high partial pressure of oxygen (PO2 &gt; 1.4 bar) safety
          limits.
        </span>
      </div>
    </div>
  );
};

export default GasMixHeatmap;
