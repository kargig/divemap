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
      className={`px-3 sm:px-4 mb-3 sm:mb-4 ${className}`}
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
          inputClassName='w-full px-4 py-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base shadow-sm'
          suggestionsClassName='absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-96 overflow-y-auto text-gray-900 dark:text-slate-100'
          highlightClass='bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 font-medium'
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
