import { Coins, Check, Loader2, Sparkles, ChevronLeft, ShieldAlert } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';

const DEFAULT_PRICING = {
  currency: 'EUR',
  full_kit_package: 30.0,
  pricing_mode: 'ITEMIZED_OR_PACKAGE',
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
    setItems(prev => ({
      ...prev,
      [key]: parseFloat(val) || 0,
    }));
  };

  const handleSave = async e => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        currency: currency,
        full_kit_package: parseFloat(packagePrice) || 0,
        pricing_mode: 'ITEMIZED_OR_PACKAGE',
        items: items,
        default_valve_fitting: defaultValve,
        daily_insurance_price: parseFloat(dailyInsurancePrice) || 0,
      };

      await api.put(`/api/v1/centers/${centerId}/booking-ops/rental-pricing`, payload);
      toast.success('Equipment rental pricing updated successfully!');
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
        title={`Equipment Rental Pricing - ${centerName || 'Diving Center'} - Divemap`}
        description='Configure dive center equipment rental rates and package bundles for online and desk bookings.'
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
                  Managing center-wide rental rates & defaults for{' '}
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
              {/* Full Kit Package Rate Card */}
              <div className='p-4 sm:p-5 bg-blue-50/70 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-3'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center'>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h3 className='font-bold text-blue-950 dark:text-blue-200 text-sm'>
                        Full Equipment Rental Package Rate
                      </h3>
                      <span className='text-[11px] text-gray-500 dark:text-gray-400'>
                        Bundle covering core gear (Regulator, BCD, Wetsuit, Fins, Boots, Mask)
                      </span>
                    </div>
                  </div>
                  <span className='text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider'>
                    Package Bundle
                  </span>
                </div>

                <div className='flex items-center gap-3 pt-2'>
                  <div className='flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 shadow-2xs'>
                    <span className='font-bold text-sm text-gray-700 dark:text-gray-300'>€</span>
                    <input
                      type='number'
                      step='0.5'
                      value={packagePrice}
                      onChange={e => setPackagePrice(e.target.value)}
                      className='w-28 font-mono font-bold text-base bg-transparent border-none focus:outline-hidden'
                      required
                    />
                  </div>
                  <span className='text-xs text-gray-500 font-medium'>
                    per diver / day (Smart Cap applied if individual rentals exceed this)
                  </span>
                </div>
              </div>

              {/* Center Default Valve & Daily Insurance */}
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
                      <option value='DIN'>DIN (G 5/8" Threaded) — Europe Standard</option>
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

              {/* Itemized Rental Rates Grid */}
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
                  {[
                    { key: 'regulator', label: 'Regulator Setup (1st & 2nd Stage, Octo, SPG)' },
                    { key: 'bcd', label: 'BCD (Buoyancy Compensator Device)' },
                    { key: 'wetsuit', label: 'Wetsuit / Semi-Dry Exposure Suit' },
                    { key: 'fins_boots', label: 'Fins & Neoprene Booties' },
                    { key: 'mask_snorkel', label: 'Mask & Snorkel' },
                    { key: 'dive_computer', label: 'Dive Computer (Wrist Unit)' },
                    { key: 'dive_torch', label: 'Primary Dive Torch' },
                    { key: 'hood', label: 'Thermal Neoprene Hood' },
                    { key: 'gloves', label: 'Neoprene Dive Gloves' },
                    { key: 'smb', label: 'Surface Marker Buoy (SMB) & Spool' },
                    { key: 'dpv_scooter', label: 'DPV Underwater Scooter' },
                    { key: 'stage_tank', label: 'Stage Cylinder (Deco / Nitrox 50 / O2)' },
                  ].map(item => (
                    <div
                      key={item.key}
                      className='p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex items-center justify-between gap-3'
                    >
                      <div className='min-w-0'>
                        <span className='font-semibold text-gray-800 dark:text-gray-200 text-xs block truncate'>
                          {item.label}
                        </span>
                        <span className='text-[10px] text-gray-400'>per diver / day</span>
                      </div>
                      <div className='flex items-center gap-1.5 shrink-0 bg-white dark:bg-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 shadow-2xs'>
                        <span className='text-gray-400 text-xs font-semibold'>€</span>
                        <input
                          type='number'
                          step='0.5'
                          value={items[item.key] ?? 0}
                          onChange={e => handleItemChange(item.key, e.target.value)}
                          className='w-14 text-right font-mono font-bold text-xs bg-transparent border-none focus:outline-hidden'
                        />
                      </div>
                    </div>
                  ))}
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
