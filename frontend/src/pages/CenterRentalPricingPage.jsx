import {
  Coins,
  Check,
  Loader2,
  Sparkles,
  ChevronLeft,
  ShieldAlert,
  Wind,
  Layers,
  Box,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';

const DEFAULT_PACKAGE_ITEMS = ['regulator', 'bcd', 'wetsuit', 'fins_boots', 'mask_snorkel'];

const DEFAULT_TANK_SURCHARGES = {
  12: 0.0,
  15: 5.0,
  10: 0.0,
  al80: 0.0,
  twinset: 15.0,
};

const DEFAULT_GAS_SURCHARGES = {
  air: 0.0,
  ean32: 8.0,
  ean36: 8.0,
  custom: 15.0,
};

const GEAR_ITEMS = [
  {
    key: 'regulator',
    title: 'Regulator Set',
    subtitle: '1st & 2nd stage, octopus, SPG console',
  },
  {
    key: 'bcd',
    title: 'BCD / Buoyancy Wing',
    subtitle: 'Buoyancy control device with inflator',
  },
  {
    key: 'wetsuit',
    title: 'Wetsuit / Semi-Dry Suit',
    subtitle: 'Thermal exposure neoprene suit',
  },
  {
    key: 'fins_boots',
    title: 'Fins & Neoprene Booties',
    subtitle: 'Open-heel or full-foot propulsion',
  },
  {
    key: 'mask_snorkel',
    title: 'Mask & Snorkel',
    subtitle: 'Tempered glass diving mask & snorkel',
  },
  {
    key: 'dive_computer',
    title: 'Wrist Dive Computer',
    subtitle: 'Digital wrist unit for live depth & NDL',
  },
  {
    key: 'dive_torch',
    title: 'Primary Dive Torch',
    subtitle: 'High-lumen light for caverns & night dives',
  },
  {
    key: 'hood',
    title: 'Thermal Neoprene Hood',
    subtitle: 'Cold-water head protection',
  },
  {
    key: 'gloves',
    title: 'Neoprene Dive Gloves',
    subtitle: 'Thermal & abrasion hand protection',
  },
  {
    key: 'smb',
    title: 'Surface Marker Buoy (SMB)',
    subtitle: 'Safety buoy & finger spool for ascent',
  },
  {
    key: 'dpv_scooter',
    title: 'DPV Underwater Scooter',
    subtitle: 'Diver propulsion vehicle for long range',
  },
  {
    key: 'stage_tank',
    title: 'Stage Cylinder',
    subtitle: 'Deco / Nitrox 50 / Oxygen cylinder',
  },
];

const TANK_OPTIONS = [
  {
    id: '12',
    title: '12L Steel Cylinder',
    subtitle: 'Standard boat diving cylinder included in base trip',
    isBaseline: true,
  },
  {
    id: '15',
    title: '15L Steel Cylinder',
    subtitle: 'High capacity upgrade for heavy air consumers',
    isBaseline: false,
  },
  {
    id: '10',
    title: '10L Steel Cylinder',
    subtitle: 'Compact lightweight cylinder for juniors or shallow dives',
    isBaseline: false,
  },
  {
    id: 'al80',
    title: 'AL80 Aluminum (11L)',
    subtitle: 'Standard aluminum cylinder popular in warm waters',
    isBaseline: false,
  },
  {
    id: 'twinset',
    title: 'Twinset (2x12L Steel)',
    subtitle: 'Double tank manifold set for extended or tech dives',
    isBaseline: false,
  },
];

const GAS_OPTIONS = [
  {
    id: 'air',
    title: 'Standard Air (21% O2)',
    subtitle: 'Standard clean compressed breathing air fill',
    isBaseline: true,
  },
  {
    id: 'ean32',
    title: 'Enriched Air Nitrox 32 (EAN32)',
    subtitle: '32% oxygen blend for extended bottom times',
    isBaseline: false,
  },
  {
    id: 'ean36',
    title: 'Enriched Air Nitrox 36 (EAN36)',
    subtitle: '36% oxygen blend for shallow/medium dive profiles',
    isBaseline: false,
  },
  {
    id: 'custom',
    title: 'Custom Blend / Deco Oxygen',
    subtitle: 'Stage deco gas or custom oxygen percentage',
    isBaseline: false,
  },
];

const DEFAULT_PRICING = {
  currency: 'EUR',
  full_kit_package: 30.0,
  pricing_mode: 'ITEMIZED_OR_PACKAGE',
  package_items: DEFAULT_PACKAGE_ITEMS,
  tank_surcharges: DEFAULT_TANK_SURCHARGES,
  gas_surcharges: DEFAULT_GAS_SURCHARGES,
  items: {
    regulator: 10.0,
    bcd: 10.0,
    wetsuit: 10.0,
    fins_boots: 8.0,
    mask_snorkel: 5.0,
    dive_computer: 10.0,
    dive_torch: 8.0,
    hood: 5.0,
    gloves: 5.0,
    smb: 5.0,
    dpv_scooter: 40.0,
    stage_tank: 20.0,
  },
};

const CenterRentalPricingPage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const centerId = params.id || params.centerId;
  const slug = params.slug;
  const fromTrip = searchParams.get('fromTrip');
  const navigate = useNavigate();

  const handleBack = () => {
    if (fromTrip) {
      navigate(`/manage/centers/${centerId}/trips/${fromTrip}`);
    } else {
      navigate(`/diving-centers/${centerId}${slug ? `/${slug}` : ''}?tab=manage`);
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centerName, setCenterName] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  const [packagePrice, setPackagePrice] = useState('30.00');
  const [currency, setCurrency] = useState('EUR');
  const [defaultValve, setDefaultValve] = useState('DIN');
  const [dailyInsurancePrice, setDailyInsurancePrice] = useState('0.00');
  const [items, setItems] = useState(DEFAULT_PRICING.items);
  const [packageItems, setPackageItems] = useState(DEFAULT_PACKAGE_ITEMS);
  const [tankSurcharges, setTankSurcharges] = useState(DEFAULT_TANK_SURCHARGES);
  const [gasSurcharges, setGasSurcharges] = useState(DEFAULT_GAS_SURCHARGES);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setUnauthorized(false);
        // Load center details & current pricing in parallel
        const [centerRes, pricingRes] = await Promise.all([
          api.get(`/api/v1/diving-centers/${centerId}`).catch(() => ({ data: {} })),
          api.get(`/api/v1/centers/${centerId}/booking-ops/rental-pricing`),
        ]);

        if (centerRes.data?.name) {
          setCenterName(centerRes.data.name);
        }

        const data = pricingRes.data || DEFAULT_PRICING;
        setCurrency(data.currency || 'EUR');
        setPackagePrice((data.full_kit_package ?? 30).toString());
        setDefaultValve(data.default_valve_fitting || 'DIN');
        setDailyInsurancePrice((data.daily_insurance_price ?? 0).toString());
        setItems(data.items || DEFAULT_PRICING.items);
        setPackageItems(data.package_items || DEFAULT_PACKAGE_ITEMS);
        setTankSurcharges(data.tank_surcharges || DEFAULT_TANK_SURCHARGES);
        setGasSurcharges(data.gas_surcharges || DEFAULT_GAS_SURCHARGES);
      } catch (err) {
        console.error('Failed to load rental pricing:', err);
        if (err.response?.status === 403) {
          setUnauthorized(true);
        } else {
          toast.error('Failed to load rental pricing.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [centerId]);

  const handleItemChange = (key, val) => {
    const num = parseFloat(val);
    setItems(prev => ({
      ...prev,
      [key]: isNaN(num) ? 0 : num,
    }));
  };

  const handleTogglePackageItem = key => {
    setPackageItems(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleTankSurchargeChange = (tankId, val) => {
    const num = parseFloat(val);
    setTankSurcharges(prev => ({
      ...prev,
      [tankId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleGasSurchargeChange = (gasId, val) => {
    const num = parseFloat(val);
    setGasSurcharges(prev => ({
      ...prev,
      [gasId]: isNaN(num) ? 0 : num,
    }));
  };

  const handleToggleTankAvailable = (tankId, currentVal) => {
    setTankSurcharges(prev => ({
      ...prev,
      [tankId]: (currentVal ?? 0) < 0 ? 5.0 : -1.0,
    }));
  };

  const handleToggleGasAvailable = (gasId, currentVal) => {
    setGasSurcharges(prev => ({
      ...prev,
      [gasId]: (currentVal ?? 0) < 0 ? 8.0 : -1.0,
    }));
  };

  const handleToggleItemAvailable = (key, currentVal) => {
    setItems(prev => ({
      ...prev,
      [key]: (currentVal ?? 0) < 0 ? 10.0 : -1.0,
    }));
  };

  const handleSave = async e => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        currency: currency,
        full_kit_package: Math.max(0, parseFloat(packagePrice) || 0),
        pricing_mode: 'ITEMIZED_OR_PACKAGE',
        items: items,
        package_items: packageItems,
        tank_surcharges: tankSurcharges,
        gas_surcharges: gasSurcharges,
        default_valve_fitting: defaultValve,
        daily_insurance_price: Math.max(0, parseFloat(dailyInsurancePrice) || 0),
      };

      await api.put(`/api/v1/centers/${centerId}/booking-ops/rental-pricing`, payload);
      toast.success('Equipment rental pricing & packages updated successfully!');
      if (fromTrip) {
        navigate(`/manage/centers/${centerId}/trips/${fromTrip}`);
      }
    } catch (err) {
      console.error('Failed to save rental pricing:', err);
      toast.error(err.response?.data?.detail || 'Failed to update rental pricing.');
    } finally {
      setSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50 py-12 flex flex-col items-center justify-center p-4'>
        <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center space-y-4'>
          <div className='w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto'>
            <ShieldAlert size={24} />
          </div>
          <h2 className='text-lg font-bold text-gray-900 dark:text-white'>
            Manager Access Required
          </h2>
          <p className='text-xs text-gray-500 leading-relaxed'>
            You must be an authorized manager or owner of {centerName || 'this diving center'} to
            configure equipment rental rates.
          </p>
          <button
            onClick={handleBack}
            className='w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm'
          >
            {fromTrip ? 'Back to Trip Operations' : 'Back to Diving Center'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50 py-6'>
      <SEO
        title={`Equipment Rental Pricing & Bundling - ${centerName || 'Diving Center'} - Divemap`}
        description='Configure dive center equipment rental rates, custom package bundles, cylinder upgrades, and Nitrox surcharges.'
      />

      <div className='max-w-[95vw] xl:max-w-[1200px] mx-auto px-0 sm:px-4 lg:px-6'>
        {/* Navigation & Header */}
        <button
          type='button'
          onClick={handleBack}
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4'
        >
          <ChevronLeft size={18} className='mr-1' />
          {fromTrip ? 'Back to Trip Operations' : 'Back to Center Management'}
        </button>

        <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          <div className='p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-750'>
            <div className='flex items-center gap-3'>
              <div className='w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center shrink-0'>
                <Coins size={22} />
              </div>
              <div>
                <h1 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white'>
                  Equipment Rental Rates & Package Bundling
                </h1>
                <p className='text-xs text-gray-500'>
                  Managing center-wide rental rates, package inclusions, and gas/cylinder surcharges
                  for{' '}
                  <span className='font-semibold text-gray-700 dark:text-gray-300'>
                    {centerName || `Center #${centerId}`}
                  </span>
                  {fromTrip && (
                    <span className='italic text-blue-600 dark:text-blue-400 ml-1.5'>
                      (return to trip on save)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={handleBack}
                className='px-4 py-2 border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all'
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className='px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
              >
                {saving ? <Loader2 size={14} className='animate-spin' /> : <Check size={14} />}
                <span>Save Rental Rates</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className='p-16 text-center text-gray-500 text-xs font-medium'>
              <Loader2 className='animate-spin mx-auto h-8 w-8 text-blue-600 mb-3' />
              Loading rental pricing configuration...
            </div>
          ) : (
            <form onSubmit={handleSave} className='p-5 sm:p-6 space-y-6'>
              {/* 1. Full Kit Package Rate & Inclusions Card */}
              <div className='p-4 sm:p-5 bg-blue-50/70 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-4'>
                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-blue-100 dark:border-blue-900/40'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center'>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h3 className='font-bold text-blue-950 dark:text-blue-200 text-sm'>
                        Full Equipment Rental Package & Bundled Items
                      </h3>
                      <span className='text-[11px] text-gray-500 dark:text-gray-400'>
                        Flat rate applied to full rental bookings or capped when individual rentals
                        exceed this price.
                      </span>
                    </div>
                  </div>
                  <span className='text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider self-start sm:self-auto'>
                    Package Bundle
                  </span>
                </div>

                <div className='flex items-center gap-3'>
                  <div className='flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 shadow-2xs'>
                    <span className='font-bold text-sm text-gray-700 dark:text-gray-300'>€</span>
                    <input
                      type='number'
                      step='0.5'
                      min='0'
                      value={packagePrice}
                      onChange={e => setPackagePrice(e.target.value)}
                      className='w-28 font-mono font-bold text-base bg-transparent border-none focus:outline-hidden text-gray-900 dark:text-white'
                      required
                    />
                  </div>
                  <span className='text-xs text-gray-600 dark:text-gray-300 font-medium'>
                    per diver / day
                  </span>
                </div>

                {/* Package Inclusions Checklist */}
                <div className='pt-2 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <label className='text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5'>
                      <Box size={14} className='text-blue-600' />
                      <span>Items Included in Full Package ({packageItems.length} selected):</span>
                    </label>
                    <span className='text-[11px] text-gray-500'>
                      Unchecked items will be billed as add-ons
                    </span>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1'>
                    {GEAR_ITEMS.map(item => {
                      const isIncluded = packageItems.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type='button'
                          onClick={() => handleTogglePackageItem(item.key)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                            isIncluded
                              ? 'bg-blue-100/60 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 shadow-2xs'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className='min-w-0 pr-1'>
                            <span
                              className={`text-xs sm:text-sm font-bold block leading-tight ${
                                isIncluded
                                  ? 'text-blue-900 dark:text-blue-200'
                                  : 'text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className='text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug'>
                              {isIncluded ? '✓ Included in Bundle' : 'Billed as Add-on'}
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                              isIncluded
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                            }`}
                          >
                            {isIncluded && <Check size={12} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Cylinder Capacity & Tank Upgrades */}
              <div className='p-4 sm:p-5 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3.5'>
                <div className='flex items-center gap-2'>
                  <div className='w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center'>
                    <Layers size={15} />
                  </div>
                  <div>
                    <h3 className='font-bold text-gray-900 dark:text-white text-sm'>
                      Cylinder Capacity & Tank Upgrades (€)
                    </h3>
                    <p className='text-xs text-gray-500'>
                      Standard 12L cylinders are included in base tickets. Specify extra daily
                      upgrade fees for larger tanks or twinsets.
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1'>
                  {TANK_OPTIONS.map(tank => {
                    const isAvailable = (tankSurcharges[tank.id] ?? 0) >= 0;
                    return (
                      <div
                        key={tank.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 shadow-2xs transition-all ${
                          isAvailable || tank.isBaseline
                            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 opacity-75'
                        }`}
                      >
                        <div className='min-w-0'>
                          <span
                            className={`font-bold text-xs sm:text-sm block leading-tight ${
                              isAvailable || tank.isBaseline
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-500 line-through'
                            }`}
                          >
                            {tank.title}
                          </span>
                          <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug'>
                            {tank.isBaseline
                              ? 'Base trip standard'
                              : isAvailable
                                ? tank.subtitle
                                : 'Not offered at this center'}
                          </span>
                        </div>

                        <div className='flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/50 mt-auto'>
                          {tank.isBaseline ? (
                            <span className='text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'>
                              Included (€0.00)
                            </span>
                          ) : (
                            <>
                              <div className='flex items-center gap-1.5'>
                                {isAvailable ? (
                                  <div className='flex items-center gap-1 bg-gray-50 dark:bg-gray-700/60 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600'>
                                    <span className='text-gray-400 text-xs font-semibold'>+€</span>
                                    <input
                                      type='number'
                                      step='0.5'
                                      min='0'
                                      value={tankSurcharges[tank.id] ?? 0}
                                      onChange={e =>
                                        handleTankSurchargeChange(tank.id, e.target.value)
                                      }
                                      className='w-14 text-right font-mono font-bold text-xs bg-transparent border-none focus:outline-hidden text-gray-900 dark:text-white'
                                    />
                                  </div>
                                ) : (
                                  <span className='text-[11px] font-bold px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'>
                                    Not Offered
                                  </span>
                                )}
                              </div>
                              <button
                                type='button'
                                onClick={() =>
                                  handleToggleTankAvailable(tank.id, tankSurcharges[tank.id])
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  isAvailable
                                    ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                                    : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                                }`}
                              >
                                {isAvailable ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Breathing Gas Mixes & Nitrox Upgrades */}
              <div className='p-4 sm:p-5 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3.5'>
                <div className='flex items-center gap-2'>
                  <div className='w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center'>
                    <Wind size={15} />
                  </div>
                  <div>
                    <h3 className='font-bold text-gray-900 dark:text-white text-sm'>
                      Breathing Gas Mixes & Nitrox Upgrades (€)
                    </h3>
                    <p className='text-xs text-gray-500'>
                      Standard Air (21% O2) is included. Specify extra fill fees for Enriched Air
                      Nitrox blending or custom deco mixes.
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1'>
                  {GAS_OPTIONS.map(gas => {
                    const isAvailable = (gasSurcharges[gas.id] ?? 0) >= 0;
                    return (
                      <div
                        key={gas.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 shadow-2xs transition-all ${
                          isAvailable || gas.isBaseline
                            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 opacity-75'
                        }`}
                      >
                        <div className='min-w-0'>
                          <span
                            className={`font-bold text-xs sm:text-sm block leading-tight ${
                              isAvailable || gas.isBaseline
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-500 line-through'
                            }`}
                          >
                            {gas.title}
                          </span>
                          <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug'>
                            {gas.isBaseline
                              ? 'Standard fill'
                              : isAvailable
                                ? gas.subtitle
                                : 'Not offered at this center'}
                          </span>
                        </div>

                        <div className='flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/50 mt-auto'>
                          {gas.isBaseline ? (
                            <span className='text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'>
                              Included (€0.00)
                            </span>
                          ) : (
                            <>
                              <div className='flex items-center gap-1.5'>
                                {isAvailable ? (
                                  <div className='flex items-center gap-1 bg-gray-50 dark:bg-gray-700/60 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600'>
                                    <span className='text-gray-400 text-xs font-semibold'>+€</span>
                                    <input
                                      type='number'
                                      step='0.5'
                                      min='0'
                                      value={gasSurcharges[gas.id] ?? 0}
                                      onChange={e =>
                                        handleGasSurchargeChange(gas.id, e.target.value)
                                      }
                                      className='w-14 text-right font-mono font-bold text-xs bg-transparent border-none focus:outline-hidden text-gray-900 dark:text-white'
                                    />
                                  </div>
                                ) : (
                                  <span className='text-[11px] font-bold px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'>
                                    Not Offered
                                  </span>
                                )}
                              </div>
                              <button
                                type='button'
                                onClick={() =>
                                  handleToggleGasAvailable(gas.id, gasSurcharges[gas.id])
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  isAvailable
                                    ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                                    : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                                }`}
                              >
                                {isAvailable ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Center Defaults & Daily Insurance */}
              <div className='p-4 sm:p-5 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4'>
                <div>
                  <h3 className='font-bold text-gray-900 dark:text-white text-sm'>
                    Center Defaults & Daily Insurance
                  </h3>
                  <p className='text-xs text-gray-500'>
                    Configure default cylinder rigging and optional daily dive insurance pricing.
                  </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div className='bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5'>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300'>
                      Default Tank Valve Fitting
                    </label>
                    <select
                      value={defaultValve}
                      onChange={e => setDefaultValve(e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 font-medium'
                    >
                      <option value='DIN'>DIN (G 5/8&quot; Threaded) — Europe Standard</option>
                      <option value='YOKE'>Yoke (INT / A-clamp) — International</option>
                    </select>
                    <span className='text-[11px] text-gray-400 block'>
                      Applied automatically when customers rent regulators & cylinders.
                    </span>
                  </div>

                  <div className='bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-1.5'>
                    <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300'>
                      Center Daily Insurance Cost (€)
                    </label>
                    <div className='flex items-center gap-2'>
                      <span className='font-bold text-sm text-gray-700 dark:text-gray-300'>€</span>
                      <input
                        type='number'
                        step='0.5'
                        min='0'
                        value={dailyInsurancePrice}
                        onChange={e => setDailyInsurancePrice(e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-mono font-bold bg-white dark:bg-gray-800'
                      />
                    </div>
                    <span className='text-[11px] text-gray-400 block'>
                      Per diver / day when choosing Center Daily Coverage (0.00 = complimentary).
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Itemized Rental Rates Grid */}
              <div className='space-y-3'>
                <div className='border-b border-gray-100 dark:border-gray-700 pb-2'>
                  <h3 className='font-bold text-gray-900 dark:text-white text-sm'>
                    Itemized Daily Rental Rates (€)
                  </h3>
                  <p className='text-xs text-gray-500'>
                    Rates charged to divers bringing partial personal equipment who rent specific
                    items à la carte.
                  </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1'>
                  {GEAR_ITEMS.map(item => {
                    const isAvailable = (items[item.key] ?? 0) >= 0;
                    return (
                      <div
                        key={item.key}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                          isAvailable
                            ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750'
                            : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30 opacity-70'
                        }`}
                      >
                        <div className='min-w-0'>
                          <span
                            className={`font-bold text-xs sm:text-sm block leading-tight ${
                              isAvailable
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 line-through'
                            }`}
                          >
                            {item.title}
                          </span>
                          <span className='text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug'>
                            {isAvailable ? item.subtitle : 'Not offered for rental'}
                          </span>
                        </div>

                        <div className='flex items-center justify-between gap-2 pt-1 border-t border-gray-200/60 dark:border-gray-700/50 mt-auto'>
                          <span className='text-[10px] text-gray-400 font-medium'>
                            Daily rental rate
                          </span>
                          <div className='flex items-center gap-2'>
                            {isAvailable ? (
                              <div className='flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 shadow-2xs'>
                                <span className='text-gray-400 text-xs font-semibold'>€</span>
                                <input
                                  type='number'
                                  step='0.5'
                                  min='0'
                                  value={items[item.key] ?? 0}
                                  onChange={e => handleItemChange(item.key, e.target.value)}
                                  className='w-14 text-right font-mono font-bold text-xs bg-transparent border-none focus:outline-hidden text-gray-900 dark:text-white'
                                />
                              </div>
                            ) : (
                              <span className='text-[11px] font-bold px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'>
                                Not Offered
                              </span>
                            )}
                            <button
                              type='button'
                              onClick={() => handleToggleItemAvailable(item.key, items[item.key])}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                isAvailable
                                  ? 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                                  : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                              }`}
                            >
                              {isAvailable ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CenterRentalPricingPage;
