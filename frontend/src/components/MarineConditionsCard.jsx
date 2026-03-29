import { Row, Col, Statistic, Descriptions, Tooltip, Tabs, Spin } from 'antd';
import { Waves, Thermometer, Wind } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import { formatWindSpeed, formatWindDirection } from '../utils/windSuitabilityHelpers';

const WeatherConditionsCard = ({ windData, loading }) => {
  if (loading) {
    return (
      <div className='p-8 text-center'>
        <Spin size='large' />
        <div className='mt-4 text-gray-500'>Loading current weather data...</div>
      </div>
    );
  }

  if (!windData || !windData.points || windData.points.length === 0) {
    return <div className='p-4 text-center text-gray-500'>No weather data available.</div>;
  }

  // Use the first point (single point query result)
  const data = windData.points[0];

  // Helper to format values
  const formatValue = (val, unit) =>
    val !== null && val !== undefined ? `${val.toFixed(1)} ${unit}` : 'N/A';

  // Wind color logic
  const getWindColor = speed => {
    if (speed < 5) return '#3f8600'; // Green
    if (speed < 8) return '#1677ff'; // Blue
    if (speed < 11) return '#d48806'; // Orange
    return '#cf1322'; // Red
  };

  const marineContent = (
    <Row gutter={[16, 16]} className='pt-2'>
      {/* Main Stats */}
      <Col span={12}>
        <Statistic
          title={
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-tight'>
              Wave Height
            </span>
          }
          value={data.wave_height}
          precision={1}
          suffix={<span className='text-xs sm:text-sm text-gray-400'>m</span>}
          styles={{
            content: {
              color:
                data.wave_height > 1.5 ? '#cf1322' : data.wave_height > 0.8 ? '#d48806' : '#3f8600',
              fontSize: 'clamp(1rem, 4vw, 1.5rem)',
              fontWeight: 700,
            },
          }}
        />
      </Col>
      <Col span={12}>
        <Statistic
          title={
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-tight'>
              Sea Temp
            </span>
          }
          value={data.sea_surface_temperature}
          precision={1}
          suffix={<span className='text-xs sm:text-sm text-gray-400'>°C</span>}
          prefix={<Thermometer className='w-3 h-3 sm:w-4 sm:h-4 mr-1 text-gray-400' />}
          styles={{
            content: {
              fontSize: 'clamp(1rem, 4vw, 1.5rem)',
              fontWeight: 700,
            },
          }}
        />
      </Col>

      {/* Detailed Breakdown */}
      <Col span={24}>
        <Descriptions
          size='small'
          column={1}
          bordered
          styles={{
            label: {
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#6b7280',
              textTransform: 'uppercase',
              padding: '6px 8px',
              width: '45%',
            },
            content: { fontSize: '13px', color: '#374151', padding: '6px 8px', fontWeight: 500 },
          }}
        >
          <Descriptions.Item label='Wave Dir'>
            {data.wave_direction !== null ? formatWindDirection(data.wave_direction).full : 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label='Wave Period'>
            {formatValue(data.wave_period, 's')}
          </Descriptions.Item>
          <Descriptions.Item label='Swell'>
            {data.swell_wave_height !== null ? (
              <span>
                {formatValue(data.swell_wave_height, 'm')} (
                {formatWindDirection(data.swell_wave_direction).cardinal}) @{' '}
                {formatValue(data.swell_wave_period, 's')}
              </span>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
          <Descriptions.Item label='Tide (MSL)'>
            <Tooltip title='Height above Mean Sea Level (includes tides)'>
              <span className='cursor-help border-b border-dotted border-gray-400 pb-0.5'>
                {formatValue(data.sea_level_height_msl, 'm')}
              </span>
            </Tooltip>
          </Descriptions.Item>
        </Descriptions>
      </Col>
    </Row>
  );

  const windContent = (
    <Row gutter={[8, 16]} className='pt-2'>
      <Col span={12}>
        <Statistic
          title={
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-tight'>
              Wind Speed
            </span>
          }
          value={data.wind_speed_10m}
          precision={1}
          suffix={<span className='text-xs sm:text-sm text-gray-400'>m/s</span>}
          styles={{
            content: {
              color: getWindColor(data.wind_speed_10m),
              fontSize: 'clamp(1rem, 4vw, 1.5rem)',
              fontWeight: 700,
            },
          }}
        />
        <div className='text-[10px] sm:text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider'>
          {data.wind_speed_10m ? `${formatWindSpeed(data.wind_speed_10m).knots} knots` : ''}
        </div>
      </Col>
      <Col span={12}>
        <Statistic
          title={
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 uppercase tracking-tight'>
              Gusts
            </span>
          }
          value={data.wind_gusts_10m}
          precision={1}
          suffix={<span className='text-xs sm:text-sm text-gray-400'>m/s</span>}
          styles={{
            content: {
              fontSize: 'clamp(1rem, 4vw, 1.5rem)',
              fontWeight: 700,
              color: '#4b5563', // gray-600
            },
          }}
        />
        <div className='text-[10px] sm:text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider'>
          {data.wind_gusts_10m ? `${formatWindSpeed(data.wind_gusts_10m).knots} knots` : ''}
        </div>
      </Col>
      <Col span={24}>
        <Descriptions
          size='small'
          column={1}
          bordered
          styles={{
            label: {
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#6b7280',
              textTransform: 'uppercase',
              padding: '6px 8px',
            },
            content: { fontSize: '13px', color: '#374151', padding: '6px 8px', fontWeight: 500 },
          }}
        >
          <Descriptions.Item label='Direction'>
            {data.wind_direction_10m !== null
              ? formatWindDirection(data.wind_direction_10m).full
              : 'N/A'}
          </Descriptions.Item>
        </Descriptions>
      </Col>
    </Row>
  );

  return (
    <div className='bg-white p-4'>
      <Tabs
        defaultActiveKey='marine'
        items={[
          {
            key: 'marine',
            label: (
              <span>
                <Waves className='w-4 h-4 inline mr-1' />
                Marine
              </span>
            ),
            children: marineContent,
          },
          {
            key: 'wind',
            label: (
              <span>
                <Wind className='w-4 h-4 inline mr-1' />
                Wind
              </span>
            ),
            children: windContent,
          },
        ]}
      />
      <div className='mt-4 text-xs text-gray-500 text-right'>
        Source:{' '}
        <a
          href='https://open-meteo.com'
          target='_blank'
          rel='noopener noreferrer'
          className='hover:text-blue-600 underline'
        >
          Open-Meteo
        </a>
      </div>
    </div>
  );
};

WeatherConditionsCard.propTypes = {
  windData: PropTypes.shape({
    points: PropTypes.arrayOf(
      PropTypes.shape({
        wave_height: PropTypes.number,
        wave_direction: PropTypes.number,
        wave_period: PropTypes.number,
        swell_wave_height: PropTypes.number,
        swell_wave_direction: PropTypes.number,
        swell_wave_period: PropTypes.number,
        sea_surface_temperature: PropTypes.number,
        sea_level_height_msl: PropTypes.number,
        wind_speed_10m: PropTypes.number,
        wind_direction_10m: PropTypes.number,
        wind_gusts_10m: PropTypes.number,
      })
    ),
  }),
  loading: PropTypes.bool,
};

export default WeatherConditionsCard;
