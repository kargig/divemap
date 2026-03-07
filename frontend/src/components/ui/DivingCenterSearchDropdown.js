import React from 'react';

import { searchDivingCenters } from '../../services/divingCenters';

import AutocompleteDropdown from './AutocompleteDropdown';

export const DivingCenterSearchDropdown = ({
  value,
  onChange,
  label = 'Diving Center',
  placeholder = 'Search diving centers...',
  className,
}) => {
  const fetchDivingCenters = async query => {
    try {
      const results = await searchDivingCenters({
        q: query,
        limit: 20,
      });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('Search diving centers failed', error);
      return [];
    }
  };

  const renderCenterItem = center => (
    <div>
      <div className='font-medium text-gray-900'>{center.name}</div>
      {center.country && (
        <div className='text-xs text-gray-500'>
          {center.country}
          {center.region ? `, ${center.region}` : ''}
        </div>
      )}
    </div>
  );

  return (
    <AutocompleteDropdown
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={selectedCenter =>
        onChange(selectedCenter ? { id: selectedCenter.id, name: selectedCenter.name } : null)
      }
      fetchData={fetchDivingCenters}
      renderItem={renderCenterItem}
      keyExtractor={center => center.id}
      displayValueExtractor={center => center.name}
      emptyMessage='No diving centers found'
      className={className}
    />
  );
};
