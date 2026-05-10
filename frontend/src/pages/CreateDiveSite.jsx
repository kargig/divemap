import { Collapse, Image as AntdImage } from 'antd';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import api from '../api';
import { FormField } from '../components/forms/FormField';
import Button from '../components/ui/Button';
import MarkdownEditor from '../components/ui/MarkdownEditor';
import Modal from '../components/ui/Modal';
import UploadPhotosComponent from '../components/UploadPhotosComponent';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import { addDiveSiteMedia, uploadDiveSitePhotoToR2Only } from '../services/diveSites';
import { extractErrorMessage } from '../utils/apiErrors';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import {
  commonSchemas,
  diveSiteSchema,
  createResolver,
  getErrorMessage,
} from '../utils/formHelpers';
import { isYouTubeUrl } from '../utils/youtubeHelpers';

const CreateDiveSite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Pre-fill latitude and longitude from query parameters (e.g. from Garmin FIT import)
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat) setValue('latitude', lat, { shouldValidate: true });
    if (lng) setValue('longitude', lng, { shouldValidate: true });
  }, [searchParams, setValue]);

  // Photo upload state
  const [photoMediaUrls, setPhotoMediaUrls] = useState([]);
  const unsavedR2PhotosRef = useRef([]);
  // Media handling state
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('photo');
  const [newMediaDescription, setNewMediaDescription] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]); // Media URLs to be saved on form submission
  const [addLinksCollapseOpen, setAddLinksCollapseOpen] = useState(false); // Control Add External Links collapse
  const [mediaDescriptions, setMediaDescriptions] = useState({}); // Track media descriptions
  // Store converted Flickr URLs (Map: original URL -> direct image URL)
  const [convertedFlickrUrls, setConvertedFlickrUrls] = useState(() => new Map());

  // Proximity check and moderation state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [nearbySites, setNearbySites] = useState([]);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  // Background proximity check
  const { data: backgroundNearbySites } = useQuery(
    ['check-proximity', formData.latitude, formData.longitude],
    async () => {
      if (!formData.latitude || !formData.longitude) return [];
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      if (isNaN(lat) || isNaN(lng)) return [];
      const res = await api.get('/api/v1/dive-sites/check-proximity', {
        params: { lat, lng, radius_m: 50 },
      });
      return res.data;
    },
    {
      enabled: !!formData.latitude && !!formData.longitude,
      staleTime: 30000,
    }
  );

  // Automatic Location and Shore Detection
  useEffect(() => {
    if (!formData.latitude || !formData.longitude) return;

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const timer = setTimeout(() => {
      // Only suggest if fields are empty
      if (!formData.country || !formData.region) {
        suggestLocation();
      }
      // Only detect if shore direction is not manually set
      if (!formData.shore_direction) {
        detectShoreDirection();
      }
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.latitude, formData.longitude]);

  const createDiveSiteMutation = useMutation(
    async data => {
      const response = await api.post('/api/v1/dive-sites/', data);
      return response.data;
    },
    {
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
        if (error.response?.status === 409 && error.response?.data?.detail?.nearby_sites) {
          setNearbySites(error.response.data.detail.nearby_sites);
          setShowDuplicateModal(true);
        } else {
          toast.error(extractErrorMessage(error) || 'Failed to create dive site');
        }
      },
    }
  );

  const handleForceSubmit = () => {
    if (pendingSubmitData) {
      setShowDuplicateModal(false);
      onSubmit(pendingSubmitData, { moderation_needed: true });
    }
  };

  const handleCreateRoute = siteId => {
    window.sessionStorage.setItem('pendingDiveRouteDescription', formData.description || '');
    navigate(`/dive-sites/${siteId}/routes/create`);
  };

  const onSubmit = async (data, options = {}) => {
    // Save raw data to state in case we need to force submit
    if (!options.moderation_needed) {
      setPendingSubmitData(data);
    }

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

    // Add moderation flag if requested
    if (options.moderation_needed) {
      submitData.moderation_needed = true;
    }

    try {
      // First create the dive site to get the ID
      const createdDiveSite = await createDiveSiteMutation.mutateAsync(submitData);

      const mediaPromises = [];
      const unsavedR2Photos = unsavedR2PhotosRef.current;

      // Upload photos to R2 and create database records for them
      for (const unsavedPhoto of unsavedR2Photos) {
        if (unsavedPhoto.originFileObj) {
          // This is a photo from create flow - upload to R2 first
          try {
            const r2UploadResult = await uploadDiveSitePhotoToR2Only(
              createdDiveSite.id,
              unsavedPhoto.originFileObj
            );

            // Create database record
            const mediaData = {
              media_type: 'photo',
              url: r2UploadResult.r2_path, // Use R2 path for storage
              description: unsavedPhoto.description || '',
            };

            mediaPromises.push(
              addDiveSiteMedia(createdDiveSite.id, mediaData).catch(error => {
                console.error('Failed to save photo to database:', error);
                toast.error(`Failed to save photo ${unsavedPhoto.file_name} to database`);
              })
            );
          } catch (error) {
            console.error('Failed to upload photo to R2:', error);
            toast.error(`Failed to upload photo ${unsavedPhoto.file_name} to R2`);
          }
        }
      }

      // Save pending media to database
      for (const pendingItem of pendingMedia) {
        const mediaData = {
          media_type: pendingItem.type,
          url: pendingItem.url,
          description: mediaDescriptions[pendingItem.id] || pendingItem.description || '',
        };
        mediaPromises.push(
          addDiveSiteMedia(createdDiveSite.id, mediaData).catch(error => {
            console.error(`Failed to save media ${pendingItem.url}:`, error);
            toast.error(`Failed to save media: ${pendingItem.url}`);
          })
        );
      }

      // Wait for all media uploads to complete
      if (mediaPromises.length > 0) {
        await Promise.all(mediaPromises);
        toast.success('Dive site created successfully with media!');
      } else {
        toast.success('Dive site created successfully!');
      }

      queryClient.invalidateQueries(['admin-dive-sites']);
      queryClient.invalidateQueries(['dive-sites']);

      // Navigate based on user role
      if (user?.is_admin) {
        navigate('/admin/dive-sites');
      } else {
        navigate('/dive-sites');
      }
    } catch (error) {
      // Error handling is done in mutation onError callback
    }
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

  // Convert Flickr URLs to direct image URLs for pending media
  useEffect(() => {
    const convertFlickrUrls = async () => {
      if (!pendingMedia || pendingMedia.length === 0) return;

      const photos = pendingMedia.filter(item => item.type === 'photo');
      const flickrPhotos = photos.filter(item => isFlickrUrl(item.url));

      if (flickrPhotos.length === 0) return;

      const newConvertedUrls = new Map(convertedFlickrUrls);
      let hasUpdates = false;

      for (const photo of flickrPhotos) {
        // Skip if already converted
        if (newConvertedUrls.has(photo.url)) continue;

        try {
          const directUrl = await convertFlickrUrlToDirectImage(photo.url);
          if (directUrl !== photo.url) {
            newConvertedUrls.set(photo.url, directUrl);
            hasUpdates = true;
          }
        } catch (error) {
          console.warn('Failed to convert Flickr URL:', photo.url, error);
        }
      }

      if (hasUpdates) {
        setConvertedFlickrUrls(newConvertedUrls);
      }
    };

    convertFlickrUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMedia]);

  // Helper to get the URL (converted if Flickr, original otherwise)
  const getImageUrl = url => {
    return convertedFlickrUrls.get(url) || url;
  };

  // Media handling functions
  const handleUrlAdd = e => {
    e?.preventDefault();
    if (!newMediaUrl.trim()) {
      toast.error('Please enter a media URL');
      return;
    }
    // Add to pending media state (will be saved on form submission)
    const tempId = `pending-${Date.now()}-${Math.random()}`;
    setPendingMedia(prev => [
      ...prev,
      {
        id: tempId,
        url: newMediaUrl.trim(),
        description: newMediaDescription.trim() || '',
        type: newMediaType,
        isPending: true, // Flag to identify pending media
      },
    ]);
    // Initialize description in mediaDescriptions
    setMediaDescriptions(prev => ({
      ...prev,
      [tempId]: newMediaDescription.trim() || '',
    }));
    // Reset form
    setNewMediaUrl('');
    setNewMediaType('photo');
    setNewMediaDescription('');
    toast.success('Media added (will be saved on form submission)');
  };

  const handleMediaRemove = mediaItem => {
    // Check if it's pending media (not yet saved to DB)
    if (mediaItem.id && mediaItem.id.toString().startsWith('pending-')) {
      // Remove from pending media state
      setPendingMedia(prev => prev.filter(item => item.id !== mediaItem.id));
      // Remove description from state
      setMediaDescriptions(prev => {
        const newDescriptions = { ...prev };
        delete newDescriptions[mediaItem.id];
        return newDescriptions;
      });
      toast.success('Media removed');
    }
  };

  return (
    <>
      <SEO 
        title='Submit a New Dive Site | Divemap'
        description='Add a new scuba dive site to the Divemap global registry. Provide GPS coordinates, depth profiles, marine life details, and safety information.'
      />
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
              <Controller
                name='description'
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <MarkdownEditor
                    label='Description'
                    value={field.value}
                    onChange={field.onChange}
                    error={error?.message}
                    placeholder='Enter dive site description'
                  />
                )}
              />
            </div>

            {/* Location Information */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div>
                <FormField name='latitude' label='Latitude' required>
                  {({ register, name }) => (
                    <input
                      id='latitude'
                      type='text'
                      inputMode='decimal'
                      {...register(name, {
                        onChange: e => {
                          const value = e.target.value;
                          if (value.includes(',')) {
                            const [lat, lng] = value.split(',').map(s => s.trim());
                            if (lat && !isNaN(parseFloat(lat)) && lng && !isNaN(parseFloat(lng))) {
                              setValue('latitude', lat);
                              setValue('longitude', lng);
                              // Trigger re-validation for both fields
                              trigger(['latitude', 'longitude']);
                            }
                          }
                        },
                      })}
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
                      type='text'
                      inputMode='decimal'
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

            {/* Background Proximity Hint */}
            {backgroundNearbySites && backgroundNearbySites.length > 0 && !showDuplicateModal && (
              <div className='bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='h-5 w-5 text-yellow-400'
                      viewBox='0 0 20 20'
                      fill='currentColor'
                    >
                      <path
                        fillRule='evenodd'
                        d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <p className='text-sm text-yellow-700'>
                      <strong className='font-medium text-yellow-800'>Did you know?</strong> There
                      are already dive sites right here:
                      <ul className='list-disc pl-5 mt-1'>
                        {backgroundNearbySites.map(site => (
                          <li key={site.id}>
                            {site.name} ({site.distance_m}m away)
                          </li>
                        ))}
                      </ul>
                      <span className='block mt-2 font-medium'>
                        Consider adding a new Dive Route to an existing site instead.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Location Suggestion Button */}
            <div className='flex justify-end'>
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
              <Controller
                name='access_instructions'
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <MarkdownEditor
                    label='Access Instructions'
                    value={field.value}
                    onChange={field.onChange}
                    error={error?.message}
                    placeholder='How to access this dive site'
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name='marine_life'
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <MarkdownEditor
                    label='Marine Life'
                    value={field.value}
                    onChange={field.onChange}
                    error={error?.message}
                    placeholder='Marine life commonly found at this site'
                  />
                )}
              />
            </div>

            <div>
              <Controller
                name='safety_information'
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <MarkdownEditor
                    label='Safety Information'
                    value={field.value}
                    onChange={field.onChange}
                    error={error?.message}
                    placeholder='Important safety considerations'
                  />
                )}
              />
            </div>

            {/* Media */}
            <div>
              <h2 className='text-xl font-semibold mb-4'>Media</h2>
              <div className='space-y-4'>
                {/* Photo Upload */}
                <UploadPhotosComponent
                  mediaUrls={photoMediaUrls}
                  setMediaUrls={setPhotoMediaUrls}
                  onUnsavedPhotosChange={unsavedPhotos => {
                    unsavedR2PhotosRef.current = unsavedPhotos;
                  }}
                />

                {/* Add External Links */}
                <div className='mb-3'>
                  <Collapse
                    activeKey={addLinksCollapseOpen ? ['1'] : []}
                    onChange={keys => setAddLinksCollapseOpen(keys.includes('1'))}
                    items={[
                      {
                        key: '1',
                        label: 'Add External Links (Photo / Video)',
                        children: (
                          <div className='space-y-4'>
                            {/* Form for adding media */}
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                              <div>
                                <label
                                  htmlFor='media_type'
                                  className='block text-sm font-medium text-gray-700 mb-1'
                                >
                                  Media Type
                                </label>
                                <select
                                  id='media_type'
                                  value={newMediaType}
                                  onChange={e => setNewMediaType(e.target.value)}
                                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                >
                                  <option value='photo'>Photo</option>
                                  <option value='video'>Video</option>
                                </select>
                              </div>
                              <div className='md:col-span-2'>
                                <label
                                  htmlFor='media_url'
                                  className='block text-sm font-medium text-gray-700 mb-1'
                                >
                                  URL
                                </label>
                                <input
                                  id='media_url'
                                  type='url'
                                  value={newMediaUrl}
                                  onChange={e => setNewMediaUrl(e.target.value)}
                                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                                  placeholder='https://example.com/image.jpg'
                                />
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor='media_description'
                                className='block text-sm font-medium text-gray-700 mb-1'
                              >
                                Description
                              </label>
                              <input
                                id='media_description'
                                type='text'
                                value={newMediaDescription}
                                onChange={e => setNewMediaDescription(e.target.value)}
                                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                              />
                            </div>
                            <div className='flex space-x-2'>
                              <button
                                type='button'
                                onClick={handleUrlAdd}
                                className='px-4 py-2 text-white rounded-md'
                                style={{ backgroundColor: UI_COLORS.success, color: 'white' }}
                                onMouseEnter={e =>
                                  (e.currentTarget.style.backgroundColor = '#007a5c')
                                }
                                onMouseLeave={e =>
                                  (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                                }
                              >
                                Add Media
                              </button>
                              <button
                                type='button'
                                onClick={() => {
                                  setNewMediaUrl('');
                                  setNewMediaDescription('');
                                  setNewMediaType('photo');
                                }}
                                className='px-4 py-2 text-white rounded-md'
                                style={{ backgroundColor: UI_COLORS.neutral, color: 'white' }}
                                onMouseEnter={e =>
                                  (e.currentTarget.style.backgroundColor = '#1f2937')
                                }
                                onMouseLeave={e =>
                                  (e.currentTarget.style.backgroundColor = UI_COLORS.neutral)
                                }
                              >
                                Clear
                              </button>
                            </div>

                            {/* Show pending media */}
                            {pendingMedia.length > 0 && (
                              <div className='mt-4 pt-4 border-t border-gray-200'>
                                <h4 className='text-sm font-medium text-gray-700 mb-3'>
                                  Pending Media
                                </h4>
                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                  {pendingMedia.map(item => (
                                    <div
                                      key={item.id}
                                      className='border rounded-lg p-4 border-yellow-400 bg-yellow-50'
                                    >
                                      <div className='flex items-center justify-between mb-2'>
                                        <span className='text-sm font-medium text-gray-700 capitalize'>
                                          {item.type}{' '}
                                          <span className='text-xs text-yellow-700'>(Pending)</span>
                                        </span>
                                        <button
                                          onClick={() => handleMediaRemove(item)}
                                          className='text-red-600 hover:text-red-800'
                                          title='Remove media'
                                        >
                                          <X size={16} />
                                        </button>
                                      </div>
                                      <div className='space-y-2'>
                                        {item.type === 'photo' ? (
                                          <AntdImage
                                            src={getImageUrl(item.url)}
                                            alt={item.description || 'Media'}
                                            className='w-full'
                                            preview={{
                                              mask: 'Preview',
                                            }}
                                          />
                                        ) : (
                                          <YouTubePreview
                                            url={item.url}
                                            description={item.description}
                                            className='w-full'
                                            openInNewTab={true}
                                          />
                                        )}
                                        {(isFlickrUrl(item.url) || isYouTubeUrl(item.url)) && (
                                          <div
                                            className='text-xs text-gray-500 truncate mt-1 px-1'
                                            title={item.url}
                                          >
                                            <a
                                              href={item.url}
                                              target='_blank'
                                              rel='noopener noreferrer'
                                              className='hover:text-blue-600 transition-colors'
                                              onClick={e => e.stopPropagation()}
                                            >
                                              {item.url}
                                            </a>
                                          </div>
                                        )}
                                        <input
                                          type='text'
                                          value={mediaDescriptions[item.id] || ''}
                                          onChange={e => {
                                            setMediaDescriptions(prev => ({
                                              ...prev,
                                              [item.id]: e.target.value,
                                            }));
                                          }}
                                          placeholder='Add description...'
                                          className='w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </div>
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

      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title='Duplicate Dive Site Detected'
        size='lg'
      >
        <div className='space-y-4 text-gray-700'>
          <p className='text-base text-gray-900 font-medium'>
            This location is extremely close to existing dive sites.
          </p>
          <p className='text-sm'>
            Did you intend to submit one of these existing dive sites? If so, you might want to
            create a new Dive Route for it instead.
          </p>

          <div className='mt-4 bg-gray-50 p-4 rounded-md border border-gray-200 max-h-60 overflow-y-auto'>
            {nearbySites.map(site => (
              <div
                key={site.id}
                className='mb-4 pb-4 border-b border-gray-200 last:mb-0 last:pb-0 last:border-0 flex justify-between items-center'
              >
                <div>
                  <h3 className='font-semibold text-gray-900'>{site.name}</h3>
                  <p className='text-sm text-gray-500'>{site.distance_m}m away</p>
                </div>
                <Button
                  type='button'
                  variant='primary'
                  size='sm'
                  onClick={() => handleCreateRoute(site.id)}
                >
                  Create Route Here
                </Button>
              </div>
            ))}
          </div>

          <div className='flex flex-col space-y-3 mt-6 pt-4 border-t border-gray-200'>
            <div className='flex justify-end space-x-3'>
              <Button type='button' variant='secondary' onClick={() => setShowDuplicateModal(false)}>
                Cancel & Discard
              </Button>
            </div>

            <div className='mt-4 pt-4 border-t border-gray-100 flex justify-center'>
              <button
                type='button'
                onClick={handleForceSubmit}
                className='text-xs text-red-600 hover:text-red-800 underline transition-colors'
              >
                I'm sure this is a distinct site. Submit for review.
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
    </>
  );
};

export default CreateDiveSite;
