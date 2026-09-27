import { Modal } from 'antd';
import { Loader2, Save, X, Calculator, Sparkles, ExternalLink } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../api';
import { TANK_SIZES } from '../utils/diveConstants';
import { calculateTankBuoyancy, WATER_TYPES } from '../utils/TankBuoyancy';

const SUIT_FACTORS = {
  '3mm-shorty': { multiplier: 0.03, offset: 0, label: '3mm Shorty' },
  '3mm': { multiplier: 0.05, offset: 0, label: '3mm Full' },
  '5mm': { multiplier: 0.08, offset: 0, label: '5mm Full' },
  '7mm': { multiplier: 0.1, offset: 2, label: '7mm Semi-Dry' },
  drysuit: { multiplier: 0.1, offset: 4, label: 'Drysuit' },
};

const PRESETS = [
  {
    name: 'Tropical Travel (3mm)',
    wetsuit_thickness: '3mm',
    wetsuit_size: 'L',
    fin_type: 'FULL_FOOT',
    regulator_fitting: 'YOKE',
    preferred_tank_id: 'al80',
    preferred_gas_mix_id: 'air',
    estimated_lead_kg: 2.0,
  },
  {
    name: 'Cold Water / Semi-Dry (7mm)',
    wetsuit_thickness: '7mm',
    wetsuit_size: 'L',
    fin_type: 'OPEN_HEEL',
    regulator_fitting: 'DIN',
    preferred_tank_id: '15',
    preferred_gas_mix_id: 'air',
    estimated_lead_kg: 8.0,
  },
  {
    name: 'Technical Diving (Twins)',
    wetsuit_thickness: 'drysuit',
    wetsuit_size: 'L',
    fin_type: 'OPEN_HEEL',
    regulator_fitting: 'DIN',
    preferred_tank_id: '24', // Double 12s
    preferred_gas_mix_id: 'tx2135',
    estimated_lead_kg: 6.0,
    has_own_dive_computer: true,
    has_own_smb: true,
  },
];

const UserGearProfileModal = ({
  isOpen,
  onClose,
  profile,
  onSaved,
  cylinders,
  gasMixes,
  initialUnitSystem = 'METRIC',
}) => {
  const isEditing = Boolean(profile?.id);
  const [saving, setSaving] = useState(false);
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem);

  // Form State
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Metric canonical
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [shoeSizeEu, setShoeSizeEu] = useState('');
  const [leadKg, setLeadKg] = useState('');

  // Imperial display
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [leadLbs, setLeadLbs] = useState('');
  const [shoeSizeUs, setShoeSizeUs] = useState('');

  // Gear Specifications
  const [wetsuitGender, setWetsuitGender] = useState('MEN');
  const [wetsuitSize, setWetsuitSize] = useState('L');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdSize, setBcdSize] = useState('M');
  const [finType, setFinType] = useState('OPEN_HEEL');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [preferredTankId, setPreferredTankId] = useState('12');
  const [preferredGasMixId, setPreferredGasMixId] = useState('air');
  const [hasOwnComputer, setHasOwnComputer] = useState(false);
  const [hasOwnSmb, setHasOwnSmb] = useState(false);

  // Insurance & Emergency
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Integrated Weight Calculator State
  const [showEstimator, setShowEstimator] = useState(false);
  const [waterTypeIdx, setWaterTypeIdx] = useState(6); // Default: Aegean / Eastern Med (1.029)

  // Dynamically compute recommended lead ballast using Divemap's buoyancy physics
  const calculatedLead = useMemo(() => {
    let effectiveWeightKg = 75; // Default if not filled
    if (unitSystem === 'METRIC' && weightKg) {
      effectiveWeightKg = parseFloat(weightKg) || 75;
    } else if (unitSystem === 'IMPERIAL' && weightLbs) {
      effectiveWeightKg = (parseFloat(weightLbs) || 165) / 2.20462;
    }

    const suitFactor = SUIT_FACTORS[wetsuitThickness] || SUIT_FACTORS['5mm'];
    const suitLead = effectiveWeightKg * suitFactor.multiplier + suitFactor.offset;

    // Tank Buoyancy
    const waterType = WATER_TYPES[waterTypeIdx] || WATER_TYPES[6];
    const tankDef =
      TANK_SIZES.find(t => t.id === preferredTankId) || TANK_SIZES.find(t => t.id === '12');

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

    // Water type adjustment (relative to 1.025 ocean base)
    const waterAdjustment = effectiveWeightKg * (waterType.density - 1.025);

    const totalLead = Math.max(0, suitLead + tankAdjustment + waterAdjustment);
    const roundedKg = Math.round(totalLead * 2) / 2; // 0.5 kg steps
    const roundedLbs = Math.round(roundedKg * 2.20462 * 2) / 2; // 0.5 lb steps

    return {
      kg: roundedKg,
      lbs: roundedLbs,
      suitLead: Math.round(suitLead * 10) / 10,
      tankAdjustment: Math.round(tankAdjustment * 10) / 10,
      waterAdjustment: Math.round(waterAdjustment * 10) / 10,
      waterLabel: waterType.label,
    };
  }, [weightKg, weightLbs, unitSystem, wetsuitThickness, preferredTankId, waterTypeIdx]);

  const handleApplyCalculatedLead = () => {
    setLeadKg(calculatedLead.kg.toString());
    setLeadLbs(calculatedLead.lbs.toString());
    toast.success(
      `Applied recommended ballast: ${unitSystem === 'METRIC' ? `${calculatedLead.kg} kg` : `${calculatedLead.lbs} lbs`}`
    );
  };

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (profile) {
        setName(profile.name || 'Default');
        setIsDefault(Boolean(profile.is_default));
        const sys = profile.preferred_unit_system || initialUnitSystem;
        setUnitSystem(sys);

        // Biometrics
        if (profile.height_cm) {
          setHeightCm(profile.height_cm.toString());
          const totalInches = Math.round(profile.height_cm / 2.54);
          setHeightFeet(Math.floor(totalInches / 12).toString());
          setHeightInches((totalInches % 12).toString());
        } else {
          setHeightCm('');
          setHeightFeet('');
          setHeightInches('');
        }

        if (profile.weight_kg) {
          setWeightKg(profile.weight_kg.toString());
          setWeightLbs((Math.round(profile.weight_kg * 2.20462 * 10) / 10).toString());
        } else {
          setWeightKg('');
          setWeightLbs('');
        }

        if (profile.shoe_size_eu) {
          setShoeSizeEu(profile.shoe_size_eu.toString());
          const usMen = Math.round((profile.shoe_size_eu - 33.5) * 2) / 2;
          setShoeSizeUs(usMen.toString());
        } else {
          setShoeSizeEu('');
          setShoeSizeUs('');
        }

        if (profile.estimated_lead_kg) {
          setLeadKg(profile.estimated_lead_kg.toString());
          setLeadLbs((Math.round(profile.estimated_lead_kg * 2.20462 * 10) / 10).toString());
        } else {
          setLeadKg('');
          setLeadLbs('');
        }

        // Equipment
        setWetsuitGender(profile.wetsuit_gender || 'MEN');
        setWetsuitSize(profile.wetsuit_size || 'L');
        setWetsuitThickness(profile.wetsuit_thickness || '5mm');
        setBcdSize(profile.bcd_size || 'M');
        setFinType(profile.fin_type || 'OPEN_HEEL');
        setRegulatorFitting(profile.regulator_fitting || 'DIN');
        setPreferredTankId(profile.preferred_tank_id || '12');
        setPreferredGasMixId(profile.preferred_gas_mix_id || 'air');
        setHasOwnComputer(Boolean(profile.has_own_dive_computer));
        setHasOwnSmb(Boolean(profile.has_own_smb));

        // Insurance
        setInsuranceProvider(profile.insurance_provider || '');
        setInsurancePolicyNumber(profile.insurance_policy_number || '');
        setInsuranceExpiryDate(profile.insurance_expiry_date || '');
        setEmergencyContactName(profile.emergency_contact_name || '');
        setEmergencyContactPhone(profile.emergency_contact_phone || '');
        setEmergencyContactRelation(profile.emergency_contact_relation || '');
      } else {
        // Defaults for new profile
        setName('');
        setIsDefault(false);
        setUnitSystem(initialUnitSystem);
        setHeightCm('');
        setHeightFeet('');
        setHeightInches('');
        setWeightKg('');
        setWeightLbs('');
        setShoeSizeEu('');
        setShoeSizeUs('');
        setLeadKg('4.0');
        setLeadLbs('9.0');
        setWetsuitGender('MEN');
        setWetsuitSize('L');
        setWetsuitThickness('5mm');
        setBcdSize('M');
        setFinType('OPEN_HEEL');
        setRegulatorFitting('DIN');
        setPreferredTankId('12');
        setPreferredGasMixId('air');
        setHasOwnComputer(false);
        setHasOwnSmb(false);
      }
    }
  }, [isOpen, profile, initialUnitSystem]);

  const applyPreset = preset => {
    if (!name) setName(preset.name);
    if (preset.wetsuit_thickness) setWetsuitThickness(preset.wetsuit_thickness);
    if (preset.wetsuit_size) setWetsuitSize(preset.wetsuit_size);
    if (preset.fin_type) setFinType(preset.fin_type);
    if (preset.regulator_fitting) setRegulatorFitting(preset.regulator_fitting);
    if (preset.preferred_tank_id) setPreferredTankId(preset.preferred_tank_id);
    if (preset.preferred_gas_mix_id) setPreferredGasMixId(preset.preferred_gas_mix_id);
    if (preset.estimated_lead_kg) {
      setLeadKg(preset.estimated_lead_kg.toString());
      setLeadLbs((Math.round(preset.estimated_lead_kg * 2.20462 * 10) / 10).toString());
    }
    if (preset.has_own_dive_computer !== undefined) setHasOwnComputer(preset.has_own_dive_computer);
    if (preset.has_own_smb !== undefined) setHasOwnSmb(preset.has_own_smb);
  };

  const handleUnitToggle = newSys => {
    if (newSys === unitSystem) return;
    setUnitSystem(newSys);

    if (newSys === 'IMPERIAL') {
      if (heightCm) {
        const totalInches = Math.round(parseFloat(heightCm) / 2.54);
        setHeightFeet(Math.floor(totalInches / 12).toString());
        setHeightInches((totalInches % 12).toString());
      }
      if (weightKg) {
        setWeightLbs((Math.round(parseFloat(weightKg) * 2.20462 * 10) / 10).toString());
      }
      if (shoeSizeEu) {
        const usMen = Math.round((parseFloat(shoeSizeEu) - 33.5) * 2) / 2;
        setShoeSizeUs(usMen.toString());
      }
      if (leadKg) {
        setLeadLbs((Math.round(parseFloat(leadKg) * 2.20462 * 10) / 10).toString());
      }
    } else {
      if (heightFeet || heightInches) {
        const ft = parseInt(heightFeet || '0', 10);
        const inch = parseInt(heightInches || '0', 10);
        setHeightCm(Math.round((ft * 12 + inch) * 2.54).toString());
      }
      if (weightLbs) {
        setWeightKg((Math.round((parseFloat(weightLbs) / 2.20462) * 10) / 10).toString());
      }
      if (shoeSizeUs) {
        const eu = Math.round((parseFloat(shoeSizeUs) + 33.5) * 2) / 2;
        setShoeSizeEu(eu.toString());
      }
      if (leadLbs) {
        setLeadKg((Math.round((parseFloat(leadLbs) / 2.20462) * 10) / 10).toString());
      }
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please provide a profile name (e.g. Tropical Travel, Mediterranean 5mm).');
      return;
    }

    try {
      setSaving(true);
      let finalHeightCm = null;
      let finalWeightKg = null;
      let finalShoeEu = null;
      let finalLeadKg = null;

      if (unitSystem === 'METRIC') {
        finalHeightCm = heightCm ? parseInt(heightCm, 10) : null;
        finalWeightKg = weightKg ? parseFloat(weightKg) : null;
        finalShoeEu = shoeSizeEu ? parseFloat(shoeSizeEu) : null;
        finalLeadKg = leadKg ? parseFloat(leadKg) : null;
      } else {
        if (heightFeet || heightInches) {
          const ft = parseInt(heightFeet || '0', 10);
          const inch = parseInt(heightInches || '0', 10);
          finalHeightCm = Math.round((ft * 12 + inch) * 2.54);
        }
        if (weightLbs) finalWeightKg = Math.round((parseFloat(weightLbs) / 2.20462) * 10) / 10;
        if (shoeSizeUs) finalShoeEu = Math.round((parseFloat(shoeSizeUs) + 33.5) * 2) / 2;
        if (leadLbs) finalLeadKg = Math.round((parseFloat(leadLbs) / 2.20462) * 10) / 10;
      }

      const payload = {
        name: name.trim(),
        is_default: isDefault,
        preferred_unit_system: unitSystem,
        preferred_shoe_system: unitSystem === 'METRIC' ? 'EU' : 'US_MEN',
        height_cm: finalHeightCm,
        weight_kg: finalWeightKg,
        shoe_size_eu: finalShoeEu,
        wetsuit_gender: wetsuitGender,
        wetsuit_size: wetsuitSize,
        wetsuit_thickness: wetsuitThickness,
        bcd_size: bcdSize,
        fin_type: finType,
        regulator_fitting: regulatorFitting,
        preferred_tank_id: preferredTankId,
        preferred_gas_mix_id: preferredGasMixId,
        estimated_lead_kg: finalLeadKg,
        has_own_dive_computer: hasOwnComputer,
        has_own_smb: hasOwnSmb,
        insurance_provider: insuranceProvider.trim() || null,
        insurance_policy_number: insurancePolicyNumber.trim() || null,
        insurance_expiry_date: insuranceExpiryDate || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        emergency_contact_relation: emergencyContactRelation.trim() || null,
      };

      if (isEditing) {
        await api.put(`/api/v1/bookings/gear-profiles/${profile.id}`, payload);
        toast.success(`Gear profile '${name}' updated successfully!`);
      } else {
        await api.post('/api/v1/bookings/gear-profiles', payload);
        toast.success(`Gear profile '${name}' created successfully!`);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save profile:', err);
      const msg = err.response?.data?.detail || 'Failed to save gear profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={780}
      title={
        <div className='flex items-center justify-between pr-8 border-b pb-3'>
          <div>
            <h3 className='text-base font-bold text-gray-900'>
              {isEditing ? `Edit Configuration: ${profile?.name}` : 'New Gear Configuration'}
            </h3>
            <p className='text-xs text-gray-500 font-normal mt-0.5'>
              Customize your gear specs, cylinder choice, and lead weights for specific diving
              conditions.
            </p>
          </div>
          {/* Unit Switcher */}
          <div className='flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200'>
            <button
              type='button'
              onClick={() => handleUnitToggle('METRIC')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                unitSystem === 'METRIC'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Metric
            </button>
            <button
              type='button'
              onClick={() => handleUnitToggle('IMPERIAL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                unitSystem === 'IMPERIAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Imperial
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className='space-y-5 pt-3 max-h-[75vh] overflow-y-auto px-1'>
        {/* Preset Chips (Only when creating new profile) */}
        {!isEditing && (
          <div>
            <span className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
              Quick Start from Preset
            </span>
            <div className='flex flex-wrap gap-2'>
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type='button'
                  onClick={() => applyPreset(preset)}
                  className='text-xs font-medium px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile Name & Default checkbox */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200'>
          <div className='sm:col-span-2'>
            <label className='block text-xs font-semibold text-gray-700 mb-1'>
              Configuration Name *
            </label>
            <input
              type='text'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g. Tropical Travel, Mediterranean 5mm, Drysuit'
              required
              className='w-full px-3 py-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm'
            />
          </div>
          <div className='pt-4 sm:pt-0'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
              />
              <span className='text-xs font-semibold text-gray-700'>Set as Primary Profile</span>
            </label>
          </div>
        </div>

        {/* Section 1: Biometrics */}
        <div>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
            1. Diver Biometrics & Ballast
          </h4>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            {unitSystem === 'METRIC' ? (
              <div>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Height (cm)</label>
                <input
                  type='number'
                  min='100'
                  max='250'
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder='180'
                  className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
                />
              </div>
            ) : (
              <div>
                <label className='block text-xs font-medium text-gray-700 mb-1'>
                  Height (Ft / In)
                </label>
                <div className='grid grid-cols-2 gap-1.5'>
                  <input
                    type='number'
                    min='3'
                    max='8'
                    value={heightFeet}
                    onChange={e => setHeightFeet(e.target.value)}
                    placeholder='Ft'
                    className='w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm'
                  />
                  <input
                    type='number'
                    min='0'
                    max='11'
                    value={heightInches}
                    onChange={e => setHeightInches(e.target.value)}
                    placeholder='In'
                    className='w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm'
                  />
                </div>
              </div>
            )}

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Weight ({unitSystem === 'METRIC' ? 'kg' : 'lbs'})
              </label>
              <input
                type='number'
                step='0.5'
                value={unitSystem === 'METRIC' ? weightKg : weightLbs}
                onChange={e =>
                  unitSystem === 'METRIC'
                    ? setWeightKg(e.target.value)
                    : setWeightLbs(e.target.value)
                }
                placeholder={unitSystem === 'METRIC' ? '75.0' : '165'}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Shoe Size ({unitSystem === 'METRIC' ? 'EU' : 'US Men'})
              </label>
              <input
                type='number'
                step='0.5'
                value={unitSystem === 'METRIC' ? shoeSizeEu : shoeSizeUs}
                onChange={e =>
                  unitSystem === 'METRIC'
                    ? setShoeSizeEu(e.target.value)
                    : setShoeSizeUs(e.target.value)
                }
                placeholder={unitSystem === 'METRIC' ? '43' : '9.5'}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1'>
                <label className='block text-xs font-medium text-gray-700'>
                  Lead Weight ({unitSystem === 'METRIC' ? 'kg' : 'lbs'})
                </label>
                <button
                  type='button'
                  onClick={() => setShowEstimator(!showEstimator)}
                  className='text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors'
                  title='Estimate lead ballast based on suit, body weight, and cylinder'
                >
                  <Calculator size={12} />
                  {showEstimator ? 'Hide' : 'Calculate'}
                </button>
              </div>
              <input
                type='number'
                step='0.5'
                value={unitSystem === 'METRIC' ? leadKg : leadLbs}
                onChange={e =>
                  unitSystem === 'METRIC' ? setLeadKg(e.target.value) : setLeadLbs(e.target.value)
                }
                placeholder={unitSystem === 'METRIC' ? '4.0' : '9.0'}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
          </div>

          {/* Integrated Weight Estimator Card */}
          {showEstimator && (
            <div className='mt-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl'>
              <div className='flex items-start justify-between gap-3 mb-2.5'>
                <div className='flex items-center gap-1.5 text-blue-900 font-bold text-xs'>
                  <Sparkles size={14} className='text-blue-600' />
                  <span>Divemap Buoyancy & Weight Estimator</span>
                </div>
                <Link
                  to='/resources/tools/weight'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1'
                >
                  Open Full Tool
                  <ExternalLink size={11} />
                </Link>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3'>
                <div>
                  <label className='block text-[11px] font-medium text-gray-600 mb-1'>
                    Water Body / Salinity
                  </label>
                  <select
                    value={waterTypeIdx}
                    onChange={e => setWaterTypeIdx(parseInt(e.target.value, 10))}
                    className='w-full px-2.5 py-1 text-xs border border-blue-200 rounded-md bg-white'
                  >
                    {WATER_TYPES.map((w, idx) => (
                      <option key={w.id} value={idx}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='bg-white p-2.5 rounded-lg border border-blue-100 flex flex-col justify-center'>
                  <span className='text-[11px] text-gray-500'>Physics Breakdown:</span>
                  <div className='text-xs text-gray-700 flex justify-between mt-0.5'>
                    <span>Suit: +{calculatedLead.suitLead}kg</span>
                    <span>
                      Tank: {calculatedLead.tankAdjustment >= 0 ? '+' : ''}
                      {calculatedLead.tankAdjustment}kg
                    </span>
                    <span>
                      Water: {calculatedLead.waterAdjustment >= 0 ? '+' : ''}
                      {calculatedLead.waterAdjustment}kg
                    </span>
                  </div>
                </div>
              </div>

              <div className='flex items-center justify-between pt-2 border-t border-blue-200/60'>
                <div>
                  <span className='text-xs text-gray-600'>Recommended Lead: </span>
                  <span className='text-sm font-bold text-blue-900'>
                    {unitSystem === 'METRIC'
                      ? `${calculatedLead.kg} kg`
                      : `${calculatedLead.lbs} lbs`}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={handleApplyCalculatedLead}
                  className='px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors'
                >
                  Apply{' '}
                  {unitSystem === 'METRIC'
                    ? `${calculatedLead.kg} kg`
                    : `${calculatedLead.lbs} lbs`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Equipment Sizing */}
        <div>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
            2. Wetsuit, BCD & Valve Configuration
          </h4>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>Wetsuit Cut</label>
              <select
                value={wetsuitGender}
                onChange={e => setWetsuitGender(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='MEN'>Men / Unisex</option>
                <option value='WOMEN'>Women</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>Wetsuit Size</label>
              <select
                value={wetsuitSize}
                onChange={e => setWetsuitSize(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='XS'>XS</option>
                <option value='S'>S</option>
                <option value='M'>M</option>
                <option value='ML'>ML</option>
                <option value='L'>L</option>
                <option value='XL'>XL</option>
                <option value='XXL'>XXL</option>
                <option value='3XL'>3XL</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Wetsuit Thickness
              </label>
              <select
                value={wetsuitThickness}
                onChange={e => setWetsuitThickness(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='3mm-shorty'>3mm Shorty</option>
                <option value='3mm'>3mm Full</option>
                <option value='5mm'>5mm Full</option>
                <option value='7mm'>7mm Semi-Dry</option>
                <option value='drysuit'>Drysuit</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>BCD Size</label>
              <select
                value={bcdSize}
                onChange={e => setBcdSize(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='XS'>XS</option>
                <option value='S'>S</option>
                <option value='M'>M</option>
                <option value='L'>L</option>
                <option value='XL'>XL</option>
                <option value='XXL'>XXL</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>Fin Type</label>
              <select
                value={finType}
                onChange={e => setFinType(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='OPEN_HEEL'>Open-Heel (With Booties)</option>
                <option value='FULL_FOOT'>Full-Foot (Barefoot)</option>
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Regulator Fitting
              </label>
              <select
                value={regulatorFitting}
                onChange={e => setRegulatorFitting(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                <option value='DIN'>DIN (232/300 bar)</option>
                <option value='YOKE'>Yoke / INT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Cylinder & Gas */}
        <div>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
            3. Cylinder & Gas Mix
          </h4>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Preferred Cylinder
              </label>
              <select
                value={preferredTankId}
                onChange={e => setPreferredTankId(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                {cylinders.map(cyl => (
                  <option key={cyl.id} value={cyl.id}>
                    {cyl.name} ({cyl.material.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Preferred Gas Mix
              </label>
              <select
                value={preferredGasMixId}
                onChange={e => setPreferredGasMixId(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white'
              >
                {gasMixes.map(gas => (
                  <option key={gas.id} value={gas.id}>
                    {gas.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className='mt-2.5 flex flex-col sm:flex-row gap-4'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={hasOwnComputer}
                onChange={e => setHasOwnComputer(e.target.checked)}
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
              />
              <span className='text-xs text-gray-700 font-medium'>Own personal dive computer</span>
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={hasOwnSmb}
                onChange={e => setHasOwnSmb(e.target.checked)}
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4'
              />
              <span className='text-xs text-gray-700 font-medium'>
                Own surface marker buoy (SMB)
              </span>
            </label>
          </div>
        </div>

        {/* Section 4: Insurance & Emergency */}
        <div>
          <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
            4. Insurance & Emergency Contact
          </h4>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Insurance Provider
              </label>
              <input
                type='text'
                value={insuranceProvider}
                onChange={e => setInsuranceProvider(e.target.value)}
                placeholder='e.g. DAN Europe'
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Policy / Membership #
              </label>
              <input
                type='text'
                value={insurancePolicyNumber}
                onChange={e => setInsurancePolicyNumber(e.target.value)}
                placeholder='12345678'
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Expiration Date
              </label>
              <input
                type='date'
                value={insuranceExpiryDate}
                onChange={e => setInsuranceExpiryDate(e.target.value)}
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3'>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Emergency Contact Name
              </label>
              <input
                type='text'
                value={emergencyContactName}
                onChange={e => setEmergencyContactName(e.target.value)}
                placeholder='Full Name'
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>
                Emergency Phone
              </label>
              <input
                type='tel'
                value={emergencyContactPhone}
                onChange={e => setEmergencyContactPhone(e.target.value)}
                placeholder='+30 ...'
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-700 mb-1'>Relationship</label>
              <input
                type='text'
                value={emergencyContactRelation}
                onChange={e => setEmergencyContactRelation(e.target.value)}
                placeholder='Partner, Parent, etc.'
                className='w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm'
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className='flex items-center justify-end gap-3 pt-3 border-t'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={saving}
            className='flex items-center justify-center px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold shadow-sm transition-all disabled:opacity-50'
          >
            {saving ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Saving...
              </>
            ) : (
              <>
                <Save className='w-4 h-4 mr-2' />
                {isEditing ? 'Save Changes' : 'Create Profile'}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserGearProfileModal;
