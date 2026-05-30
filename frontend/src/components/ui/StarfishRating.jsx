import { Rate, ConfigProvider } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

const StarfishRating = ({ value, onChange, disabled, readOnly, size = 28, gap = 4, className }) => {
  // Custom character component using the starfish SVG
  const StarfishIcon = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <img
        src='/arts/starfish-2.svg'
        alt='starfish'
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'grayscale(100%) opacity(0.3)', // Default state (unselected)
          transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        className='starfish-icon'
      />
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#f59e0b',
        },
        components: {
          Rate: {
            starSize: size,
          },
        },
      }}
    >
      <div className={`starfish-rating-container ${className || ''}`}>
        <style>
          {`
            /* Remove grayscale for full, half, active (hover), and focused (touch/keyboard) stars */
            .starfish-rating-container .ant-rate-star-full .starfish-icon,
            .starfish-rating-container .ant-rate-star-half .starfish-icon,
            .starfish-rating-container .ant-rate-star-active .starfish-icon,
            .starfish-rating-container .ant-rate-star-focused .starfish-icon {
              filter: none !important;
              opacity: 1 !important;
              transform: scale(1.1);
            }
            
            /* Add a subtle scale effect to the stars being hovered over */
            .starfish-rating-container .ant-rate-star-active .starfish-icon {
              transform: scale(1.1);
            }

            /* The specifically hovered star gets a slightly larger pop */
            .starfish-rating-container .ant-rate-star:hover .starfish-icon {
              transform: scale(1.25) !important;
            }
            
            .starfish-rating-container .ant-rate-star-second {
              color: transparent;
            }
          `}
        </style>
        <Rate
          character={StarfishIcon}
          count={10}
          value={value}
          onChange={onChange}
          disabled={disabled || readOnly}
          allowHalf={true}
          style={{
            fontSize: size,
            display: 'inline-flex',
            gap: gap,
            flexWrap: 'nowrap',
          }}
        />
      </div>
    </ConfigProvider>
  );
};

StarfishRating.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  size: PropTypes.number,
  gap: PropTypes.number,
  className: PropTypes.string,
};

export default StarfishRating;
