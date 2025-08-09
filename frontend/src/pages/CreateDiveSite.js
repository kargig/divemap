import { ArrowLeft, Save, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

import api from '../api';

const CreateDiveSite = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    address: '',
    country: '',
    region: '',
    access_instructions: '',
    difficulty_level: '',
    marine_life: '',
    safety_information: '',
    max_depth: '',
  });

  const createDiveSiteMutation = useMutation(data => api.post('/api/v1/dive-sites/', data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dive-sites']);
      queryClient.invalidateQueries(['dive-sites']);
      toast.success('Dive site created successfully!');
      // Navigate to dive sites list for regular users, admin panel for admins
      const isAdminRoute = window.location.pathname.includes('/admin/');
      navigate(isAdminRoute ? '/admin/dive-sites' : '/dive-sites');
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to create dive site');
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
    const submitData = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
    };

    // Convert max_depth to number if provided, or set to null if empty
    if (formData.max_depth && formData.max_depth.trim() !== '') {
      submitData.max_depth = parseFloat(formData.max_depth);
    } else {
      submitData.max_depth = null;
    }

    createDiveSiteMutation.mutate(submitData);
  };

  const handleCancel = () => {
    // Navigate back to dive sites list for regular users, admin panel for admins
    const isAdminRoute = window.location.pathname.includes('/admin/');
    navigate(isAdminRoute ? '/admin/dive-sites' : '/dive-sites');
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
                name='difficulty_level'
                value={formData.difficulty_level}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>Select difficulty level</option>
                <option value='beginner'>Beginner</option>
                <option value='intermediate'>Intermediate</option>
                <option value='advanced'>Advanced</option>
                <option value='expert'>Expert</option>
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

            <div>
              <label htmlFor='address' className='block text-sm font-medium text-gray-700 mb-2'>
                Address
              </label>
              <input
                id='address'
                type='text'
                name='address'
                value={formData.address}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='Enter address'
              />
            </div>
          </div>

          {/* Location Suggestion Button */}
          <div className='flex justify-center'>
            <button
              type='button'
              onClick={suggestLocation}
              disabled={!formData.latitude || !formData.longitude}
              className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
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
              className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
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
