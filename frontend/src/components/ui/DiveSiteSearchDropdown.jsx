import React from 'react';

import { getDiveSites } from '../../services/diveSites';

import AutocompleteDropdown from './AutocompleteDropdown';

export const DiveSiteSearchDropdown = ({
  value,
  onChange,
  label = 'Dive Site',
  placeholder = 'Search dive sites...',
  className,
}) => {
  const fetchDiveSites = async query => {
    try {
      const response = await getDiveSites({
        search: query,
        page_size: 25,
        detail_level: 'basic',
      });

      let results = [];
      if (Array.isArray(response)) {
        results = response;
      } else if (response && Array.isArray(response.items)) {
        results = response.items;
      } else if (response && Array.isArray(response.data)) {
        results = response.data;
      }
      return results;
    } catch (error) {
      console.error('Search dive sites failed', error);
      return [];
    }
  };

  const renderDiveSiteItem = site => (
    <div>
      <div className='font-medium text-gray-900'>{site.name}</div>
      {site.country && (
        <div className='text-xs text-gray-500'>
          {site.country}
          {site.region ? `, ${site.region}` : ''}
        </div>
      )}
    </div>
  );

  return (
    <AutocompleteDropdown
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={selectedSite =>
        onChange(selectedSite ? { id: selectedSite.id, name: selectedSite.name } : null)
      }
      fetchData={fetchDiveSites}
      renderItem={renderDiveSiteItem}
      keyExtractor={site => site.id}
      displayValueExtractor={site => site.name}
      emptyMessage='No dive sites found'
      className={className}
    />
  );
};
