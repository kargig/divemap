import { Coins, Check, Loader2, Sparkles, ChevronLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';

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
    dpv_scooter: 40.0,
    stage_tank: 20.0,
  },
};

const CenterRentalPricingPage = () => {
  const { centerId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [centerName, setCenterName] = useState('');

  const [packagePrice, setPackagePrice] = useState('30.00');
  const [currency, setCurrency] = useState('EUR');
  const [items, setItems] = useState(DEFAULT_PRICING.items);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
        setItems(data.items || DEFAULT_PRICING.items);
      } catch (err) {
        console.error('Failed to load rental pricing:', err);
        toast.error('Failed to load rental pricing.');
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
      };

      await api.put(`/api/v1/centers/${centerId}/booking-ops/rental-pricing`, payload);
      toast.success('Equipment rental pricing updated successfully!');
    } catch (err) {
      console.error('Failed to save rental pricing:', err);
      toast.error(err.response?.data?.detail || 'Failed to update rental pricing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50 py-6'>
      <SEO
        title={`Equipment Rental Pricing - ${centerName || 'Diving Center'} - Divemap`}
        description='Configure dive center equipment rental rates and package bundles for online and desk bookings.'
      />

      <div className='max-w-[95vw] xl:max-w-[1200px] mx-auto px-0 sm:px-4 lg:px-6'>
        {/* Navigation & Header */}
        <button
          onClick={() => navigate(-1)}
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4'
        >
          <ChevronLeft size={18} className='mr-1' />
          Back
        </button>

        <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden'>
          <div className='p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-750'>
            <div className='flex items-center gap-3'>
              <div className='w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center shrink-0'>
                <Coins size={22} />
              </div>
              <div>
                <h1 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white'>
                  Equipment Rental Pricing
                </h1>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {centerName ? `${centerName} • ` : ''}Configure itemized rental rates and package
                  bundles for online & desk checkout.
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2 self-end sm:self-center'>
              <button
                type='button'
                onClick={handleSave}
                disabled={saving || loading}
                className='px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
              >
                {saving ? <Loader2 size={14} className='animate-spin' /> : <Check size={14} />}
                <span>Save Rental Pricing</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className='p-16 text-center text-gray-500 text-xs font-medium'>
              <Loader2 className='animate-spin mx-auto h-8 w-8 text-blue-600 mb-3' />
              Loading rental pricing configuration...
            </div>
          ) : (
            <form onSubmit={handleSave} className='p-5 sm:p-6 space-y-6 text-xs'>
              {/* Full Kit Package Rate */}
              <div className='p-4 sm:p-5 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='font-bold text-blue-950 dark:text-blue-200 flex items-center gap-2 text-sm'>
                    <Sparkles size={16} className='text-blue-600' />
                    Full Equipment Rental Package Price (Bundle)
                  </span>
                  <span className='text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide'>
                    Daily Bundle Rate
                  </span>
                </div>
                <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl'>
                  Flat day rate covering the core scuba kit (Wetsuit, BCD, Regulator, Fins &
                  Booties, Mask/Snorkel). If an own-gear diver selects individual rental items whose
                  sum reaches or exceeds this price, their surcharge is automatically capped at this
                  bundle rate.
                </p>
                <div className='flex items-center gap-2 pt-1'>
                  <span className='font-bold text-base text-gray-700 dark:text-gray-300'>€</span>
                  <input
                    type='number'
                    step='0.5'
                    value={packagePrice}
                    onChange={e => setPackagePrice(e.target.value)}
                    className='w-36 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-mono font-bold text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                    required
                  />
                  <span className='text-xs text-gray-500 font-medium'>per diver / day</span>
                </div>
              </div>

              {/* Itemized Pricing */}
              <div className='space-y-4'>
                <div>
                  <h3 className='font-bold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-1'>
                    Itemized À La Carte Rates
                  </h3>
                  <p className='text-xs text-gray-500'>
                    Rates applied when divers rent individual pieces of equipment à la carte.
                  </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'>
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
                    { key: 'dpv_scooter', label: 'DPV Underwater Scooter' },
                    { key: 'stage_tank', label: 'Stage Cylinder (Deco / Nitrox 50 / O2)' },
                  ].map(item => (
                    <div
                      key={item.key}
                      className='p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex items-center justify-between'
                    >
                      <span className='font-medium text-gray-700 dark:text-gray-300 text-xs truncate mr-2'>
                        {item.label}
                      </span>
                      <div className='flex items-center gap-1 shrink-0'>
                        <span className='text-gray-400 text-xs'>€</span>
                        <input
                          type='number'
                          step='0.5'
                          value={items[item.key] ?? 0}
                          onChange={e => handleItemChange(item.key, e.target.value)}
                          className='w-20 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-right font-mono font-bold text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className='pt-5 border-t border-gray-100 dark:border-gray-700 flex justify-end'>
                <button
                  type='submit'
                  disabled={saving}
                  className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
                >
                  {saving ? <Loader2 size={14} className='animate-spin' /> : <Check size={14} />}
                  <span>Save Rental Pricing Changes</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CenterRentalPricingPage;
