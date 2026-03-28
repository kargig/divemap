import { Row, Col } from 'antd';
import { Grid } from 'antd-mobile';
import { Calendar, Clock, Eye, TrendingUp, User, Notebook, Wind, Droplets } from 'lucide-react';
import React from 'react';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { getTagColor } from '../utils/tagHelpers';
import { formatGases } from '../utils/textHelpers';

const DiveInfoGrid = ({ dive, hasDeco, isMobile, formatDate, formatTime }) => {
  const formatGasDisplay = gasStr => {
    if (!gasStr) return '-';
    try {
      // Check if it's JSON (structured gas data)
      if (gasStr.startsWith('{')) {
        const data = JSON.parse(gasStr);
        if (data.mode === 'structured') {
          const backGas = data.back_gas?.tank ? `${data.back_gas.tank}L` : '';
          const gasInfo = data.back_gas?.gas?.o2 ? ` (EAN${data.back_gas.gas.o2})` : '';
          const stages = data.stages?.length > 0 ? ` + ${data.stages.length} Stg` : '';
          return `${backGas}${gasInfo}${stages}` || 'Standard';
        }
      }
    } catch (e) {
      // Not JSON or parse error, fall back to original string
    }
    return formatGases(gasStr);
  };

  const renderTankIcon = tanks => {
    if (!tanks) return null;
    let isDoubles = false;

    try {
      const isDoublesVolume = name => {
        const n = String(name).toLowerCase();
        return (
          n.includes('double') ||
          n.includes('twin') ||
          n.startsWith('d') ||
          ['14', '16', '20', '24', '30'].includes(n)
        );
      };

      if (tanks.startsWith('{')) {
        const data = JSON.parse(tanks);
        if (data.mode === 'structured') {
          const tankName = data.back_gas?.tank || '';
          isDoubles = isDoublesVolume(tankName);
        }
      } else {
        isDoubles = isDoublesVolume(tanks);
      }
    } catch (e) {
      // fallback
    }

    return (
      <img
        src={isDoubles ? '/doubles.png' : '/single.png'}
        alt='tank'
        className='w-4 h-4 object-contain'
      />
    );
  };

  return (
    <>
      <div className='flex items-center gap-2 mb-4 pb-2 border-b border-gray-100'>
        <Notebook className='h-5 w-5 text-blue-600' />
        <h2 className='text-xl font-semibold'>Dive Information</h2>
        {hasDeco && (
          <span className='text-red-500 font-medium text-sm border border-red-200 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1'>
            <Droplets className='w-3 h-3' />
            Deco
          </span>
        )}
      </div>

      {isMobile ? (
        // Mobile View: Ant Design Mobile Grid
        <div className='mb-4'>
          <Grid columns={2} gap={16}>
            <Grid.Item>
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Difficulty
                </span>
                <div className='flex items-center mt-0.5'>
                  {dive.difficulty_code ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                    >
                      {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                    </span>
                  ) : (
                    <span className='text-sm text-gray-500'>-</span>
                  )}
                </div>
              </div>
            </Grid.Item>

            <Grid.Item>
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Date & Time
                </span>
                <div className='flex items-center gap-1.5'>
                  <Calendar className='w-4 h-4 text-gray-400' />
                  <span className='text-sm font-medium text-gray-900'>
                    {formatDate(dive.dive_date)}
                    {dive.dive_time && (
                      <span className='text-gray-500 font-normal ml-1'>
                        {formatTime(dive.dive_time)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Grid.Item>

            <Grid.Item>
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Max Depth
                </span>
                <div className='flex items-center gap-1.5'>
                  <TrendingUp className='w-4 h-4 text-blue-500' />
                  <span className='text-sm font-bold text-gray-900'>
                    {dive.max_depth || '-'}
                    <span className='text-xs font-normal text-gray-400 ml-0.5'>m</span>
                  </span>
                </div>
              </div>
            </Grid.Item>

            <Grid.Item>
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Duration
                </span>
                <div className='flex items-center gap-1.5'>
                  <Clock className='w-4 h-4 text-indigo-500' />
                  <span className='text-sm font-bold text-gray-900'>
                    {dive.duration || '-'}
                    <span className='text-xs font-normal text-gray-400 ml-0.5'>min</span>
                  </span>
                </div>
              </div>
            </Grid.Item>

            {dive.gases && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Gases
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <Wind className='w-4 h-4 text-green-500' />
                    <span className='text-sm font-medium'>{formatGases(dive.gases)}</span>
                  </div>
                </div>
              </Grid.Item>
            )}

            {dive.gas_bottles_used && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Tanks
                  </span>
                  <div className='flex items-center gap-1.5'>
                    {renderTankIcon(dive.gas_bottles_used)}
                    <span className='text-sm font-medium'>
                      {formatGasDisplay(dive.gas_bottles_used)}
                    </span>
                  </div>
                </div>
              </Grid.Item>
            )}

            {dive.visibility_rating && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Visibility
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <Eye size={15} className='text-cyan-500' />
                    <span className='text-sm font-medium'>{dive.visibility_rating}/10</span>
                  </div>
                </div>
              </Grid.Item>
            )}

            {dive.user_rating && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Rating
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <img
                      src='/arts/divemap_shell.png'
                      alt='Rating'
                      className='w-4 h-4 object-contain'
                    />
                    <span className='text-sm font-medium'>{dive.user_rating}/10</span>
                  </div>
                </div>
              </Grid.Item>
            )}

            <Grid.Item span={2}>
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Tags
                </span>
                {dive.tags && dive.tags.length > 0 ? (
                  <div className='flex flex-wrap gap-2 mt-0.5'>
                    {dive.tags.map(tag => (
                      <span
                        key={tag.id}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag.name)}`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className='text-sm text-gray-400'>-</span>
                )}
              </div>
            </Grid.Item>
          </Grid>
        </div>
      ) : (
        // Desktop View
        <>
          <div className='mb-4'>
            <Row gutter={[32, 16]}>
              <Col>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Difficulty
                  </span>
                  <div className='flex items-center mt-0.5'>
                    {dive.difficulty_code ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                      >
                        {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                      </span>
                    ) : (
                      <span className='text-sm text-gray-500'>-</span>
                    )}
                  </div>
                </div>
              </Col>

              <Col>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Max Depth
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <TrendingUp className='w-4 h-4 text-blue-500' />
                    <span className='text-sm font-bold text-gray-900'>
                      {dive.max_depth || '-'}
                      <span className='text-xs font-normal text-gray-400 ml-0.5'>m</span>
                    </span>
                  </div>
                </div>
              </Col>

              <Col>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Duration
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <Clock className='w-4 h-4 text-indigo-500' />
                    <span className='text-sm font-bold text-gray-900'>
                      {dive.duration || '-'}
                      <span className='text-xs font-normal text-gray-400 ml-0.5'>min</span>
                    </span>
                  </div>
                </div>
              </Col>

              <Col>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Date & Time
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <Calendar className='w-4 h-4 text-gray-400' />
                    <span className='text-sm font-medium text-gray-900'>
                      {formatDate(dive.dive_date)}
                      {dive.dive_time && (
                        <span className='text-gray-500 font-normal ml-1'>
                          {formatTime(dive.dive_time)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </Col>

              <Col flex='auto'>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Tags
                  </span>
                  {dive.tags && dive.tags.length > 0 ? (
                    <div className='flex flex-wrap gap-2 mt-0.5'>
                      {dive.tags.map(tag => (
                        <span
                          key={tag.id}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag.name)}`}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className='text-sm text-gray-400'>-</span>
                  )}
                </div>
              </Col>
            </Row>
          </div>

          <div className='mb-4'>
            <Row gutter={[16, 16]}>
              {dive.gases && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <Wind size={15} className='text-green-500' />
                    <span className='text-sm text-gray-600'>Gases:</span>
                    <span className='font-medium'>{formatGases(dive.gases)}</span>
                  </div>
                </Col>
              )}

              {dive.gas_bottles_used && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    {renderTankIcon(dive.gas_bottles_used)}
                    <span className='text-sm text-gray-600'>Tanks:</span>
                    <span className='font-medium'>{formatGasDisplay(dive.gas_bottles_used)}</span>
                  </div>
                </Col>
              )}

              {dive.average_depth && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <TrendingUp size={15} className='text-blue-500' />
                    <span className='text-sm text-gray-600'>Avg Depth:</span>
                    <span className='font-medium'>{dive.average_depth}m</span>
                  </div>
                </Col>
              )}

              {dive.visibility_rating && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <Eye size={15} className='text-cyan-500' />
                    <span className='text-sm text-gray-600'>Visibility:</span>
                    <span className='font-medium'>{dive.visibility_rating}/10</span>
                  </div>
                </Col>
              )}

              {dive.user_rating && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <img
                      src='/arts/divemap_shell.png'
                      alt='Rating'
                      className='w-4 h-4 object-contain'
                    />
                    <span className='text-sm text-gray-600'>Rating:</span>
                    <span className='font-medium'>{dive.user_rating}/10</span>
                  </div>
                </Col>
              )}

              {dive.suit_type && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <User size={15} className='text-gray-500' />
                    <span className='text-sm text-gray-600'>Suit:</span>
                    <span className='font-medium capitalize'>
                      {dive.suit_type.replace('_', ' ')}
                    </span>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        </>
      )}
    </>
  );
};

export default DiveInfoGrid;
