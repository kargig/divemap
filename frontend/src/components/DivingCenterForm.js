import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { UI_COLORS } from '../utils/colorPalette';
import { commonSchemas, createResolver, getErrorMessage } from '../utils/formHelpers';

import { FormField } from './forms/FormField';

// Zod schema for diving center form
const divingCenterSchema = z.object({
  name: commonSchemas.divingCenterName,
  description: commonSchemas.divingCenterDescription,
  email: z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val.trim() === '') return true; // Empty is valid
        return z.string().email().safeParse(val).success;
      },
      { message: 'Please enter a valid email address' }
    )
    .refine(val => !val || val.length <= 255, {
      message: 'Email must be at most 255 characters',
    })
    .or(z.literal('')),
  phone: commonSchemas.phone,
  website: commonSchemas.url,
  latitude: commonSchemas.latitude,
  longitude: commonSchemas.longitude,
  country: commonSchemas.country,
  region: commonSchemas.region,
  city: commonSchemas.city,
  address: commonSchemas.address,
});

// Helper to normalize form values
const normalizeFormValues = source => ({
  name: source?.name || '',
  description: source?.description || '',
  email: source?.email || '',
  phone: source?.phone || '',
  website: source?.website || '',
  latitude: source?.latitude?.toString?.() || source?.latitude || '',
  longitude: source?.longitude?.toString?.() || source?.longitude || '',
  country: source?.country || '',
  region: source?.region || '',
  city: source?.city || '',
  address: source?.address || '',
});

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
  const isUpdatingFromExternalRef = useRef(false);

  // Determine default values
  const getDefaultValues = () => {
    const source = isControlled ? externalFormData : initialValues;
    return normalizeFormValues(source);
  };

  const methods = useForm({
    resolver: createResolver(divingCenterSchema),
    defaultValues: getDefaultValues(),
    mode: 'onChange',
    reValidateMode: 'onChange', // Re-validate on change even after submission
  });

  const {
    register,
    handleSubmit: handleFormSubmit,
    watch,
    reset,
    formState: { errors },
  } = methods;

  // Track if form has been initialized to prevent unnecessary resets
  const isInitializedRef = useRef(false);
  const initialExternalDataRef = useRef(null);

  // Initialize form with external data on mount (controlled mode)
  useEffect(() => {
    if (isControlled && externalFormData && !isInitializedRef.current) {
      const normalized = normalizeFormValues(externalFormData);
      reset(normalized);
      initialExternalDataRef.current = JSON.stringify(normalized);
      isInitializedRef.current = true;
    }
  }, [isControlled, externalFormData, reset]);

  // Sync form with initialValues when not in controlled mode
  useEffect(() => {
    if (!isControlled && initialValues && !isInitializedRef.current) {
      reset(normalizeFormValues(initialValues));
      isInitializedRef.current = true;
    }
  }, [initialValues, isControlled, reset]);

  // Sync form values back to parent in controlled mode
  // Debounce to avoid triggering parent updates on every keystroke
  const watchedValues = watch();
  useEffect(() => {
    if (
      isControlled &&
      onExternalChange &&
      isInitializedRef.current &&
      !isUpdatingFromExternalRef.current
    ) {
      // Debounce to avoid too frequent updates and prevent feedback loops
      const timeoutId = setTimeout(() => {
        if (!isUpdatingFromExternalRef.current) {
          onExternalChange(watchedValues);
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [watchedValues, isControlled, onExternalChange]);

  const suggestFromCoordinates = async () => {
    const lat = parseFloat(watchedValues.latitude);
    const lng = parseFloat(watchedValues.longitude);

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
      // Update form fields with suggested location
      reset({
        ...watchedValues,
        country: data.country || '',
        region: data.region || '',
        city: data.city || '',
      });
      toast.dismiss();
      toast.success('Location information suggested from coordinates!');
    } catch (error) {
      toast.dismiss();
      toast.error(`Failed to get location: ${error.message}`);
    }
  };

  const onSubmitForm = data => {
    // Transform coordinates from string to float
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    const cleaned = { ...data };
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
    <FormProvider {...methods}>
      <form onSubmit={handleFormSubmit(onSubmitForm)} className='space-y-6'>
        <div className='flex items-center justify-between mb-2'>
          <button
            type='button'
            onClick={onCancel}
            className='flex items-center text-blue-600 hover:text-blue-800 mr-4'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            {mode === 'create' ? 'Back to Diving Centers' : 'Back to Diving Center'}
          </button>
        </div>

        {/* Basic Information */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <FormField name='name' label='Name' required>
              {({ register, name }) => (
                <input
                  id='diving-center-name'
                  type='text'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter diving center name'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='email' label='Email'>
              {({ register, name }) => (
                <input
                  id='diving-center-email'
                  type='email'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter email address'
                />
              )}
            </FormField>
          </div>
        </div>

        <div>
          <FormField name='description' label='Description' required>
            {({ register, name }) => (
              <textarea
                id='diving-center-description'
                {...register(name)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder='Enter diving center description'
              />
            )}
          </FormField>
        </div>

        {/* Contact Information */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <FormField name='phone' label='Phone'>
              {({ register, name }) => (
                <input
                  id='diving-center-phone'
                  type='tel'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter phone number'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='website' label='Website'>
              {({ register, name }) => (
                <input
                  id='diving-center-website'
                  type='url'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.website ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter website URL'
                />
              )}
            </FormField>
          </div>
        </div>

        {/* Location Information */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <div>
            <FormField name='latitude' label='Latitude' required>
              {({ register, name }) => (
                <input
                  id='diving-center-latitude'
                  type='number'
                  step='any'
                  {...register(name, {
                    valueAsNumber: false, // Keep as string for preprocess
                  })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.latitude ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='e.g., -16.92'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='longitude' label='Longitude' required>
              {({ register, name }) => (
                <input
                  id='diving-center-longitude'
                  type='number'
                  step='any'
                  {...register(name, {
                    valueAsNumber: false, // Keep as string for preprocess
                  })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.longitude ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='e.g., 145.77'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='address' label='Address'>
              {({ register, name }) => (
                <input
                  id='diving-center-address'
                  type='text'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='Enter address'
                />
              )}
            </FormField>
          </div>
        </div>

        {/* Suggest Location Button */}
        <div className='flex justify-center'>
          <button
            type='button'
            onClick={suggestFromCoordinates}
            disabled={!watchedValues.latitude || !watchedValues.longitude}
            className='px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors'
            style={{ backgroundColor: UI_COLORS.success }}
            onMouseEnter={e =>
              !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')
            }
            onMouseLeave={e =>
              !e.currentTarget.disabled &&
              (e.currentTarget.style.backgroundColor = UI_COLORS.success)
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
            <FormField name='country' label='Country'>
              {({ register, name }) => (
                <input
                  id='diving-center-country'
                  type='text'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.country ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='e.g., Greece'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='region' label='Region'>
              {({ register, name }) => (
                <input
                  id='diving-center-region'
                  type='text'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.region ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='e.g., South Aegean'
                />
              )}
            </FormField>
          </div>

          <div>
            <FormField name='city' label='City'>
              {({ register, name }) => (
                <input
                  id='diving-center-city'
                  type='text'
                  {...register(name)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.city ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder='e.g., Kos'
                />
              )}
            </FormField>
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
    </FormProvider>
  );
};

export default DivingCenterForm;
