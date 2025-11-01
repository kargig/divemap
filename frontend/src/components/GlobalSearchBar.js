import { Search, X, Map, Building, Anchor, Calendar, Route, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { searchGlobal } from '../api';

// Icon mapping for entity types
const ENTITY_ICONS = {
  Map: Map,
  Building: Building,
  Anchor: Anchor,
  Calendar: Calendar,
  Route: Route,
};

const GlobalSearchBar = ({
  className = '',
  inputClassName = '',
  placeholder = 'Search dives, sites, centers...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState({ groupIndex: -1, itemIndex: -1 });
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounced search function
  const performSearch = useCallback(async searchQuery => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await searchGlobal(searchQuery.trim(), 8);
      setResults(data);
      setIsOpen(true);
    } catch (err) {
      console.error('Global search error:', err);
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce input changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults(null);
      setIsOpen(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex({ groupIndex: -1, itemIndex: -1 });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = e => {
    if (!isOpen || !results || results.results.length === 0) {
      if (e.key === 'Enter' && query.trim().length >= 3) {
        // If no results open, perform search
        performSearch(query);
      }
      return;
    }

    const flatResults = results.results.flatMap((group, groupIdx) =>
      group.results.map((item, itemIdx) => ({ groupIdx, itemIdx, item }))
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (prev.groupIndex === -1 && prev.itemIndex === -1) {
            return { groupIndex: 0, itemIndex: 0 };
          }
          const currentFlatIdx = flatResults.findIndex(
            r => r.groupIdx === prev.groupIndex && r.itemIdx === prev.itemIndex
          );
          const nextFlatIdx = Math.min(currentFlatIdx + 1, flatResults.length - 1);
          return {
            groupIndex: flatResults[nextFlatIdx].groupIdx,
            itemIndex: flatResults[nextFlatIdx].itemIdx,
          };
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (prev.groupIndex === -1 && prev.itemIndex === -1) {
            return prev;
          }
          const currentFlatIdx = flatResults.findIndex(
            r => r.groupIdx === prev.groupIndex && r.itemIdx === prev.itemIndex
          );
          const prevFlatIdx = Math.max(currentFlatIdx - 1, 0);
          return {
            groupIndex: flatResults[prevFlatIdx].groupIdx,
            itemIndex: flatResults[prevFlatIdx].itemIdx,
          };
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex.groupIndex !== -1 && highlightedIndex.itemIndex !== -1) {
          const selected =
            results.results[highlightedIndex.groupIndex].results[highlightedIndex.itemIndex];
          handleSelectResult(selected);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex({ groupIndex: -1, itemIndex: -1 });
        break;

      default:
        break;
    }
  };

  // Handle result selection
  const handleSelectResult = result => {
    navigate(result.route_path);
    setIsOpen(false);
    setQuery('');
    setResults(null);
    setHighlightedIndex({ groupIndex: -1, itemIndex: -1 });
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
    setError(null);
    setHighlightedIndex({ groupIndex: -1, itemIndex: -1 });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Calculate total result count
  const totalCount = results?.total_count || 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
        <input
          ref={inputRef}
          type='text'
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results && results.results.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-white text-gray-900 ${inputClassName}`}
        />
        {query && (
          <button
            onClick={handleClear}
            className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
            aria-label='Clear search'
          >
            <X className='h-5 w-5' />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (isLoading || results || error) && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto'>
          {isLoading && (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-6 w-6 animate-spin text-blue-500' />
              <span className='ml-2 text-gray-600'>Searching...</span>
            </div>
          )}

          {error && <div className='p-4 text-red-600 text-sm'>{error}</div>}

          {!isLoading && !error && results && results.results.length === 0 && (
            <div className='p-4 text-gray-500 text-sm text-center'>
              No results found for &quot;{query}&quot;
            </div>
          )}

          {!isLoading && !error && results && results.results.length > 0 && (
            <div className='py-2'>
              {results.results.map((group, groupIdx) => {
                const IconComponent = ENTITY_ICONS[group.icon_name] || Search;
                return (
                  <div key={group.entity_type} className='mb-2'>
                    {/* Entity Type Header */}
                    <div className='px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center space-x-2 text-sm font-semibold text-gray-700'>
                      <IconComponent className='h-4 w-4' />
                      <span className='capitalize'>
                        {group.entity_type.replace(/_/g, ' ')} ({group.count})
                      </span>
                    </div>

                    {/* Results List */}
                    <div>
                      {group.results.map((item, itemIdx) => {
                        const isHighlighted =
                          highlightedIndex.groupIndex === groupIdx &&
                          highlightedIndex.itemIndex === itemIdx;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectResult(item)}
                            className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                              isHighlighted ? 'bg-blue-100' : ''
                            }`}
                            onMouseEnter={() => {
                              setHighlightedIndex({ groupIndex: groupIdx, itemIndex: itemIdx });
                            }}
                          >
                            <div className='flex items-start space-x-3'>
                              <IconComponent className='h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0' />
                              <div className='flex-1 min-w-0'>
                                <div className='font-medium text-gray-900 truncate'>
                                  {item.name}
                                </div>
                                {item.metadata && (
                                  <div className='text-sm text-gray-500 mt-1'>
                                    {item.metadata.country && <span>{item.metadata.country}</span>}
                                    {item.metadata.region && item.metadata.country && (
                                      <span>, {item.metadata.region}</span>
                                    )}
                                    {item.metadata.region && !item.metadata.country && (
                                      <span>{item.metadata.region}</span>
                                    )}
                                    {item.metadata.dive_date && (
                                      <span className='ml-2'>{item.metadata.dive_date}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

GlobalSearchBar.propTypes = {
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  placeholder: PropTypes.string,
};

export default GlobalSearchBar;
