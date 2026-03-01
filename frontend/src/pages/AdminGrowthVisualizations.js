import {
  TrendingUp,
  TrendingDown,
  LineChart as LineChartIcon,
  Calendar,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import usePageTitle from '../hooks/usePageTitle';
import { getGrowthData } from '../services/admin';

const AdminGrowthVisualizations = () => {
  usePageTitle('Divemap - Admin - Growth Visualizations');
  const [period, setPeriod] = useState('3months');

  const {
    data: growthData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery(['growthData', period], () => getGrowthData(period), {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const formatNumber = num => {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercentage = num => {
    if (num === null || num === undefined) return '0.00';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const formatDate = (dateString, includeYear = false) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(includeYear && { year: 'numeric' }),
    });
  };

  // Custom tooltip component (moved outside renderChart to prevent recreation)
  const CustomTooltip = ({ active, payload, color, formatDateFunc, formatNumberFunc }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='bg-white p-3 border border-gray-200 rounded-lg shadow-lg'>
          <p className='text-sm text-gray-600'>{formatDateFunc(data.date, true)}</p>
          <p className='text-lg font-bold' style={{ color }}>
            {formatNumberFunc(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  CustomTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
    color: PropTypes.string,
    formatDateFunc: PropTypes.func,
    formatNumberFunc: PropTypes.func,
  };

  // Chart colors constants
  const CHART_COLORS = {
    dive_sites: '#3b82f6',
    diving_centers: '#10b981',
    dives: '#f59e0b',
    dive_routes: '#8b5cf6',
    dive_trips: '#ec4899',
  };

  /**
   * Render a growth chart for a specific data type
   * @param {Array<{date: string, count: number}>} data - Array of data points with date and count
   * @param {string} label - Chart label/title
   * @param {string} color - Chart color (hex code)
   * @param {string} dataKey - Key for growth rates lookup
   * @returns {JSX.Element|null} Chart component or null if insufficient data
   */
  const renderChart = (data, label, color, dataKey) => {
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // Filter out invalid data points
    const validData = data.filter(item => item && typeof item.count === 'number' && item.date);

    // Need at least 2 valid data points for a meaningful chart
    if (validData.length < 2) return null;

    // Transform data for Recharts (rename 'count' to 'value' and format date)
    const chartData = validData.map(item => ({
      date: item.date,
      dateFormatted: formatDate(item.date),
      value: item.count,
    }));

    return (
      <div className='bg-white p-6 rounded-lg border shadow-sm mb-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <LineChartIcon className='h-5 w-5 mr-2' />
          {label}
        </h3>
        <ResponsiveContainer width='100%' height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor={color} stopOpacity={0.3} />
                <stop offset='95%' stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
            <XAxis
              dataKey='dateFormatted'
              stroke='#6b7280'
              style={{ fontSize: '12px' }}
              interval='preserveStartEnd'
            />
            <YAxis
              stroke='#6b7280'
              style={{ fontSize: '12px' }}
              tickFormatter={value => formatNumber(value)}
            />
            <Tooltip
              content={
                <CustomTooltip
                  color={color}
                  formatDateFunc={formatDate}
                  formatNumberFunc={formatNumber}
                />
              }
            />
            <Area
              type='monotone'
              dataKey='value'
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${dataKey})`}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {/* Current value and growth rate */}
        {growthData?.growth_rates && (
          <div className='mt-4 flex items-center justify-between'>
            <div>
              <p className='text-sm text-gray-600'>Current Count</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(validData[validData.length - 1]?.count || 0)}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-sm text-gray-600'>Growth Rate</p>
              <div className='flex items-center'>
                {(growthData.growth_rates[dataKey] || 0) >= 0 ? (
                  <TrendingUp className='h-4 w-4 text-green-600 mr-1' />
                ) : (
                  <TrendingDown className='h-4 w-4 text-red-600 mr-1' />
                )}
                <span
                  className={`text-lg font-bold ${
                    (growthData.growth_rates[dataKey] || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatPercentage(growthData.growth_rates[dataKey] || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
        <div className='bg-red-50 border border-red-200 rounded-lg p-6 text-center'>
          <p className='text-red-600 mb-4'>Failed to load growth data</p>
          <button
            onClick={() => refetch()}
            className='px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Growth Visualizations</h1>
            <p className='text-gray-600 mt-1'>Track content growth over time</p>
          </div>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <Calendar className='h-5 w-5 text-gray-500' />
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className='border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='week'>Last Week</option>
                <option value='month'>Last Month</option>
                <option value='3months'>Last 3 Months</option>
                <option value='6months'>Last 6 Months</option>
                <option value='year'>Last Year</option>
              </select>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center'
            >
              {isFetching ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <RefreshCw className='h-4 w-4 mr-2' />
              )}
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className='flex justify-center items-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-blue-600' />
          <span className='ml-2 text-gray-600'>Loading growth data...</span>
        </div>
      )}

      {/* Growth Charts */}
      {growthData && !isLoading && growthData.growth_data && (
        <>
          {growthData.growth_data.dive_sites &&
            renderChart(
              growthData.growth_data.dive_sites,
              'Dive Sites',
              CHART_COLORS.dive_sites,
              'dive_sites'
            )}
          {growthData.growth_data.diving_centers &&
            renderChart(
              growthData.growth_data.diving_centers,
              'Diving Centers',
              CHART_COLORS.diving_centers,
              'diving_centers'
            )}
          {growthData.growth_data.dives &&
            renderChart(growthData.growth_data.dives, 'Dives', CHART_COLORS.dives, 'dives')}
          {growthData.growth_data.dive_routes &&
            renderChart(
              growthData.growth_data.dive_routes,
              'Dive Routes',
              CHART_COLORS.dive_routes,
              'dive_routes'
            )}
          {growthData.growth_data.dive_trips &&
            renderChart(
              growthData.growth_data.dive_trips,
              'Dive Trips',
              CHART_COLORS.dive_trips,
              'dive_trips'
            )}
        </>
      )}
    </div>
  );
};

export default AdminGrowthVisualizations;
