import {
  CheckCircle2,
  Circle,
  PackageCheck,
  Search,
  Sparkles,
  Edit,
  Shield,
  LifeBuoy,
  Anchor,
  Compass,
  Gauge,
  Flame,
  Download,
  Loader2,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

const DiverEquipmentChecklist = ({
  participants = [],
  onToggleGearCheck,
  onEditDiver,
  centerId,
  tripId,
}) => {
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

  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      toast.loading('Generating Equipment Checklist PDF...', { id: 'gear-pdf' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/equipment-checklist/pdf`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      toast.success('Equipment Checklist PDF ready!', { id: 'gear-pdf' });
    } catch (err) {
      console.error('Failed to export equipment checklist PDF:', err);
      toast.error(err.response?.data?.detail || 'Failed to export equipment checklist PDF.', {
        id: 'gear-pdf',
      });
    } finally {
      setExportingPdf(false);
    }
  };

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

        <div className='flex items-center gap-2'>
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
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className='flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50'
            title='Export spreadsheet-style printable checklist PDF for clipboard checks'
          >
            {exportingPdf ? <Loader2 size={13} className='animate-spin' /> : <Download size={13} />}
            <span>Export Checklist (PDF)</span>
          </button>
        </div>
      </div>

      {/* Vessel Safety Assets: Spare Cylinders & Spare Regulator */}
      <div className='p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-2.5'>
        <div className='flex items-center justify-between'>
          <span className='font-bold text-xs text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5'>
            <LifeBuoy size={15} className='text-indigo-600' />
            Vessel Safety & Emergency Spare Assets (Organized for Trip)
          </span>
          <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 uppercase'>
            Boat Inventory
          </span>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs'>
          {/* Spare Cylinders */}
          <div className='p-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 flex items-center justify-center'>
                <Gauge size={16} />
              </div>
              <div>
                <strong className='text-gray-900 dark:text-white block text-xs'>
                  2x 12L Air (DIN) Safety Spares
                </strong>
                <span className='text-[10px] text-gray-500'>
                  Safety buffer for deco hang bar & emergency reserve
                </span>
              </div>
            </div>
            <span className='px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[10px] rounded-lg border border-emerald-200'>
              ✓ Loaded on Boat
            </span>
          </div>

          {/* Spare Regulator */}
          <div className='p-3 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 flex items-center justify-center'>
                <Compass size={16} />
              </div>
              <div>
                <strong className='text-gray-900 dark:text-white block text-xs'>
                  1x Spare Regulator Setup
                </strong>
                <span className='text-[10px] text-gray-500'>
                  Complete system (1st & 2nd, Octo, SPG) + Yoke insert
                </span>
              </div>
            </div>
            <span className='px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[10px] rounded-lg border border-emerald-200'>
              ✓ Staged in Boat Box
            </span>
          </div>
        </div>
      </div>

      {/* Filter, Search & Color Legend Bar */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-3'>
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

        {/* Visual Color Distinction Legend */}
        <div className='flex flex-wrap items-center gap-3 text-xs bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs'>
          <span className='font-bold text-gray-400 uppercase text-[10px] tracking-wider'>
            Gear Origin:
          </span>
          <div className='flex items-center gap-1.5'>
            <span className='w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-100 dark:ring-blue-900'></span>
            <span className='font-bold text-blue-900 dark:text-blue-200 text-[11px]'>
              Rental (Center Handover)
            </span>
          </div>
          <div className='flex items-center gap-1.5'>
            <span className='w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-100 dark:ring-slate-700'></span>
            <span className='font-semibold text-slate-700 dark:text-gray-300 text-[11px]'>
              Diver-Owned (Customer Kit)
            </span>
          </div>
          <div className='flex items-center gap-1.5'>
            <span className='w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-100 dark:ring-indigo-900'></span>
            <span className='font-semibold text-indigo-900 dark:text-indigo-200 text-[11px]'>
              Boat Asset (Tank & Lead)
            </span>
          </div>
        </div>

        <div className='relative w-full sm:w-60'>
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
            const isFullRentalTier =
              diver.unit_id === 'certified-diver-full-rental' ||
              diver.unit_id === 'demo-unit-2' ||
              Boolean(eq.is_rental_package);

            // Item-by-item Rental vs Own evaluation
            const isRegRental =
              isFullRentalTier || eq.rental_regulator || eq.has_own_regulator === false;
            const isBcdRental = Boolean(eq.bcd_size && eq.bcd_size !== 'None');
            const isSuitRental = Boolean(eq.wetsuit_size && eq.wetsuit_size !== 'None');
            const isFinsRental = isFullRentalTier || eq.rental_fins || eq.has_own_fins === false;
            const isMaskRental = isFullRentalTier || eq.rental_mask || eq.has_own_mask === false;
            const isTorchRental = Boolean(eq.rental_torch);
            const isScooterRental = Boolean(eq.rental_scooter || eq.has_scooter);

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
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isFullRentalTier
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {isFullRentalTier ? 'Full Rental Package' : 'Own Gear Diver'}
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
                  {/* 1. Primary Cylinder & Valve (Facility Boat Asset) */}
                  <div className='p-2.5 rounded-xl space-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40'>
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <Gauge size={12} className='text-indigo-600' />
                        Cylinder
                      </span>
                      <span className='text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'>
                        Boat Asset
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block'>
                      {diver.tanks_count || 2}x {diver.selected_tank_id}L •{' '}
                      {diver.selected_gas_mix_id?.toUpperCase()}
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

                  {/* 2. Regulator Setup (Rental vs Own) */}
                  <div
                    className={`p-2.5 rounded-xl space-y-1 border ${
                      isRegRental
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <Compass
                          size={12}
                          className={isRegRental ? 'text-blue-600' : 'text-slate-500'}
                        />
                        Regulator
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isRegRental
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        {isRegRental ? 'Rental' : 'Own'}
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block'>
                      {isRegRental
                        ? `Rental Reg (${eq.regulator_fitting || 'DIN'})`
                        : 'Diver Own Reg'}
                    </strong>
                    {eq.stage_tank && eq.stage_tank !== 'None' && (
                      <span className='inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900'>
                        + {eq.stage_tank}
                      </span>
                    )}
                  </div>

                  {/* 3. BCD & Buoyancy (Rental vs Own) */}
                  <div
                    className={`p-2.5 rounded-xl space-y-1 border ${
                      isBcdRental
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <LifeBuoy
                          size={12}
                          className={isBcdRental ? 'text-blue-600' : 'text-slate-500'}
                        />
                        BCD
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isBcdRental
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        {isBcdRental ? 'Rental' : 'Own'}
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block'>
                      {isBcdRental ? `Size ${eq.bcd_size}` : 'Diver Own BCD'}
                    </strong>
                    {isBcdRental && (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isWomenBcd ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isWomenBcd ? "Women's Cut" : "Men's / Unisex"}
                      </span>
                    )}
                  </div>

                  {/* 4. Lead Ballast & Weights (Facility Boat Asset) */}
                  <div className='p-2.5 rounded-xl space-y-1 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40'>
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <Anchor size={12} className='text-indigo-600' />
                        Ballast
                      </span>
                      <span className='text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'>
                        Boat Asset
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block font-mono'>
                      {lead} kg ({blocksStr})
                    </strong>
                    <span className='inline-block text-[10px] text-gray-500 font-medium'>
                      {eq.weight_system === 'BELT' ? 'Nylon Belt' : 'Integrated Pockets'}
                    </span>
                  </div>

                  {/* 5. Thermal Suit & Protection (Rental vs Own) */}
                  <div
                    className={`p-2.5 rounded-xl space-y-1 border ${
                      isSuitRental
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <Shield
                          size={12}
                          className={isSuitRental ? 'text-blue-600' : 'text-slate-500'}
                        />
                        Thermal Suit
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isSuitRental
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        {isSuitRental ? 'Rental' : 'Own'}
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block'>
                      {isSuitRental
                        ? `${eq.wetsuit_size} (${eq.wetsuit_thickness || '5mm'})`
                        : 'Diver Own Suit'}
                    </strong>
                    {isSuitRental && (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isWomenSuit ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isWomenSuit ? "Women's" : "Men's"}
                      </span>
                    )}
                  </div>

                  {/* 6. Footwear & Fins (Rental vs Own) */}
                  <div
                    className={`p-2.5 rounded-xl space-y-1 border ${
                      isFinsRental
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1'>
                        <Compass
                          size={12}
                          className={isFinsRental ? 'text-blue-600' : 'text-slate-500'}
                        />
                        Fins & Boots
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          isFinsRental
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                        }`}
                      >
                        {isFinsRental ? 'Rental' : 'Own'}
                      </span>
                    </div>
                    <strong className='text-gray-900 dark:text-white block'>
                      {isFinsRental
                        ? `Rental Fins ${eq.fin_size && eq.fin_size !== 'None' ? `(${eq.fin_size})` : ''}`
                        : 'Diver Own Fins'}
                    </strong>
                    <span className='text-[10px] text-gray-500 block'>
                      Booties:{' '}
                      {eq.rental_boots || (eq.boot_size && eq.boot_size !== 'None')
                        ? `Rental EU ${eq.boot_size || eq.shoe_size_eu || '43'}`
                        : 'Own Boots'}
                    </span>
                  </div>
                </div>

                {/* Accessories, Lights & Safety Gear Bar with Consistent Colors */}
                <div className='mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2 text-xs'>
                  <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider'>
                    Kit Accessories:
                  </span>

                  {/* Mask: Rental (Blue) vs Own (Slate) */}
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border flex items-center gap-1 ${
                      isMaskRental
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                        : 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-600'
                    }`}
                  >
                    <span>Mask:</span>
                    <span>{isMaskRental ? 'Rental Mask' : 'Own Mask'}</span>
                  </span>

                  {/* Snorkel */}
                  {eq.rental_snorkel && (
                    <span className='px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'>
                      Rental Snorkel
                    </span>
                  )}

                  {/* Hood */}
                  {eq.hood_size && eq.hood_size !== 'None' && (
                    <span className='px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'>
                      Rental Hood: Size {eq.hood_size}
                    </span>
                  )}

                  {/* Gloves */}
                  {eq.gloves_size && eq.gloves_size !== 'None' && (
                    <span className='px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700'>
                      Rental Gloves: Size {eq.gloves_size}
                    </span>
                  )}

                  {/* Dive Torch / Light: Rental (Amber/Blue) */}
                  {isTorchRental && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold flex items-center gap-1'>
                      <Flame size={11} className='text-amber-600' />
                      Rental Dive Torch
                    </span>
                  )}

                  {/* DPV Scooter */}
                  {isScooterRental && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 font-bold flex items-center gap-1'>
                      <Sparkles size={11} className='text-purple-600' />
                      Rental DPV Scooter
                    </span>
                  )}

                  {/* Dive Computer: Rental (Blue) vs Own (Slate) */}
                  {eq.rental_dive_computer || (isFullRentalTier && !eq.has_own_dive_computer) ? (
                    <span className='px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 flex items-center gap-1'>
                      Rental Dive Computer
                    </span>
                  ) : eq.has_own_dive_computer ? (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 font-medium'>
                      ✓ Own Computer
                    </span>
                  ) : (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 font-bold'>
                      ⚠️ Computer Required
                    </span>
                  )}

                  {eq.has_own_smb && (
                    <span className='px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 font-medium'>
                      ✓ Own SMB & Spool
                    </span>
                  )}

                  {eq.emergency_contact_name && (
                    <span className='text-[11px] text-gray-400 ml-auto'>
                      Emergency: {eq.emergency_contact_name} ({eq.emergency_contact_phone})
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
