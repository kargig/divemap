import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

const Button = ({
  children,
  onClick,
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  disabled = false,
  type = 'button',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors shadow-sm';

  const variants = {
    primary:
      'border border-transparent text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500',
    danger: 'border border-transparent text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 shadow-none border-transparent',
    white: 'bg-white border border-blue-600 text-blue-600 hover:bg-blue-50', // For things like "Full Map View"
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm leading-4',
    md: 'px-3 py-2 text-sm leading-4',
    lg: 'px-4 py-2 text-base',
  };

  const classes = `
    ${baseStyles}
    ${variants[variant] || variants.primary}
    ${sizes[size] || sizes.md}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `
    .trim()
    .replace(/\s+/g, ' ');

  const content = (
    <>
      {icon && <span className={`flex-shrink-0 ${children ? 'mr-1.5' : ''} -ml-0.5`}>{icon}</span>}
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...props}>
      {content}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  to: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost', 'white']),
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  className: PropTypes.string,
  icon: PropTypes.node,
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default Button;
