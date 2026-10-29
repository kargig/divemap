import { Search, Plus, FilterX } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

/**
 * EmptyState Component
 *
 * Provides a consistent, actionable empty state for list pages
 * according to Rev. 8 specifications.
 */
const EmptyState = ({
  icon: Icon = Search,
  title = 'No results found',
  message = 'Try adjusting your search or filters to find what you are looking for.',
  onClearFilters,
  actionLink,
  actionText,
}) => {
  return (
    <div className='bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-12 text-center'>
      <div className='bg-gray-50 dark:bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6'>
        <Icon className='w-10 h-10 text-gray-300 dark:text-slate-600' />
      </div>

      <h3 className='text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2'>{title}</h3>
      <p className='text-gray-500 dark:text-slate-400 max-w-sm mx-auto mb-8'>{message}</p>

      <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className='inline-flex items-center gap-2 px-6 py-2 bg-divemap-blue text-white font-bold rounded-lg hover:opacity-90 transition-colors shadow-lg hover:shadow-divemap-blue/25'
          >
            <FilterX className='w-4 h-4' />
            Clear All Filters
          </button>
        )}

        {actionLink && actionText && (
          <Link
            to={actionLink}
            className='inline-flex items-center gap-2 px-6 py-2 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-650 transition-colors'
          >
            <Plus className='w-4 h-4' />
            {actionText}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
