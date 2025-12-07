import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import { UI_COLORS } from '../utils/colorPalette';

// Reusable form for creating/editing Diving Centers
// Props:
// - mode: 'create' | 'edit'
// - initialValues: object with fields
// - onSubmit: (values) => void
// - onCancel: () => void
// - externalFormData: optional object for controlled mode
// - onExternalChange: optional setter for controlled mode
const DivingCenterForm = ({
  mode = 'create',
  initialValues,
  onSubmit,
  onCancel,
  externalFormData,
  onExternalChange,
}) => {
  const isControlled = !!externalFormData && typeof onExternalChange === 'function';

  const [internalFormData, setInternalFormData] = useState({
    name: initialValues?.name || '',
    description: initialValues?.description || '',
    email: initialValues?.email || '',
    phone: initialValues?.phone || '',
    website: initialValues?.website || '',
    latitude: initialValues?.latitude?.toString?.() || initialValues?.latitude || '',
    longitude: initialValues?.longitude?.toString?.() || initialValues?.longitude || '',
    country: initialValues?.country || '',
    region: initialValues?.region || '',
    city: initialValues?.city || '',
    address: initialValues?.address || '',
  });

  // Keep internal state in sync when parent provides new initialValues
  useEffect(() => {
    if (isControlled) return; // external state controls values
    setInternalFormData({
      name: initialValues?.name || '',
      description: initialValues?.description || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      website: initialValues?.website || '',
      latitude: initialValues?.latitude?.toString?.() || initialValues?.latitude || '',
      longitude: initialValues?.longitude?.toString?.() || initialValues?.longitude || '',
      country: initialValues?.country || '',
      region: initialValues?.region || '',
      city: initialValues?.city || '',
      address: initialValues?.address || '',
    });
  }, [initialValues, isControlled]);

  const formData = isControlled ? externalFormData : internalFormData;
  const setFormData = updater => {
    if (isControlled) {
      const next = typeof updater === 'function' ? updater(externalFormData) : updater;
      onExternalChange(next);
    } else {
      setInternalFormData(updater);
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const suggestFromCoordinates = async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      toast.error('Please enter valid latitude and longitude coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Coordinates are out of valid range (Lat: -90 to 90, Lng: -180 to 180)');
      return;
    }

    try {
      toast.loading('Looking up location...');
      const response = await fetch(
        `/api/v1/diving-centers/reverse-geocode?latitude=${lat}&longitude=${lng}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        country: data.country || '',
        region: data.region || '',
        city: data.city || '',
      }));
      toast.dismiss();
      toast.success('Location information suggested from coordinates!');
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to get location: ${error.message}`);
    }
  };

  const handleSubmit = e => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    // Required in both modes
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error('Name and description are required');
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Latitude and longitude are required');
      return;
    }

    const cleaned = { ...formData };
    // Drop optional string fields if empty to satisfy backend Optional types
    ['email', 'phone', 'website', 'country', 'region', 'city', 'address'].forEach(key => {
      if (typeof cleaned[key] === 'string' && cleaned[key].trim() === '') {
        delete cleaned[key];
      }
    });

    // Normalize and validate phone number: remove spaces and convert '00' prefix to '+'
    if (cleaned.phone !== undefined && cleaned.phone !== null && cleaned.phone !== '') {
      // Convert to string and remove all whitespace
      const originalPhone = String(cleaned.phone);
      cleaned.phone = originalPhone.replace(/\s+/g, '');

      // Skip validation if empty after trimming
      if (cleaned.phone === '') {
        delete cleaned.phone;
      } else {
        // Convert '00' prefix to '+' if present
        if (cleaned.phone.startsWith('00')) {
          cleaned.phone = `+${cleaned.phone.substring(2)}`;
        }
        // If it doesn't start with '+', add it (assuming international format)
        else if (!cleaned.phone.startsWith('+')) {
          cleaned.phone = `+${cleaned.phone}`;
        }

        // Check for non-digit characters (except the leading '+')
        // Reject if any non-digit characters are found
        const afterPlus = cleaned.phone.substring(1);
        if (!/^\d+$/.test(afterPlus)) {
          toast.error(
            'Phone number contains invalid characters (letters or special characters). ' +
              'Only digits are allowed after the country code. ' +
              `Entered: ${originalPhone}`
          );
          return;
        }

        // Validate phone number format: ^\+[1-9]\d{1,14}$
        // Must start with +, followed by digit 1-9, then 1-14 more digits
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(cleaned.phone)) {
          toast.error(
            'Phone number must be in international format: +[1-9][digits] (e.g., +3012345678). ' +
              'Must start with + followed by a non-zero digit and 1-14 more digits. ' +
              `Entered: ${originalPhone}`
          );
          return;
        }
      }
    }

    onSubmit({
      ...cleaned,
      latitude: lat,
      longitude: lng,
    });
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <div className='flex items-center justify-between mb-2'>
        <button
          type='button'
          onClick={onCancel}
          className='flex items-center text-gray-600 hover:text-gray-800 mr-4'
        >
          <ArrowLeft className='h-4 w-4 mr-1' />
          {mode === 'create' ? 'Back to Diving Centers' : 'Back to Diving Center'}
        </button>
      </div>

      {/* Basic Information */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label
            htmlFor='diving-center-name'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Name *
          </label>
          <input
            id='diving-center-name'
            type='text'
            name='name'
            value={formData.name}
            onChange={handleInputChange}
            required
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter diving center name'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-email'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Email
          </label>
          <input
            id='diving-center-email'
            type='email'
            name='email'
            value={formData.email}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter email address'
          />
        </div>
      </div>

      <div>
        <label
          htmlFor='diving-center-description'
          className='block text-sm font-medium text-gray-700 mb-2'
        >
          Description *
        </label>
        <textarea
          id='diving-center-description'
          name='description'
          value={formData.description}
          onChange={handleInputChange}
          required
          rows={3}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Enter diving center description'
        />
      </div>

      {/* Contact Information */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <label
            htmlFor='diving-center-phone'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Phone
          </label>
          <input
            id='diving-center-phone'
            type='tel'
            name='phone'
            value={formData.phone}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter phone number'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-website'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Website
          </label>
          <input
            id='diving-center-website'
            type='url'
            name='website'
            value={formData.website}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter website URL'
          />
        </div>
      </div>

      {/* Location Information */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div>
          <label
            htmlFor='diving-center-latitude'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Latitude *
          </label>
          <input
            id='diving-center-latitude'
            type='number'
            step='any'
            name='latitude'
            value={formData.latitude}
            onChange={handleInputChange}
            required
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., -16.92'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-longitude'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Longitude *
          </label>
          <input
            id='diving-center-longitude'
            type='number'
            step='any'
            name='longitude'
            value={formData.longitude}
            onChange={handleInputChange}
            required
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., 145.77'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-address'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Address
          </label>
          <input
            id='diving-center-address'
            type='text'
            name='address'
            value={formData.address}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter address'
          />
        </div>
      </div>

      {/* Suggest Location Button */}
      <div className='flex justify-center'>
        <button
          type='button'
          onClick={suggestFromCoordinates}
          disabled={!formData.latitude || !formData.longitude}
          className='px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors'
          style={{ backgroundColor: UI_COLORS.success }}
          onMouseEnter={e =>
            !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')
          }
          onMouseLeave={e =>
            !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.success)
          }
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
            />
          </svg>
          Suggest Country, Region & City from Coordinates
        </button>
      </div>

      {/* Geographic Information */}
      <div className='grid grid-cols-1 md-grid-cols-3 md:grid-cols-3 gap-6'>
        <div>
          <label
            htmlFor='diving-center-country'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Country
          </label>
          <input
            id='diving-center-country'
            type='text'
            name='country'
            value={formData.country}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., Greece'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-region'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Region
          </label>
          <input
            id='diving-center-region'
            type='text'
            name='region'
            value={formData.region}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., South Aegean'
          />
        </div>

        <div>
          <label
            htmlFor='diving-center-city'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            City
          </label>
          <input
            id='diving-center-city'
            type='text'
            name='city'
            value={formData.city}
            onChange={handleInputChange}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., Kos'
          />
        </div>
      </div>

      {/* Actions: consumer pages will render their own submit buttons with loading states if needed */}
      <div className='flex justify-end space-x-4 pt-6 border-t'>
        <button
          type='button'
          onClick={onCancel}
          className='flex items-center px-4 py-2 text-white rounded-md'
          style={{ backgroundColor: UI_COLORS.neutral }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1f2937')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.neutral)}
        >
          Cancel
        </button>
        <button
          type='submit'
          className='flex items-center px-4 py-2 text-white rounded-md'
          style={{ backgroundColor: UI_COLORS.primary }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#005a8a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.primary)}
        >
          {mode === 'create' ? 'Create Diving Center' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default DivingCenterForm;
