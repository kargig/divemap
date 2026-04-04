import { ChevronDown, X } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import useClickOutside from '../../hooks/useClickOutside';

const AutocompleteDropdown = ({
  label,
  placeholder,
  value,
  onChange,
  fetchData,
  renderItem,
  keyExtractor,
  displayValueExtractor,
  emptyMessage = 'No results found',
  debounceTime = 300,
  className = '',
  error,
}) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);

  // Sync internal search state with external value if it changes
  useEffect(() => {
    if (value && typeof value === 'string') {
      setSearch(value);
    } else if (!value) {
      setSearch('');
    }
  }, [value]);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const handleSearchChange = newSearch => {
    setSearch(newSearch);
    setIsOpen(true);

    if (!newSearch.trim()) {
      onChange(null);
      setResults([]);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const data = await fetchData(newSearch);
        setResults(data || []);
      } catch (error) {
        console.error('Search failed', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceTime);
  };

  const handleSelect = item => {
    const displayValue = displayValueExtractor ? displayValueExtractor(item) : item;
    setSearch(displayValue);
    setIsOpen(false);
    onChange(item);
  };

  const handleClear = e => {
    e.stopPropagation();
    setSearch('');
    setResults([]);
    onChange(null);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && <label className='block text-sm font-medium text-gray-700 mb-2'>{label}</label>}
      <div className='relative'>
        <input
          type='text'
          placeholder={placeholder}
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${error ? 'border-red-500' : 'border-gray-300'}`}
        />
        <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
          {isLoading ? (
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400'></div>
          ) : search && isOpen ? (
            <X
              size={16}
              className='text-gray-400 cursor-pointer hover:text-gray-600'
              onClick={handleClear}
            />
          ) : (
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform pointer-events-none ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && search.trim() && !isLoading && results.length > 0 && (
        <div className='absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
          {results.map((item, index) => (
            <div
              key={keyExtractor ? keyExtractor(item, index) : index}
              onClick={() => handleSelect(item)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(item);
                }
              }}
              role='button'
              tabIndex={0}
              className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
            >
              {renderItem ? (
                renderItem(item)
              ) : (
                <div className='font-medium text-gray-900'>{item}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isOpen && search.trim() && !isLoading && results.length === 0 && (
        <div className='absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg'>
          <div className='px-3 py-2 text-gray-500 text-sm'>{emptyMessage}</div>
        </div>
      )}
      {error && <p className='text-xs text-red-500 mt-1'>{error}</p>}
    </div>
  );
};

AutocompleteDropdown.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  fetchData: PropTypes.func.isRequired,
  renderItem: PropTypes.func,
  keyExtractor: PropTypes.func,
  displayValueExtractor: PropTypes.func,
  emptyMessage: PropTypes.string,
  debounceTime: PropTypes.number,
  className: PropTypes.string,
};

export default AutocompleteDropdown;
