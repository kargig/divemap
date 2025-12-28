import PropTypes from 'prop-types';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { fuzzySearch, createDebouncedSearch, SEARCH_CONFIGS } from '../utils/fuzzySearch';

import Combobox from './ui/Combobox';

/**
 * Enhanced Fuzzy Search Input Component using Radix-based Combobox
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
  highlightMatches = true,
  highlightClass = 'bg-yellow-200',

  // Styling props
  className = '',
  label,
  error,
  required = false,

  // Behavior props
  disabled = false,

  // Advanced props
  customConfig = null,
  searchKeys = null,
  threshold = null,
  distance = null,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
        const config = customConfig || {
          ...(SEARCH_CONFIGS[configType] || SEARCH_CONFIGS.generic),
          ...(searchKeys && { keys: searchKeys }),
          ...(threshold !== null && { threshold }),
          ...(distance !== null && { distance }),
        };

        const results = fuzzySearch(data, query, config);
        setSuggestions(results.slice(0, maxSuggestions));
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

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  const options = useMemo(() => {
    return suggestions.map((suggestion, index) => ({
      value: `${suggestion.item.id || suggestion.refIndex}-${index}`,
      label: suggestion.item.name || suggestion.item.title || suggestion.item.description || '',
      suggestion: suggestion,
    }));
  }, [suggestions]);

  const handleValueChange = value => {
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption) {
      onSearchSelect(selectedOption.suggestion.item);
    }
  };

  const renderSuggestionItem = option => {
    const { suggestion } = option;
    const displayText = option.label;

    // Helper to highlight matches (simplified for React)
    const renderHighlightedText = (text, matches) => {
      if (!highlightMatches || !matches || matches.length === 0) return text;

      const nameMatches = matches.filter(match => match.key === 'name' || match.key === 'title');
      if (nameMatches.length === 0) return text;

      const indices = nameMatches[0].indices || [];
      if (indices.length === 0) return text;

      const parts = [];
      let lastIndex = 0;

      indices.forEach(([start, end], i) => {
        if (start > lastIndex) {
          parts.push(text.substring(lastIndex, start));
        }
        parts.push(
          <span key={i} className={highlightClass}>
            {text.substring(start, end + 1)}
          </span>
        );
        lastIndex = end + 1;
      });

      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts;
    };

    return (
      <div className='flex flex-col w-full'>
        <div className='font-medium text-gray-900'>
          {renderHighlightedText(displayText, suggestion.matches)}
        </div>
        {suggestion.item.country && (
          <div className='text-xs text-gray-500'>
            {suggestion.item.country}
            {suggestion.item.region && `, ${suggestion.item.region}`}
          </div>
        )}
        {suggestion.item.description && (
          <div className='text-xs text-gray-400 line-clamp-1 mt-0.5'>
            {suggestion.item.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <Combobox
      label={label}
      placeholder={placeholder}
      searchPlaceholder='Type to search...'
      options={options}
      value='' // External state handles value
      onValueChange={handleValueChange}
      onSearchChange={onSearchChange}
      searchTerm={searchValue}
      isLoading={isLoading}
      renderItem={renderSuggestionItem}
      className={className}
      error={error}
      required={required}
      disabled={disabled}
      emptyMessage={
        searchValue.length >= minQueryLength ? `No results found for "${searchValue}"` : null
      }
    />
  );
};

FuzzySearchInput.propTypes = {
  data: PropTypes.array.isRequired,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  onSearchSelect: PropTypes.func,
  configType: PropTypes.string,
  placeholder: PropTypes.string,
  minQueryLength: PropTypes.number,
  maxSuggestions: PropTypes.number,
  debounceDelay: PropTypes.number,
  highlightMatches: PropTypes.bool,
  highlightClass: PropTypes.string,
  className: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  customConfig: PropTypes.object,
  searchKeys: PropTypes.array,
  threshold: PropTypes.number,
  distance: PropTypes.number,
};

export default FuzzySearchInput;
