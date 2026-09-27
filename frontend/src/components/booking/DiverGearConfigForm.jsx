import {
  Calculator,
  Check,
  Loader2,
  Scale,
  Sparkles,
  Anchor,
  Gauge,
  LifeBuoy,
  HeartPulse,
  Compass,
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

import { TANK_SIZES } from '../../utils/diveConstants';
import { calculateTankBuoyancy, WATER_TYPES } from '../../utils/TankBuoyancy';

const SUIT_FACTORS = {
  '3mm-shorty': { multiplier: 0.03, offset: 0, label: '3mm Shorty' },
  '3mm': { multiplier: 0.05, offset: 0, label: '3mm Full' },
  '5mm': { multiplier: 0.08, offset: 0, label: '5mm Full' },
  '7mm': { multiplier: 0.1, offset: 2, label: '7mm Semi-Dry' },
  drysuit: { multiplier: 0.1, offset: 4, label: 'Drysuit' },
};

const DiverGearConfigForm = ({
  initialData,
  onSave,
  onCancel,
  loading = false,
  compact = false,
  showEmergencyAndInsurance = true,
  showBallastCalculator = true,
}) => {
  const [unitSystem, setUnitSystem] = useState('METRIC'); // METRIC | IMPERIAL

  // Sizing & Biometrics
  const [heightCm, setHeightCm] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');

  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');

  const [shoeSizeEu, setShoeSizeEu] = useState('43');
  const [shoeSizeUs, setShoeSizeUs] = useState('9.5');

  // 1. Head & Face
  const [rentalMask, setRentalMask] = useState(false);
  const [rentalSnorkel, setRentalSnorkel] = useState(false);
  const [hoodSize, setHoodSize] = useState('None');

  // 2. Breathing & Regulators
  const [selectedTankId, setSelectedTankId] = useState('12');
  const [selectedGasMixId, setSelectedGasMixId] = useState('air');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [rentalRegulator, setRentalRegulator] = useState(true);
  const [stageTank, setStageTank] = useState('None');

  // 3. Buoyancy & Ballast
  const [bcdGender, setBcdGender] = useState('MEN');
  const [bcdSize, setBcdSize] = useState('M');
  const [leadKg, setLeadKg] = useState('4.0');
  const [leadLbs, setLeadLbs] = useState('9.0');
  const [weightSystem, setWeightSystem] = useState('INTEGRATED');

  // 4. Thermal & Exposure
  const [wetsuitGender, setWetsuitGender] = useState('MEN');
  const [wetsuitSize, setWetsuitSize] = useState('L');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [glovesSize, setGlovesSize] = useState('None');
  const [rentalSocks, setRentalSocks] = useState(false);

  // 5. Footwear & Fins
  const [finType, setFinType] = useState('OPEN_HEEL');
  const [rentalFins, setRentalFins] = useState(true);
  const [rentalBoots, setRentalBoots] = useState(true);

  // 6. Specialty / Propulsion
  const [rentalScooter, setRentalScooter] = useState(false);
  const [rentalTorch, setRentalTorch] = useState(false);

  // 7. Safety Gear
  const [hasOwnComputer, setHasOwnComputer] = useState(false);
  const [hasOwnSmb, setHasOwnSmb] = useState(false);

  // 8. Insurance & Emergency
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');

  // Ballast Physics Calculator State
  const [showEstimator, setShowEstimator] = useState(false);
  const [waterTypeIdx, setWaterTypeIdx] = useState(6); // Default: Aegean / Eastern Med (1.029)

  // Sync initialData into form state
  useEffect(() => {
    if (!initialData) return;
    const eq = initialData.equipment_sizing || {};

    if (initialData.selected_tank_id) setSelectedTankId(initialData.selected_tank_id);
    if (initialData.selected_gas_mix_id) setSelectedGasMixId(initialData.selected_gas_mix_id);

    // Regulator & weight system
    if (eq.regulator_fitting) setRegulatorFitting(eq.regulator_fitting);
    if (eq.weight_system) setWeightSystem(eq.weight_system);
    setRentalRegulator(eq.rental_regulator !== undefined ? Boolean(eq.rental_regulator) : true);
    setStageTank(eq.stage_tank || 'None');

    // Head & face
    setRentalMask(Boolean(eq.rental_mask));
    setRentalSnorkel(Boolean(eq.rental_snorkel));
    setHoodSize(eq.hood_size || 'None');

    // Ballast
    const rawLead = initialData.estimated_lead_kg ?? eq.estimated_lead_kg ?? eq.lead_kg;
    if (rawLead !== undefined && rawLead !== null) {
      setLeadKg(rawLead.toString());
      setLeadLbs((Math.round(parseFloat(rawLead) * 2.20462 * 10) / 10).toString());
    }

    // Biometrics
    if (eq.height_cm) {
      setHeightCm(eq.height_cm.toString());
      const totalInches = Math.round(parseFloat(eq.height_cm) / 2.54);
      setHeightFeet(Math.floor(totalInches / 12).toString());
      setHeightInches((totalInches % 12).toString());
    }
    if (eq.weight_kg) {
      setWeightKg(eq.weight_kg.toString());
      setWeightLbs((Math.round(parseFloat(eq.weight_kg) * 2.20462 * 10) / 10).toString());
    }
    if (eq.shoe_size_eu) {
      setShoeSizeEu(eq.shoe_size_eu.toString());
      const usMen = Math.round((parseFloat(eq.shoe_size_eu) - 33.5) * 2) / 2;
      setShoeSizeUs(usMen.toString());
    }

    // Thermal & BCD
    setWetsuitGender(eq.wetsuit_gender || 'MEN');
    setWetsuitSize(eq.wetsuit_size || 'None');
    setWetsuitThickness(eq.wetsuit_thickness || '5mm');
    setBcdGender(eq.bcd_gender || eq.wetsuit_gender || 'MEN');
    setBcdSize(eq.bcd_size || 'None');
    setGlovesSize(eq.gloves_size || 'None');
    setRentalSocks(Boolean(eq.rental_socks));

    // Footwear & Fins
    setFinType(eq.fin_type || 'OPEN_HEEL');
    setRentalFins(eq.rental_fins !== undefined ? Boolean(eq.rental_fins) : true);
    setRentalBoots(eq.rental_boots !== undefined ? Boolean(eq.rental_boots) : true);

    // Specialty
    setRentalScooter(Boolean(eq.rental_scooter || eq.has_scooter));
    setRentalTorch(Boolean(eq.rental_torch || eq.has_torch));

    // Safety gear
    setHasOwnComputer(Boolean(eq.has_own_dive_computer));
    setHasOwnSmb(Boolean(eq.has_own_smb));

    // Emergency & Insurance
    setEmergencyContactName(eq.emergency_contact_name || initialData.emergency_contact_name || '');
    setEmergencyContactPhone(
      eq.emergency_contact_phone || initialData.emergency_contact_phone || ''
    );
    setInsuranceProvider(eq.insurance_provider || initialData.insurance_provider || '');
    setInsurancePolicyNumber(
      eq.insurance_policy_number || initialData.insurance_policy_number || ''
    );
    setInsuranceExpiryDate(eq.insurance_expiry_date || initialData.insurance_expiry_date || '');
  }, [initialData]);

  // Unit conversion helpers
  const handleUnitSystemChange = newSystem => {
    setUnitSystem(newSystem);
    if (newSystem === 'IMPERIAL') {
      if (weightKg && !weightLbs) {
        setWeightLbs((Math.round(parseFloat(weightKg) * 2.20462 * 10) / 10).toString());
      }
      if (leadKg && !leadLbs) {
        setLeadLbs((Math.round(parseFloat(leadKg) * 2.20462 * 10) / 10).toString());
      }
    } else {
      if (weightLbs && !weightKg) {
        setWeightKg((Math.round((parseFloat(weightLbs) / 2.20462) * 10) / 10).toString());
      }
      if (leadLbs && !leadKg) {
        setLeadKg((Math.round((parseFloat(leadLbs) / 2.20462) * 2) / 2).toString());
      }
    }
  };

  const handleWeightChange = val => {
    if (unitSystem === 'METRIC') {
      setWeightKg(val);
      if (val && !isNaN(val)) {
        setWeightLbs((Math.round(parseFloat(val) * 2.20462 * 10) / 10).toString());
      } else {
        setWeightLbs('');
      }
    } else {
      setWeightLbs(val);
      if (val && !isNaN(val)) {
        setWeightKg((Math.round((parseFloat(val) / 2.20462) * 10) / 10).toString());
      } else {
        setWeightKg('');
      }
    }
  };

  const handleLeadChange = val => {
    if (unitSystem === 'METRIC') {
      setLeadKg(val);
      if (val && !isNaN(val)) {
        setLeadLbs((Math.round(parseFloat(val) * 2.20462 * 2) / 2).toString());
      } else {
        setLeadLbs('');
      }
    } else {
      setLeadLbs(val);
      if (val && !isNaN(val)) {
        setLeadKg((Math.round((parseFloat(val) / 2.20462) * 2) / 2).toString());
      } else {
        setLeadKg('');
      }
    }
  };

  // Buoyancy Physics Calculation
  const calculatedLead = useMemo(() => {
    let effectiveWeightKg = 75;
    if (unitSystem === 'METRIC' && weightKg) {
      effectiveWeightKg = parseFloat(weightKg) || 75;
    } else if (unitSystem === 'IMPERIAL' && weightLbs) {
      effectiveWeightKg = (parseFloat(weightLbs) || 165) / 2.20462;
    }

    const suitFactor = SUIT_FACTORS[wetsuitThickness] || SUIT_FACTORS['5mm'];
    const suitLead = effectiveWeightKg * suitFactor.multiplier + suitFactor.offset;

    const waterType = WATER_TYPES[waterTypeIdx] || WATER_TYPES[6];
    const tankDef =
      TANK_SIZES.find(t => t.id === selectedTankId) || TANK_SIZES.find(t => t.id === '12');

    let tankAdjustment = 0;
    if (tankDef) {
      const isDoubles = tankDef.isDoubles || false;
      const bProps = {
        liters: isDoubles ? tankDef.size / 2 : tankDef.size,
        weight: isDoubles ? tankDef.emptyWeight / 2 : tankDef.emptyWeight,
        material: tankDef.material,
        waterDensity: waterType.density,
        isDoubles,
        includeValve: true,
        o2: 21,
        he: 0,
        bar: 200,
        checkPressure: 50,
      };
      const bRes = calculateTankBuoyancy(bProps);
      tankAdjustment = bRes.buoyancyEmpty;
    }

    const waterAdjustment = effectiveWeightKg * (waterType.density - 1.025);
    const totalLead = Math.max(0, suitLead + tankAdjustment + waterAdjustment);
    const roundedKg = Math.round(totalLead * 2) / 2; // 0.5 kg steps
    const roundedLbs = Math.round(roundedKg * 2.20462 * 2) / 2; // 0.5 lb steps

    return {
      kg: roundedKg,
      lbs: roundedLbs,
      waterLabel: waterType.label,
    };
  }, [weightKg, weightLbs, unitSystem, wetsuitThickness, selectedTankId, waterTypeIdx]);

  const handleApplyCalculatedLead = () => {
    setLeadKg(calculatedLead.kg.toString());
    setLeadLbs(calculatedLead.lbs.toString());
    toast.success(
      `Applied recommended ballast: ${unitSystem === 'METRIC' ? `${calculatedLead.kg} kg` : `${calculatedLead.lbs} lbs`}`
    );
  };

  const handleSubmit = e => {
    e.preventDefault();

    // Canonical metric values
    const finalLeadKg = parseFloat(leadKg) || 0;
    const finalWeightKg = parseFloat(weightKg) || null;
    const finalHeightCm = parseFloat(heightCm) || null;
    const finalShoeEu = parseFloat(shoeSizeEu) || null;

    const payload = {
      selected_tank_id: selectedTankId,
      selected_gas_mix_id: selectedGasMixId,
      equipment_sizing: {
        height_cm: finalHeightCm,
        weight_kg: finalWeightKg,
        shoe_size_eu: finalShoeEu,
        regulator_fitting: regulatorFitting,
        rental_regulator: rentalRegulator,
        stage_tank: stageTank === 'None' ? null : stageTank,
        rental_mask: rentalMask,
        rental_snorkel: rentalSnorkel,
        hood_size: hoodSize === 'None' ? null : hoodSize,
        weight_system: weightSystem,
        estimated_lead_kg: finalLeadKg,
        lead_kg: finalLeadKg,
        wetsuit_gender: wetsuitGender,
        wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
        wetsuit_thickness: wetsuitThickness,
        bcd_gender: bcdGender,
        bcd_size: bcdSize === 'None' ? null : bcdSize,
        gloves_size: glovesSize === 'None' ? null : glovesSize,
        rental_socks: rentalSocks,
        fin_type: finType,
        rental_fins: rentalFins,
        rental_boots: rentalBoots,
        rental_scooter: rentalScooter,
        rental_torch: rentalTorch,
        has_own_dive_computer: hasOwnComputer,
        has_own_smb: hasOwnSmb,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactPhone.trim() || undefined,
        insurance_provider: insuranceProvider.trim() || undefined,
        insurance_policy_number: insurancePolicyNumber.trim() || undefined,
        insurance_expiry_date: insuranceExpiryDate.trim() || undefined,
      },
    };

    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4 text-xs'>
      {/* Unit Switcher & Header Bar */}
      <div className='flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700'>
        <div className='flex items-center gap-2'>
          <Scale className='text-blue-600 h-4 w-4' />
          <span className='font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]'>
            Configuration Units
          </span>
        </div>
        <div className='flex items-center bg-white dark:bg-gray-700 rounded-lg p-0.5 border border-gray-200 dark:border-gray-600'>
          <button
            type='button'
            onClick={() => handleUnitSystemChange('METRIC')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              unitSystem === 'METRIC'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            Metric (kg, cm)
          </button>
          <button
            type='button'
            onClick={() => handleUnitSystemChange('IMPERIAL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              unitSystem === 'IMPERIAL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            Imperial (lbs, ft)
          </button>
        </div>
      </div>

      {/* 1. Head & Face (Mask, Snorkel, Hood) */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
          <Compass className='text-cyan-600 h-4 w-4' />
          <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
            Head & Face: Mask, Snorkel & Thermal Hood
          </h4>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Thermal Hood (Opt)
            </label>
            <select
              value={hoodSize}
              onChange={e => setHoodSize(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='None'>None (No Hood / Own Hood)</option>
              <option value='S'>Size S (Small)</option>
              <option value='M'>Size M (Medium)</option>
              <option value='L'>Size L (Large)</option>
              <option value='XL'>Size XL (Extra Large)</option>
            </select>
          </div>

          <div className='flex items-center gap-4 sm:col-span-2 pt-2 sm:pt-5'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalMask}
                onChange={e => setRentalMask(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Renting Dive Mask (Must)</span>
            </label>

            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalSnorkel}
                onChange={e => setRentalSnorkel(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Renting Snorkel (Opt)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Breathing, Regulators & Stage Cylinders */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
          <Gauge className='text-blue-600 h-4 w-4' />
          <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
            Cylinders, Gas & Life-Support Regulators
          </h4>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Primary Cylinder *
            </label>
            <select
              value={selectedTankId}
              onChange={e => setSelectedTankId(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='12'>12L Steel (Standard Single)</option>
              <option value='15'>15L Steel (High Capacity)</option>
              <option value='al80'>AL80 (11.1L Aluminum)</option>
              <option value='10'>10L Steel (Compact Single)</option>
              <option value='24'>2x12L Steel (Twinset)</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Breathing Gas Mix *
            </label>
            <select
              value={selectedGasMixId}
              onChange={e => setSelectedGasMixId(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='air'>Air (21% O2)</option>
              <option value='ean32'>EAN32 (Enriched Air Nitrox)</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Regulator Fitting *
            </label>
            <select
              value={regulatorFitting}
              onChange={e => setRegulatorFitting(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='DIN'>DIN (G 5/8" Threaded - 232/300 bar)</option>
              <option value='YOKE'>Yoke (INT / A-clamp - 232 bar)</option>
            </select>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Decompression / Stage Cylinder (Opt)
            </label>
            <select
              value={stageTank}
              onChange={e => setStageTank(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='None'>None (Standard Dive)</option>
              <option value='7L Stage (EAN50)'>7L Stage (EAN50)</option>
              <option value='AL80 Stage (EAN50)'>AL80 (11.1L) Stage (EAN50)</option>
              <option value='7L Stage (100% O2)'>7L Stage (100% O2 Deco)</option>
              <option value='AL80 Stage (Air)'>AL80 Stage (Air / Bottom Gas)</option>
            </select>
          </div>

          <div className='flex items-center pt-4'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalRegulator}
                onChange={e => setRentalRegulator(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Renting Center Regulator Setup (Must)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Ballast, Lead & Physics Calculator */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700'>
          <div className='flex items-center gap-2'>
            <Anchor className='text-indigo-600 h-4 w-4' />
            <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
              Ballast Weight & Weight System
            </h4>
          </div>
          {showBallastCalculator && (
            <button
              type='button'
              onClick={() => setShowEstimator(!showEstimator)}
              className='text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-1'
            >
              <Calculator size={13} />
              {showEstimator ? 'Hide Calculator' : 'Physics Ballast Calculator'}
            </button>
          )}
        </div>

        {/* Physics Calculator Box */}
        {showEstimator && (
          <div className='p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2.5'>
            <div className='flex items-center justify-between'>
              <span className='font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-[11px]'>
                <Sparkles size={13} className='text-indigo-600' />
                Divemap Buoyancy & Salinity Estimator
              </span>
              <button
                type='button'
                onClick={handleApplyCalculatedLead}
                className='px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-sm'
              >
                <Check size={11} />
                Apply (
                {unitSystem === 'METRIC' ? `${calculatedLead.kg} kg` : `${calculatedLead.lbs} lbs`})
              </button>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]'>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-0.5'>
                  Water Body / Salinity
                </label>
                <select
                  value={waterTypeIdx}
                  onChange={e => setWaterTypeIdx(parseInt(e.target.value, 10))}
                  className='w-full px-2 py-1 border rounded-lg text-xs bg-white dark:bg-gray-750'
                >
                  {WATER_TYPES.map((wt, idx) => (
                    <option key={wt.id} value={idx}>
                      {wt.label} ({wt.density} kg/L)
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex items-end'>
                <p className='text-gray-500 dark:text-gray-400 text-[10px] leading-relaxed'>
                  Estimates displacement for {wetsuitThickness} suit, {selectedTankId}L cylinder at
                  50 bar reserve, and selected water salinity.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Lead Ballast ({unitSystem === 'METRIC' ? 'kg' : 'lbs'}) *
            </label>
            <input
              type='number'
              step='0.5'
              value={unitSystem === 'METRIC' ? leadKg : leadLbs}
              onChange={e => handleLeadChange(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-bold'
              placeholder='e.g. 4.5'
            />
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Weight System *
            </label>
            <select
              value={weightSystem}
              onChange={e => setWeightSystem(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='INTEGRATED'>Integrated BCD Pockets</option>
              <option value='BELT'>Weight Belt (Nylon Webbing)</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Body Weight ({unitSystem === 'METRIC' ? 'kg' : 'lbs'})
            </label>
            <input
              type='number'
              step='1'
              value={unitSystem === 'METRIC' ? weightKg : weightLbs}
              onChange={e => handleWeightChange(e.target.value)}
              className='w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono'
              placeholder={unitSystem === 'METRIC' ? 'e.g. 78' : 'e.g. 172'}
            />
          </div>
        </div>
      </div>

      {/* 4. Thermal Suit, BCD, Gloves & Socks */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
          <LifeBuoy className='text-emerald-600 h-4 w-4' />
          <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
            Thermal Exposure, BCD & Gloves
          </h4>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Wetsuit Cut *
            </label>
            <select
              value={wetsuitGender}
              onChange={e => setWetsuitGender(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='MEN'>Men's / Unisex</option>
              <option value='WOMEN'>Women's</option>
              <option value='OTHER'>Other / Custom</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Wetsuit Size *
            </label>
            <select
              value={wetsuitSize}
              onChange={e => setWetsuitSize(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750'
            >
              <option value='None'>None (Own Suit)</option>
              <option value='XS'>XS</option>
              <option value='S'>S</option>
              <option value='M'>M</option>
              <option value='L'>L</option>
              <option value='XL'>XL</option>
              <option value='XXL'>XXL</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Suit Thickness
            </label>
            <select
              value={wetsuitThickness}
              onChange={e => setWetsuitThickness(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750'
            >
              <option value='3mm-shorty'>3mm Shorty</option>
              <option value='3mm'>3mm Full</option>
              <option value='5mm'>5mm Full</option>
              <option value='7mm'>7mm Semi-Dry</option>
              <option value='drysuit'>Drysuit</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              BCD Cut *
            </label>
            <select
              value={bcdGender}
              onChange={e => setBcdGender(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='MEN'>Men's / Unisex</option>
              <option value='WOMEN'>Women's Cut</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              BCD Size *
            </label>
            <select
              value={bcdSize}
              onChange={e => setBcdSize(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750'
            >
              <option value='None'>None (Own BCD)</option>
              <option value='XXS'>XXS</option>
              <option value='XS'>XS</option>
              <option value='S'>S</option>
              <option value='M'>M</option>
              <option value='L'>L</option>
              <option value='XL'>XL</option>
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Gloves (Opt)
            </label>
            <select
              value={glovesSize}
              onChange={e => setGlovesSize(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='None'>None / Own</option>
              <option value='S'>Size S</option>
              <option value='M'>Size M</option>
              <option value='L'>Size L</option>
              <option value='XL'>Size XL</option>
            </select>
          </div>

          <div className='flex items-center pt-4'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalSocks}
                onChange={e => setRentalSocks(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Neoprene Socks / Fin Liners (Opt)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 5. Footwear & Fins */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
          <Compass className='text-blue-600 h-4 w-4' />
          <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
            Fins & Neoprene Boots
          </h4>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Fin Style *
            </label>
            <select
              value={finType}
              onChange={e => setFinType(e.target.value)}
              className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750 font-medium'
            >
              <option value='OPEN_HEEL'>Open-Heel (Requires Booties)</option>
              <option value='FULL_FOOT'>Full-Foot (Barefoot)</option>
            </select>
          </div>

          <div>
            <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
              Shoe / Boot Size (EU)
            </label>
            <input
              type='number'
              step='0.5'
              value={shoeSizeEu}
              onChange={e => {
                setShoeSizeEu(e.target.value);
                if (e.target.value) {
                  const usMen = Math.round((parseFloat(e.target.value) - 33.5) * 2) / 2;
                  setShoeSizeUs(usMen.toString());
                }
              }}
              className='w-full px-2 py-1.5 border rounded-lg text-xs'
              placeholder='e.g. 43'
            />
          </div>

          <div className='flex items-center pt-4'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalBoots}
                onChange={e => setRentalBoots(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Renting Neoprene Booties ({finType === 'OPEN_HEEL' ? 'Must' : 'Opt'})</span>
            </label>
          </div>

          <div className='flex items-center pt-4'>
            <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
              <input
                type='checkbox'
                checked={rentalFins}
                onChange={e => setRentalFins(e.target.checked)}
                className='rounded text-blue-600'
              />
              <span>Renting Fins (Must)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 6. Specialty, Propulsion & Personal Safety Gear */}
      <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
        <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
          <Sparkles className='text-amber-500 h-4 w-4' />
          <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
            Specialty Propulsion & Personal Safety Gear
          </h4>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1'>
          <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
            <input
              type='checkbox'
              checked={rentalTorch}
              onChange={e => setRentalTorch(e.target.checked)}
              className='rounded text-blue-600'
            />
            <span className='font-bold text-amber-700 dark:text-amber-300'>
              Rent Dive Torch (Opt)
            </span>
          </label>

          <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
            <input
              type='checkbox'
              checked={rentalScooter}
              onChange={e => setRentalScooter(e.target.checked)}
              className='rounded text-blue-600'
            />
            <span className='font-bold text-blue-900 dark:text-blue-300'>
              Reserve DPV Scooter (Opt)
            </span>
          </label>

          <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
            <input
              type='checkbox'
              checked={hasOwnComputer}
              onChange={e => setHasOwnComputer(e.target.checked)}
              className='rounded text-blue-600'
            />
            <span>Has own Dive Computer</span>
          </label>

          <label className='flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer'>
            <input
              type='checkbox'
              checked={hasOwnSmb}
              onChange={e => setHasOwnSmb(e.target.checked)}
              className='rounded text-blue-600'
            />
            <span>Has own SMB & Spool</span>
          </label>
        </div>
      </div>

      {/* 7. Optional Emergency Contact & Insurance */}
      {showEmergencyAndInsurance && (
        <div className='p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
          <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
            <HeartPulse className='text-red-500 h-4 w-4' />
            <h4 className='font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider'>
              Emergency Contact & Dive Insurance
            </h4>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
                Emergency Contact Name
              </label>
              <input
                type='text'
                value={emergencyContactName}
                onChange={e => setEmergencyContactName(e.target.value)}
                className='w-full px-2.5 py-1.5 border rounded-lg text-xs'
                placeholder='Full Name (Next of Kin)'
              />
            </div>

            <div>
              <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
                Emergency Phone / WhatsApp
              </label>
              <input
                type='tel'
                value={emergencyContactPhone}
                onChange={e => setEmergencyContactPhone(e.target.value)}
                className='w-full px-2.5 py-1.5 border rounded-lg text-xs'
                placeholder='+30 690 000 0000'
              />
            </div>

            <div>
              <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
                Dive Insurance Provider
              </label>
              <input
                type='text'
                value={insuranceProvider}
                onChange={e => setInsuranceProvider(e.target.value)}
                className='w-full px-2.5 py-1.5 border rounded-lg text-xs'
                placeholder='e.g. DAN Europe / DiveAssure'
              />
            </div>

            <div>
              <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
                Policy Number & Expiration
              </label>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  type='text'
                  value={insurancePolicyNumber}
                  onChange={e => setInsurancePolicyNumber(e.target.value)}
                  className='w-full px-2.5 py-1.5 border rounded-lg text-xs'
                  placeholder='Policy #'
                />
                <input
                  type='date'
                  value={insuranceExpiryDate}
                  onChange={e => setInsuranceExpiryDate(e.target.value)}
                  className='w-full px-2.5 py-1.5 border rounded-lg text-xs'
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className='flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700'>
        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            className='px-3.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-semibold'
          >
            Cancel
          </button>
        )}
        <button
          type='submit'
          disabled={loading}
          className='px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
        >
          {loading ? <Loader2 size={13} className='animate-spin' /> : <Check size={13} />}
          <span>Save Equipment & Sizing</span>
        </button>
      </div>
    </form>
  );
};

export default DiverGearConfigForm;
