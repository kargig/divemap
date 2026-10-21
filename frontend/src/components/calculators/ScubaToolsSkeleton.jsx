import { Calculator } from 'lucide-react';
import React from 'react';

export default function ScubaToolsSkeleton() {
  return (
    <div
      role='status'
      aria-label='Loading dive planning tools...'
      className='bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl border-y sm:border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden animate-pulse'
    >
      {/* Header */}
      <div className='bg-[#eaf4f9]/50 dark:bg-slate-700/50 p-5 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3.5'>
        <div className='bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-blue-100/50 dark:border-slate-600 shadow-sm shrink-0 flex items-center justify-center h-11 w-11'>
          <Calculator className='h-5 w-5 text-[#0072B2] dark:text-sky-400 opacity-60' />
        </div>
        <div className='min-w-0 flex-1 text-left'>
          <h3 className='text-base font-extrabold text-gray-900 dark:text-slate-100 leading-snug'>
            Scuba Tools
          </h3>
          <p className='text-xs text-gray-600 dark:text-slate-300 leading-tight mt-0.5'>
            Instant, interactive dive planning calculators
          </p>
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className='flex border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30'>
        <div className='flex-1 py-3 px-4 flex justify-center'>
          <div className='h-4 bg-gray-200 dark:bg-slate-600 rounded w-28'></div>
        </div>
        <div className='flex-1 py-3 px-4 flex justify-center'>
          <div className='h-4 bg-gray-200 dark:bg-slate-600 rounded w-28'></div>
        </div>
        <div className='flex-1 py-3 px-4 flex justify-center'>
          <div className='h-4 bg-gray-200 dark:bg-slate-600 rounded w-28'></div>
        </div>
      </div>

      {/* Content body skeleton */}
      <div className='p-4 sm:p-6 min-h-[260px] flex flex-col justify-between space-y-4'>
        <div className='space-y-4'>
          <div className='h-4 bg-gray-200 dark:bg-slate-700 rounded w-40'></div>
          <div className='h-6 bg-gray-200 dark:bg-slate-700 rounded w-full'></div>
          <div className='h-4 bg-gray-200 dark:bg-slate-700 rounded w-48'></div>
        </div>
        <div className='bg-[#eaf4f9]/30 dark:bg-slate-700/40 p-4 rounded-xl text-center border border-[#eaf4f9] dark:border-slate-600 h-24 flex flex-col justify-center items-center'>
          <div className='h-3 bg-gray-200 dark:bg-slate-600 rounded w-36 mb-2'></div>
          <div className='h-8 bg-blue-100 dark:bg-sky-900/40 rounded w-24'></div>
        </div>
      </div>
    </div>
  );
}
