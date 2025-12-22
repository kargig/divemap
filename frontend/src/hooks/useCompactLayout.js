import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Custom hook for managing compact layout state with URL synchronization
 *
 * Provides compact layout state management that:
 * - Initializes from URL parameter
 * - Syncs with URL changes
 * - Updates URL when toggled
 * - Preserves other URL parameters
 *
 * @param {object} options - Configuration options
 * @param {boolean} options.defaultCompact - Default compact state (default: false)
 * @param {string} options.urlParam - URL parameter name (default: 'compact_layout')
 * @returns {object} { compactLayout, handleToggleCompact, handleDisplayOptionChange }
 *
 * @example
 * // Default non-compact (most common)
 * const { compactLayout, handleDisplayOptionChange } = useCompactLayout();
 *
 * @example
 * // Default compact (if needed)
 * const { compactLayout, handleDisplayOptionChange } = useCompactLayout({ defaultCompact: true });
 */
export const useCompactLayout = (options = {}) => {
  const { defaultCompact = false, urlParam = 'compact_layout' } = options;
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize state from URL
  const [compactLayout, setCompactLayout] = useState(() => {
    const params = new URLSearchParams(location.search);
    const paramValue = params.get(urlParam);

    if (defaultCompact) {
      // Default to compact, only non-compact if explicitly 'false'
      return paramValue !== 'false';
    } else {
      // Default to non-compact, only compact if explicitly 'true'
      return paramValue === 'true';
    }
  });

  // Sync state from URL changes (e.g., browser back/forward, direct URL navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paramValue = params.get(urlParam);

    let shouldBeCompact;
    if (defaultCompact) {
      shouldBeCompact = paramValue !== 'false';
    } else {
      shouldBeCompact = paramValue === 'true';
    }

    // Only update if state doesn't match URL to avoid unnecessary re-renders
    if (shouldBeCompact !== compactLayout) {
      setCompactLayout(shouldBeCompact);
    }
  }, [location.search, compactLayout, defaultCompact, urlParam]);

  // Toggle handler that updates both state and URL
  const handleToggleCompact = () => {
    const newCompactLayout = !compactLayout;
    setCompactLayout(newCompactLayout);

    // Update URL while preserving other parameters
    const urlParams = new URLSearchParams(location.search);
    if (newCompactLayout) {
      if (defaultCompact) {
        // For default-compact pages, delete param when enabling (since default is compact)
        urlParams.delete(urlParam);
      } else {
        // For default-non-compact pages, set param when enabling
        urlParams.set(urlParam, 'true');
      }
    } else {
      if (defaultCompact) {
        // For default-compact pages, set 'false' when disabling
        urlParams.set(urlParam, 'false');
      } else {
        // For default-non-compact pages, delete param when disabling (since default is non-compact)
        urlParams.delete(urlParam);
      }
    }

    navigate(`?${urlParams.toString()}`, { replace: true });
  };

  // Handler for ResponsiveFilterBar's onDisplayOptionChange
  // This matches the expected signature: (option) => void
  const handleDisplayOptionChange = option => {
    if (option === 'compact') {
      handleToggleCompact();
    }
  };

  return {
    compactLayout,
    handleToggleCompact,
    handleDisplayOptionChange,
  };
};
