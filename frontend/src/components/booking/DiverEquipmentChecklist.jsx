import {
  CheckCircle2,
  Circle,
  PackageCheck,
  Search,
  Printer,
  Sparkles,
  Edit,
  Shield,
  LifeBuoy,
  Anchor,
  Compass,
  Gauge,
  Flame,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

const DiverEquipmentChecklist = ({ participants = [], onToggleGearCheck, onEditDiver }) => {
  const [filter, setFilter] = useState('ALL'); // ALL | CHECKED | PENDING
  const [search, setSearch] = useState('');

  const gearCheckedCount = useMemo(
    () => participants.filter(p => Boolean(p.gear_checked)).length,
    [participants]
  );

  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const matchesSearch =
        !search ||
        p.diver_full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.certification_level?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (filter === 'CHECKED') return Boolean(p.gear_checked);
      if (filter === 'PENDING') return !p.gear_checked;
      return true;
    });
  }, [participants, filter, search]);

  return (
    <div className='space-y-6'>
      {/* Header Toolbar */}
      <div className='bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h3 className='text-base font-bold text-gray-900 dark:text-white flex items-center gap-2'>
            <PackageCheck className='h-5 w-5 text-emerald-600' />
            Individual Diver Gear Inspection & Handover Checklist
          </h3>
          <p className='text-xs text-gray-500 mt-0.5'>
            Verify top-to-bottom kit presence for each diver at the equipment bench before boat
            boarding.
          </p>
        </div>

        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs'>
            <span className='text-emerald-700 dark:text-emerald-300 font-bold'>
              Equipment Verified:
            </span>
            <strong className='font-mono font-bold text-emerald-800 dark:text-emerald-200'>
              {gearCheckedCount}/{participants.length}
            </strong>
          </div>

          <button
            type='button'
            onClick={() => window.print()}
            className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-all'
          >
            <Printer size={13} />
            <span>Print Checklist</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
        <div className='flex items-center gap-1.5'>
          <button
            type='button'
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filter === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700'
            }`}
          >
            All Divers ({participants.length})
          </button>
          <button
            type='button'
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filter === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Pending Check ({participants.length - gearCheckedCount})
          </button>
          <button
            type='button'
            onClick={() => setFilter('CHECKED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filter === 'CHECKED'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Verified Complete ({gearCheckedCount})
          </button>
        </div>

        <div className='relative w-full sm:w-64'>
          <Search size={14} className='absolute left-3 top-2.5 text-gray-400' />
          <input
            type='text'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search diver or qualification...'
            className='w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl text-xs bg-white dark:bg-gray-800'
          />
        </div>
      </div>

      {/* Diver Equipment Cards List */}
      {filteredParticipants.length === 0 ? (
        <div className='p-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700'>
          <p className='text-xs text-gray-400 italic'>No divers match the selected filter.</p>
        </div>
      ) : (
        <div className='space-y-4'>
          {filteredParticipants.map(diver => {
            const eq = diver.equipment_sizing || {};
            const isChecked = Boolean(diver.gear_checked);
            const isWomenSuit = eq.wetsuit_gender === 'WOMEN';
            const isWomenBcd = (eq.bcd_gender || eq.wetsuit_gender) === 'WOMEN';

            const lead = diver.estimated_lead_kg || 0;
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

            return (
              <div
                key={diver.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isChecked
                    ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-800/60 shadow-xs'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm'
                }`}
              >
                {/* Diver Header Row */}
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                        isChecked ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                    >
                      {diver.diver_full_name?.charAt(0) || 'D'}
                    </div>

                    <div>
                      <div className='flex items-center gap-2'>
                        <h4 className='font-bold text-sm text-gray-900 dark:text-white'>
                          {diver.diver_full_name}
                        </h4>
                        <span className='px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
                          {diver.certification_agency} {diver.certification_level}
                        </span>
                      </div>
                      <span className='text-[11px] text-gray-400'>
                        {diver.date_of_birth ? `DOB: ${diver.date_of_birth}` : ''}{' '}
                        {diver.diver_nationality ? `• ${diver.diver_nationality}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Master Handover Toggle */}
                  <div className='flex items-center gap-2'>
                    {onEditDiver && (
                      <button
                        type='button'
                        onClick={() => onEditDiver(diver)}
                        className='px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 border border-gray-200 dark:border-gray-700'
                      >
                        <Edit size={12} />
                        <span>Edit Gear</span>
                      </button>
                    )}

                    <button
                      type='button'
                      onClick={() => onToggleGearCheck && onToggleGearCheck(diver.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                        isChecked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {isChecked ? (
                        <>
                          <CheckCircle2 size={14} />
                          <span>All Gear Verified Present</span>
                        </>
                      ) : (
                        <>
                          <Circle size={14} />
                          <span>Confirm All Gear Present</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Top-to-Bottom Equipment Checklist Grid */}
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 text-xs'>
                  {/* 1. Primary Cylinder & Valve */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <Gauge size={12} className='text-blue-600' />
                      Cylinder
                    </span>
                    <strong className='text-gray-900 dark:text-white block'>
                      {diver.selected_tank_id}L • {diver.selected_gas_mix_id?.toUpperCase()}
                    </strong>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        eq.regulator_fitting === 'YOKE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {eq.regulator_fitting === 'YOKE' ? '⚠️ Yoke Insert' : '✓ DIN Native'}
                    </span>
                  </div>

                  {/* 2. Regulator Setup */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <Compass size={12} className='text-cyan-600' />
                      Regulator
                    </span>
                    <strong className='text-gray-900 dark:text-white block'>
                      {eq.rental_regulator || !eq.has_own_regulator
                        ? `Rental Reg (${eq.regulator_fitting || 'DIN'})`
                        : 'Diver Own Reg'}
                    </strong>
                    {eq.stage_tank && eq.stage_tank !== 'None' && (
                      <span className='inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900'>
                        + {eq.stage_tank}
                      </span>
                    )}
                  </div>

                  {/* 3. BCD & Buoyancy */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <LifeBuoy size={12} className='text-emerald-600' />
                      BCD
                    </span>
                    <strong className='text-gray-900 dark:text-white block'>
                      {eq.bcd_size && eq.bcd_size !== 'None' ? `Size ${eq.bcd_size}` : 'Own BCD'}
                    </strong>
                    {eq.bcd_size && eq.bcd_size !== 'None' && (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isWomenBcd ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isWomenBcd ? "Women's Cut" : "Men's / Unisex"}
                      </span>
                    )}
                  </div>

                  {/* 4. Lead Ballast & Weights */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <Anchor size={12} className='text-indigo-600' />
                      Ballast ({lead} kg)
                    </span>
                    <strong className='text-gray-900 dark:text-white block font-mono'>
                      {blocksStr}
                    </strong>
                    <span className='inline-block text-[10px] text-gray-500 font-medium'>
                      {eq.weight_system === 'BELT' ? 'Nylon Belt' : 'Integrated Pockets'}
                    </span>
                  </div>

                  {/* 5. Thermal Suit & Protection */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <Shield size={12} className='text-blue-600' />
                      Thermal Suit
                    </span>
                    <strong className='text-gray-900 dark:text-white block'>
                      {eq.wetsuit_size && eq.wetsuit_size !== 'None'
                        ? `${eq.wetsuit_size} (${eq.wetsuit_thickness || '5mm'})`
                        : 'Own Suit'}
                    </strong>
                    {eq.wetsuit_size && eq.wetsuit_size !== 'None' && (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isWomenSuit ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isWomenSuit ? "Women's" : "Men's"}
                      </span>
                    )}
                  </div>

                  {/* 6. Footwear & Fins */}
                  <div className='p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl space-y-1'>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1'>
                      <Compass size={12} className='text-cyan-600' />
                      Fins & Boots
                    </span>
                    <strong className='text-gray-900 dark:text-white block'>
                      {eq.fin_type === 'OPEN_HEEL' ? 'Open-Heel Fins' : 'Full-Foot Fins'}
                    </strong>
                    <span className='text-[10px] text-gray-500 block'>
                      Booties: EU {eq.shoe_size_eu || '43'}
                    </span>
                  </div>
                </div>

                {/* Accessories, Lights & Safety Gear Bar */}
                <div className='mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2 text-xs'>
                  <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider'>
                    Kit Accessories:
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      eq.rental_mask
                        ? 'bg-cyan-100 text-cyan-900 font-bold'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    Mask: {eq.rental_mask ? 'Rental Mask' : 'Own Mask'}
                  </span>

                  {eq.rental_snorkel && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-cyan-50 text-cyan-800 font-medium'>
                      Snorkel
                    </span>
                  )}

                  {eq.hood_size && eq.hood_size !== 'None' && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-900 font-medium'>
                      Hood: Size {eq.hood_size}
                    </span>
                  )}

                  {eq.gloves_size && eq.gloves_size !== 'None' && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-900 font-medium'>
                      Gloves: Size {eq.gloves_size}
                    </span>
                  )}

                  {/* Dive Torch / Light */}
                  {eq.rental_torch && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-amber-100 text-amber-900 font-bold flex items-center gap-1'>
                      <Flame size={11} className='text-amber-600' />
                      Rental Dive Torch
                    </span>
                  )}

                  {/* DPV Scooter */}
                  {eq.rental_scooter && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-purple-100 text-purple-900 font-bold flex items-center gap-1'>
                      <Sparkles size={11} className='text-purple-600' />
                      DPV Scooter Reserved
                    </span>
                  )}

                  {eq.has_own_dive_computer && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800'>
                      ✓ Own Computer
                    </span>
                  )}

                  {eq.has_own_smb && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800'>
                      ✓ Own SMB & Spool
                    </span>
                  )}

                  {eq.emergency_contact_name && (
                    <span className='text-[11px] text-gray-400 ml-auto'>
                      Emergency Contact: {eq.emergency_contact_name} ({eq.emergency_contact_phone})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiverEquipmentChecklist;
