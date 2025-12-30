import { ArrowLeft, Save, X } from 'lucide-react';
import { useForm, FormProvider } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import api, { extractErrorMessage } from '../api';
import { FormField } from '../components/forms/FormField';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import {
  commonSchemas,
  diveSiteSchema,
  createResolver,
  getErrorMessage,
} from '../utils/formHelpers';

const CreateDiveSite = () => {
  // Set page title
  usePageTitle('Divemap - Create Dive Site');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const methods = useForm({
    resolver: createResolver(diveSiteSchema),
    mode: 'onChange', // Validate on change to clear errors immediately
    defaultValues: {
      name: '',
      description: '',
      latitude: '',
      longitude: '',
      country: '',
      region: '',
      access_instructions: '',
      difficulty_code: '',
      marine_life: '',
      safety_information: '',
      max_depth: '',
      shore_direction: '',
      shore_direction_confidence: '',
      shore_direction_method: '',
      shore_direction_distance_m: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = methods;

  const formData = watch();

  const createDiveSiteMutation = useMutation(data => api.post('/api/v1/dive-sites/', data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dive-sites']);
      queryClient.invalidateQueries(['dive-sites']);
      toast.success('Dive site created successfully!');

      // Navigate based on user role
      if (user?.is_admin) {
        navigate('/admin/dive-sites');
      } else {
        navigate('/dive-sites');
      }
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to create dive site');
    },
  });

  const onSubmit = data => {
    // Convert latitude/longitude to numbers
    const {
      shore_direction,
      shore_direction_confidence,
      shore_direction_method,
      shore_direction_distance_m,
      ...baseData
    } = data;
    const submitData = {
      ...baseData,
      latitude: typeof data.latitude === 'string' ? parseFloat(data.latitude) : data.latitude,
      longitude: typeof data.longitude === 'string' ? parseFloat(data.longitude) : data.longitude,
    };

    // Convert max_depth to number if provided, or set to null if empty
    if (
      data.max_depth &&
      (typeof data.max_depth === 'string' ? data.max_depth.trim() !== '' : true)
    ) {
      submitData.max_depth =
        typeof data.max_depth === 'string' ? parseFloat(data.max_depth) : data.max_depth;
    } else {
      submitData.max_depth = null;
    }

    // Convert difficulty_code: null or empty string becomes null, otherwise keep the code
    // Note: Schema already transforms empty strings to null, but we handle both cases for safety
    if (data.difficulty_code && data.difficulty_code !== null && data.difficulty_code !== '') {
      submitData.difficulty_code = data.difficulty_code;
    } else {
      submitData.difficulty_code = null;
    }

    // Handle shore_direction: only include if provided, otherwise omit from create
    // This allows creating without shore_direction (backend will auto-detect if coordinates are provided)
    if (
      data.shore_direction &&
      (typeof data.shore_direction === 'string' ? data.shore_direction.trim() !== '' : true)
    ) {
      submitData.shore_direction =
        typeof data.shore_direction === 'string'
          ? parseFloat(data.shore_direction)
          : data.shore_direction;

      // Include other shore_direction fields if shore_direction is set
      if (data.shore_direction_confidence && data.shore_direction_confidence.trim() !== '') {
        submitData.shore_direction_confidence = data.shore_direction_confidence;
      } else {
        submitData.shore_direction_confidence = null;
      }
      if (data.shore_direction_method && data.shore_direction_method.trim() !== '') {
        submitData.shore_direction_method = data.shore_direction_method;
      } else {
        submitData.shore_direction_method = null;
      }
      if (
        data.shore_direction_distance_m &&
        (typeof data.shore_direction_distance_m === 'string'
          ? data.shore_direction_distance_m.trim() !== ''
          : true)
      ) {
        submitData.shore_direction_distance_m =
          typeof data.shore_direction_distance_m === 'string'
            ? parseFloat(data.shore_direction_distance_m)
            : data.shore_direction_distance_m;
      } else {
        submitData.shore_direction_distance_m = null;
      }
    }
    // If shore_direction is empty, omit all shore_direction fields from create
    // This allows the backend to auto-detect if coordinates are provided

    createDiveSiteMutation.mutate(submitData);
  };

  const handleCancel = () => {
    // Navigate based on user role
    if (user?.is_admin) {
      navigate('/admin/dive-sites');
    } else {
      navigate('/dive-sites');
    }
  };

  const suggestLocation = async () => {
    const lat = formData.latitude;
    const lng = formData.longitude;
    if (!lat || !lng) {
      toast.error('Please enter latitude and longitude first');
      return;
    }

    try {
      const response = await api.get('/api/v1/dive-sites/reverse-geocode', {
        params: {
          latitude: typeof lat === 'string' ? parseFloat(lat) : lat,
          longitude: typeof lng === 'string' ? parseFloat(lng) : lng,
        },
        timeout: 30000, // 30 second timeout
      });

      const { country, region } = response.data;

      setValue('country', country || '');
      setValue('region', region || '');

      if (country || region) {
        toast.success('Location suggestions applied!');
      } else {
        toast('No location data found for these coordinates');
      }
    } catch (error) {
      let errorMessage = 'Failed to get location suggestions';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const detectShoreDirection = async () => {
    if (!formData.latitude || !formData.longitude) {
      toast.error('Please enter latitude and longitude first');
      return;
    }

    try {
      // First create the dive site (temporarily) or use a different approach
      // Since we don't have a dive site ID yet, we need to call the detection service directly
      // However, the API endpoint requires a dive site ID, so we'll need to handle this differently
      // For now, we'll create the dive site first, then detect shore direction
      // But that's not ideal. Let's check if there's a way to detect without a dive site ID

      // Actually, looking at the backend, the detect endpoint requires a dive site ID
      // So for create flow, we'll just let the backend auto-detect on creation
      // But we can still allow manual entry
      toast(
        'Shore direction will be auto-detected when you create the dive site. You can also enter it manually.'
      );
    } catch (error) {
      let errorMessage = 'Failed to detect shore direction';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='flex items-center mb-6'>
        <button
          onClick={handleCancel}
          className='flex items-center text-gray-600 hover:text-gray-800 mr-4'
        >
          <ArrowLeft className='h-4 w-4 mr-1' />
          Back to Dive Sites
        </button>
      </div>

      <div className='bg-white rounded-lg shadow-md p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>Create New Dive Site</h1>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
            {/* Basic Information */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <FormField name='name' label='Name' required>
                  {({ register, name }) => (
                    <input
                      id='dive-site-name'
                      type='text'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='Enter dive site name'
                    />
                  )}
                </FormField>
              </div>

              <div>
                <FormField name='difficulty_code' label='Difficulty Level'>
                  {({ register, name }) => (
                    <select
                      id='difficulty-level'
                      {...register(name)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    >
                      {getDifficultyOptions().map(option => (
                        <option
                          key={option.value === null ? 'null' : option.value}
                          value={option.value === null ? '' : option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              </div>
            </div>

            <div>
              <FormField name='description' label='Description'>
                {({ register, name }) => (
                  <textarea
                    id='dive-site-description'
                    {...register(name)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='Enter dive site description'
                  />
                )}
              </FormField>
            </div>

            {/* Location Information */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div>
                <FormField name='latitude' label='Latitude' required>
                  {({ register, name }) => (
                    <input
                      id='latitude'
                      type='number'
                      step='any'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.latitude ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='e.g., -16.5'
                    />
                  )}
                </FormField>
              </div>

              <div>
                <FormField name='longitude' label='Longitude' required>
                  {({ register, name }) => (
                    <input
                      id='longitude'
                      type='number'
                      step='any'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.longitude ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='e.g., 145.67'
                    />
                  )}
                </FormField>
              </div>
            </div>

            {/* Location Suggestion Button */}
            <div className='flex justify-center'>
              <button
                type='button'
                onClick={suggestLocation}
                disabled={!formData.latitude || !formData.longitude}
                className='px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
                style={{ backgroundColor: UI_COLORS.success }}
                onMouseEnter={e =>
                  !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')
                }
                onMouseLeave={e =>
                  !e.currentTarget.disabled &&
                  (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                }
              >
                🗺️ Suggest Country & Region from Coordinates
              </button>
            </div>

            {/* Country and Region Information */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <FormField name='country' label='Country'>
                  {({ register, name }) => (
                    <input
                      id='country'
                      type='text'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.country ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='e.g., Australia'
                    />
                  )}
                </FormField>
              </div>

              <div>
                <FormField name='region' label='Region'>
                  {({ register, name }) => (
                    <input
                      id='region'
                      type='text'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.region ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='e.g., Queensland'
                    />
                  )}
                </FormField>
              </div>
            </div>

            {/* Shore Direction Information */}
            <div>
              <FormField name='shore_direction' label='Shore Direction (degrees)'>
                {({ register, name }) => (
                  <>
                    <input
                      id='shore_direction'
                      type='number'
                      step='0.01'
                      min='0'
                      max='360'
                      {...register(name)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.shore_direction ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder='Auto-detected from coordinates (or enter manually)'
                    />
                    <p className='mt-1 text-xs text-gray-500'>
                      Shore direction in degrees (0-360). 0° = North, 90° = East, 180° = South, 270°
                      = West. If left empty, shore direction will be auto-detected from coordinates
                      when the dive site is created.
                    </p>
                  </>
                )}
              </FormField>
            </div>

            {/* Dive Information */}
            <div>
              <FormField name='max_depth' label='Maximum Depth (meters)'>
                {({ register, name }) => (
                  <input
                    id='max-depth'
                    type='number'
                    min='0'
                    max='1000'
                    step='any'
                    {...register(name)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.max_depth ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='e.g., 25.5'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='access_instructions' label='Access Instructions'>
                {({ register, name }) => (
                  <textarea
                    id='access-instructions'
                    {...register(name)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.access_instructions ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='How to access this dive site'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='marine_life' label='Marine Life'>
                {({ register, name }) => (
                  <textarea
                    id='marine-life'
                    {...register(name)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.marine_life ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='Marine life commonly found at this site'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='safety_information' label='Safety Information'>
                {({ register, name }) => (
                  <textarea
                    id='safety-information'
                    {...register(name)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.safety_information ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder='Important safety considerations'
                  />
                )}
              </FormField>
            </div>

            {/* Form Actions */}
            <div className='flex justify-end space-x-4 pt-6 border-t'>
              <button
                type='button'
                onClick={handleCancel}
                className='flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200'
              >
                <X className='h-4 w-4 mr-2' />
                Cancel
              </button>
              <button
                type='submit'
                disabled={createDiveSiteMutation.isLoading}
                className='flex items-center px-4 py-2 text-white rounded-md disabled:opacity-50'
                style={{ backgroundColor: UI_COLORS.primary }}
                onMouseEnter={e =>
                  !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#005a8a')
                }
                onMouseLeave={e =>
                  !e.currentTarget.disabled &&
                  (e.currentTarget.style.backgroundColor = UI_COLORS.primary)
                }
              >
                <Save className='h-4 w-4 mr-2' />
                {createDiveSiteMutation.isLoading ? 'Creating...' : 'Create Dive Site'}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

export default CreateDiveSite;
