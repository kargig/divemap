import PropTypes from 'prop-types';
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'divemap_theme';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (_) {
    return 'light';
  }
};

const applyThemeToDOM = resolved => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-prefers-color-scheme', 'dark');
    root.style.colorScheme = 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0f172a');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-prefers-color-scheme', 'light');
    root.style.colorScheme = 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0072B2');
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Calculate the currently resolved theme
  const resolvedTheme = useMemo(() => {
    if (theme === 'system') return systemTheme;
    return theme;
  }, [theme, systemTheme]);

  // Synchronize DOM whenever resolved theme changes
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
    if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(
        new window.CustomEvent('divemap_theme_change', {
          detail: { theme, resolvedTheme },
        })
      );
    }
  }, [theme, resolvedTheme]);

  // Listen to OS prefers-color-scheme media query changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (!mediaQuery) return;

      const handleChange = e => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleChange);
        }
      };
    } catch (_) {}
  }, []);

  const setTheme = useCallback(newTheme => {
    if (!['system', 'light', 'dark'].includes(newTheme)) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (_) {}
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useTheme = () => useContext(ThemeContext);
