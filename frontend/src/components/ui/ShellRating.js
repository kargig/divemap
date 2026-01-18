import { Rate, ConfigProvider } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

const ShellRating = ({ value, onChange, disabled, readOnly, size = 24, gap = 4, className }) => {
  // Custom character component using the shell image
  const ShellIcon = (
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
        src='/arts/divemap_shell.png'
        alt='shell'
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'grayscale(100%) opacity(0.5)', // Default state (unselected)
          transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        className='shell-icon'
      />
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          // You can customize the active color here if needed,
          // but we'll primarily handle visuals via the CSS/img styles
          colorPrimary: '#f59e0b', // Amber/Orange-like color for the filled state
        },
        components: {
          Rate: {
            starSize: size,
          },
        },
      }}
    >
      <div className={`shell-rating-container ${className || ''}`}>
        <style>
          {`
            /* Remove grayscale for full, half, active (hover), and focused (touch/keyboard) stars */
            .shell-rating-container .ant-rate-star-full .shell-icon,
            .shell-rating-container .ant-rate-star-half .shell-icon,
            .shell-rating-container .ant-rate-star-active .shell-icon,
            .shell-rating-container .ant-rate-star-focused .shell-icon {
              filter: none !important;
              opacity: 1 !important;
              transform: scale(1.1); /* Ensure scale is applied to all active states */
            }
            
            /* Add a subtle scale effect to the stars being hovered over */
            .shell-rating-container .ant-rate-star-active .shell-icon {
              transform: scale(1.1);
            }

            /* The specifically hovered star gets a slightly larger pop */
            .shell-rating-container .ant-rate-star:hover .shell-icon {
              transform: scale(1.25) !important;
            }
            
            .shell-rating-container .ant-rate-star-second {
              color: transparent; /* Hide default star color to let image show */
            }
          `}
        </style>
        <Rate
          character={ShellIcon}
          count={10}
          value={value}
          onChange={onChange}
          disabled={disabled || readOnly}
          allowHalf={true}
          style={{
            fontSize: size,
            display: 'inline-flex',
            gap: gap,
            flexWrap: 'nowrap', // Ensure shells don't wrap weirdly
          }}
        />
      </div>
    </ConfigProvider>
  );
};

ShellRating.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  size: PropTypes.number,
  gap: PropTypes.number,
  className: PropTypes.string,
};

export default ShellRating;
