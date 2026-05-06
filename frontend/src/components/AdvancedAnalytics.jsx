import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

const AdvancedAnalytics = ({
  sacData,
  durationData,
  tempData,
  yearlyData,
  sacTimeData,
  depthTimeData,
}) => {
  const hasSacData = sacData && sacData.length > 0;
  const hasDurationData = durationData && durationData.length > 0;
  const hasTempData = tempData && tempData.length > 0;
  const hasYearlyData = yearlyData && yearlyData.length > 0;
  const hasSacTimeData = sacTimeData && sacTimeData.length > 0;
  const hasDepthTimeData = depthTimeData && depthTimeData.length > 0;

  // Process Temp vs Suit data for Stacked Bar Chart
  const processedTempData = useMemo(() => {
    if (!hasTempData) return [];

    // 1. Group data into temperature buckets
    const getBucket = temp => {
      if (temp < 10) return '< 10°C';
      if (temp >= 30) return '30°C+';
      const lower = Math.floor(temp / 2) * 2;
      return `${lower}-${lower + 1}°C`;
    };

    const bucketsOrder = [
      '< 10°C',
      '10-11°C',
      '12-13°C',
      '14-15°C',
      '16-17°C',
      '18-19°C',
      '20-21°C',
      '22-23°C',
      '24-25°C',
      '26-27°C',
      '28-29°C',
      '30°C+',
    ];
    const grouped = {};
    const allSuits = new Set();

    tempData.forEach(item => {
      if (item.temp == null || !item.suit) return;
      const bucket = getBucket(item.temp);
      const suit = item.suit;
      allSuits.add(suit);

      if (!grouped[bucket]) {
        grouped[bucket] = { bucket };
      }
      grouped[bucket][suit] = (grouped[bucket][suit] || 0) + 1;
    });

    // 2. Format for Recharts and sort by temperature bucket
    const result = bucketsOrder.filter(bucket => grouped[bucket]).map(bucket => grouped[bucket]);

    return { data: result, suits: Array.from(allSuits) };
  }, [tempData, hasTempData]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='bg-white p-3 border border-gray-100 shadow-lg rounded-md text-sm'>
          {data.sac && (
            <p>
              <strong>Depth:</strong> {data.depth}m<br />
              <strong>SAC:</strong> {data.sac} L/min
            </p>
          )}
          {data.count && (
            <p>
              <strong>Duration:</strong> {data.duration}m<br />
              <strong>Max Depth:</strong> {data.depth}m<br />
              <strong>Dives:</strong> {data.count}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const suitColors = {
    Wetsuit: '#3b82f6', // blue-500
    Drysuit: '#8b5cf6', // violet-500
    'Semi-dry': '#0ea5e9', // sky-500
    Shorty: '#10b981', // emerald-500
    'None / Rashguard': '#f59e0b', // amber-500
  };
  const getSuitColor = (suit, index) => {
    if (suitColors[suit]) return suitColors[suit];
    // Fallback colors
    const fallbacks = ['#6366f1', '#14b8a6', '#f43f5e', '#8b5cf6', '#d946ef'];
    return fallbacks[index % fallbacks.length];
  };

  if (
    !hasSacData &&
    !hasDurationData &&
    !hasTempData &&
    !hasYearlyData &&
    !hasSacTimeData &&
    !hasDepthTimeData
  )
    return null;

  return (
    <div className='mt-8 space-y-8'>
      {/* SAC vs Depth */}
      {hasSacData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            Air Consumption (SAC) vs. Depth
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Tracking gas efficiency (L/min) at deeper depths.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis
                  type='number'
                  dataKey='depth'
                  name='Depth'
                  unit='m'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                />
                <YAxis
                  type='number'
                  dataKey='sac'
                  name='SAC'
                  unit='L'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name='SAC' data={sacData} fill='#2563eb' opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Duration vs Depth Bubble Chart */}
      {hasDurationData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            Depth Distribution vs. Duration
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Bubble size represents the number of dives at that specific depth/time profile.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis
                  type='number'
                  dataKey='duration'
                  name='Duration'
                  unit='min'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                />
                <YAxis
                  type='number'
                  dataKey='depth'
                  name='Depth'
                  unit='m'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                />
                <ZAxis type='number' dataKey='count' range={[40, 400]} name='Dives' />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name='Dives' data={durationData} fill='#0ea5e9' opacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Temp vs Suit Stacked Bar */}
      {hasTempData && processedTempData && processedTempData.data.length > 0 && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>
            Temperature vs. Exposure Suit
          </h3>
          <p className='text-xs text-gray-500 mb-4'>
            Thermal protection choices based on water temperature ranges.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={processedTempData.data}
                margin={{ top: 10, right: 10, bottom: 10, left: -20 }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey='bucket' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <YAxis tick={{ fontSize: 10 }} stroke='#9ca3af' allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: '0.375rem',
                    border: '1px solid #f3f4f6',
                    fontSize: '14px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType='circle' />
                {processedTempData.suits.map((suit, index) => (
                  <Bar key={suit} dataKey={suit} stackId='a' fill={getSuitColor(suit, index)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dives per Year Bar Chart */}
      {hasYearlyData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>Dives per Year</h3>
          <p className='text-xs text-gray-500 mb-4'>Annual dive activity and progression.</p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={yearlyData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis dataKey='year' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <YAxis tick={{ fontSize: 10 }} stroke='#9ca3af' allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: '0.375rem',
                    border: '1px solid #f3f4f6',
                    fontSize: '14px',
                  }}
                />
                <Bar name='Dives' dataKey='count' fill='#3b82f6' radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SAC Evolution Line Chart */}
      {hasSacTimeData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>SAC Evolution</h3>
          <p className='text-xs text-gray-500 mb-4'>Air consumption rate changes over time.</p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={sacTimeData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                  tickFormatter={val => val.substring(0, 7)} // Show YYYY-MM
                />
                <YAxis unit='L' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0.375rem',
                    border: '1px solid #f3f4f6',
                    fontSize: '14px',
                  }}
                />
                <Line
                  type='monotone'
                  name='SAC'
                  dataKey='sac'
                  stroke='#8b5cf6'
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Depth Evolution Area Chart */}
      {hasDepthTimeData && (
        <div className='bg-white rounded-lg p-4 border border-gray-100'>
          <h3 className='text-md font-semibold text-gray-800 mb-1'>Depth Progression</h3>
          <p className='text-xs text-gray-500 mb-4'>
            Maximum and average depths reached over time.
          </p>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart
                data={depthTimeData}
                margin={{ top: 10, right: 10, bottom: 10, left: -20 }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f3f4f6' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 10 }}
                  stroke='#9ca3af'
                  tickFormatter={val => val.substring(0, 7)}
                />
                <YAxis reversed={true} unit='m' tick={{ fontSize: 10 }} stroke='#9ca3af' />
                <Tooltip
                  contentStyle={{
                    borderRadius: '0.375rem',
                    border: '1px solid #f3f4f6',
                    fontSize: '14px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} iconType='circle' />
                <Area
                  type='monotone'
                  name='Max Depth'
                  dataKey='max'
                  stroke='#1d4ed8'
                  fill='#1d4ed8'
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type='monotone'
                  name='Avg Depth'
                  dataKey='avg'
                  stroke='#38bdf8'
                  fill='#38bdf8'
                  fillOpacity={0.4}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalytics;
