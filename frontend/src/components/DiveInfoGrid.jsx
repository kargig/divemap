import { Row, Col } from 'antd';
import { Grid } from 'antd-mobile';
import { Calendar, Clock, Eye, TrendingUp, User } from 'lucide-react';
import React from 'react';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { getTagColor } from '../utils/tagHelpers';

const DiveInfoGrid = ({ dive, hasDeco, isMobile, formatDate, formatTime }) => {
  return (
    <>
      <div className='flex items-center gap-2 mb-4 pb-2 border-b border-gray-100'>
        <h2 className='text-xl font-semibold'>Dive Information</h2>
        {hasDeco && (
          <span className='text-red-500 font-medium text-sm border border-red-200 bg-red-50 px-2 py-0.5 rounded'>
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
                  <TrendingUp className='w-4 h-4 text-gray-400' />
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
                  <Clock className='w-4 h-4 text-gray-400' />
                  <span className='text-sm font-bold text-gray-900'>
                    {dive.duration || '-'}
                    <span className='text-xs font-normal text-gray-400 ml-0.5'>min</span>
                  </span>
                </div>
              </div>
            </Grid.Item>

            {dive.average_depth && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Avg Depth
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <TrendingUp size={15} className='text-gray-500' />
                    <span className='text-sm font-medium'>{dive.average_depth}m</span>
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
                    <Eye size={15} className='text-gray-500' />
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

            {dive.suit_type && (
              <Grid.Item>
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Suit
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <User size={15} className='text-gray-500' />
                    <span className='text-sm font-medium capitalize'>
                      {dive.suit_type.replace('_', ' ')}
                    </span>
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
                    <TrendingUp className='w-4 h-4 text-gray-400' />
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
                    <Clock className='w-4 h-4 text-gray-400' />
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
              {dive.average_depth && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <TrendingUp size={15} className='text-gray-500' />
                    <span className='text-sm text-gray-600'>Avg Depth:</span>
                    <span className='font-medium'>{dive.average_depth}m</span>
                  </div>
                </Col>
              )}

              {dive.visibility_rating && (
                <Col xs={24} sm={12} md={6}>
                  <div className='flex items-center gap-2'>
                    <Eye size={15} className='text-gray-500' />
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
