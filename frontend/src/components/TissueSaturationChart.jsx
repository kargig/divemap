import PropTypes from 'prop-types';
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

const HALFTIMES = [5, 8, 12.5, 18.5, 27, 38.3, 54.3, 77, 109, 146, 187, 239, 305, 390, 498, 635];

/**
 * Visualizes tissue saturation for all 16 Bühlmann compartments at the end of a dive.
 */
const TissueSaturationChart = ({ saturationData, gfHigh }) => {
  const data = useMemo(() => {
    if (!saturationData || saturationData.length !== 16) return [];
    return saturationData.map((gf99, index) => ({
      name: `C${index + 1}`,
      halftime: HALFTIMES[index],
      gf99: gf99,
      display_name: `${HALFTIMES[index]}m`,
    }));
  }, [saturationData]);

  if (data.length === 0) return null;

  return (
    <div className='mt-8 px-4 sm:px-0'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>Final Tissue Status</h3>
          <p className='text-sm text-gray-500'>
            Relative saturation (GF99) of all 16 Bühlmann ZH-L16 compartments after surfacing.
          </p>
        </div>
        {gfHigh && (
          <div className='text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100'>
            GF High: {gfHigh}
          </div>
        )}
      </div>

      <div className='h-64 w-full'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
            barCategoryGap='20%'
          >
            <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f0f0f0' />
            <XAxis
              dataKey='display_name'
              fontSize={10}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Compartment Halftime (min)',
                position: 'bottom',
                offset: 0,
                fontSize: 10,
              }}
            />
            <YAxis
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[0, dataMax => Math.max(110, dataMax)]}
              unit='%'
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className='bg-white p-2 border border-gray-200 rounded shadow-sm text-xs'>
                      <div className='font-bold mb-1'>Compartment {d.name}</div>
                      <div>Halftime: {d.halftime} min</div>
                      <div className='mt-1'>
                        Saturation: <span className='font-mono font-bold'>{d.gf99}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={100}
              stroke='#ef4444'
              strokeDasharray='3 3'
              label={{ position: 'right', value: 'M-Value', fill: '#ef4444', fontSize: 10 }}
            />
            {gfHigh && (
              <ReferenceLine
                y={gfHigh}
                stroke='#3b82f6'
                strokeDasharray='5 5'
                label={{ position: 'right', value: 'GF High', fill: '#3b82f6', fontSize: 10 }}
              />
            )}
            <Bar dataKey='gf99' radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => {
                let color = '#22c55e'; // Green (< 80%)
                if (entry.gf99 > 100)
                  color = '#ef4444'; // Red (> M-Value)
                else if (entry.gf99 > 80)
                  color = '#eab308'; // Yellow (Near M-Value)
                else if (gfHigh && entry.gf99 > gfHigh) color = '#3b82f6'; // Blue (Above GF High but below M-Value)

                return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className='mt-4 flex flex-wrap gap-4 justify-center text-[10px] text-gray-500'>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-green-500 opacity-80 rounded-sm'></div>
          <span>Safe (&lt;80%)</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-yellow-500 opacity-80 rounded-sm'></div>
          <span>Caution (80-100%)</span>
        </div>
        <div className='flex items-center gap-1'>
          <div className='w-3 h-3 bg-red-500 opacity-80 rounded-sm'></div>
          <span>Over M-Value (&gt;100%)</span>
        </div>
        {gfHigh && (
          <div className='flex items-center gap-1'>
            <div className='w-3 h-3 bg-blue-500 opacity-80 rounded-sm'></div>
            <span>Above GF High</span>
          </div>
        )}
      </div>
    </div>
  );
};

TissueSaturationChart.propTypes = {
  saturationData: PropTypes.arrayOf(PropTypes.number),
  gfHigh: PropTypes.number,
};

export default TissueSaturationChart;
