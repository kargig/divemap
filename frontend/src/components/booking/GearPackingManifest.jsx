import { Gauge, Anchor, Package, Printer, Wrench, AlertCircle, ShieldAlert } from 'lucide-react';
import React from 'react';

const GearPackingManifest = ({ summary = {}, participants = [] }) => {
  const cylinders = summary.cylinders || {};
  const wetsuits = summary.wetsuits || {};
  const bcds = summary.bcds || {};
  const fins = summary.fins || {};
  const leadBreakdown = summary.lead_breakdown || {};
  const valveFittings = summary.valve_fittings || {};

  const totalCylinders = Object.values(cylinders).reduce((a, b) => a + b, 0);
  const totalWetsuits = Object.values(wetsuits).reduce((a, b) => a + b, 0);
  const totalBcds = Object.values(bcds).reduce((a, b) => a + b, 0);
  const totalFins = Object.values(fins).reduce((a, b) => a + b, 0);

  const totalLeadKg = leadBreakdown.total_lead_kg || 0;
  const totalLeadLbs = leadBreakdown.total_lead_lbs || 0;

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
            Aggregated equipment manifest, valve connections, and lead ballast pack breakdown for
            boat crew and compressor room.
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
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
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
              {Object.entries(cylinders).map(([tank, count]) => {
                const isYoke = tank.includes('YOKE');
                const [spec, ...valveParts] = tank.split(' — ');
                const valveInfo = valveParts.join(' — ');

                return (
                  <div
                    key={tank}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isYoke
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                        : 'bg-gray-50 dark:bg-gray-750 border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div>
                      <span className='text-xs font-bold text-gray-800 dark:text-gray-200 block'>
                        {spec}
                      </span>
                      {valveInfo && (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-2 py-0.5 rounded ${
                            isYoke
                              ? 'bg-amber-200/90 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                          }`}
                        >
                          {isYoke ? '⚠️ ' : '✓ '}
                          {valveInfo}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1.5 border rounded-lg text-sm font-mono font-bold ${
                        isYoke
                          ? 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-300 border-amber-300'
                          : 'bg-white dark:bg-gray-800 text-blue-600 border-gray-200'
                      }`}
                    >
                      {count}x
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Valve Fitting & Tool Bag Box */}
          <div className='pt-3 border-t border-gray-100 dark:border-gray-700'>
            <h5 className='text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5'>
              <Wrench size={13} className='text-blue-600' />
              Valve Connections & Inserts
            </h5>
            <div className='grid grid-cols-2 gap-2 text-xs mb-2.5'>
              <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
                <span className='text-gray-500 block text-[10px]'>DIN (G 5/8"):</span>
                <strong className='text-gray-900 dark:text-white font-mono'>
                  {valveFittings.din_count || 0} Native
                </strong>
              </div>
              <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
                <span className='text-gray-500 block text-[10px]'>Yoke (INT / A-clamp):</span>
                <strong className='text-gray-900 dark:text-white font-mono'>
                  {valveFittings.yoke_count || 0} Divers
                </strong>
              </div>
            </div>

            {valveFittings.yoke_count > 0 ? (
              <div className='p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2'>
                <AlertCircle size={14} className='text-amber-600 shrink-0 mt-0.5' />
                <span>
                  <strong>Tool Box Alert:</strong> Pack{' '}
                  <strong>
                    {valveFittings.yoke_inserts_needed}x DIN-to-Yoke threaded insert(s)
                  </strong>{' '}
                  and an <strong>8mm hex key</strong> in the boat tool kit to adapt cylinders for
                  Yoke first stages.
                </span>
              </div>
            ) : (
              <div className='text-[11px] text-gray-500 flex items-center gap-1'>
                <span>✓ All divers using native DIN first stages (no yoke inserts required).</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Lead Ballast Weights Card */}
        <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
            <div className='flex items-center gap-2'>
              <Anchor className='text-indigo-600 h-5 w-5' />
              <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight'>
                Lead Ballast & Belts
              </h4>
            </div>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'>
              {totalLeadKg} kg ({totalLeadLbs} lbs)
            </span>
          </div>

          {/* Lead Blocks Breakdown (2kg, 1kg, 0.5kg trim, Belts, Pockets) */}
          <div className='grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs'>
            <div className='p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40'>
              <span className='text-[10px] text-gray-500 uppercase font-semibold block'>
                2 kg Blocks
              </span>
              <strong className='text-base font-bold font-mono text-indigo-700 dark:text-indigo-300'>
                {leadBreakdown.blocks_2kg || 0}x
              </strong>
              <span className='text-[9px] text-gray-400 block'>~4.4 lbs ea</span>
            </div>
            <div className='p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40'>
              <span className='text-[10px] text-gray-500 uppercase font-semibold block'>
                1 kg Blocks
              </span>
              <strong className='text-base font-bold font-mono text-indigo-700 dark:text-indigo-300'>
                {leadBreakdown.blocks_1kg || 0}x
              </strong>
              <span className='text-[9px] text-gray-400 block'>~2.2 lbs ea</span>
            </div>
            <div className='p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40'>
              <span className='text-[10px] text-gray-500 uppercase font-semibold block'>
                0.5 kg Blocks
              </span>
              <strong className='text-base font-bold font-mono text-indigo-700 dark:text-indigo-300'>
                {leadBreakdown.blocks_05kg || 0}x
              </strong>
              <span className='text-[9px] text-gray-400 block'>~1.1 lbs trim</span>
            </div>
            <div className='p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40'>
              <span className='text-[10px] text-gray-500 uppercase font-semibold block'>
                Nylon Belts
              </span>
              <strong className='text-base font-bold font-mono text-blue-700 dark:text-blue-300'>
                {leadBreakdown.belts_needed || 0}
              </strong>
              <span className='text-[9px] text-gray-400 block'>belt system</span>
            </div>
            <div className='p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40'>
              <span className='text-[10px] text-gray-500 uppercase font-semibold block'>
                BCD Pockets
              </span>
              <strong className='text-base font-bold font-mono text-emerald-700 dark:text-emerald-300'>
                {leadBreakdown.integrated_weight_divers || 0}
              </strong>
              <span className='text-[9px] text-gray-400 block'>integrated</span>
            </div>
          </div>

          {/* Spare Buffer Callout */}
          <div className='p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-300 flex items-start gap-2'>
            <ShieldAlert size={14} className='text-blue-600 shrink-0 mt-0.5' />
            <span>
              <strong>Check-Dive Safety Buffer (+15%):</strong> Add{' '}
              <strong>+{leadBreakdown.spare_buffer_kg || 4} kg spare lead</strong> (
              {leadBreakdown.spare_blocks_2kg || 2}x 2kg + {leadBreakdown.spare_blocks_1kg || 2}x
              1kg blocks) to the boat bucket for buoyancy fine-tuning.
            </span>
          </div>

          {/* Diver Distribution List */}
          <div>
            <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5'>
              Per-Diver Weight Distribution & Symmetry
            </span>
            <div className='max-h-36 overflow-y-auto space-y-1.5 pr-1'>
              {participants.map(p => {
                const lead = p.estimated_lead_kg || 0;
                const hasHalf = lead % 1.0 >= 0.4;
                const whole = Math.floor(lead);
                const twos = Math.floor(whole / 2);
                const ones = whole % 2;

                const blocksStr =
                  [
                    twos > 0 ? `${twos}x2kg` : null,
                    ones > 0 ? `${ones}x1kg` : null,
                    hasHalf ? `1x0.5kg` : null,
                  ]
                    .filter(Boolean)
                    .join(' + ') || '0kg';

                const isBelt = p.equipment_sizing?.weight_system === 'BELT';

                return (
                  <div
                    key={p.id}
                    className='flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50 dark:bg-gray-750 rounded-lg'
                  >
                    <div className='flex items-center gap-1.5 truncate max-w-[170px]'>
                      <span className='font-medium text-gray-700 dark:text-gray-300 truncate'>
                        {p.diver_full_name}
                      </span>
                      <span className='text-[10px] text-gray-400 font-sans shrink-0'>
                        ({isBelt ? 'Belt' : 'Pockets'})
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] text-gray-500 font-mono'>{blocksStr}</span>
                      <span className='font-mono font-bold text-gray-900 dark:text-white'>
                        {lead} kg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              {Object.entries(wetsuits).map(([size, count]) => {
                const isWomen = size.startsWith("Women's");
                const isMen = size.startsWith("Men's");

                return (
                  <div
                    key={size}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      isWomen
                        ? 'bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/40'
                        : isMen
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40'
                          : 'bg-gray-50 dark:bg-gray-750 border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div>
                      <span className='text-xs font-bold text-gray-800 dark:text-gray-200 block'>
                        {size}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                          isWomen
                            ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-200'
                            : isMen
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {isWomen ? "Women's Cut" : isMen ? "Men's / Unisex" : 'Custom / Other'}
                      </span>
                    </div>
                    <span className='text-base font-mono font-bold text-blue-600 dark:text-blue-400'>
                      {count}x
                    </span>
                  </div>
                );
              })}
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
