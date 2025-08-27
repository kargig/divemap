import PropTypes from 'prop-types';
import React from 'react';

import FuzzySearchInput from './FuzzySearchInput';

const DivingCentersDesktopSearchBar = ({
  searchValue,
  onSearchChange,
  onSearchSelect,
  data,
  configType = 'divingCenters',
  placeholder = 'Search diving centers by name, location, or services...',
  className = '',
}) => {
  return (
    <div
      data-testid='diving-centers-desktop-search-bar'
      className={`p-4 border-b border-gray-200 ${className}`}
    >
      <div className='max-w-2xl mx-auto'>
        <FuzzySearchInput
          data={data || []}
          searchValue={searchValue}
          onSearchChange={value => onSearchChange({ target: { name: 'search', value } })}
          onSearchSelect={onSearchSelect}
          configType={configType}
          placeholder={placeholder}
          minQueryLength={2}
          maxSuggestions={8}
          debounceDelay={300}
          showSuggestions={true}
          highlightMatches={true}
          showScore={false}
          showClearButton={true}
          className='w-full'
          inputClassName='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base'
          suggestionsClassName='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto'
          highlightClass='bg-blue-100 font-medium'
        />
      </div>
    </div>
  );
};

DivingCentersDesktopSearchBar.propTypes = {
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func.isRequired,
  onSearchSelect: PropTypes.func.isRequired,
  data: PropTypes.array,
  configType: PropTypes.string,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

export default DivingCentersDesktopSearchBar;
