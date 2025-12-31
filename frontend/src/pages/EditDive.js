import { Save, ArrowLeft, Plus, X, ChevronDown, Image, Video, FileText, Link } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Button } from 'antd';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import {
  getDive,
  updateDive,
  getDiveSites,
  getAvailableTags,
  addDiveMedia,
  deleteDiveMedia,
  updateDiveMedia,
  getDivingCenters,
  extractErrorMessage,
  extractFieldErrors,
} from '../api';
import DivingCenterSearchableDropdown from '../components/DivingCenterSearchableDropdown';
import { FormField } from '../components/forms/FormField';
import RouteSelection from '../components/RouteSelection';
import UserSearchInput from '../components/UserSearchInput';
import UploadPhotosComponent from '../components/UploadPhotosComponent';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { createDiveSchema, createResolver, getErrorMessage } from '../utils/formHelpers';

const EditDive = () => {
  // Set page title
  usePageTitle('Divemap - Edit Dive');
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

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
    reset,
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
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('video'); // Changed default to video since photos use file upload
  const [newMediaDescription, setNewMediaDescription] = useState('');
  const [selectedBuddies, setSelectedBuddies] = useState([]);
  const [newMediaIsPublic, setNewMediaIsPublic] = useState(true);
  // Ref to store unsaved R2 photos from UploadCustomComponent for use in onSubmit
  const unsavedR2PhotosRef = useRef([]);
  // Track photo UIDs that have been saved to DB (to signal component to clear them from unsaved list)
  const [savedPhotoUids, setSavedPhotoUids] = useState([]);

  // Fetch dive data
  const {
    data: dive,
    isLoading,
    error,
  } = useQuery(['dive', id], () => getDive(id), {
    enabled: !!id && !authLoading && !!user,
    onSuccess: data => {
      // Check if the dive belongs to the current user (admins can edit any dive)
      if (data.user_id !== user?.id && !user?.is_admin) {
        toast.error('You can only edit your own dives');
        navigate('/dives');
        return;
      }

      // Reset form with dive data
      reset({
        dive_site_id: data.dive_site_id ? data.dive_site_id.toString() : '',
        diving_center_id: data.diving_center_id ? data.diving_center_id.toString() : '',
        selected_route_id: data.selected_route_id ? data.selected_route_id.toString() : '',
        name: data.name || '',
        is_private: data.is_private || false,
        dive_information: data.dive_information || '',
        max_depth: data.max_depth ? data.max_depth.toString() : '',
        average_depth: data.average_depth ? data.average_depth.toString() : '',
        gas_bottles_used: data.gas_bottles_used || '',
        suit_type: data.suit_type || '',
        difficulty_code: data.difficulty_code || '',
        visibility_rating: data.visibility_rating ? data.visibility_rating.toString() : '',
        user_rating: data.user_rating ? data.user_rating.toString() : '',
        dive_date: data.dive_date || new Date().toISOString().split('T')[0],
        dive_time: data.dive_time ? data.dive_time.substring(0, 5) : '',
        duration: data.duration ? data.duration.toString() : '',
      });

      // Load existing tags
      if (data.tags && Array.isArray(data.tags)) {
        setSelectedTags(data.tags.map(tag => tag.id));
      } else {
        setSelectedTags([]);
      }

      // Load existing media
      if (data.media && Array.isArray(data.media)) {
        const existingMedia = data.media.map(media => ({
          id: media.id,
          type: media.media_type,
          url: media.url,
          description: media.description || '',
          title: media.title || '',
          is_public: media.is_public !== undefined ? media.is_public : true,
          uploaded: true, // Mark as already uploaded
          original_filename: media.original_filename || undefined,
        }));
        setMediaUrls(existingMedia);
      } else {
        setMediaUrls([]);
      }

      // Load existing buddies
      if (data.buddies && Array.isArray(data.buddies)) {
        setSelectedBuddies(data.buddies);
      } else {
        setSelectedBuddies([]);
      }

      // Set dive site search name
      if (data.dive_site) {
        setDiveSiteSearch(data.dive_site.name);
      }
    },
    onError: error => {
      if (error.response?.status === 404) {
        toast.error('Dive not found or you do not have permission to edit it');
        navigate('/dives');
      } else {
        toast.error('Failed to load dive');
      }
    },
  });

  // Note: Dive sites are now loaded dynamically via search, not statically

  const { data: divingCenters = [] } = useQuery(['diving-centers'], () =>
    getDivingCenters({ page_size: 100 })
  );

  const { data: availableTags = [] } = useQuery(['tags'], getAvailableTags);

  // Clear route selection when dive site changes

  useEffect(() => {
    // Only clear if the user has changed the dive site from the original one
    // We check if dive data is loaded and compare current ID with original ID
    const isInitialDiveSite =
      dive?.dive_site_id && diveSiteId.toString() === dive.dive_site_id.toString();

    if (diveSiteId && !isInitialDiveSite) {
      setValue('selected_route_id', '');
    }
  }, [diveSiteId, setValue, dive]);

  // Fetch initial dive sites with "Attiki" on component mount
  useEffect(() => {
    // Only load initial sites if no dive site is already set
    if (!dive || !dive.dive_site) {
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
    }
  }, []);

  // Cleanup pending debounce on unmount
  useEffect(() => {
    return () => {
      if (diveSiteSearchTimeoutRef.current) {
        clearTimeout(diveSiteSearchTimeoutRef.current);
      }
    };
  }, []);


  // Clear route selection when dive site changes (handled by useEffect above)

  // Update dive mutation
  const updateDiveMutation = useMutation(({ diveId, diveData }) => updateDive(diveId, diveData), {
    onSuccess: () => {
      toast.success('Dive updated successfully!');
      queryClient.invalidateQueries(['dives']);
      queryClient.invalidateQueries(['dive', id]);
      // Reset savedPhotoUids before navigation (component will have already cleared them from unsaved list)
      setSavedPhotoUids([]);
      navigate(`/dives/${id}`);
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
      toast.error(extractErrorMessage(error) || 'Failed to update dive');
    },
  });

  // Handle loading and authentication states after hooks
  if (authLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  const handleRouteSelect = routeId => {
    setValue('selected_route_id', routeId.toString(), { shouldValidate: true });
  };

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

  // Use search results directly (no client-side filtering needed)
  const filteredDiveSites = diveSiteSearchResults;

  // Filter diving centers based on search input
  const handleDiveSiteSelect = (siteId, siteName) => {
    setValue('dive_site_id', siteId.toString(), { shouldValidate: true });
    setDiveSiteSearch(siteName);
    setIsDiveSiteDropdownOpen(false);
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
  const handleUrlAdd = () => {
    if (newMediaUrl.trim()) {
      const newMedia = {
        id: Date.now() + Math.random(),
        type: newMediaType,
        url: newMediaUrl.trim(),
        description: newMediaDescription.trim(),
        title: '',
        is_public: newMediaIsPublic,
      };
      setMediaUrls(prev => [...prev, newMedia]);

      // Reset form
      setNewMediaUrl('');
      setNewMediaType('video');
      setNewMediaDescription('');
      setNewMediaIsPublic(true);
      setShowMediaForm(false);
    }
  };

  const handleMediaRemove = async (mediaItem) => {
    // If this has a database ID, it means it's been saved and we need to delete from backend and R2
    if (mediaItem.id) {
      try {
        // Ensure mediaId is a number
        const mediaId = typeof mediaItem.id === 'number' ? mediaItem.id : parseInt(mediaItem.id);
        if (isNaN(mediaId)) {
          toast.error('Invalid media ID');
          return;
        }
        // Delete from backend (which also deletes from R2)
        await deleteDiveMedia(id, mediaId);
        toast.success('Photo deleted successfully');
        // Remove from local state only after successful deletion
        setMediaUrls(prev => prev.filter(item => item.id !== mediaItem.id));
        queryClient.invalidateQueries(['dive', id]);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete photo');
        // Don't remove from UI if deletion failed
      }
    } else {
      // For non-uploaded items (files that were just selected but not yet uploaded), just remove from local state
      setMediaUrls(prev => prev.filter(item => item.id !== mediaItem.id));
    }
  };

  const handleMediaDescriptionChange = (id, description) => {
    setMediaUrls(prev => prev.map(item => (item.id === id ? { ...item, description } : item)));
  };


  const onSubmit = async data => {
    // Data is already validated and transformed by Zod schema
    // Format dive_time to include seconds (HH:MM -> HH:MM:00) for backend
    const diveData = {
      ...data,
      dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
      tags: selectedTags.length > 0 ? selectedTags : [],
      buddies: selectedBuddies.length > 0 ? selectedBuddies.map(buddy => buddy.id) : [],
    };

    try {
      // First, create database records for photos uploaded to R2 but not yet saved
      const dbCreationPromises = [];
      const unsavedR2Photos = unsavedR2PhotosRef.current;
      for (const unsavedPhoto of unsavedR2Photos) {
        const mediaData = {
          media_type: 'photo',
          url: unsavedPhoto.r2_path, // Use R2 path for storage
          description: unsavedPhoto.description || '',
          title: '',
          is_public: unsavedPhoto.is_public,
        };

        dbCreationPromises.push(
          addDiveMedia(id, mediaData)
            .then(createdMedia => {
              // Update mediaUrls with the new DB ID
              setMediaUrls(prev =>
                prev.map(item =>
                  item.temp_uid === unsavedPhoto.uid
                    ? { ...item, id: createdMedia.id, uploaded: true, temp_uid: undefined }
                    : item
                )
              );
              // Track this UID as saved so component can clear it from unsaved list
              setSavedPhotoUids(prev => [...prev, unsavedPhoto.uid]);
              return createdMedia;
            })
            .catch(_error => {
              toast.error(`Failed to save photo ${unsavedPhoto.file_name} to database`);
            })
        );
      }

      // Wait for all DB records to be created
      if (dbCreationPromises.length > 0) {
        await Promise.all(dbCreationPromises);
      }

      // Clear unsaved photos ref since they're now saved
      unsavedR2PhotosRef.current = [];
      
      // Note: savedPhotoUids is set above when each photo is saved
      // The component will clear these from its unsaved list via useEffect
      // We'll reset it after navigation to prepare for next use

      // Now update the dive with all other data
      await updateDiveMutation.mutateAsync({ diveId: id, diveData });

      // Add media URLs (only for non-uploaded media, uploaded photos are already saved)
      // Also update descriptions for already-uploaded photos
      const mediaPromises = [];

      for (const mediaUrl of mediaUrls) {
        // If photo was already uploaded and saved, update its description if changed
        if (mediaUrl.uploaded && mediaUrl.id) {
          mediaPromises.push(
            updateDiveMedia(id, mediaUrl.id, mediaUrl.description || '', mediaUrl.is_public).catch(_error => {
              toast.error(`Failed to update media description: ${mediaUrl.url}`);
            })
          );
          continue;
        }

        // Skip photos that were just saved above (they already have DB records)
        if (mediaUrl.type === 'photo' && !mediaUrl.uploaded) {
          continue;
        }

        // Add new media URLs (non-photo media like videos, external links)
        const mediaData = {
          media_type: mediaUrl.type,
          url: mediaUrl.url,
          description: mediaUrl.description || '',
          title: mediaUrl.title || '',
          is_public: mediaUrl.is_public !== undefined ? mediaUrl.is_public : true,
        };

        mediaPromises.push(
          addDiveMedia(id, mediaData).catch(_error => {
            toast.error(`Failed to add media URL: ${mediaUrl.url}`);
          })
        );
      }

      // Wait for all media uploads to complete
      if (mediaPromises.length > 0) {
        await Promise.all(mediaPromises);
        toast.success('Dive updated successfully with media!');
      }
    } catch (error) {
      // Error handling is done in mutation's onError
    }
  };

  const _getDifficultyColor = level => {
    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-orange-100 text-orange-800',
      expert: 'bg-red-100 text-red-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const _getSuitTypeColor = type => {
    const colors = {
      wet_suit: 'bg-blue-100 text-blue-800',
      dry_suit: 'bg-purple-100 text-purple-800',
      shortie: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className='text-center py-8'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
        <p className='mt-4 text-gray-600'>Loading dive details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-8'>
        <p className='text-red-600'>
          Error loading dive:{' '}
          {typeof error === 'string' ? error : error?.message || 'Unknown error occurred'}
        </p>
      </div>
    );
  }

  if (!dive) {
    return (
      <div className='text-center py-8'>
        <p className='text-gray-600'>Dive not found</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='flex items-center gap-4 mb-6'>
        <button
          onClick={() => navigate(`/dives/${id}`)}
          className='text-gray-600 hover:text-gray-800'
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className='text-3xl font-bold text-gray-900'>Edit Dive</h1>
      </div>

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className='bg-white rounded-lg shadow p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Basic Information */}
            <div className='md:col-span-2'>
              <h2 className='text-xl font-semibold mb-4'>Basic Information</h2>
            </div>

            <FormField name='dive_site_id' label='Dive Site (Optional)'>
              {() => (
                <div className='relative' ref={diveSiteDropdownRef}>
                  <div className='relative'>
                    <input
                      type='text'
                      value={diveSiteSearch}
                      onChange={e => handleDiveSiteSearchChange(e.target.value)}
                      onFocus={() => setIsDiveSiteDropdownOpen(true)}
                      onKeyDown={handleDiveSiteKeyDown}
                      placeholder='Search for a dive site...'
                      className='w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
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
                            className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                          >
                            <div className='font-medium text-gray-900'>{site.name}</div>
                            {site.country && (
                              <div className='text-sm text-gray-500'>{site.country}</div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className='px-3 py-2 text-gray-500 text-sm'>No dive sites found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </FormField>

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
            <FormField name='selected_route_id' label='Selected Route'>
              {() => (
                <RouteSelection
                  diveSiteId={diveSiteId}
                  selectedRouteId={watch('selected_route_id')}
                  onRouteSelect={handleRouteSelect}
                />
              )}
            </FormField>

            <div>
              <FormField name='name' label='Dive Name (Optional)'>
                {({ register, name }) => (
                  <input
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
                    {...register(name, { valueAsBoolean: true })}
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
                    type='date'
                    {...register(name)}
                    required
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='dive_time' label='Dive Time (Optional)'>
                {({ register, name }) => (
                  <input
                    type='time'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='duration' label='Duration (minutes)'>
                {({ register, name }) => (
                  <input
                    type='number'
                    min='1'
                    max='1440'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
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
                    type='number'
                    min='0'
                    max='1000'
                    step='any'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    placeholder='18.5'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='average_depth' label='Average Depth (meters)'>
                {({ register, name }) => (
                  <input
                    type='number'
                    min='0'
                    max='1000'
                    step='any'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    placeholder='12.0'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='difficulty_code' label='Difficulty Level'>
                {({ register, name }) => (
                  <select
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
                    type='number'
                    min='1'
                    max='10'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    placeholder='8'
                  />
                )}
              </FormField>
            </div>

            <div>
              <FormField name='user_rating' label='Your Rating (1-10)'>
                {({ register, name }) => (
                  <input
                    type='number'
                    min='1'
                    max='10'
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    placeholder='9'
                  />
                )}
              </FormField>
            </div>

            <div className='md:col-span-2'>
              <FormField name='gas_bottles_used' label='Gas Bottles Used'>
                {({ register, name }) => (
                  <textarea
                    {...register(name)}
                    className='w-full border border-gray-300 rounded-md px-3 py-2'
                    rows='2'
                    placeholder='e.g., 12L aluminum tank, 200 bar'
                  />
                )}
              </FormField>
            </div>

            <div className='md:col-span-2'>
              <FormField name='dive_information' label='Dive Information'>
                {({ register, name }) => (
                  <textarea
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
                {/* Photo Upload */}
                <UploadPhotosComponent
                  id={id}
                  mediaUrls={mediaUrls}
                  setMediaUrls={setMediaUrls}
                  onUnsavedPhotosChange={unsavedPhotos => {
                    unsavedR2PhotosRef.current = unsavedPhotos;
                  }}
                  onMediaRemove={handleMediaRemove}
                  savedPhotoUids={savedPhotoUids}
                />

                {/* URL Upload */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Add Media URLs
                  </label>
                  <div className='flex items-center gap-4'>
                    <button
                      type='button'
                      onClick={() => setShowMediaForm(true)}
                      className='flex items-center gap-2 px-4 py-2 text-white rounded-md'
                      style={{ backgroundColor: UI_COLORS.success }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#007a5c')}
                      onMouseLeave={e =>
                        (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                      }
                    >
                      <Link size={16} />
                      Add Media URL
                    </button>
                  </div>

                  {/* Media Form */}
                  {showMediaForm && (
                    <div className='mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50'>
                      <div className='space-y-3'>
                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Media URL *
                          </label>
                          <input
                            type='url'
                            value={newMediaUrl}
                            onChange={e => setNewMediaUrl(e.target.value)}
                            placeholder='https://example.com/media'
                            className='w-full border border-gray-300 rounded-md px-3 py-2'
                            required
                          />
                        </div>

                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Media Type
                          </label>
                          <select
                            value={newMediaType}
                            onChange={e => setNewMediaType(e.target.value)}
                            className='w-full border border-gray-300 rounded-md px-3 py-2'
                          >
                            <option value='external_link'>External Link</option>
                            <option value='video'>Video</option>
                            <option value='dive_plan'>Dive Plan</option>
                          </select>
                        </div>

                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>
                            Description (Optional)
                          </label>
                          <textarea
                            value={newMediaDescription}
                            onChange={e => setNewMediaDescription(e.target.value)}
                            placeholder='Describe this media...'
                            className='w-full border border-gray-300 rounded-md px-3 py-2'
                            rows='2'
                          />
                        </div>

                        <div className='flex gap-2'>
                          <button
                            type='button'
                            onClick={handleUrlAdd}
                            disabled={!newMediaUrl.trim()}
                            className='px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed'
                            style={{ backgroundColor: UI_COLORS.success }}
                            onMouseEnter={e =>
                              !e.currentTarget.disabled &&
                              (e.currentTarget.style.backgroundColor = '#007a5c')
                            }
                            onMouseLeave={e =>
                              !e.currentTarget.disabled &&
                              (e.currentTarget.style.backgroundColor = UI_COLORS.success)
                            }
                          >
                            Add Media
                          </button>
                          <button
                            type='button'
                            onClick={() => {
                              setShowMediaForm(false);
                              setNewMediaUrl('');
                              setNewMediaType('video');
                              setNewMediaDescription('');
                            }}
                            className='px-4 py-2 text-white rounded-md'
                            style={{ backgroundColor: UI_COLORS.neutral }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1f2937')}
                            onMouseLeave={e =>
                              (e.currentTarget.style.backgroundColor = UI_COLORS.neutral)
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Media Preview (for non-photo media) */}
                {mediaUrls.filter(media => media.type !== 'photo').length > 0 && (
                  <div className='space-y-3'>
                    <h3 className='text-lg font-medium text-gray-900'>Media Preview</h3>

                    {mediaUrls
                      .filter(media => media.type !== 'photo')
                      .map(media => (
                        <div
                          key={media.id}
                          className='flex items-start gap-3 p-3 border border-gray-200 rounded-lg'
                        >
                          <div className='flex-shrink-0'>
                            {media.type === 'video' ? (
                              <Video size={24} className='text-purple-600' />
                            ) : media.type === 'dive_plan' ? (
                              <FileText size={24} className='text-green-600' />
                            ) : (
                              <Link size={24} className='text-orange-600' />
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center justify-between mb-2'>
                              <span className='text-sm font-medium text-gray-900 truncate'>
                                {media.url}
                              </span>
                              <button
                                type='button'
                                onClick={() => handleMediaRemove(media)}
                                className='text-red-600 hover:text-red-800'
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className='text-xs text-gray-500 mb-2'>Type: {media.type}</div>
                            <input
                              type='text'
                              placeholder='Add description (optional)'
                              value={media.description}
                              onChange={e => handleMediaDescriptionChange(media.id, e.target.value)}
                              className='w-full text-sm border border-gray-300 rounded px-2 py-1'
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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
                    className='px-4 py-2 text-white rounded-md flex items-center gap-2'
                    style={{ backgroundColor: UI_COLORS.success }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#007a5c')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
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
              onClick={() => navigate(`/dives/${id}`)}
              className='px-6 py-2 text-white rounded-md'
              style={{ backgroundColor: UI_COLORS.neutral }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1f2937')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.neutral)}
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={updateDiveMutation.isLoading}
              className='px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
              style={{ backgroundColor: UI_COLORS.primary }}
              onMouseEnter={e =>
                !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#005a8a')
              }
              onMouseLeave={e =>
                !e.currentTarget.disabled &&
                (e.currentTarget.style.backgroundColor = UI_COLORS.primary)
              }
            >
              {updateDiveMutation.isLoading ? (
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
              ) : (
                <Save size={16} />
              )}
              Update Dive
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export default EditDive;
