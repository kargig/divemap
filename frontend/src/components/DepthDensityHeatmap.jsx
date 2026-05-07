import React from 'react';

const MAX_DEPTH_BINS = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-80', '80+'];

const AVG_DEPTH_BINS = ['0-5', '5-10', '10-15', '15-20', '20-25', '25-30', '30+'];

const DepthDensityHeatmap = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className='text-gray-500 text-sm mt-2'>Not enough dive data to generate heatmap.</p>;
  }

  // Find max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Helper to get color intensity based on count
  const getColor = count => {
    if (count === 0) return 'bg-gray-50';

    const ratio = count / maxCount;
    // We use a progressive blue scale matching Divemap's brand
    if (ratio <= 0.2) return 'bg-blue-100';
    if (ratio <= 0.4) return 'bg-blue-300';
    if (ratio <= 0.6) return 'bg-blue-500';
    if (ratio <= 0.8) return 'bg-blue-700';
    return 'bg-blue-900';
  };

  // Convert array to dictionary for easy lookup
  const dataMap = data.reduce((acc, item) => {
    acc[`${item.max_bin}|${item.avg_bin}`] = item.count;
    return acc;
  }, {});

  return (
    <div className='mt-6 text-center'>
      <h3 className='text-md font-semibold text-gray-800 mb-2'>Depth Density Heatmap</h3>
      <p className='text-xs text-gray-500 mb-6'>Max Depth vs. Average Depth (Meters)</p>

      <div className='flex justify-center overflow-x-auto pb-4'>
        <div className='flex min-w-max'>
          {/* Y-Axis Labels (Avg Depth) */}
          <div className='flex flex-col gap-1 pr-3 mt-[52px] sm:mt-[64px]'>
            {AVG_DEPTH_BINS.map(label => (
              <div
                key={label}
                className='h-8 sm:h-12 lg:h-14 flex items-center justify-end text-[10px] sm:text-xs text-gray-500 w-12 text-right'
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid Area */}
          <div>
            {/* X-Axis Labels (Max Depth) */}
            <div className='flex gap-1 mb-2'>
              {MAX_DEPTH_BINS.map(label => (
                <div key={label} className='w-8 sm:w-16 lg:w-20 relative h-10 sm:h-12'>
                  <span className='absolute bottom-0 left-1/2 text-[10px] sm:text-xs text-gray-500 origin-bottom-left -rotate-45 whitespace-nowrap'>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Matrix */}
            <div className='flex gap-1'>
              {MAX_DEPTH_BINS.map(maxBin => (
                <div key={maxBin} className='flex flex-col gap-1'>
                  {AVG_DEPTH_BINS.map(avgBin => {
                    const count = dataMap[`${maxBin}|${avgBin}`] || 0;

                    // Parse bin starts for safety check (don't highlight Avg > Max)
                    const avgStart = parseInt(avgBin.split('-')[0]);
                    const maxStart = parseInt(maxBin.split('-')[0]);

                    const isImpossible = avgStart > maxStart;

                    return (
                      <div
                        key={`${maxBin}-${avgBin}`}
                        className={`w-8 h-8 sm:w-16 sm:h-12 lg:w-20 lg:h-14 rounded-sm ${isImpossible ? 'bg-gray-50/30' : getColor(count)} transition-all hover:ring-2 hover:ring-blue-400 group relative cursor-help flex items-center justify-center`}
                        title={
                          count > 0
                            ? `${count} dive(s): Max ${maxBin}m, Avg ${avgBin}m`
                            : isImpossible
                              ? ''
                              : '0 dives'
                        }
                      >
                        {count > 0 && (
                          <span
                            className={`text-[10px] sm:text-xs font-medium ${count > maxCount * 0.4 ? 'text-white' : 'text-gray-700'}`}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* X-Axis Legend */}
            <div className='mt-4 text-center text-[10px] sm:text-xs text-gray-400'>
              Maximum Depth (m)
            </div>
          </div>

          {/* Y-Axis Legend (Vertical) */}
          <div className='flex items-center ml-4 sm:ml-8'>
            <div className='text-[10px] sm:text-xs text-gray-400 -rotate-90 whitespace-nowrap'>
              Average Depth (m)
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className='flex items-center justify-end gap-2 mt-4 text-[10px] text-gray-400'>
        <span>Fewer Dives</span>
        <div className='w-2.5 h-2.5 rounded-sm bg-blue-100' />
        <div className='w-2.5 h-2.5 rounded-sm bg-blue-300' />
        <div className='w-2.5 h-2.5 rounded-sm bg-blue-500' />
        <div className='w-2.5 h-2.5 rounded-sm bg-blue-700' />
        <div className='w-2.5 h-2.5 rounded-sm bg-blue-900' />
        <span>More Dives</span>
      </div>
    </div>
  );
};

export default DepthDensityHeatmap;
