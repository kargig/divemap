import { ArrowLeft, Save, X } from 'lucide-react';
import { UI_COLORS } from '../utils/colorPalette';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api, { extractErrorMessage } from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getDifficultyOptions } from '../utils/difficultyHelpers';

const CreateDiveSite = () => {
  // Set page title
  usePageTitle('Divemap - Create Dive Site');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
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
  });

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

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = e => {
    e.preventDefault();

    // Validate required fields
    if (!formData.latitude || formData.latitude.trim() === '') {
      toast.error('Latitude is required');
      return;
    }
    if (!formData.longitude || formData.longitude.trim() === '') {
      toast.error('Longitude is required');
      return;
    }

    // Convert latitude/longitude to numbers
    // Start with formData but exclude shore_direction fields (we'll add them conditionally)
    const { shore_direction, shore_direction_confidence, shore_direction_method, shore_direction_distance_m, ...baseData } = formData;
    const submitData = {
      ...baseData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
    };

    // Convert max_depth to number if provided, or set to null if empty
    if (formData.max_depth && formData.max_depth.trim() !== '') {
      submitData.max_depth = parseFloat(formData.max_depth);
    } else {
      submitData.max_depth = null;
    }

    // Convert difficulty_code: empty string becomes null, otherwise keep the code
    if (formData.difficulty_code && formData.difficulty_code.trim() !== '') {
      submitData.difficulty_code = formData.difficulty_code;
    } else {
      submitData.difficulty_code = null;
    }

    // Handle shore_direction: only include if provided, otherwise omit from create
    // This allows creating without shore_direction (backend will auto-detect if coordinates are provided)
    if (formData.shore_direction && formData.shore_direction.trim() !== '') {
      submitData.shore_direction = parseFloat(formData.shore_direction);
      
      // Include other shore_direction fields if shore_direction is set
      if (formData.shore_direction_confidence && formData.shore_direction_confidence.trim() !== '') {
        submitData.shore_direction_confidence = formData.shore_direction_confidence;
      } else {
        submitData.shore_direction_confidence = null;
      }
      if (formData.shore_direction_method && formData.shore_direction_method.trim() !== '') {
        submitData.shore_direction_method = formData.shore_direction_method;
      } else {
        submitData.shore_direction_method = null;
      }
      if (formData.shore_direction_distance_m && formData.shore_direction_distance_m.trim() !== '') {
        submitData.shore_direction_distance_m = parseFloat(formData.shore_direction_distance_m);
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
    if (!formData.latitude || !formData.longitude) {
      toast.error('Please enter latitude and longitude first');
      return;
    }

    try {
      const response = await api.get('/api/v1/dive-sites/reverse-geocode', {
        params: {
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
        },
        timeout: 30000, // 30 second timeout
      });

      const { country, region } = response.data;

      setFormData(prev => ({
        ...prev,
        country: country || '',
        region: region || '',
      }));

      if (country || region) {
        toast.success('Location suggestions applied!');
      } else {
        toast.info('No location data found for these coordinates');
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
      toast.info('Shore direction will be auto-detected when you create the dive site. You can also enter it manually.');
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

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Basic Information */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label
                htmlFor='dive-site-name'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Name *
              </label>
              <input
                id='dive-site-name'
                type='text'
                name='name'
                value={formData.name}
                onChange={handleInputChange}
                required
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='Enter dive site name'
              />
            </div>

            <div>
              <label
                htmlFor='difficulty-level'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Difficulty Level
              </label>
              <select
                id='difficulty-level'
                name='difficulty_code'
                value={formData.difficulty_code || ''}
                onChange={handleInputChange}
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
            </div>
          </div>

          <div>
            <label
              htmlFor='dive-site-description'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Description
            </label>
            <textarea
              id='dive-site-description'
              name='description'
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Enter dive site description'
            />
          </div>

          {/* Location Information */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <div>
              <label htmlFor='latitude' className='block text-sm font-medium text-gray-700 mb-2'>
                Latitude *
              </label>
              <input
                id='latitude'
                type='number'
                step='any'
                name='latitude'
                value={formData.latitude}
                onChange={handleInputChange}
                required
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., -16.5'
              />
            </div>

            <div>
              <label htmlFor='longitude' className='block text-sm font-medium text-gray-700 mb-2'>
                Longitude *
              </label>
              <input
                id='longitude'
                type='number'
                step='any'
                name='longitude'
                value={formData.longitude}
                onChange={handleInputChange}
                required
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., 145.67'
              />
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
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#007a5c')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
            >
              🗺️ Suggest Country & Region from Coordinates
            </button>
          </div>

          {/* Country and Region Information */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label htmlFor='country' className='block text-sm font-medium text-gray-700 mb-2'>
                Country
              </label>
              <input
                id='country'
                type='text'
                name='country'
                value={formData.country}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., Australia'
              />
            </div>

            <div>
              <label htmlFor='region' className='block text-sm font-medium text-gray-700 mb-2'>
                Region
              </label>
              <input
                id='region'
                type='text'
                name='region'
                value={formData.region}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., Queensland'
              />
            </div>
          </div>

          {/* Shore Direction Information */}
          <div>
            <label htmlFor='shore_direction' className='block text-sm font-medium text-gray-700 mb-2'>
              Shore Direction (degrees)
            </label>
            <input
              id='shore_direction'
              type='number'
              step='0.01'
              min='0'
              max='360'
              name='shore_direction'
              value={formData.shore_direction}
              onChange={handleInputChange}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Auto-detected from coordinates (or enter manually)'
            />
            <p className='mt-1 text-xs text-gray-500'>
              Shore direction in degrees (0-360). 0° = North, 90° = East, 180° = South, 270° = West.
              If left empty, shore direction will be auto-detected from coordinates when the dive site is created.
            </p>
          </div>

          {/* Dive Information */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'></div>

          <div>
            <label htmlFor='max-depth' className='block text-sm font-medium text-gray-700 mb-2'>
              Maximum Depth (meters)
            </label>
            <input
              id='max-depth'
              type='number'
              min='0'
              max='1000'
              step='any'
              name='max_depth'
              value={formData.max_depth}
              onChange={handleInputChange}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='e.g., 25.5'
            />
          </div>

          <div>
            <label
              htmlFor='access-instructions'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Access Instructions
            </label>
            <textarea
              id='access-instructions'
              name='access_instructions'
              value={formData.access_instructions}
              onChange={handleInputChange}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='How to access this dive site'
            />
          </div>

          <div>
            <label htmlFor='marine-life' className='block text-sm font-medium text-gray-700 mb-2'>
              Marine Life
            </label>
            <textarea
              id='marine-life'
              name='marine_life'
              value={formData.marine_life}
              onChange={handleInputChange}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Marine life commonly found at this site'
            />
          </div>

          <div>
            <label
              htmlFor='safety-information'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Safety Information
            </label>
            <textarea
              id='safety-information'
              name='safety_information'
              value={formData.safety_information}
              onChange={handleInputChange}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              placeholder='Important safety considerations'
            />
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
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#005a8a')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = UI_COLORS.primary)}
            >
              <Save className='h-4 w-4 mr-2' />
              {createDiveSiteMutation.isLoading ? 'Creating...' : 'Create Dive Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDiveSite;
