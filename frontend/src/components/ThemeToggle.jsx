import { Sun, Moon, Monitor, Check } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useRef, useEffect } from 'react';

import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ variant = 'desktop', className = '' }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const options = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];

  if (variant === 'segmented') {
    return (
      <div
        className={`flex items-center p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 w-full ${className}`}
      >
        {options.map(({ key, label, icon: Icon }) => {
          const isActive = theme === key;
          return (
            <button
              key={key}
              type='button'
              onClick={() => setTheme(key)}
              aria-label={`Switch to ${label.toLowerCase()} theme`}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className='w-4 h-4 flex-shrink-0' />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Desktop icon dropdown variant
  const CurrentIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        aria-label='Toggle theme'
        aria-expanded={isOpen}
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        className='p-2 rounded-full text-white hover:text-blue-200 hover:bg-white/10 transition-colors focus:outline-none flex items-center justify-center'
      >
        <CurrentIcon className='w-5 h-5 transition-transform duration-200' />
      </button>

      {isOpen && (
        <div className='absolute right-0 mt-2 w-40 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-100'>
          <div className='px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500'>
            Appearance
          </div>
          {options.map(({ key, label, icon: Icon }) => {
            const isSelected = theme === key;
            return (
              <button
                key={key}
                type='button'
                onClick={() => {
                  setTheme(key);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                  isSelected
                    ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/60 dark:bg-blue-950/40'
                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className='flex items-center gap-2.5'>
                  <Icon className='w-4 h-4' />
                  <span>{label}</span>
                </div>
                {isSelected && <Check className='w-4 h-4' />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

ThemeToggle.propTypes = {
  variant: PropTypes.oneOf(['desktop', 'segmented']),
  className: PropTypes.string,
};

export default ThemeToggle;
