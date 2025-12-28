import { ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useRef, useEffect, useMemo } from 'react';

const DivingCenterSearchableDropdown = ({
  divingCenters = [],
  selectedId,
  onSelect,
  placeholder = 'Search for a diving center...',
  label = 'Diving Center',
  error,
  required = false,
  className = '',
  id = 'diving-center-search',
}) => {
  const [searchTerm, setSearchInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize search term from selectedId
  useEffect(() => {
    if (selectedId && Array.isArray(divingCenters)) {
      const selected = divingCenters.find(c => c.id.toString() === selectedId.toString());
      if (selected) {
        setSearchInput(selected.name);
      }
    } else if (!selectedId) {
      setSearchInput('');
    }
  }, [selectedId, divingCenters]);

  // Filter diving centers based on search input
  const filteredCenters = useMemo(() => {
    if (!Array.isArray(divingCenters)) return [];
    if (!searchTerm) return divingCenters;

    return divingCenters.filter(center =>
      center.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [divingCenters, searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        // Reset search term to selected item if not selected
        if (selectedId) {
          const selected = divingCenters.find(c => c.id.toString() === selectedId.toString());
          if (selected) setSearchInput(selected.name);
        } else {
          setSearchInput('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedId, divingCenters]);

  const handleSelect = center => {
    onSelect(center.id, center.name);
    setSearchInput(center.name);
    setIsDropdownOpen(false);
  };

  const handleInputChange = e => {
    setSearchInput(e.target.value);
    setIsDropdownOpen(true);
    if (!e.target.value) {
      onSelect(null, '');
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label htmlFor={id} className='block text-sm font-medium text-gray-700 mb-1'>
          {label} {required && <span className='text-red-500'>*</span>}
        </label>
      )}
      <div className='relative'>
        <input
          id={id}
          type='text'
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full border rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          autoComplete='off'
        />
        <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
          {filteredCenters.length > 0 ? (
            filteredCenters.map(center => (
              <div
                key={center.id}
                onClick={() => handleSelect(center)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(center);
                  }
                }}
                role='button'
                tabIndex={0}
                className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
              >
                <div className='font-medium text-gray-900'>{center.name}</div>
                {center.country && <div className='text-sm text-gray-500'>{center.country}</div>}
              </div>
            ))
          ) : (
            <div className='px-3 py-2 text-gray-500 text-sm'>No diving centers found</div>
          )}
        </div>
      )}
      {error && <p className='mt-1 text-sm text-red-600'>{error}</p>}
    </div>
  );
};

DivingCenterSearchableDropdown.propTypes = {
  divingCenters: PropTypes.array.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default DivingCenterSearchableDropdown;
