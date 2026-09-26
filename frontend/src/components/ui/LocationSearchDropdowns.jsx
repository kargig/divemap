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

const regionLabel = item => (typeof item === 'string' ? item : item?.region || '');

export const RegionSearchDropdown = ({ value, onChange, countryFilter, className }) => {
  const fetchRegions = async query => {
    try {
      // getUniqueRegions(country, search) — country first, then search text
      const results = await getUniqueRegions(countryFilter || '', query || '');
      return results;
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
      onChange={selected => {
        if (!selected) {
          onChange('', null);
          return;
        }
        if (typeof selected === 'string') {
          onChange(selected, null);
          return;
        }
        onChange(selected.region || '', selected.country || null);
      }}
      fetchData={fetchRegions}
      displayValueExtractor={regionLabel}
      keyExtractor={(item, index) =>
        typeof item === 'string' ? String(index) : `${item.country || ''}:${item.region}`
      }
      renderItem={item => {
        const region = regionLabel(item);
        const country = typeof item === 'string' ? null : item?.country;
        const showCountry = !countryFilter && country;
        return (
          <div className='font-medium text-gray-900'>
            {region}
            {showCountry ? <span className='text-gray-500 font-normal'> · {country}</span> : null}
          </div>
        );
      }}
      emptyMessage='No regions found'
      className={className}
    />
  );
};
