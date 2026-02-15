import React from 'react';

const SuggestionChips = ({ suggestions, onSelect }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className='flex flex-wrap gap-2 pb-2 px-1'>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className='whitespace-nowrap px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full border border-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default SuggestionChips;
