import PropTypes from 'prop-types';
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from 'react-query';

import { searchDivingCenters, getDivingCenter } from '../services/divingCenters';

import Combobox from './ui/Combobox';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Search diving centers from backend when query is at least 3 characters
  const { data: remoteCenters = [], isFetching: isSearching } = useQuery(
    ['diving-centers-search', debouncedSearchTerm],
    async () => {
      if (debouncedSearchTerm.length < 3) return [];
      try {
        const response = await searchDivingCenters({ q: debouncedSearchTerm, limit: 50 });
        return response || [];
      } catch (err) {
        console.error('Error searching diving centers:', err);
        return [];
      }
    },
    {
      enabled: debouncedSearchTerm.length >= 3,
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // If we have a selectedId that's not in our list, fetch it specifically
  // This ensures the label is correctly displayed even for centers not in the initial 100
  const { data: selectedCenterData } = useQuery(
    ['diving-center', selectedId],
    () => getDivingCenter(selectedId),
    {
      enabled:
        !!selectedId &&
        !divingCenters.some(c => c.id.toString() === selectedId.toString()) &&
        !remoteCenters.some(c => c.id.toString() === selectedId.toString()),
      staleTime: 10 * 60 * 1000,
    }
  );

  // Merge initial centers, search results, and specifically fetched selected center
  const combinedCenters = useMemo(() => {
    const centersMap = new Map();

    // 1. Add initial centers (e.g., owned by user or pre-fetched top 100)
    if (Array.isArray(divingCenters)) {
      divingCenters.forEach(center => {
        if (center && center.id) {
          centersMap.set(center.id.toString(), center);
        }
      });
    }

    // 2. Add remote search results
    if (Array.isArray(remoteCenters)) {
      remoteCenters.forEach(center => {
        if (center && center.id && !centersMap.has(center.id.toString())) {
          centersMap.set(center.id.toString(), center);
        }
      });
    }

    // 3. Add the specifically fetched selected center if missing
    if (
      selectedCenterData &&
      selectedCenterData.id &&
      !centersMap.has(selectedCenterData.id.toString())
    ) {
      centersMap.set(selectedCenterData.id.toString(), selectedCenterData);
    }

    return Array.from(centersMap.values());
  }, [divingCenters, remoteCenters, selectedCenterData]);

  const options = useMemo(() => {
    const formattedOptions = combinedCenters.map(center => ({
      value: center.id.toString(),
      label: center.country ? `${center.name} (${center.country})` : center.name,
    }));

    // If no search term, return everything we have
    if (!searchTerm.trim()) return formattedOptions;

    // Local filter for instant feedback while remote results load
    // and to further narrow down results
    const lowerSearchTerm = searchTerm.toLowerCase();
    return formattedOptions.filter(option => option.label.toLowerCase().includes(lowerSearchTerm));
  }, [combinedCenters, searchTerm]);

  const handleValueChange = value => {
    const selectedCenter = combinedCenters.find(c => c.id.toString() === value?.toString());
    onSelect(value || null, selectedCenter ? selectedCenter.name : '');
  };

  return (
    <Combobox
      id={id}
      label={label}
      value={selectedId ? selectedId.toString() : ''}
      onValueChange={handleValueChange}
      options={options}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      placeholder={placeholder}
      searchPlaceholder='Type at least 3 chars to search...'
      emptyMessage={
        searchTerm.length > 0 && searchTerm.length < 3
          ? 'Type at least 3 characters to search...'
          : 'No diving centers found.'
      }
      error={error}
      required={required}
      className={className}
      isLoading={isSearching}
    />
  );
};

DivingCenterSearchableDropdown.propTypes = {
  divingCenters: PropTypes.array,
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
