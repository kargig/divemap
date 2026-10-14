import { X, Check, Loader2, Coins, Sparkles, Tag } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

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

const CenterRentalPricingModal = ({ isOpen, onClose, centerId }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [packagePrice, setPackagePrice] = useState('30.00');
  const [currency, setCurrency] = useState('EUR');
  const [items, setItems] = useState(DEFAULT_PRICING.items);

  useEffect(() => {
    if (!isOpen || !centerId) return;

    const fetchPricing = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/centers/${centerId}/booking-ops/rental-pricing`);
        const data = res.data || DEFAULT_PRICING;
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

    fetchPricing();
  }, [isOpen, centerId]);

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
      onClose();
    } catch (err) {
      console.error('Failed to save rental pricing:', err);
      toast.error(err.response?.data?.detail || 'Failed to update rental pricing.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
      <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200'>
        {/* Header */}
        <div className='p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-750'>
          <div className='flex items-center gap-2.5'>
            <div className='w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center'>
              <Coins size={18} />
            </div>
            <div>
              <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                Equipment Rental Pricing
              </h3>
              <p className='text-xs text-gray-500'>
                Configure itemized rental rates and package bundles for online & desk checkout.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg'
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className='p-12 text-center text-gray-500 text-xs font-medium'>
            <Loader2 className='animate-spin mx-auto h-6 w-6 text-blue-600 mb-2' />
            Loading rental pricing...
          </div>
        ) : (
          <form onSubmit={handleSave} className='overflow-y-auto p-5 space-y-4 text-xs'>
            {/* Full Kit Package Rate */}
            <div className='p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5 text-xs'>
                  <Sparkles size={14} className='text-blue-600' />
                  Full Equipment Rental Package Price
                </span>
                <span className='text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase'>
                  Bundle
                </span>
              </div>
              <p className='text-[11px] text-gray-500 dark:text-gray-400'>
                Covers core scuba kit (Wetsuit, BCD, Regulator, Fins, Boots, Mask). If an own-gear
                diver selects multiple rental parts, the core surcharge is automatically capped at
                this price.
              </p>
              <div className='flex items-center gap-2 pt-1'>
                <span className='font-bold text-sm text-gray-700 dark:text-gray-300'>€</span>
                <input
                  type='number'
                  step='0.5'
                  value={packagePrice}
                  onChange={e => setPackagePrice(e.target.value)}
                  className='w-32 px-3 py-1.5 border border-gray-300 rounded-lg font-mono font-bold text-sm bg-white dark:bg-gray-800'
                  required
                />
                <span className='text-xs text-gray-400 font-medium'>per diver / day</span>
              </div>
            </div>

            {/* Itemized Pricing */}
            <div className='space-y-3 pt-1'>
              <span className='font-bold text-gray-500 uppercase tracking-wider text-[10px] block'>
                Itemized Rental Rates (€ per item / day)
              </span>

              <div className='grid grid-cols-2 gap-3'>
                {[
                  { key: 'regulator', label: 'Regulator Setup' },
                  { key: 'bcd', label: 'BCD (Buoyancy Device)' },
                  { key: 'wetsuit', label: 'Wetsuit / Semi-Dry' },
                  { key: 'fins_boots', label: 'Fins & Booties' },
                  { key: 'mask_snorkel', label: 'Mask & Snorkel' },
                  { key: 'dive_computer', label: 'Dive Computer (Wrist)' },
                  { key: 'dive_torch', label: 'Primary Dive Torch' },
                  { key: 'hood', label: 'Thermal Hood' },
                  { key: 'gloves', label: 'Dive Gloves' },
                  { key: 'dpv_scooter', label: 'DPV Scooter' },
                  { key: 'stage_tank', label: 'Stage Cylinder (EAN50/O2)' },
                ].map(item => (
                  <div
                    key={item.key}
                    className='p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex items-center justify-between'
                  >
                    <span className='font-medium text-gray-700 dark:text-gray-300 text-[11px] truncate mr-2'>
                      {item.label}
                    </span>
                    <div className='flex items-center gap-1 shrink-0'>
                      <span className='text-gray-400 text-xs'>€</span>
                      <input
                        type='number'
                        step='0.5'
                        value={items[item.key] ?? 0}
                        onChange={e => handleItemChange(item.key, e.target.value)}
                        className='w-16 px-2 py-1 border border-gray-300 rounded text-right font-mono font-bold text-xs bg-white dark:bg-gray-800'
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className='flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700'>
              <button
                type='button'
                onClick={onClose}
                className='px-3.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-semibold'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={saving}
                className='px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
              >
                {saving ? <Loader2 size={13} className='animate-spin' /> : <Check size={13} />}
                <span>Save Rental Pricing</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CenterRentalPricingModal;
