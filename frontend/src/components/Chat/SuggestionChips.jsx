import React from 'react';

const SuggestionChips = ({ suggestions, onSelect }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className='flex overflow-hidden sm:overflow-x-auto hide-scrollbar gap-2 pb-1.5 sm:pb-2 px-1 w-full'>
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion)}
          className={`truncate min-w-0 max-w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] sm:text-xs rounded-full border border-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 ${index >= 1 ? 'hidden sm:block shrink-0' : 'flex-1 shrink'}`}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default SuggestionChips;
