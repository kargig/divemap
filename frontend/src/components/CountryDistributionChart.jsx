import { Globe } from 'lucide-react';
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#1d4ed8', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#6366f1', '#8b5cf6'];

const CountryDistributionChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <p className='text-gray-500 text-sm mt-2'>
        No country information available in your dive logs.
      </p>
    );
  }

  // Sort descending by count
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  const totalDives = sortedData.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const percentage = ((entry.count / totalDives) * 100).toFixed(1);
      return (
        <div className='bg-white p-3 border border-gray-100 shadow-lg rounded-md text-sm text-left'>
          <p className='font-semibold text-gray-800'>{entry.country}</p>
          <p className='text-gray-600 text-xs mt-1'>
            Dives: <span className='font-semibold'>{entry.count}</span> ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 hover:shadow-md transition-shadow animate-fade-in text-center'>
      <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center justify-center gap-2'>
        <Globe className='w-5 h-5 text-blue-600' />
        Global Dive Travel Distribution
      </h3>
      <p className='text-xs text-gray-500 mb-6'>
        Proportion of logged dives across visited nations.
      </p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-center'>
        {/* Pie/Donut Chart Container */}
        <div className='h-60 w-full flex justify-center relative'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={sortedData}
                dataKey='count'
                nameKey='country'
                cx='50%'
                cy='50%'
                innerRadius='60%'
                outerRadius='80%'
                paddingAngle={3}
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Inner Donut Text */}
          <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
            <span className='text-2xl font-bold text-gray-800'>{totalDives}</span>
            <span className='text-[10px] text-gray-400 uppercase tracking-wider font-semibold'>
              Total Dives
            </span>
          </div>
        </div>

        {/* Custom Sidebar Legend Summary */}
        <div className='flex flex-col justify-center text-left gap-3 max-h-60 overflow-y-auto pr-2'>
          {sortedData.slice(0, 6).map((entry, index) => {
            const pct = ((entry.count / totalDives) * 100).toFixed(1);
            return (
              <div
                key={entry.country}
                className='flex items-center justify-between text-xs pb-1.5 border-b border-gray-50'
              >
                <div className='flex items-center gap-2'>
                  <span
                    className='w-3 h-3 rounded-full shrink-0'
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className='font-medium text-gray-700 truncate max-w-[120px]'>
                    {entry.country}
                  </span>
                </div>
                <span className='text-gray-500 font-semibold'>
                  {entry.count}{' '}
                  <span className='text-gray-400 font-normal text-[10px]'>({pct}%)</span>
                </span>
              </div>
            );
          })}
          {sortedData.length > 6 && (
            <div className='text-[10px] text-gray-400 font-medium text-center pt-1.5'>
              + {sortedData.length - 6} other countries visited
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountryDistributionChart;
