import { Loader2, AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../api';
import { getUniqueCountries } from '../services/diveSites';

import LocationPickerMap from './LocationPickerMap';
import Modal from './ui/Modal';

const QuickCreateDiveSiteModal = ({
  isOpen,
  onClose,
  initialData = {},
  matchingCount = 1,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictSite, setConflictSite] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countriesList, setCountriesList] = useState([]);

  useEffect(() => {
    let mounted = true;
    getUniqueCountries()
      .then(countries => {
        if (mounted && Array.isArray(countries)) {
          setCountriesList(
            countries.map(c => (typeof c === 'string' ? c : c.name || c.country)).filter(Boolean)
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Sync initialData when opened or changed
  useEffect(() => {
    if (isOpen) {
      setName(initialData.name || '');
      setCountry(initialData.country || '');
      setRegion(initialData.region || '');
      setLatitude(initialData.latitude != null ? String(initialData.latitude) : '');
      setLongitude(initialData.longitude != null ? String(initialData.longitude) : '');
      setApplyToAll(true);
      setConflictSite(null);
      setErrorMsg('');
    }
  }, [isOpen, initialData]);

  const handleSelectExisting = site => {
    toast.success(`Linked to existing site: ${site.name}`);
    if (onSuccess) {
      onSuccess(site, applyToAll);
    }
    if (onClose) {
      onClose();
    }
  };

  const handleSubmit = async (e, forceModeration = false) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const trimmedName = name.trim();
    const trimmedCountry = country.trim();
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (!trimmedName) {
      setErrorMsg('Dive site name is required.');
      return;
    }
    if (!trimmedCountry) {
      setErrorMsg('Country is required.');
      return;
    }
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMsg('Please select a valid latitude between -90 and 90.');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setErrorMsg('Please select a valid longitude between -180 and 180.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        country: trimmedCountry,
        region: region.trim() || undefined,
        latitude: latNum,
        longitude: lngNum,
        moderation_needed: forceModeration,
      };

      const res = await api.post('/api/v1/dive-sites/', payload);
      toast.success('Dive site created successfully!');
      if (onSuccess) {
        onSuccess(res.data, applyToAll);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.detail?.nearby_sites?.[0]) {
        setConflictSite(err.response.data.detail.nearby_sites[0]);
      } else {
        const msg =
          err.response?.data?.detail?.message ||
          (typeof err.response?.data?.detail === 'string'
            ? err.response.data.detail
            : 'Failed to create dive site.');
        setErrorMsg(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Quick Create Dive Site'
      className='w-full max-w-2xl p-0 overflow-hidden'
    >
      <form onSubmit={e => handleSubmit(e, false)} className='flex flex-col'>
        <div className='p-4 sm:p-6 space-y-4 max-h-[calc(85vh-8rem)] overflow-y-auto'>
          {errorMsg && (
            <div className='p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md text-sm text-red-700 dark:text-red-300'>
              {errorMsg}
            </div>
          )}

          {/* Conflict 409 Warning */}
          {conflictSite && (
            <div className='p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md text-sm space-y-2'>
              <div className='flex items-start gap-2 text-amber-900 dark:text-amber-200 font-semibold'>
                <AlertTriangle className='w-4 h-4 text-amber-600 shrink-0 mt-0.5' />
                <span>Existing dive site found at this location</span>
              </div>
              <p className='text-xs text-amber-800 dark:text-amber-300'>
                A site named <strong>&quot;{conflictSite.name}&quot;</strong> is already registered
                within 50 meters of these coordinates.
              </p>
              <div className='flex flex-wrap gap-2 pt-1'>
                <button
                  type='button'
                  onClick={() => handleSelectExisting(conflictSite)}
                  className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors'
                >
                  Use &quot;{conflictSite.name}&quot; Instead
                </button>
                <button
                  type='button'
                  onClick={() => handleSubmit(null, true)}
                  disabled={isSubmitting}
                  className='px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded text-xs font-medium hover:bg-amber-100/50 transition-colors'
                >
                  Submit My Site Anyway
                </button>
              </div>
            </div>
          )}

          {/* Site Name Input */}
          <div>
            <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
              Dive Site Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='e.g., Shark Reef, Blue Hole'
              className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
            />
          </div>

          {/* Coordinates Inputs */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
                Latitude <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder='e.g., 27.7281'
                className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
            </div>
            <div>
              <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
                Longitude <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder='e.g., 34.2519'
                className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
            </div>
          </div>

          {/* LocationPickerMap (Satellite-first & Proximity suggestion) */}
          <div>
            <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
              Pin Location & Search Nearby Sites
            </label>
            <LocationPickerMap
              latitude={latitude}
              longitude={longitude}
              country={country}
              region={region}
              initialSearchQuery={name || initialData.name || ''}
              autoSearchOnMount={
                !initialData.latitude && !initialData.longitude && !!(name || initialData.name)
              }
              height='h-52 sm:h-64'
              onChange={({ lat, lng }) => {
                setLatitude(String(lat));
                setLongitude(String(lng));
              }}
              onLocationResolved={({ country: resCountry, region: resRegion }) => {
                if (resCountry) setCountry(resCountry);
                if (resRegion) setRegion(resRegion);
              }}
              onSelectNearbySite={handleSelectExisting}
            />
          </div>

          {/* Country & Region */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
                Country <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                list='country-suggestions'
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder='e.g., Egypt, Greece'
                className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
              <datalist id='country-suggestions'>
                {countriesList.map((c, i) => (
                  <option key={i} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
                Region
              </label>
              <input
                type='text'
                value={region}
                onChange={e => setRegion(e.target.value)}
                placeholder='e.g., South Sinai, Cyclades'
                className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          {/* Batch Apply Checkbox */}
          {matchingCount > 1 && (
            <div className='p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md'>
              <label className='flex items-start gap-2.5 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={applyToAll}
                  onChange={e => setApplyToAll(e.target.checked)}
                  className='mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500'
                />
                <span className='text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 font-medium'>
                  Apply this site to all <strong>{matchingCount} dives</strong> in this import named{' '}
                  <em>&quot;{initialData.name}&quot;</em>
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className='p-4 bg-gray-50 dark:bg-slate-900/60 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={isSubmitting}
            className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create & Link Site</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

QuickCreateDiveSiteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    name: PropTypes.string,
    country: PropTypes.string,
    region: PropTypes.string,
    latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  matchingCount: PropTypes.number,
  onSuccess: PropTypes.func,
};

export default QuickCreateDiveSiteModal;
