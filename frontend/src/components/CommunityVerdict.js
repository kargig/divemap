import { UserOutlined, TrophyOutlined, RocketOutlined } from '@ant-design/icons';
import { Card, Progress, Avatar, Tooltip, ConfigProvider } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import ShellRating from './ui/ShellRating';

const CommunityVerdict = ({ diveSite, onRate, isSubmitting, compact = false }) => {
  const { average_rating, total_ratings, user_rating } = diveSite;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRate = value => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    onRate(value);
  };

  const getVerdictMessage = () => {
    if (total_ratings === 0)
      return { text: 'Be the first to discover this gem! 💎', icon: <RocketOutlined /> };
    if (average_rating >= 9) return { text: 'A community favorite! 🏆', icon: <TrophyOutlined /> };
    if (average_rating >= 7)
      return { text: 'Highly recommended by divers.', icon: <TrophyOutlined /> };
    return { text: 'Divers have shared their thoughts.', icon: <UserOutlined /> };
  };

  const message = getVerdictMessage();

  // Calculate percentage for progress circle (scale 0-10)
  const percent = average_rating ? average_rating * 10 : 0;

  // Custom stroke color based on rating
  const strokeColor = average_rating >= 8 ? '#10b981' : average_rating >= 6 ? '#f59e0b' : '#ef4444';

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3b82f6',
        },
      }}
    >
      <div>
        <Card
          bordered={!compact}
          className={
            compact
              ? 'bg-transparent shadow-none'
              : 'shadow-sm border border-gray-100 bg-gradient-to-br from-blue-50/50 to-white'
          }
          bodyStyle={{ padding: compact ? '0' : '24px' }}
        >
          <div
            className={`flex flex-col md:flex-row items-center gap-6 ${!compact ? 'justify-between' : 'justify-start'}`}
          >
            {/* Left: Verdict & Message */}
            <div className={`flex items-center gap-4 ${!compact ? 'flex-1' : ''}`}>
              <div className='relative flex-shrink-0'>
                <Progress
                  type='circle'
                  percent={percent}
                  format={() => (
                    <div className='flex flex-col items-center'>
                      <span className='text-2xl font-bold text-gray-800'>
                        {average_rating ? average_rating.toFixed(1) : '-'}
                      </span>
                      <span className='text-xs text-gray-500'>/ 10</span>
                    </div>
                  )}
                  width={compact ? 70 : 80}
                  strokeColor={strokeColor}
                  strokeWidth={8}
                />
              </div>

              <div className='flex flex-col min-w-[140px]'>
                <h3
                  className={`font-bold text-gray-900 m-0 flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}
                >
                  Community Verdict
                </h3>
                <p className='text-gray-600 text-xs mt-1 mb-1 flex items-center gap-2 whitespace-nowrap'>
                  {message.icon}
                  {message.text}
                </p>

                {/* Social Proof Avatars */}
                {total_ratings > 0 && (
                  <div className='flex items-center gap-2 mt-1'>
                    <Avatar.Group maxCount={3} size='small'>
                      {[...Array(Math.min(total_ratings, 3))].map((_, i) => (
                        <Tooltip title='Verified Diver' key={i}>
                          <Avatar
                            style={{
                              backgroundColor: `hsl(${200 + i * 20}, 70%, 50%)`,
                              width: 20,
                              height: 20,
                            }}
                            icon={<UserOutlined style={{ fontSize: 10 }} />}
                          />
                        </Tooltip>
                      ))}
                    </Avatar.Group>
                    <span className='text-[10px] text-gray-500'>
                      {total_ratings} {total_ratings === 1 ? 'rating' : 'ratings'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Context for User */}
            <div
              className={`hidden md:flex flex-col items-end min-w-[180px] ${!compact ? 'border-l border-gray-100 pl-6' : 'ml-4'}`}
            >
              <span className='text-[11px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider'>
                {!user ? 'Log in to rate' : user_rating ? 'Your Rating' : "What's your verdict?"}
              </span>
              <div className='relative'>
                <ShellRating
                  value={user_rating || 0}
                  onChange={handleRate}
                  disabled={isSubmitting}
                  size={compact ? 20 : 24}
                  gap={compact ? 2 : 4}
                />
                {isSubmitting && (
                  <div className='absolute inset-0 bg-white/50 flex items-center justify-center'>
                    <span className='text-xs text-blue-600 animate-pulse'>Saving...</span>
                  </div>
                )}
              </div>
              {!user_rating && user && (
                <span className='text-[10px] text-blue-500 mt-1 font-medium'>
                  Tap to rate instantly
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </ConfigProvider>
  );
};

CommunityVerdict.propTypes = {
  diveSite: PropTypes.object.isRequired,
  onRate: PropTypes.func,
  isSubmitting: PropTypes.bool,
  compact: PropTypes.bool,
};

export default CommunityVerdict;
