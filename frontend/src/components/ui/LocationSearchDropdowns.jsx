import React from 'react';

import { getUniqueCountries, getUniqueRegions } from '../../services/diveSites';

import AutocompleteDropdown from './AutocompleteDropdown';

export const CountrySearchDropdown = ({ value, onChange, className }) => {
  const fetchCountries = async query => {
    try {
      const results = await getUniqueCountries(query);
      return results; // Returns array of strings
    } catch (error) {
      console.error('Failed to fetch countries:', error);
      return [];
    }
  };

  const handleChange = selected => {
    onChange(selected || '');
  };

  return (
    <AutocompleteDropdown
      label='Country'
      placeholder='Search for a country...'
      value={value}
      onChange={handleChange}
      fetchData={fetchCountries}
      emptyMessage='No countries found'
      className={className}
    />
  );
};

export const RegionSearchDropdown = ({ value, onChange, countryFilter, className }) => {
  const fetchRegions = async query => {
    try {
      const results = await getUniqueRegions(query, countryFilter || undefined);
      return results; // Returns array of strings
    } catch (error) {
      console.error('Failed to fetch regions:', error);
      return [];
    }
  };

  return (
    <AutocompleteDropdown
      label='Region/State'
      placeholder='Search for a region...'
      value={value}
      onChange={selected => onChange(selected || '')}
      fetchData={fetchRegions}
      emptyMessage='No regions found'
      className={className}
    />
  );
};
