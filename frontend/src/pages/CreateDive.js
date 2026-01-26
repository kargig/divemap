import { Collapse, Image as AntdImage } from 'antd';
import { Save, ArrowLeft, Plus, X, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import { getAvailableTags } from '../api';
import DivingCenterSearchableDropdown from '../components/DivingCenterSearchableDropdown';
import { FormField } from '../components/forms/FormField';
import GasTanksInput from '../components/forms/GasTanksInput';
import RouteSelection from '../components/RouteSelection';
import UploadPhotosComponent from '../components/UploadPhotosComponent';
import UserSearchInput from '../components/UserSearchInput';
import YouTubePreview from '../components/YouTubePreview';
import usePageTitle from '../hooks/usePageTitle';
import { createDive, addDiveMedia, uploadPhotoToR2Only } from '../services/dives';
import { getDiveSites } from '../services/diveSites';
import { getDivingCenters } from '../services/divingCenters';
import { extractErrorMessage, extractFieldErrors } from '../utils/apiErrors';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import { createDiveSchema, createResolver, getErrorMessage } from '../utils/formHelpers';

const CreateDive = () => {
  // Set page title
  usePageTitle('Divemap - Create Dive');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // React Hook Form setup
  const methods = useForm({
    resolver: createResolver(createDiveSchema),
    mode: 'onChange', // Validate on change to provide real-time feedback
    reValidateMode: 'onChange', // Re-validate on change even after submission
    defaultValues: {
      dive_site_id: '',
      diving_center_id: '',
      selected_route_id: '',
      name: '',
      is_private: false,
      dive_information: '',
      max_depth: '',
      average_depth: '',
      gas_bottles_used: '',
      suit_type: '',
      difficulty_code: '',
      visibility_rating: '',
      user_rating: '',
      dive_date: new Date().toISOString().split('T')[0],
      dive_time: '',
      duration: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError,
  } = methods;

  // Watch dive_site_id for dependent field clearing
  const diveSiteId = watch('dive_site_id');

  // Keep separate state for tags, media, buddies, and search dropdowns
  const [selectedTags, setSelectedTags] = useState([]);

  const [newTag, setNewTag] = useState('');
  const [diveSiteSearch, setDiveSiteSearch] = useState('');
  const [isDiveSiteDropdownOpen, setIsDiveSiteDropdownOpen] = useState(false);
  const diveSiteDropdownRef = useRef(null);
  const [diveSiteSearchResults, setDiveSiteSearchResults] = useState([]);
  const [diveSiteSearchLoading, setDiveSiteSearchLoading] = useState(false);
  const [diveSiteSearchError, setDiveSiteSearchError] = useState(null);
  const diveSiteSearchTimeoutRef = useRef(null);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [selectedBuddies, setSelectedBuddies] = useState([]);
  // Ref to store unsaved photos from UploadPhotosComponent (for create flow, these are files not yet uploaded to R2)
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
  const [submitStatus, setSubmitStatus] = useState('');

  // Fetch dive sites for dropdown
  const { data: diveSites = [] } = useQuery(['dive-sites'], () => getDiveSites({ page_size: 100 }));

  // Fetch diving centers for dropdown
  const { data: divingCenters = [] } = useQuery(['diving-centers'], () =>
    getDivingCenters({ page_size: 100 })
  );

  // Fetch available tags
  const { data: availableTags = [] } = useQuery(['available-tags'], () => getAvailableTags());

  // Handle clicking outside dropdown
  useEffect(() => {
    const handleClickOutside = event => {
      if (diveSiteDropdownRef.current && !diveSiteDropdownRef.current.contains(event.target)) {
        setIsDiveSiteDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch initial dive sites with "Attiki" on component mount
  useEffect(() => {
    const loadInitialDiveSites = async () => {
      try {
        setDiveSiteSearchLoading(true);
        setDiveSiteSearchError(null);
        const results = await getDiveSites({
          search: 'Attiki',
          page_size: 25,
        });
        setDiveSiteSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Failed to load initial dive sites:', error);
        setDiveSiteSearchError('Failed to load dive sites');
        setDiveSiteSearchResults([]);
      } finally {
        setDiveSiteSearchLoading(false);
      }
    };

    loadInitialDiveSites();
  }, []);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (diveSiteSearchTimeoutRef.current) {
        clearTimeout(diveSiteSearchTimeoutRef.current);
      }
    };
  }, []);

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

  // Create dive mutation
  const createDiveMutation = useMutation(createDive, {
    onSuccess: () => {
      toast.success('Dive logged successfully!');
      queryClient.invalidateQueries(['dives']);
      navigate('/dives');
    },
    onError: error => {
      // Extract field-specific errors and set them in React Hook Form
      const fieldErrors = extractFieldErrors(error);
      Object.keys(fieldErrors).forEach(field => {
        setError(field, {
          type: 'server',
          message: fieldErrors[field]?.message || fieldErrors[field] || 'Invalid value',
        });
      });

      // Show general error message
      toast.error(extractErrorMessage(error) || 'Failed to log dive');
    },
  });

  // Helper function to get error styling for a field
  const getFieldErrorClass = fieldName => {
    return errors[fieldName]
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent';
  };

  const handleRouteSelect = routeId => {
    setValue('selected_route_id', routeId.toString(), { shouldValidate: true });
  };

  // Clear route selection when dive site changes
  useEffect(() => {
    if (diveSiteId) {
      setValue('selected_route_id', '');
    }
  }, [diveSiteId, setValue]);

  const handleTagToggle = tagId => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleAddNewTag = () => {
    if (
      newTag.trim() &&
      !availableTags.find(tag => tag.name.toLowerCase() === newTag.toLowerCase())
    ) {
      // In a real implementation, you would create the tag via API
      toast('Tag creation feature coming soon!');
      setNewTag('');
    }
  };

  // Handle buddy selection
  const MAX_BUDDIES = 20;

  const handleBuddySelect = user => {
    // Prevent duplicate buddies
    if (selectedBuddies.find(buddy => buddy.id === user.id)) {
      toast.error('This user is already added as a buddy');
      return;
    }
    // Enforce maximum buddies limit
    if (selectedBuddies.length >= MAX_BUDDIES) {
      toast.error(`Maximum ${MAX_BUDDIES} buddies allowed per dive`);
      return;
    }
    setSelectedBuddies(prev => [...prev, user]);
  };

  // Handle buddy removal
  const handleBuddyRemove = buddyId => {
    setSelectedBuddies(prev => prev.filter(buddy => buddy.id !== buddyId));
  };

  // Use dynamically searched dive sites instead of static filtering
  const filteredDiveSites = diveSiteSearchResults;

  // Get selected dive site name
  // const selectedDiveSite = Array.isArray(diveSites)
  //   ? diveSites.find(site => site.id.toString() === formData.dive_site_id)
  //   : null;

  // Get selected diving center name
  // const selectedDivingCenter = Array.isArray(divingCenters)
  //   ? divingCenters.find(center => center.id.toString() === formData.diving_center_id)
  //   : null;

  const handleDiveSiteSelect = (siteId, siteName) => {
    setValue('dive_site_id', siteId.toString(), { shouldValidate: true });
    setDiveSiteSearch(siteName);
    setIsDiveSiteDropdownOpen(false);
    // Keep the selected site in search results
    const selectedSite = filteredDiveSites.find(site => site.id.toString() === siteId.toString());
    if (selectedSite) {
      setDiveSiteSearchResults([selectedSite]);
    }
  };

  const handleDiveSiteSearchChange = value => {
    setDiveSiteSearch(value);
    setIsDiveSiteDropdownOpen(true);
    if (!value) {
      setValue('dive_site_id', '', { shouldValidate: true });
      // Reload initial "Attiki" results when search is cleared
      const loadInitialDiveSites = async () => {
        try {
          setDiveSiteSearchLoading(true);
          setDiveSiteSearchError(null);
          const results = await getDiveSites({
            search: 'Attiki',
            page_size: 25,
          });
          setDiveSiteSearchResults(Array.isArray(results) ? results : []);
        } catch (error) {
          console.error('Failed to load initial dive sites:', error);
          setDiveSiteSearchError('Failed to load dive sites');
          setDiveSiteSearchResults([]);
        } finally {
          setDiveSiteSearchLoading(false);
        }
      };
      loadInitialDiveSites();
      return;
    }

    // Clear previous timeout
    if (diveSiteSearchTimeoutRef.current) {
      clearTimeout(diveSiteSearchTimeoutRef.current);
    }

    // Debounce search: wait 0.5 seconds after user stops typing
    diveSiteSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setDiveSiteSearchLoading(true);
        setDiveSiteSearchError(null);
        const results = await getDiveSites({
          search: value,
          page_size: 25,
        });
        setDiveSiteSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error('Search dive sites failed', error);
        setDiveSiteSearchError('Search failed');
        setDiveSiteSearchResults([]);
      } finally {
        setDiveSiteSearchLoading(false);
      }
    }, 500);
  };

  const handleDiveSiteKeyDown = e => {
    if (e.key === 'Escape') {
      setIsDiveSiteDropdownOpen(false);
    }
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
    } else {
      // For other items (shouldn't happen in create flow, but handle gracefully)
      setMediaUrls(prev => prev.filter(item => item.id !== mediaItem.id));
    }
  };

  const onSubmit = async data => {
    setSubmitStatus('Processing...');
    // Data is already validated and transformed by Zod schema
    // Transform dive_time format if provided
    const diveData = {
      ...data,
      dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
      buddies: selectedBuddies.length > 0 ? selectedBuddies.map(buddy => buddy.id) : [],
      tags: selectedTags.length > 0 ? selectedTags : [],
    };

    try {
      // First, check for photo uploads
      const unsavedR2Photos = unsavedR2PhotosRef.current;
      if (unsavedR2Photos.length > 0) {
        setSubmitStatus('Uploading photos...');
      }

      const createdDive = await createDiveMutation.mutateAsync(diveData);

      setSubmitStatus('Saving media...');

      const mediaPromises = [];

      // First, upload photos to R2 and create DB records for them
      for (const unsavedPhoto of unsavedR2Photos) {
        if (unsavedPhoto.originFileObj) {
          // This is a photo from create flow - upload to R2 first
          try {
            const r2UploadResult = await uploadPhotoToR2Only(
              createdDive.id,
              unsavedPhoto.originFileObj
            );

            // Create database record
            const mediaData = {
              media_type: 'photo',
              url: r2UploadResult.r2_path, // Use R2 path for storage
              description: unsavedPhoto.description || '',
              title: '',
              medium_url: r2UploadResult.medium_path,
              thumbnail_url: r2UploadResult.thumbnail_path,
            };

            mediaPromises.push(
              addDiveMedia(createdDive.id, mediaData).catch(error => {
                console.error('Failed to save photo to database:', error);
                toast.error(`Failed to save photo ${unsavedPhoto.file_name} to database`);
              })
            );
          } catch (error) {
            console.error('Failed to upload photo to R2:', error);
            toast.error(
              `Failed to upload photo ${unsavedPhoto.file_name}: ${extractErrorMessage(error)}`
            );
          }
        }
      }

      // Save pending media to database
      for (const pendingItem of pendingMedia) {
        const mediaData = {
          media_type: pendingItem.type,
          url: pendingItem.url,
          description: mediaDescriptions[pendingItem.id] || pendingItem.description || '',
          title: '',
        };
        mediaPromises.push(
          addDiveMedia(createdDive.id, mediaData).catch(error => {
            console.error(`Failed to save media ${pendingItem.url}:`, error);
            toast.error(`Failed to save media: ${pendingItem.url}`);
          })
        );
      }

      // Wait for all media uploads to complete
      if (mediaPromises.length > 0) {
        await Promise.all(mediaPromises);
        toast.success('Dive logged successfully with media!');
      } else {
        toast.success('Dive logged successfully!');
      }

      queryClient.invalidateQueries(['dives']);
      navigate('/dives');
    } catch (error) {
      // Error handling is done in mutation onError callback
      // which uses setError to set field-specific errors
      setSubmitStatus('');
    }
  };

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='flex items-center gap-4 mb-6'>
        <button onClick={() => navigate('/dives')} className='text-gray-600 hover:text-gray-800'>
          <ArrowLeft size={24} />
        </button>
        <h1 className='text-3xl font-bold text-gray-900'>Log New Dive</h1>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className='bg-white rounded-lg shadow p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Basic Information */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Basic Information</h2>
            </div>

            <div className='relative' ref={diveSiteDropdownRef}>
              <label
                htmlFor='dive-site-search'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Dive Site (Optional)
              </label>
              <div className='relative'>
                <input
                  id='dive-site-search'
                  type='text'
                  value={diveSiteSearch}
                  onChange={e => handleDiveSiteSearchChange(e.target.value)}
                  onFocus={() => setIsDiveSiteDropdownOpen(true)}
                  onKeyDown={handleDiveSiteKeyDown}
                  placeholder='Search for a dive site...'
                  className={`w-full border rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${getFieldErrorClass('dive_site_id')}`}
                />
                <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${isDiveSiteDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Dropdown */}
              {isDiveSiteDropdownOpen && (
                <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                  {diveSiteSearchLoading ? (
                    <div className='px-3 py-2 text-gray-500 text-sm'>Searching...</div>
                  ) : diveSiteSearchError ? (
                    <div className='px-3 py-2 text-red-500 text-sm'>{diveSiteSearchError}</div>
                  ) : filteredDiveSites.length > 0 ? (
                    filteredDiveSites.map(site => (
                      <div
                        key={site.id}
                        onClick={() => handleDiveSiteSelect(site.id, site.name)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleDiveSiteSelect(site.id, site.name);
                          }
                        }}
                        role='button'
                        tabIndex={0}
                        className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                      >
                        <div className='font-medium text-gray-900'>{site.name}</div>
                        {site.country && (
                          <div className='text-sm text-gray-500'>{site.country}</div>
                        )}
                      </div>
                    ))
                  ) : diveSiteSearch ? (
                    <div className='px-3 py-2 text-gray-500 text-sm'>No dive sites found</div>
                  ) : (
                    <div className='px-3 py-2 text-gray-500 text-sm'>
                      Start typing to search dive sites
                    </div>
                  )}
                </div>
              )}
              {errors.dive_site_id && (
                <p className='mt-1 text-sm text-red-600'>{getErrorMessage(errors.dive_site_id)}</p>
              )}
            </div>

            <DivingCenterSearchableDropdown
              divingCenters={divingCenters}
              selectedId={watch('diving_center_id')}
              onSelect={id =>
                setValue('diving_center_id', id ? id.toString() : '', { shouldValidate: true })
              }
              error={errors.diving_center_id ? getErrorMessage(errors.diving_center_id) : null}
              label='Diving Center (Optional)'
              id='diving-center-search'
            />

            {/* Route Selection */}
            <div>
              <RouteSelection
                diveSiteId={diveSiteId}
                selectedRouteId={watch('selected_route_id')}
                onRouteSelect={handleRouteSelect}
              />
              {errors.selected_route_id && (
                <p className='mt-1 text-sm text-red-600'>
                  {getErrorMessage(errors.selected_route_id)}
                </p>
              )}
            </div>

            <div>
              <FormField name='name' label='Dive Name (Optional)'>
                {({ register, name }) => (
                  <input
                    id='dive-name'
                    type='text'
                    {...register(name)}
                    placeholder='Custom dive name or leave empty for automatic naming'
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='is_private' label='Privacy Setting'>
                {({ register, name }) => (
                  <select
                    id='privacy-setting'
                    {...register(name, {
                      setValueAs: value => value === 'true' || value === true,
                    })}
                    defaultValue='false'
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                  >
                    <option value='false'>Public (visible to everyone)</option>
                    <option value='true'>Private (visible only to you)</option>
                  </select>
                )}
              </FormField>
            </div>

            <div>
              <FormField name='dive_date' label='Dive Date' required>
                {({ register, name }) => (
                  <input
                    id='dive-date'
                    type='date'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('dive_date')}`}
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='dive_time' label='Dive Time (Optional)'>
                {({ register, name }) => (
                  <input
                    id='dive-time'
                    type='time'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('dive_time')}`}
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='duration' label='Duration (minutes)'>
                {({ register, name }) => (
                  <input
                    id='dive-duration'
                    type='number'
                    min='1'
                    max='1440'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('duration')}`}
                    placeholder='60'
                  />
                )}
              </FormField>
            </div>

            {/* Dive Details */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Dive Details</h2>
            </div>

            <div>
              <FormField name='max_depth' label='Max Depth (meters)'>
                {({ register, name }) => (
                  <input
                    id='max-depth'
                    type='number'
                    min='0'
                    max='1000'
                    step='any'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('max_depth')}`}
                    placeholder='18.5'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='average_depth' label='Average Depth (meters)'>
                {({ register, name }) => (
                  <input
                    id='average-depth'
                    type='number'
                    min='0'
                    max='1000'
                    step='any'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('average_depth')}`}
                    placeholder='12.0'
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
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
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

            <div>
              <FormField name='suit_type' label='Suit Type'>
                {({ register, name }) => (
                  <select
                    id='suit-type'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                  >
                    <option value=''>Select suit type</option>
                    <option value='wet_suit'>Wet Suit</option>
                    <option value='dry_suit'>Dry Suit</option>
                    <option value='shortie'>Shortie</option>
                  </select>
                )}
              </FormField>
            </div>

            <div>
              <FormField name='visibility_rating' label='Visibility Rating (1-10)'>
                {({ register, name }) => (
                  <input
                    id='visibility-rating'
                    type='number'
                    min='1'
                    max='10'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('visibility_rating')}`}
                    placeholder='8'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='user_rating' label='Your Rating (1-10)'>
                {({ register, name }) => (
                  <input
                    id='user-rating'
                    type='number'
                    min='1'
                    max='10'
                    {...register(name)}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${getFieldErrorClass('user_rating')}`}
                    placeholder='9'
                  />
                )}
              </FormField>
            </div>

            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Gas Bottles Used
              </label>
              <Controller
                name='gas_bottles_used'
                control={methods.control}
                render={({ field: { value, onChange }, fieldState: { error } }) => (
                  <GasTanksInput value={value} onChange={onChange} error={error?.message} />
                )}
              />
            </div>

            <div className='md:col-span-2'>
              <FormField name='dive_information' label='Dive Information'>
                {({ register, name }) => (
                  <textarea
                    id='dive-information'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    rows='4'
                    placeholder='Describe your dive experience, what you saw, conditions, etc.'
                  />
                )}
              </FormField>
            </div>

            {/* Media */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Media</h2>
              <div className='space-y-4'>
                {/* Photo Upload - Only show for public dives */}
                {!watch('is_private') && (
                  <UploadPhotosComponent
                    mediaUrls={mediaUrls.filter(m => m.type === 'photo')}
                    setMediaUrls={updater => {
                      if (typeof updater === 'function') {
                        setMediaUrls(prev => {
                          const nonPhotos = prev.filter(m => m.type !== 'photo');
                          const photos = updater(prev.filter(m => m.type === 'photo'));
                          return [...nonPhotos, ...photos];
                        });
                      } else {
                        const nonPhotos = mediaUrls.filter(m => m.type !== 'photo');
                        setMediaUrls([...nonPhotos, ...updater]);
                      }
                    }}
                    onUnsavedPhotosChange={unsavedPhotos => {
                      unsavedR2PhotosRef.current = unsavedPhotos;
                    }}
                  />
                )}
                {watch('is_private') && (
                  <div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
                    <p className='text-sm text-gray-600'>
                      Photo uploads are only available for public dives. Photos are visible on the
                      dive site.
                    </p>
                  </div>
                )}

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

            {/* Buddies */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Buddies</h2>
              <div className='space-y-4'>
                <UserSearchInput
                  onSelect={handleBuddySelect}
                  excludeUserIds={selectedBuddies.map(buddy => buddy.id)}
                  placeholder='Search for users to add as buddies...'
                  label='Add Dive Buddies (Optional)'
                />

                {/* Selected Buddies */}
                {selectedBuddies.length > 0 && (
                  <div className='mt-4'>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                      Selected Buddies
                    </label>
                    <div className='flex flex-wrap gap-2'>
                      {selectedBuddies.map(buddy => (
                        <div
                          key={buddy.id}
                          className='flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-full border border-blue-300'
                        >
                          {buddy.avatar_url ? (
                            <img
                              src={buddy.avatar_url}
                              alt={buddy.username}
                              className='w-6 h-6 rounded-full object-cover'
                            />
                          ) : (
                            <div className='w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center'>
                              <span className='text-xs font-medium text-blue-800'>
                                {buddy.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className='text-sm font-medium'>{buddy.username}</span>
                          {buddy.name && (
                            <span className='text-xs text-blue-600'>({buddy.name})</span>
                          )}
                          <button
                            type='button'
                            onClick={() => handleBuddyRemove(buddy.id)}
                            className='ml-1 text-blue-600 hover:text-blue-800'
                            aria-label={`Remove ${buddy.username}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Tags</h2>
              <div className='space-y-4'>
                <div className='flex flex-wrap gap-2'>
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      type='button'
                      onClick={() => handleTagToggle(tag.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>

                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder='Add new tag...'
                    className='flex-1 border border-gray-300 rounded-md px-3 py-2'
                  />
                  <button
                    type='button'
                    onClick={handleAddNewTag}
                    className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2'
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className='mt-8 flex justify-end gap-4'>
            <button
              type='button'
              onClick={() => navigate('/dives')}
              className='px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={createDiveMutation.isLoading || !!submitStatus}
              className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
            >
              {createDiveMutation.isLoading || submitStatus ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                  {submitStatus || 'Saving...'}
                </>
              ) : (
                <>
                  <Save size={16} />
                  Log Dive
                </>
              )}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export default CreateDive;
