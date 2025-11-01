import Fuse from 'fuse.js';

/**
 * Fuzzy Search Utility for Divemap Application
 *
 * This utility provides Levenshtein distance-based fuzzy search functionality
 * that can be used across all search components in the application.
 *
 * Features:
 * - Configurable search thresholds
 * - Multiple search strategies (fuzzy, exact, prefix)
 * - Highlighting of matched terms
 * - Support for nested object properties
 * - Performance optimized with Fuse.js
 */

// Default Fuse.js options for optimal fuzzy search
const DEFAULT_FUSE_OPTIONS = {
  // Search algorithm settings
  includeScore: true,
  includeMatches: true,
  threshold: 0.8, // Very high threshold = very tolerant matching (0.0 = exact, 1.0 = very loose)
  distance: 100, // Maximum edit distance (Levenshtein distance)

  // Search behavior
  minMatchCharLength: 1, // Allow single character matches
  findAllMatches: true,
  isCaseSensitive: false, // Ensure case-insensitive search

  // Performance settings
  useExtendedSearch: false,
  ignoreLocation: true, // Ignore location for better fuzzy matching

  // Field weights for different types of content
  keys: [],
};

/**
 * Create a fuzzy search instance for a specific data type
 * @param {Array} data - Array of objects to search through
 * @param {Object} options - Fuse.js configuration options
 * @returns {Fuse} Configured Fuse instance
 */
export const createFuzzySearch = (data, options = {}) => {
  const fuseOptions = {
    ...DEFAULT_FUSE_OPTIONS,
    ...options,
  };

  return new Fuse(data, fuseOptions);
};

/**
 * Configure search options for different content types
 */
export const SEARCH_CONFIGS = {
  // Dive Sites search configuration
  diveSites: {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'country', weight: 0.8 },
      { name: 'region', weight: 0.8 },
      { name: 'description', weight: 0.6 },
      { name: 'difficulty_label', weight: 0.5 },
      { name: 'requirements', weight: 0.5 },
      { name: 'aliases', weight: 0.9 },
    ],
    threshold: 0.8, // Very tolerant for typo correction
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },

  // Dives search configuration
  dives: {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'dive_information', weight: 0.7 },
      { name: 'dive_site.name', weight: 0.9 },
      { name: 'user.username', weight: 0.6 },
    ],
    threshold: 0.6, // More tolerant for typo correction
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },

  // Diving Centers search configuration
  divingCenters: {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'description', weight: 0.6 },
      { name: 'country', weight: 0.8 },
      { name: 'region', weight: 0.8 },
      { name: 'city', weight: 0.8 },
    ],
    threshold: 0.6, // More tolerant for typo correction
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },

  // Dive Trips search configuration
  diveTrips: {
    keys: [
      { name: 'trip_description', weight: 1.0 },
      { name: 'special_requirements', weight: 0.8 },
      { name: 'diving_center.name', weight: 0.9 },
      { name: 'dives.dive_site.name', weight: 0.8 },
      { name: 'dives.dive_description', weight: 0.6 },
    ],
    threshold: 0.6, // More tolerant for typo correction
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },

  // Users search configuration
  users: {
    keys: [
      { name: 'username', weight: 1.0 },
      { name: 'name', weight: 0.9 },
      { name: 'email', weight: 0.7 },
    ],
    threshold: 0.3,
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },

  // Generic search configuration
  generic: {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'title', weight: 1.0 },
      { name: 'description', weight: 0.7 },
      { name: 'content', weight: 0.6 },
    ],
    threshold: 0.7,
    distance: 100,
    isCaseSensitive: false, // Ensure case-insensitive search
  },
};

/**
 * Perform fuzzy search with the specified configuration
 * @param {Array} data - Array of objects to search through
 * @param {string} query - Search query string
 * @param {string|Object} configType - Search configuration type or custom config
 * @returns {Array} Array of search results with scores and matches
 */
export const fuzzySearch = (data, query, configType = 'generic') => {
  if (!query || !query.trim()) {
    return data.map((item, index) => ({
      item,
      refIndex: index,
      score: 0,
      matches: [],
    }));
  }

  const config =
    typeof configType === 'string'
      ? SEARCH_CONFIGS[configType] || SEARCH_CONFIGS.generic
      : configType;

  const fuse = createFuzzySearch(data, config);
  const results = fuse.search(query);

  return results;
};

/**
 * Perform fuzzy search and return only the items (without metadata)
 * @param {Array} data - Array of objects to search through
 * @param {string} query - Search query string
 * @param {string|Object} configType - Search configuration type or custom config
 * @returns {Array} Array of matched items
 */
export const fuzzySearchItems = (data, query, configType = 'generic') => {
  const results = fuzzySearch(data, query, configType);
  return results.map(result => result.item);
};

/**
 * Highlight matched terms in search results
 * @param {string} text - Original text
 * @param {Array} matches - Array of match objects from Fuse.js
 * @param {string} highlightClass - CSS class for highlighting
 * @returns {string} HTML string with highlighted matches
 */
export const highlightMatches = (text, matches, highlightClass = 'bg-yellow-200') => {
  // Ensure text is a string and escape it first to prevent HTML injection
  if (typeof text !== 'string') {
    text = String(text || '');
  }

  // Always escape the text first to prevent HTML injection
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // If no matches, return the escaped text as-is
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return escapedText;
  }

  try {
    // Get all indices from matches for the target field
    const allIndices = [];
    matches
      .filter(
        match =>
          match &&
          match.key &&
          (match.key === 'name' || match.key === 'title' || match.key === 'description')
      )
      .forEach(match => {
        if (match.indices && Array.isArray(match.indices)) {
          match.indices.forEach(([start, end]) => {
            if (
              typeof start === 'number' &&
              typeof end === 'number' &&
              start >= 0 &&
              end >= start
            ) {
              allIndices.push({ start, end });
            }
          });
        }
      });

    // If no valid indices, return the escaped text as-is
    if (allIndices.length === 0) {
      return escapedText;
    }

    // Sort indices by start position in descending order to avoid index shifting
    allIndices.sort((a, b) => b.start - a.start);

    // Apply highlighting by processing from end to beginning
    let highlightedText = escapedText;
    allIndices.forEach(({ start, end }) => {
      // Ensure indices are within bounds
      if (start >= 0 && end >= start && end < highlightedText.length) {
        const before = highlightedText.substring(0, start);
        const matched = highlightedText.substring(start, end + 1);
        const after = highlightedText.substring(end + 1);

        highlightedText = `${before}<span class="${highlightClass}">${matched}</span>${after}`;
      }
    });

    return highlightedText;
  } catch (error) {
    // If any error occurs during highlighting, return the escaped text as-is
    console.warn('Error during text highlighting:', error);
    return escapedText;
  }
};

/**
 * Create a search result component with highlighting
 * @param {Object} result - Search result object
 * @param {string} displayField - Field to display (default: 'name')
 * @param {string} highlightClass - CSS class for highlighting
 * @returns {Object} Object with original text and highlighted HTML
 */
export const createHighlightedResult = (
  result,
  displayField = 'name',
  highlightClass = 'bg-yellow-200'
) => {
  // Ensure result is valid
  if (!result || !result.item) {
    return {
      original: '',
      highlighted: '',
      score: 0,
      item: null,
    };
  }

  // Get the text to display, ensuring it's a string
  const text = result.item[displayField];
  const safeText = typeof text === 'string' ? text : String(text || '');

  // Get matches, ensuring it's an array
  const matches = Array.isArray(result.matches) ? result.matches : [];

  // Get score, ensuring it's a number
  const score = typeof result.score === 'number' ? result.score : 0;

  return {
    original: safeText,
    highlighted: highlightMatches(safeText, matches, highlightClass),
    score: score,
    item: result.item,
  };
};

/**
 * Sort search results by relevance score
 * @param {Array} results - Array of search results
 * @param {boolean} ascending - Sort order (true = ascending, false = descending)
 * @returns {Array} Sorted search results
 */
export const sortByRelevance = (results, ascending = false) => {
  return [...results].sort((a, b) => {
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;

    return ascending ? scoreA - scoreB : scoreB - scoreA;
  });
};

/**
 * Filter search results by minimum score threshold
 * @param {Array} results - Array of search results
 * @param {number} threshold - Minimum score threshold (0.0 to 1.0)
 * @returns {Array} Filtered search results
 */
export const filterByScore = (results, threshold = 0.6) => {
  return results.filter(result => (result.score || 0) <= threshold);
};

/**
 * Create a debounced search function for performance optimization
 * @param {Function} searchFunction - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const createDebouncedSearch = (searchFunction, delay = 300) => {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise(resolve => {
      timeoutId = setTimeout(() => {
        resolve(searchFunction(...args));
      }, delay);
    });
  };
};

/**
 * Advanced search with multiple strategies
 * @param {Array} data - Array of objects to search through
 * @param {string} query - Search query string
 * @param {Object} options - Search options
 * @returns {Array} Array of search results
 */
export const advancedSearch = (data, query, options = {}) => {
  const {
    configType = 'generic',
    minScore = 0.6,
    maxResults = 50,
    sortByRelevance: shouldSort = true,
    highlightMatches: shouldHighlight = false,
  } = options;

  // Perform fuzzy search
  let results = fuzzySearch(data, query, configType);

  // Filter by score threshold
  if (minScore > 0) {
    results = filterByScore(results, minScore);
  }

  // Sort by relevance
  if (shouldSort) {
    results = sortByRelevance(results, false);
  }

  // Limit results
  if (maxResults > 0) {
    results = results.slice(0, maxResults);
  }

  // Add highlighting if requested
  if (shouldHighlight) {
    results = results.map(result => ({
      ...result,
      highlighted: createHighlightedResult(result),
    }));
  }

  return results;
};

/**
 * Search across multiple data types simultaneously
 * @param {Object} dataSets - Object with different data types
 * @param {string} query - Search query string
 * @param {Object} options - Search options
 * @returns {Object} Object with results for each data type
 */
export const multiTypeSearch = (dataSets, query, options = {}) => {
  const results = {};

  Object.entries(dataSets).forEach(([type, data]) => {
    const config = SEARCH_CONFIGS[type] || SEARCH_CONFIGS.generic;
    results[type] = fuzzySearch(data, query, config);
  });

  return results;
};

export default {
  createFuzzySearch,
  fuzzySearch,
  fuzzySearchItems,
  highlightMatches,
  createHighlightedResult,
  sortByRelevance,
  filterByScore,
  createDebouncedSearch,
  advancedSearch,
  multiTypeSearch,
  SEARCH_CONFIGS,
};
