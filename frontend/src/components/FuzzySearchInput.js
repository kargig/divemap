import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import {
  fuzzySearch,
  createHighlightedResult,
  createDebouncedSearch,
  SEARCH_CONFIGS,
} from '../utils/fuzzySearch';

/**
 * Enhanced Fuzzy Search Input Component
 *
 * Features:
 * - Real-time fuzzy search with Levenshtein distance
 * - Search suggestions with highlighting
 * - Configurable search behavior
 * - Keyboard navigation
 * - Debounced search for performance
 * - Customizable appearance and behavior
 */
const FuzzySearchInput = ({
  // Data and search props
  data = [],
  searchValue = '',
  onSearchChange = () => {},
  onSearchSelect = () => {},

  // Configuration props
  configType = 'generic',
  placeholder = 'Search...',
  minQueryLength = 2,
  maxSuggestions = 10,
  debounceDelay = 300,

  // Display props
  showSuggestions = true,
  highlightMatches = true,
  showScore = false,
  showClearButton = true,

  // Styling props
  className = '',
  inputClassName = '',
  suggestionsClassName = '',
  highlightClass = 'bg-yellow-200',

  // Behavior props
  autoFocus = false,
  disabled = false,
  readOnly = false,

  // Event handlers
  onFocus = () => {},
  onBlur = () => {},
  onKeyDown = () => {},

  // Custom render props
  renderSuggestion = null,
  renderNoResults = null,
  renderLoading = null,

  // Advanced props
  customConfig = null,
  searchKeys = null,
  threshold = null,
  distance = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const containerRef = useRef(null);

  // Create debounced search function
  const debouncedSearch = useCallback(
    createDebouncedSearch(async query => {
      if (!query || query.length < minQueryLength) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Use custom config if provided, otherwise use configType
        const config = customConfig || {
          ...(SEARCH_CONFIGS[configType] || SEARCH_CONFIGS.generic),
          ...(searchKeys && { keys: searchKeys }),
          ...(threshold !== null && { threshold }),
          ...(distance !== null && { distance }),
        };

        const results = fuzzySearch(data, query, config);
        const limitedResults = results.slice(0, maxSuggestions);

        setSuggestions(limitedResults);
      } catch (error) {
        console.error('Fuzzy search error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceDelay),
    [
      data,
      configType,
      minQueryLength,
      maxSuggestions,
      customConfig,
      searchKeys,
      threshold,
      distance,
      debounceDelay,
    ]
  );

  // Perform search when query changes
  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = e => {
    const value = e.target.value;
    onSearchChange(value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = e => {
    setFocused(true);
    setIsOpen(true);
    onFocus(e);
  };

  // Handle input blur
  const handleInputBlur = e => {
    setFocused(false);
    // Delay closing to allow for suggestion clicks
    setTimeout(() => {
      if (!focused) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }, 150);
    onBlur(e);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = suggestion => {
    onSearchSelect(suggestion.item);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = e => {
    const { key } = e;

    if (!isOpen || suggestions.length === 0) {
      onKeyDown(e);
      return;
    }

    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSuggestionSelect(suggestions[highlightedIndex]);
        }
        break;

      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;

      default:
        onKeyDown(e);
        break;
    }
  };

  // Clear search
  const handleClear = () => {
    onSearchChange('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  // Render suggestion item
  const renderSuggestionItem = (suggestion, index) => {
    const isHighlighted = index === highlightedIndex;

    // Get the text to display without HTML
    const displayText =
      suggestion.item.name || suggestion.item.title || suggestion.item.description || '';

    // Create highlighted text using CSS classes instead of HTML
    const createHighlightedText = (text, matches) => {
      if (!matches || matches.length === 0) {
        return text;
      }

      // Find all match indices for the name field
      const nameMatches = matches.filter(match => match.key === 'name');
      if (nameMatches.length === 0) {
        return text;
      }

      // Get the first match indices
      const indices = nameMatches[0].indices || [];
      if (indices.length === 0) {
        return text;
      }

      // Create highlighted text using CSS spans
      let result = '';
      let lastIndex = 0;

      indices.forEach(([start, end]) => {
        // Add text before the match
        if (start > lastIndex) {
          result += text.substring(lastIndex, start);
        }

        // Add the highlighted match
        result += `<span class="${highlightClass}">${text.substring(start, end + 1)}</span>`;

        lastIndex = end + 1;
      });

      // Add remaining text
      if (lastIndex < text.length) {
        result += text.substring(lastIndex);
      }

      return result;
    };

    if (renderSuggestion) {
      return renderSuggestion(suggestion, index, isHighlighted, {
        original: displayText,
        highlighted: displayText,
      });
    }

    return (
      <div
        key={`${suggestion.item.id || suggestion.refIndex}-${index}`}
        className={`px-4 py-3 cursor-pointer transition-colors ${
          isHighlighted
            ? 'bg-blue-100 border-l-4 border-blue-500'
            : 'hover:bg-gray-50 border-l-4 border-transparent'
        }`}
        onClick={() => handleSuggestionSelect(suggestion)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            {highlightMatches ? (
              <div
                className='font-medium text-gray-900'
                dangerouslySetInnerHTML={{
                  __html: createHighlightedText(displayText, suggestion.matches || []),
                }}
              />
            ) : (
              <div className='font-medium text-gray-900'>{displayText}</div>
            )}

            {/* Show additional context if available */}
            {suggestion.item.country && (
              <div className='text-sm text-gray-500 mt-1'>
                {suggestion.item.country}
                {suggestion.item.region && `, ${suggestion.item.region}`}
              </div>
            )}

            {suggestion.item.description && (
              <div className='text-sm text-gray-500 mt-1 line-clamp-2'>
                {suggestion.item.description}
              </div>
            )}
          </div>

          {/* Show relevance score if enabled */}
          {showScore && suggestion.score !== undefined && (
            <div className='ml-4 text-xs text-gray-400'>
              {Math.round((1 - suggestion.score) * 100)}%
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render no results message
  const renderNoResultsMessage = () => {
    if (renderNoResults) {
      return renderNoResults(searchValue);
    }

    return (
      <div className='px-4 py-3 text-gray-500 text-center'>
        No results found for "{searchValue}"
      </div>
    );
  };

  // Render loading indicator
  const renderLoadingMessage = () => {
    if (renderLoading) {
      return renderLoading();
    }

    return (
      <div className='px-4 py-3 text-gray-500 text-center'>
        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto'></div>
        <span className='ml-2'>Searching...</span>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />

        <input
          ref={inputRef}
          type='text'
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={`
            w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${inputClassName}
          `}
        />

        {/* Clear Button */}
        {showClearButton && searchValue && (
          <button
            onClick={handleClear}
            className='absolute right-8 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors'
            title='Clear search'
          >
            <X className='h-4 w-4' />
          </button>
        )}

        {/* Toggle Suggestions Button */}
        {showSuggestions && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className='absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors'
            title={isOpen ? 'Hide suggestions' : 'Show suggestions'}
          >
            {isOpen ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </button>
        )}
      </div>

      {/* Search Suggestions */}
      {showSuggestions && isOpen && (
        <div
          ref={suggestionsRef}
          className={`
            absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200
            rounded-lg shadow-lg max-h-96 overflow-y-auto z-50
            ${suggestionsClassName}
          `}
        >
          {isLoading
            ? renderLoadingMessage()
            : suggestions.length > 0
              ? suggestions.map((suggestion, index) => renderSuggestionItem(suggestion, index))
              : searchValue.length >= minQueryLength
                ? renderNoResultsMessage()
                : null}
        </div>
      )}
    </div>
  );
};

FuzzySearchInput.propTypes = {
  // Data and search props
  data: PropTypes.array.isRequired,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  onSearchSelect: PropTypes.func,

  // Configuration props
  configType: PropTypes.oneOf([
    'diveSites',
    'dives',
    'divingCenters',
    'diveTrips',
    'users',
    'generic',
  ]),
  placeholder: PropTypes.string,
  minQueryLength: PropTypes.number,
  maxSuggestions: PropTypes.number,
  debounceDelay: PropTypes.number,

  // Display props
  showSuggestions: PropTypes.bool,
  highlightMatches: PropTypes.bool,
  showScore: PropTypes.bool,
  showClearButton: PropTypes.bool,

  // Styling props
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  suggestionsClassName: PropTypes.string,
  highlightClass: PropTypes.string,

  // Behavior props
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,

  // Event handlers
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onKeyDown: PropTypes.func,

  // Custom render props
  renderSuggestion: PropTypes.func,
  renderNoResults: PropTypes.func,
  renderLoading: PropTypes.func,

  // Advanced props
  customConfig: PropTypes.object,
  searchKeys: PropTypes.array,
  threshold: PropTypes.number,
  distance: PropTypes.number,
};

export default FuzzySearchInput;
