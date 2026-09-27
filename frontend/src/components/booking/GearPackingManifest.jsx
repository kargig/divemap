import { Package, Printer, Compass, Gauge, Anchor, Sparkles, LifeBuoy, Layers } from 'lucide-react';
import React, { useState } from 'react';

const GearPackingManifest = ({ summary, participants = [] }) => {
  const [numCrates, setNumCrates] = useState(3); // 1 | 2 | 3 | 4 | 5

  const cylinders = summary?.cylinders || {};
  const stageTanks = summary?.stage_tanks || {};
  const wetsuits = summary?.wetsuits || {};
  const bcds = summary?.bcds || {};
  const fins = summary?.fins || {};
  const boots = summary?.boots || {};
  const hoods = summary?.hoods || {};
  const gloves = summary?.gloves || {};
  const regulators = summary?.regulators || { DIN: 0, Yoke: 0 };
  const masksCount = summary?.masks_count || 0;
  const snorkelsCount = summary?.snorkels_count || 0;
  const socksCount = summary?.socks_count || 0;
  const scootersCount = summary?.scooters_count || 0;

  const leadBreakdown = summary?.lead_breakdown || {};
  const valveFittings = summary?.valve_fittings || {};

  const totalCylinders = Object.values(cylinders).reduce((a, b) => a + b, 0);
  const totalStageTanks = Object.values(stageTanks).reduce((a, b) => a + b, 0);
  const totalWetsuits = Object.values(wetsuits).reduce((a, b) => a + b, 0);
  const totalBcds = Object.values(bcds).reduce((a, b) => a + b, 0);
  const totalFins = Object.values(fins).reduce((a, b) => a + b, 0);
  const totalBoots = Object.values(boots).reduce((a, b) => a + b, 0);
  const totalHoods = Object.values(hoods).reduce((a, b) => a + b, 0);
  const totalGloves = Object.values(gloves).reduce((a, b) => a + b, 0);
  const totalRegs = (regulators.DIN || 0) + (regulators.Yoke || 0);

  // Sub-renderers for modular crate assembly
  const renderWetsuitsBlock = () => (
    <div>
      <div className='flex items-center justify-between pb-1 border-b mb-1.5'>
        <span className='text-[11px] font-bold text-gray-500 uppercase tracking-wider'>
          Thermal Suits ({totalWetsuits})
        </span>
      </div>
      {Object.keys(wetsuits).length === 0 ? (
        <p className='text-xs text-gray-400 italic py-1'>No rental suits requested.</p>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
          {Object.entries(wetsuits).map(([size, count]) => {
            const isWomen = size.startsWith("Women's");
            const isMen = size.startsWith("Men's");
            return (
              <div
                key={size}
                className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                  isWomen
                    ? 'bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/40'
                    : isMen
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40'
                      : 'bg-gray-50 dark:bg-gray-750 border-gray-100 dark:border-gray-700'
                }`}
              >
                <div>
                  <span className='font-bold text-gray-800 dark:text-gray-200 block text-[11px]'>
                    {size}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1 py-0.2 rounded inline-block ${
                      isWomen
                        ? 'bg-pink-100 text-pink-800'
                        : isMen
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isWomen ? "Women's" : isMen ? "Men's / Unisex" : 'Other'}
                  </span>
                </div>
                <strong className='font-mono text-sm text-blue-600'>{count}x</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBcdsBlock = () => (
    <div>
      <div className='flex items-center justify-between pb-1 border-b mb-1.5'>
        <span className='text-[11px] font-bold text-gray-500 uppercase tracking-wider'>
          BCDs ({totalBcds})
        </span>
      </div>
      {Object.keys(bcds).length === 0 ? (
        <p className='text-xs text-gray-400 italic py-1'>No rental BCDs.</p>
      ) : (
        <div className='flex flex-wrap gap-1.5'>
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
  );

  const renderRegulatorsBlock = () => (
    <div>
      <div className='flex items-center justify-between pb-1 border-b mb-1.5'>
        <span className='text-[11px] font-bold text-gray-500 uppercase tracking-wider'>
          Regulator Sets ({totalRegs})
        </span>
      </div>
      {totalRegs === 0 ? (
        <p className='text-xs text-gray-400 italic py-1'>All divers using own regulators.</p>
      ) : (
        <div className='grid grid-cols-2 gap-2 text-center text-xs'>
          <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
            <span className='text-[10px] text-gray-500 block uppercase'>DIN Regulators</span>
            <strong className='text-sm font-mono text-blue-600'>{regulators.DIN || 0}x</strong>
          </div>
          <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
            <span className='text-[10px] text-gray-500 block uppercase'>Yoke Regulators</span>
            <strong className='text-sm font-mono text-amber-600'>{regulators.Yoke || 0}x</strong>
          </div>
        </div>
      )}
    </div>
  );

  const renderFootwearAndFinsBlock = () => (
    <div className='space-y-2'>
      <div className='flex items-center justify-between pb-1 border-b mb-1'>
        <span className='text-[11px] font-bold text-gray-500 uppercase tracking-wider'>
          Fins ({totalFins}) & Boots ({totalBoots})
        </span>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs'>
        <div>
          <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
            Fins by Size / Style
          </span>
          {Object.keys(fins).length === 0 ? (
            <p className='text-xs text-gray-400 italic'>Own fins.</p>
          ) : (
            <div className='flex flex-wrap gap-1'>
              {Object.entries(fins).map(([f, count]) => (
                <span
                  key={f}
                  className='px-2 py-0.5 bg-gray-50 dark:bg-gray-750 rounded text-[11px]'
                >
                  {f}: <strong className='text-blue-600'>{count}x</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
            Neoprene Booties
          </span>
          {Object.keys(boots).length === 0 ? (
            <p className='text-xs text-gray-400 italic'>None.</p>
          ) : (
            <div className='flex flex-wrap gap-1'>
              {Object.entries(boots).map(([b, count]) => (
                <span
                  key={b}
                  className='px-2 py-0.5 bg-gray-50 dark:bg-gray-750 rounded text-[11px]'
                >
                  {b}: <strong className='text-blue-600'>{count}x</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAccessoriesBlock = () => (
    <div className='space-y-2'>
      <div className='flex items-center justify-between pb-1 border-b mb-1'>
        <span className='text-[11px] font-bold text-gray-500 uppercase tracking-wider'>
          Small Gear, Masks, Hoods & Tech
        </span>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs'>
        <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
          <span className='text-[10px] text-gray-500 block uppercase'>Dive Masks</span>
          <strong className='text-sm font-mono text-cyan-700'>{masksCount}x</strong>
        </div>
        <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
          <span className='text-[10px] text-gray-500 block uppercase'>Snorkels</span>
          <strong className='text-sm font-mono text-cyan-700'>{snorkelsCount}x</strong>
        </div>
        <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
          <span className='text-[10px] text-gray-500 block uppercase'>Thermal Hoods</span>
          <strong className='text-sm font-mono text-indigo-700'>{totalHoods}x</strong>
        </div>
        <div className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg'>
          <span className='text-[10px] text-gray-500 block uppercase'>Dive Gloves</span>
          <strong className='text-sm font-mono text-indigo-700'>{totalGloves}x</strong>
        </div>
      </div>

      {(socksCount > 0 || scootersCount > 0 || totalStageTanks > 0) && (
        <div className='pt-1.5 flex flex-wrap gap-2 text-xs'>
          {socksCount > 0 && (
            <span className='px-2 py-0.5 bg-indigo-50 text-indigo-900 rounded font-semibold text-[11px]'>
              Socks / Liners: {socksCount}x
            </span>
          )}
          {scootersCount > 0 && (
            <span className='px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[11px] flex items-center gap-1'>
              <Sparkles size={11} /> DPV Scooters: {scootersCount}x
            </span>
          )}
          {totalStageTanks > 0 && (
            <span className='px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[11px]'>
              Stage Cylinders: {totalStageTanks}x
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className='space-y-6'>
      {/* Crate Loadout Top Bar */}
      <div className='bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h3 className='text-base font-bold text-gray-900 dark:text-white flex items-center gap-2'>
            <Package className='h-5 w-5 text-blue-600' />
            Dockside Crate Packing & Tank Loadout
          </h3>
          <p className='text-xs text-gray-500 mt-0.5'>
            Top-to-bottom equipment checklist, valve configurations, and partitionable transport
            crates.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => window.print()}
            className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-all'
          >
            <Printer size={13} />
            <span>Print Crate Sheet</span>
          </button>
        </div>
      </div>

      {/* Crate Partitioning Bar (1 to 5 Crates) */}
      <div className='bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Layers className='h-4 w-4 text-blue-600' />
          <span className='font-bold text-gray-800 dark:text-gray-200 text-xs uppercase tracking-wider'>
            Crate / Bag Partitioning:
          </span>
        </div>

        <div className='flex items-center gap-1.5'>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type='button'
              onClick={() => setNumCrates(n)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                numCrates === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              {n} {n === 1 ? 'Crate' : 'Crates'}
            </button>
          ))}
        </div>

        <span className='text-[11px] text-gray-400 italic hidden lg:inline'>
          Configures packing layout across {numCrates} transport containers for boat deck loading.
        </span>
      </div>

      {/* Cylinders & Lead Staging (Outside Crates) */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        {/* 1. Primary Cylinders & Stage Tanks Card (6 Cols) */}
        <div className='lg:col-span-6 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
            <div>
              <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                <Gauge size={16} className='text-blue-600' />
                Cylinders to Load (Primary & Stages)
              </h4>
              <span className='text-[11px] text-gray-400'>
                Stage on boat racks according to valve specifications.
              </span>
            </div>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'>
              {totalCylinders + totalStageTanks} Tanks
            </span>
          </div>

          {/* Primary Cylinders */}
          {Object.keys(cylinders).length === 0 ? (
            <p className='text-xs text-gray-400 italic py-2 text-center'>No primary cylinders.</p>
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

          {/* Stage & Decompression Cylinders (If any) */}
          {totalStageTanks > 0 && (
            <div className='pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5'>
              <span className='text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block'>
                Stage & Decompression Cylinders ({totalStageTanks})
              </span>
              {Object.entries(stageTanks).map(([st, count]) => (
                <div
                  key={st}
                  className='flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 text-xs'
                >
                  <span className='font-bold text-purple-900 dark:text-purple-200'>{st}</span>
                  <strong className='font-mono text-purple-700'>{count}x</strong>
                </div>
              ))}
            </div>
          )}

          {/* Valve Fitting Summary Box */}
          <div className='pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs'>
            <div>
              <span className='text-gray-500'>Fittings: </span>
              <strong className='text-gray-900 dark:text-white'>
                {valveFittings.din_count || 0} Native DIN
              </strong>
              {' • '}
              <strong className='text-amber-600'>{valveFittings.yoke_count || 0} Yoke</strong>
            </div>
            <span className='text-[11px] text-gray-500 font-mono'>{valveFittings.tool_notes}</span>
          </div>
        </div>

        {/* 2. Lead Ballast & Belts Card (6 Cols) */}
        <div className='lg:col-span-6 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
          <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
            <div>
              <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2'>
                <Anchor size={16} className='text-indigo-600' />
                Lead Ballast & Weight Belts
              </h4>
              <span className='text-[11px] text-gray-400'>
                Stage in weight bucket with 15% check-dive buffer.
              </span>
            </div>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'>
              {leadBreakdown.total_lead_kg || 0} kg ({leadBreakdown.total_lead_lbs || 0} lbs)
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

          {/* Per-Diver Weight Distribution Breakdown */}
          <div className='pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5'>
            <span className='text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1'>
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
      </div>

      {/* Dynamic Partitioned Crates Grid (1 to 5 Crates) */}
      <div>
        <h4 className='font-bold text-sm text-gray-900 dark:text-white uppercase tracking-tight mb-3 flex items-center gap-2'>
          <Layers size={16} className='text-blue-600' />
          Partitioned Transport Crates ({numCrates} {numCrates === 1 ? 'Crate' : 'Crates'} Layout)
        </h4>

        {/* 1 Crate Layout */}
        {numCrates === 1 && (
          <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
            <div className='flex items-center justify-between pb-2 border-b'>
              <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                Master Crate 1: All Rental Gear & Accessories
              </h5>
              <span className='text-xs text-gray-500 font-mono'>Single Master Loadout</span>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {renderWetsuitsBlock()}
              {renderBcdsBlock()}
              {renderRegulatorsBlock()}
              {renderFootwearAndFinsBlock()}
              <div className='md:col-span-2'>{renderAccessoriesBlock()}</div>
            </div>
          </div>
        )}

        {/* 2 Crates Layout */}
        {numCrates === 2 && (
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
            <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
              <div className='flex items-center justify-between pb-2 border-b'>
                <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                  Crate 1 of 2: Thermal Suits, Hoods & BCDs
                </h5>
                <span className='text-xs text-gray-500 font-mono'>
                  {totalWetsuits + totalBcds} Items
                </span>
              </div>
              <div className='space-y-4'>
                {renderWetsuitsBlock()}
                {renderBcdsBlock()}
              </div>
            </div>

            <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
              <div className='flex items-center justify-between pb-2 border-b'>
                <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                  Crate 2 of 2: Regulators, Fins, Boots & Small Gear
                </h5>
                <span className='text-xs text-gray-500 font-mono'>
                  {totalRegs + totalFins + totalBoots} Items
                </span>
              </div>
              <div className='space-y-4'>
                {renderRegulatorsBlock()}
                {renderFootwearAndFinsBlock()}
                {renderAccessoriesBlock()}
              </div>
            </div>
          </div>
        )}

        {/* 3 Crates Layout (Standard Center Ops) */}
        {numCrates === 3 && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
            <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <div className='flex items-center justify-between pb-2 border-b'>
                <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                  Crate 1 of 3: Thermal Suits & Hoods
                </h5>
                <span className='text-xs font-mono text-gray-500'>{totalWetsuits} Suits</span>
              </div>
              {renderWetsuitsBlock()}
            </div>

            <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
              <div className='flex items-center justify-between pb-2 border-b'>
                <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                  Crate 2 of 3: BCDs & Life-Support Regs
                </h5>
                <span className='text-xs font-mono text-gray-500'>
                  {totalBcds + totalRegs} Items
                </span>
              </div>
              <div className='space-y-3'>
                {renderBcdsBlock()}
                {renderRegulatorsBlock()}
              </div>
            </div>

            <div className='p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
              <div className='flex items-center justify-between pb-2 border-b'>
                <h5 className='font-bold text-sm text-gray-900 dark:text-white'>
                  Crate 3 of 3: Fins, Boots, Masks & Small Gear
                </h5>
                <span className='text-xs font-mono text-gray-500'>
                  {totalFins + totalBoots} Items
                </span>
              </div>
              <div className='space-y-3'>
                {renderFootwearAndFinsBlock()}
                {renderAccessoriesBlock()}
              </div>
            </div>
          </div>
        )}

        {/* 4 Crates Layout */}
        {numCrates === 4 && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <h5 className='font-bold text-xs text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 1: Wetsuits & Hoods
              </h5>
              {renderWetsuitsBlock()}
            </div>

            <div className='p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <h5 className='font-bold text-xs text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 2: Rental BCDs
              </h5>
              {renderBcdsBlock()}
            </div>

            <div className='p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <h5 className='font-bold text-xs text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 3: Regulators & Tech
              </h5>
              {renderRegulatorsBlock()}
              {scootersCount > 0 && (
                <div className='p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-[11px] font-bold text-amber-900'>
                  DPV Scooters: {scootersCount}x
                </div>
              )}
            </div>

            <div className='p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <h5 className='font-bold text-xs text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 4: Fins, Boots & Masks
              </h5>
              {renderFootwearAndFinsBlock()}
              {renderAccessoriesBlock()}
            </div>
          </div>
        )}

        {/* 5 Crates Layout (Dedicated Compartments) */}
        {numCrates === 5 && (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3'>
            <div className='p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2'>
              <h5 className='font-bold text-[11px] text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 1: Suits
              </h5>
              {renderWetsuitsBlock()}
            </div>

            <div className='p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2'>
              <h5 className='font-bold text-[11px] text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 2: BCDs
              </h5>
              {renderBcdsBlock()}
            </div>

            <div className='p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2'>
              <h5 className='font-bold text-[11px] text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 3: Regulators
              </h5>
              {renderRegulatorsBlock()}
            </div>

            <div className='p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2'>
              <h5 className='font-bold text-[11px] text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 4: Fins & Boots
              </h5>
              {renderFootwearAndFinsBlock()}
            </div>

            <div className='p-3.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2'>
              <h5 className='font-bold text-[11px] text-gray-900 dark:text-white pb-1 border-b uppercase'>
                Crate 5: Small Gear & DPV
              </h5>
              {renderAccessoriesBlock()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GearPackingManifest;
