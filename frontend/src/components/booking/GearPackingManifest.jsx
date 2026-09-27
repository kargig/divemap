import { Gauge, Anchor, Package, Printer } from 'lucide-react';
import React from 'react';

const GearPackingManifest = ({ summary = {}, participants = [] }) => {
  const cylinders = summary.cylinders || {};
  const wetsuits = summary.wetsuits || {};
  const bcds = summary.bcds || {};
  const fins = summary.fins || {};
  const totalLead = summary.total_lead_kg || 0;

  const totalCylinders = Object.values(cylinders).reduce((a, b) => a + b, 0);
  const totalWetsuits = Object.values(wetsuits).reduce((a, b) => a + b, 0);
  const totalBcds = Object.values(bcds).reduce((a, b) => a + b, 0);
  const totalFins = Object.values(fins).reduce((a, b) => a + b, 0);

  return (
    <div className='space-y-6'>
      {/* Top Banner with Quick Totals */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800'>
        <div>
          <h3 className='text-sm sm:text-base font-bold text-blue-950 dark:text-blue-100 flex items-center gap-2'>
            <Package className='text-blue-600 h-5 w-5' />
            Dockside Crate Packing & Tank Loadout
          </h3>
          <p className='text-xs text-blue-800/80 dark:text-blue-300 mt-0.5'>
            Aggregated equipment manifest for boat crew and compressor room staff.
          </p>
        </div>
        <button
          type='button'
          onClick={() => window.print()}
          className='flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-700 shadow-sm hover:bg-blue-50 transition-all self-start sm:self-auto'
        >
          <Printer size={14} />
          Print Crate List
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* 1. Breathing Gas & Cylinders Card */}
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 mb-3'>
            <div className='flex items-center gap-2'>
              <Gauge className='text-blue-600 h-5 w-5' />
              <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight'>
                Cylinders to Load
              </h4>
            </div>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'>
              {totalCylinders} Tanks
            </span>
          </div>

          {Object.keys(cylinders).length === 0 ? (
            <p className='text-xs text-gray-400 italic py-4 text-center'>No cylinders requested.</p>
          ) : (
            <div className='space-y-2'>
              {Object.entries(cylinders).map(([tank, count]) => (
                <div
                  key={tank}
                  className='flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700'
                >
                  <span className='text-xs font-bold text-gray-800 dark:text-gray-200'>{tank}</span>
                  <span className='px-2.5 py-1 bg-white dark:bg-gray-800 border rounded-lg text-xs font-mono font-bold text-blue-600'>
                    {count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Lead Ballast Weights Card */}
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 mb-3'>
            <div className='flex items-center gap-2'>
              <Anchor className='text-indigo-600 h-5 w-5' />
              <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight'>
                Lead Ballast Weights
              </h4>
            </div>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'>
              {totalLead} kg Total
            </span>
          </div>

          <p className='text-xs text-gray-500 mb-3'>
            Estimated diver weight distribution for weight pocket crates:
          </p>

          <div className='max-h-48 overflow-y-auto space-y-1.5 pr-1'>
            {participants.map(p => (
              <div
                key={p.id}
                className='flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50 dark:bg-gray-750 rounded-lg'
              >
                <span className='font-medium text-gray-700 dark:text-gray-300 truncate max-w-[180px]'>
                  {p.diver_full_name}
                </span>
                <span className='font-mono font-bold text-gray-900 dark:text-white'>
                  {p.estimated_lead_kg || 0} kg
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Rental Wetsuits Crate Card */}
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 mb-3'>
            <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight'>
              Crate A: Rental Wetsuits
            </h4>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'>
              {totalWetsuits} Suits
            </span>
          </div>

          {Object.keys(wetsuits).length === 0 ? (
            <p className='text-xs text-gray-400 italic py-4 text-center'>
              No rental wetsuits requested. All divers using own suits.
            </p>
          ) : (
            <div className='grid grid-cols-2 gap-2'>
              {Object.entries(wetsuits).map(([size, count]) => (
                <div
                  key={size}
                  className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-100 dark:border-gray-700 text-center'
                >
                  <span className='text-xs font-bold text-gray-700 dark:text-gray-300 block'>
                    {size}
                  </span>
                  <span className='text-sm font-mono font-bold text-blue-600 mt-0.5 block'>
                    {count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Rental BCDs & Fins Crates Card */}
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 mb-3'>
            <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight'>
              Crate B: BCDs & Fins
            </h4>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'>
              {totalBcds + totalFins} Items
            </span>
          </div>

          <div className='space-y-3'>
            <div>
              <span className='text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1'>
                BCDs ({totalBcds})
              </span>
              {Object.keys(bcds).length === 0 ? (
                <span className='text-xs text-gray-400 italic'>None</span>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {Object.entries(bcds).map(([size, count]) => (
                    <span
                      key={size}
                      className='px-2.5 py-1 bg-gray-50 dark:bg-gray-750 rounded-lg text-xs font-semibold'
                    >
                      Size {size}: <strong className='text-blue-600'>{count}x</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className='pt-2 border-t border-gray-100 dark:border-gray-700'>
              <span className='text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1'>
                Fins & Booties ({totalFins})
              </span>
              {Object.keys(fins).length === 0 ? (
                <span className='text-xs text-gray-400 italic'>None</span>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {Object.entries(fins).map(([size, count]) => (
                    <span
                      key={size}
                      className='px-2.5 py-1 bg-gray-50 dark:bg-gray-750 rounded-lg text-xs font-semibold'
                    >
                      {size}: <strong className='text-blue-600'>{count}x</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GearPackingManifest;
