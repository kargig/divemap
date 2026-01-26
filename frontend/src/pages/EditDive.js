import { Collapse, Image as AntdImage } from 'antd';
import { Save, ArrowLeft, Plus, X, ChevronDown, Image, Video, FileText, Link } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import DivingCenterSearchableDropdown from '../components/DivingCenterSearchableDropdown';
import { FormField } from '../components/forms/FormField';
import GasTanksInput from '../components/forms/GasTanksInput';
import RouteSelection from '../components/RouteSelection';
import Button from '../components/ui/Button';
import UploadPhotosComponent from '../components/UploadPhotosComponent';
import UserSearchInput from '../components/UserSearchInput';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  getDive,
  updateDive,
  addDiveMedia,
  updateDiveMedia,
  deleteDiveMedia,
  uploadPhotoToR2Only,
  getDiveMedia,
} from '../services/dives';
import { getDiveSites } from '../services/diveSites';
import { getDivingCenters } from '../services/divingCenters';
import { getAvailableTags } from '../services/tags';
import { extractErrorMessage, extractFieldErrors } from '../utils/apiErrors';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import { createDiveSchema, createResolver, getErrorMessage } from '../utils/formHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';

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
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('video'); // Changed default to video since photos use file upload
  const [newMediaDescription, setNewMediaDescription] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]); // Media URLs to be saved on form submission
  const [addLinksCollapseOpen, setAddLinksCollapseOpen] = useState(false); // Control Add External Links collapse
  const [mediaDescriptions, setMediaDescriptions] = useState({}); // Track media descriptions
  const [selectedBuddies, setSelectedBuddies] = useState([]);
  // Ref to store unsaved R2 photos from UploadPhotosComponent for use in onSubmit
  const unsavedR2PhotosRef = useRef([]);
  // Track photo UIDs that have been saved to DB (to signal component to clear them from unsaved list)
  const [savedPhotoUids, setSavedPhotoUids] = useState([]);
  // Store converted Flickr URLs (Map: original URL -> direct image URL)
  const [convertedFlickrUrls, setConvertedFlickrUrls] = useState(new Map());
  const [submitStatus, setSubmitStatus] = useState('');

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
          uploaded: true, // Mark as already uploaded
          original_filename: media.original_filename || undefined,
        }));
        setMediaUrls(existingMedia);
        // Initialize media descriptions
        const descriptions = {};
        existingMedia.forEach(media => {
          descriptions[media.id] = media.description ? decodeHtmlEntities(media.description) : '';
        });
        setMediaDescriptions(descriptions);
      } else {
        setMediaUrls([]);
        setMediaDescriptions({});
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

  // Fetch dive media separately using get_dive_media endpoint
  const {
    data: diveMedia = [],
    isLoading: mediaLoading,
    error: mediaError,
  } = useQuery(['dive-media', id], () => getDiveMedia(id), {
    enabled: !!id && !authLoading && !!user && !!dive,
    onSuccess: data => {
      // Initialize media descriptions when media loads (for all media including photos)
      const descriptions = {};
      data.forEach(media => {
        descriptions[media.id] = media.description ? decodeHtmlEntities(media.description) : '';
      });
      setMediaDescriptions(prev => ({ ...prev, ...descriptions }));
    },
    onError: _error => {
      toast.error('Failed to load media');
    },
  });

  // Convert Flickr URLs to direct image URLs
  useEffect(() => {
    const convertFlickrUrls = async () => {
      if (!diveMedia || diveMedia.length === 0) return;

      // Get all photos
      const photos = diveMedia.filter(item => item.media_type === 'photo');
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

      // Also check pending media for Flickr URLs
      const pendingFlickrPhotos = pendingMedia.filter(
        item => item.type === 'photo' && isFlickrUrl(item.url)
      );
      for (const photo of pendingFlickrPhotos) {
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
  }, [diveMedia, pendingMedia]);

  // Helper to get the URL (converted if Flickr, original otherwise)
  const getImageUrl = url => {
    return convertedFlickrUrls.get(url) || url;
  };

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
    setNewMediaType('video');
    setNewMediaDescription('');
    // Close the collapse
    setAddLinksCollapseOpen(false);
    toast.success('Media added (will be saved on form submission)');
  };

  const handleMediaRemove = async mediaItem => {
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
      return;
    }
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
        toast.success('Media deleted successfully');
        // Remove description from state
        setMediaDescriptions(prev => {
          const newDescriptions = { ...prev };
          delete newDescriptions[mediaItem.id];
          return newDescriptions;
        });
        // Invalidate queries to refresh the media list
        queryClient.invalidateQueries(['dive', id]);
        queryClient.invalidateQueries(['dive-media', id]);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete media');
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
    setSubmitStatus('Processing...');
    // Data is already validated and transformed by Zod schema
    // Format dive_time to include seconds (HH:MM -> HH:MM:00) for backend
    const diveData = {
      ...data,
      dive_time: data.dive_time && data.dive_time !== '' ? `${data.dive_time}:00` : null,
      tags: selectedTags.length > 0 ? selectedTags : [],
      buddies: selectedBuddies.length > 0 ? selectedBuddies.map(buddy => buddy.id) : [],
    };

    try {
      // First, upload photos to R2 and create database records for them
      const dbCreationPromises = [];
      const unsavedR2Photos = unsavedR2PhotosRef.current;

      if (unsavedR2Photos.length > 0) {
        setSubmitStatus('Uploading photos...');
      }

      for (const unsavedPhoto of unsavedR2Photos) {
        if (unsavedPhoto.originFileObj) {
          // This is a photo from create/edit flow - upload to R2 first
          try {
            const r2UploadResult = await uploadPhotoToR2Only(id, unsavedPhoto.originFileObj);

            // Create database record
            const mediaData = {
              media_type: 'photo',
              url: r2UploadResult.r2_path, // Use R2 path for storage
              description: unsavedPhoto.description || '',
              title: '',
              medium_url: r2UploadResult.medium_path,
              thumbnail_url: r2UploadResult.thumbnail_path,
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
          } catch (error) {
            console.error('Failed to upload photo to R2:', error);
            toast.error(
              `Failed to upload photo ${unsavedPhoto.file_name}: ${extractErrorMessage(error)}`
            );
          }
        } else if (unsavedPhoto.r2_path) {
          // Photo was already uploaded to R2 (from previous edit session), just create DB record
          const mediaData = {
            media_type: 'photo',
            url: unsavedPhoto.r2_path,
            description: unsavedPhoto.description || '',
            title: '',
          };

          dbCreationPromises.push(
            addDiveMedia(id, mediaData)
              .then(createdMedia => {
                setMediaUrls(prev =>
                  prev.map(item =>
                    item.temp_uid === unsavedPhoto.uid
                      ? { ...item, id: createdMedia.id, uploaded: true, temp_uid: undefined }
                      : item
                  )
                );
                setSavedPhotoUids(prev => [...prev, unsavedPhoto.uid]);
                return createdMedia;
              })
              .catch(_error => {
                toast.error(`Failed to save photo ${unsavedPhoto.file_name} to database`);
              })
          );
        }
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

      setSubmitStatus('Saving details...');

      // Now update the dive with all other data
      await updateDiveMutation.mutateAsync({ diveId: id, diveData });

      // Add media URLs (only for non-uploaded media, uploaded photos are already saved)
      // Also update descriptions for already-uploaded photos
      const mediaPromises = [];

      for (const mediaUrl of mediaUrls) {
        // If photo was already uploaded and saved, update its description if changed
        if (mediaUrl.uploaded && mediaUrl.id) {
          mediaPromises.push(
            updateDiveMedia(id, mediaUrl.id, mediaUrl.description || '', null).catch(_error => {
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
      }

      // Save pending media to database
      const pendingMediaPromises = [];
      for (const pendingItem of pendingMedia) {
        const mediaData = {
          media_type: pendingItem.type,
          url: pendingItem.url,
          description: mediaDescriptions[pendingItem.id] || pendingItem.description || '',
          title: '',
        };
        pendingMediaPromises.push(
          addDiveMedia(id, mediaData).catch(error => {
            console.error(`Failed to save media ${pendingItem.url}:`, error);
            toast.error(`Failed to save media: ${pendingItem.url}`);
          })
        );
      }
      if (pendingMediaPromises.length > 0) {
        await Promise.all(pendingMediaPromises);
      }

      // Update media descriptions that have changed (for all media from diveMedia)
      const mediaUpdatePromises = [];
      for (const mediaItem of diveMedia) {
        // Only update if description has changed
        const currentDescription = mediaItem.description || '';
        const newDescription = mediaDescriptions[mediaItem.id] || '';
        if (currentDescription !== newDescription) {
          mediaUpdatePromises.push(
            updateDiveMedia(id, mediaItem.id, newDescription || null).catch(error => {
              console.error(`Failed to update media description for media ${mediaItem.id}:`, error);
              toast.error(`Failed to update media description`);
            })
          );
        }
      }
      if (mediaUpdatePromises.length > 0) {
        await Promise.all(mediaUpdatePromises);
      }

      // Clear pending media after successful save
      setPendingMedia([]);

      // Invalidate queries to refresh the list
      await queryClient.invalidateQueries(['dive', id]);
      await queryClient.invalidateQueries(['dive-media', id]);

      if (
        mediaPromises.length > 0 ||
        pendingMediaPromises.length > 0 ||
        mediaUpdatePromises.length > 0
      ) {
        toast.success('Dive updated successfully with media!');
      }
    } catch (error) {
      // Error handling is done in mutation's onError
      setSubmitStatus('');
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
                    {...register(name, {
                      setValueAs: value => value === 'true' || value === true,
                    })}
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
                    mediaUrls={mediaUrls}
                    setMediaUrls={setMediaUrls}
                    onUnsavedPhotosChange={unsavedPhotos => {
                      unsavedR2PhotosRef.current = unsavedPhotos;
                    }}
                    onMediaRemove={handleMediaRemove}
                    savedPhotoUids={savedPhotoUids}
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
                                  URL *
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
                                  setNewMediaType('video');
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
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                {/* Manage Media */}
                {mediaLoading && (
                  <div className='text-center py-4'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                    <p className='text-gray-600 mt-2'>Loading media...</p>
                  </div>
                )}
                {mediaError && (
                  <div className='text-center py-4'>
                    <p className='text-red-600'>Failed to load media</p>
                  </div>
                )}
                {!mediaLoading &&
                  !mediaError &&
                  (diveMedia.length > 0 || pendingMedia.length > 0) && (
                    <div className='mb-3'>
                      <Collapse
                        items={[
                          {
                            key: '1',
                            label: 'Manage Media',
                            children: (
                              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                {/* Show saved media (including photos) */}
                                {diveMedia.map(item => (
                                  <div key={item.id} className='border rounded-lg p-4'>
                                    <div className='flex items-center justify-between mb-2'>
                                      <span className='text-sm font-medium text-gray-700 capitalize'>
                                        {item.media_type}
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleMediaRemove({
                                            id: item.id,
                                            type: item.media_type,
                                            url: item.url,
                                            description: item.description,
                                          })
                                        }
                                        className='text-red-600 hover:text-red-800'
                                        title='Delete media'
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                    <div className='space-y-2'>
                                      {item.media_type === 'photo' ? (
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
                                {/* Show pending media */}
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
                            ),
                          },
                        ]}
                      />
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
            <Button onClick={() => navigate(`/dives/${id}`)} variant='secondary'>
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={updateDiveMutation.isLoading || !!submitStatus}
              variant='primary'
              icon={!(updateDiveMutation.isLoading || submitStatus) && <Save className='w-4 h-4' />}
            >
              {updateDiveMutation.isLoading || submitStatus ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  {submitStatus || 'Saving...'}
                </>
              ) : (
                'Update Dive'
              )}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export default EditDive;
