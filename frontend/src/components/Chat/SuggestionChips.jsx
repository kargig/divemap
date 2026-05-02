import React from 'react';

const SuggestionChips = ({ suggestions, onSelect }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className='flex flex-col gap-1 w-full px-1 mb-2'>
      <span className='hidden sm:block text-xs font-semibold text-gray-500 mb-1 dark:text-gray-400'>
        Suggested prompts:
      </span>
      <div className='flex flex-wrap gap-2'>
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className={`px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] sm:text-xs rounded-full border border-gray-200 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 whitespace-normal text-left ${index >= 1 ? 'hidden sm:block' : 'block'}`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestionChips;
