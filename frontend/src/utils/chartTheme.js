/**
 * Theme tokens for Recharts, Canvas, and SVG Data Visualizations
 */
export const getChartTheme = resolvedTheme => {
  const isDark = resolvedTheme === 'dark';

  return {
    isDark,
    gridStroke: isDark ? '#334155' : '#e5e7eb',
    axisStroke: isDark ? '#64748b' : '#9ca3af',
    axisText: isDark ? '#94a3b8' : '#6b7280',
    tooltip: {
      background: isDark ? '#1e293b' : '#ffffff',
      border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
      color: isDark ? '#f8fafc' : '#0f172a',
      mutedColor: isDark ? '#94a3b8' : '#64748b',
      boxShadow: isDark
        ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
        : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    cursorFill: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(243, 244, 246, 0.6)',
    exportBg: isDark ? '#0f172a' : '#ffffff',
  };
};
