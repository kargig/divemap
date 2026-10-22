import { Clock, Wind, Cylinder, Shirt, Activity } from 'lucide-react';
import React from 'react';

import { getDiverCapabilitySummary } from '../../utils/diverCapabilityHelpers';
import DepthIcon from '../ui/DepthIcon';

/**
 * DiverCapabilityRibbon
 * Displays objective diver capabilities (depth limits, deco, gases, cylinder rig, thermal habits)
 * in a high-contrast responsive ribbon without artificial diver categorization.
 */
const DiverCapabilityRibbon = ({ profile, className = '' }) => {
  const summary = getDiverCapabilitySummary(profile);
  if (!summary) return null;

  const items = [
    {
      label: 'Max Cert Depth',
      value: summary.maxCertDepthStr,
      icon: <DepthIcon className='text-blue-500' size={18} />,
      accent: 'border-l-blue-500',
    },
    {
      label: 'Deepest Logged Dive',
      value: summary.deepestDiveStr,
      subValue: summary.maxDecoStr ? `Deco: ${summary.maxDecoStr}` : null,
      icon: <Clock className='text-indigo-500 w-4 h-4' />,
      accent: 'border-l-indigo-500',
    },
    {
      label: 'Usual Gases',
      value: summary.bestGasStr,
      icon: <Wind className='text-emerald-500 w-4 h-4' />,
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Primary Rig',
      value: summary.primaryRigStr,
      icon: <Cylinder className='text-amber-500 w-4 h-4' />,
      accent: 'border-l-amber-500',
    },
    {
      label: 'Thermal Exposure',
      value: summary.thermalVersatilityStr,
      icon: <Shirt className='text-cyan-500 w-4 h-4' />,
      accent: 'border-l-cyan-500',
    },
    {
      label: 'Experience',
      value: summary.experienceStr,
      icon: <Activity className='text-rose-500 w-4 h-4' />,
      accent: 'border-l-rose-500',
    },
  ];

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-3 sm:p-4 my-4 ${className}`}
    >
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-slate-700/60'>
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`flex flex-col justify-center px-2 py-1.5 ${idx > 0 ? 'pt-2 sm:pt-0' : ''}`}
          >
            <div className='flex items-center space-x-1.5 text-gray-500 dark:text-slate-400 mb-1'>
              <span className='shrink-0'>{item.icon}</span>
              <span className='text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate'>
                {item.label}
              </span>
            </div>
            <div className='text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100 truncate'>
              {item.value}
            </div>
            {item.subValue && (
              <div className='text-[11px] font-medium text-gray-500 dark:text-slate-400 truncate'>
                {item.subValue}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiverCapabilityRibbon;
