import { Save, ArrowLeft, Plus, X, ChevronDown, Image, Video, FileText, Link } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate } from 'react-router-dom';

import {
  getDive,
  updateDive,
  getDiveSites,
  getAvailableTags,
  addDiveMedia,
  uploadDivePhoto,
  deleteDiveMedia,
  updateDiveMedia,
  getDivingCenters,
} from '../api';
import RouteSelection from '../components/RouteSelection';
import UserSearchInput from '../components/UserSearchInput';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { UI_COLORS } from '../utils/colorPalette';
import { getDifficultyOptions } from '../utils/difficultyHelpers';

const EditDive = () => {
  // Set page title
  usePageTitle('Divemap - Edit Dive');
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({});
  const [newTag, setNewTag] = useState('');
  const [diveSiteSearch, setDiveSiteSearch] = useState('');
  const [isDiveSiteDropdownOpen, setIsDiveSiteDropdownOpen] = useState(false);
  const diveSiteDropdownRef = useRef(null);
  const [diveSiteSearchResults, setDiveSiteSearchResults] = useState([]);
  const [diveSiteSearchLoading, setDiveSiteSearchLoading] = useState(false);
  const [diveSiteSearchError, setDiveSiteSearchError] = useState(null);
  const diveSiteSearchTimeoutRef = useRef(null);
  const [divingCenterSearch, setDivingCenterSearch] = useState('');
  const [isDivingCenterDropdownOpen, setIsDivingCenterDropdownOpen] = useState(false);
  const divingCenterDropdownRef = useRef(null);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('video'); // Changed default to video since photos use file upload
  const [newMediaDescription, setNewMediaDescription] = useState('');
  const [selectedBuddies, setSelectedBuddies] = useState([]);
  const [newMediaIsPublic, setNewMediaIsPublic] = useState(true);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef(null);

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

      setFormData({
        dive_site_id: data.dive_site_id ? data.dive_site_id.toString() : '',
        diving_center_id: data.diving_center_id ? data.diving_center_id.toString() : '',
        selected_route_id: data.selected_route_id ? data.selected_route_id.toString() : '',
        name: data.name || '',
        is_private: data.is_private || false,
        dive_information: data.dive_information || '',
        max_depth: data.max_depth || '',
        average_depth: data.average_depth || '',
        gas_bottles_used: data.gas_bottles_used || '',
        suit_type: data.suit_type || '',
        difficulty_code: data.difficulty_code || '',
        visibility_rating: data.visibility_rating || '',
        user_rating: data.user_rating || '',
        dive_date: data.dive_date || new Date().toISOString().split('T')[0],
        dive_time: data.dive_time ? data.dive_time.substring(0, 5) : '',
        duration: data.duration || '',
        selectedTags: data.tags ? data.tags.map(tag => tag.id) : [],
      });

      // Load existing buddies
      if (data.buddies && Array.isArray(data.buddies)) {
        setSelectedBuddies(data.buddies);
      } else {
        setSelectedBuddies([]);
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
      if (
        divingCenterDropdownRef.current &&
        !divingCenterDropdownRef.current.contains(event.target)
      ) {
        setIsDivingCenterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Initialize dive site search when dive data loads
  useEffect(() => {
    if (dive && dive.dive_site) {
      // Use dive site name directly from API response
      setDiveSiteSearch(dive.dive_site.name);
      // Also add the current dive site to search results so it's available for selection
      setDiveSiteSearchResults([dive.dive_site]);
    }
  }, [dive]);

  // Initialize diving center search when dive data loads
  useEffect(() => {
    if (dive && dive.diving_center) {
      // Use diving center name directly from API response
      setDivingCenterSearch(dive.diving_center.name);
    } else if (
      dive &&
      dive.diving_center_id &&
      Array.isArray(divingCenters) &&
      divingCenters.length > 0
    ) {
      // Fallback: search in divingCenters array if diving_center object is not available
      const selectedCenter = divingCenters.find(center => center.id === dive.diving_center_id);
      if (selectedCenter) {
        setDivingCenterSearch(selectedCenter.name);
      }
    }
  }, [dive, divingCenters]);

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

  // TODO: Clear route selection when dive site changes (but not during initial load)
  // This useEffect was causing issues with route pre-selection during form initialization
  // Need to implement a better solution that doesn't interfere with initial form data loading
  /*
  useEffect(() => {
    // Only clear route selection if:
    // 1. Dive data has been loaded (dive exists)
    // 2. There's a dive site ID
    // 3. There's a selected route ID
    // 4. The selected route doesn't belong to the current dive site
    if (dive && formData.dive_site_id && formData.selected_route_id) {
      const currentRoute = dive.selected_route;
      if (currentRoute && currentRoute.dive_site_id !== parseInt(formData.dive_site_id)) {
        setFormData(prev => ({
          ...prev,
          selected_route_id: '',
        }));
      }
    }
  }, [formData.dive_site_id, dive]);
  */

  // Update dive mutation
  const updateDiveMutation = useMutation(({ diveId, diveData }) => updateDive(diveId, diveData), {
    onSuccess: () => {
      toast.success('Dive updated successfully!');
      queryClient.invalidateQueries(['dives']);
      queryClient.invalidateQueries(['dive', id]);
      navigate(`/dives/${id}`);
    },
    onError: error => {
      let errorMessage = 'Failed to update dive';
      if (error.response?.status === 404) {
        errorMessage = 'Dive not found or you do not have permission to edit it.';
      } else if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          // Handle validation errors array
          const firstError = error.response.data.detail[0];
          errorMessage = firstError.msg || 'Validation error';
        } else {
          // Handle simple string error
          errorMessage = error.response.data.detail;
        }
      }
      toast.error(errorMessage);
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRouteSelect = routeId => {
    setFormData(prev => ({
      ...prev,
      selected_route_id: routeId,
    }));
  };

  const handleTagToggle = tagId => {
    setFormData(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tagId)
        ? prev.selectedTags.filter(id => id !== tagId)
        : [...prev.selectedTags, tagId],
    }));
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
  const filteredDivingCenters = divingCenterSearch
    ? divingCenters.filter(center =>
        center.name.toLowerCase().includes(divingCenterSearch.toLowerCase())
      )
    : [];

  const handleDiveSiteSelect = (siteId, siteName) => {
    handleInputChange('dive_site_id', siteId.toString());
    setDiveSiteSearch(siteName);
    setIsDiveSiteDropdownOpen(false);
  };

  const handleDivingCenterSelect = (centerId, centerName) => {
    handleInputChange('diving_center_id', centerId.toString());
    setDivingCenterSearch(centerName);
    setIsDivingCenterDropdownOpen(false);
  };

  const handleDiveSiteSearchChange = value => {
    setDiveSiteSearch(value);
    setIsDiveSiteDropdownOpen(true);
    if (!value) {
      handleInputChange('dive_site_id', '');
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

  const handleDivingCenterSearchChange = value => {
    setDivingCenterSearch(value);
    setIsDivingCenterDropdownOpen(true);
    if (!value) {
      handleInputChange('diving_center_id', '');
    }
  };

  const handleDiveSiteKeyDown = e => {
    if (e.key === 'Escape') {
      setIsDiveSiteDropdownOpen(false);
    }
  };

  const handleDivingCenterKeyDown = e => {
    if (e.key === 'Escape') {
      setIsDivingCenterDropdownOpen(false);
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

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Prevent multiple simultaneous uploads
    if (uploadingPhotos) {
      return;
    }

    setUploadingPhotos(true);
    const uploadPromises = files.map(async (file) => {
      try {
        const uploadedMedia = await uploadDivePhoto(
          id,
          file,
          newMediaDescription.trim(),
          newMediaIsPublic
        );
        return {
          id: uploadedMedia.id, // Use database ID for uploaded photos
          type: 'photo',
          url: uploadedMedia.url,
          description: uploadedMedia.description || '',
          title: '',
          is_public: uploadedMedia.is_public,
          uploaded: true, // Mark as already uploaded (indicates it's in database)
        };
      } catch (error) {
        toast.error(`Failed to upload ${file.name}: ${error.response?.data?.detail || error.message}`);
        return null;
      }
    });

    const uploadedMedia = await Promise.all(uploadPromises);
    const validMedia = uploadedMedia.filter(m => m !== null);
    
    if (validMedia.length > 0) {
      setMediaUrls(prev => [...prev, ...validMedia]);
      toast.success(`Successfully uploaded ${validMedia.length} photo(s)`);
    }

    // Reset form
    setNewMediaDescription('');
    setNewMediaIsPublic(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadingPhotos(false);
  };

  const handleMediaRemove = async (mediaItem) => {
    // If this is an uploaded photo (has database ID), delete it from backend and R2
    if (mediaItem.uploaded && typeof mediaItem.id === 'number') {
      try {
        await deleteDiveMedia(id, mediaItem.id);
        toast.success('Photo deleted successfully');
        queryClient.invalidateQueries(['dive', id]);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete photo');
        return; // Don't remove from UI if deletion failed
      }
    }
    
    // Remove from local state
    setMediaUrls(prev => prev.filter(item => item.id !== mediaItem.id));
  };

  const handleMediaDescriptionChange = (id, description) => {
    setMediaUrls(prev => prev.map(item => (item.id === id ? { ...item, description } : item)));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Validate required fields
    if (!formData.dive_date) {
      toast.error('Dive date is required');
      return;
    }

    if (!formData.dive_site_id) {
      toast.error('Dive site is required');
      return;
    }

    const diveData = {
      dive_site_id:
        formData.dive_site_id && formData.dive_site_id !== ''
          ? parseInt(formData.dive_site_id)
          : null,
      diving_center_id:
        formData.diving_center_id && formData.diving_center_id !== ''
          ? parseInt(formData.diving_center_id)
          : null,
      selected_route_id:
        formData.selected_route_id && formData.selected_route_id !== ''
          ? parseInt(formData.selected_route_id)
          : null,
      name: formData.name !== undefined ? formData.name : null,
      is_private: formData.is_private || false,
      dive_information: formData.dive_information || null,
      max_depth: formData.max_depth ? parseFloat(formData.max_depth) : null,
      average_depth: formData.average_depth ? parseFloat(formData.average_depth) : null,
      gas_bottles_used: formData.gas_bottles_used || null,
      suit_type: formData.suit_type && formData.suit_type !== '' ? formData.suit_type : null,
      difficulty_code:
        formData.difficulty_code && formData.difficulty_code !== ''
          ? formData.difficulty_code
          : null,
      visibility_rating: formData.visibility_rating ? parseInt(formData.visibility_rating) : null,
      user_rating: formData.user_rating ? parseInt(formData.user_rating) : null,
      dive_date: formData.dive_date || new Date().toISOString().split('T')[0],
      dive_time:
        formData.dive_time && formData.dive_time !== '' ? `${formData.dive_time}:00` : null,
      duration: formData.duration ? parseInt(formData.duration) : null,
      tags: formData.selectedTags || [],
      buddies: selectedBuddies.length > 0 ? selectedBuddies.map(buddy => buddy.id) : [],
    };

    try {
      await updateDiveMutation.mutateAsync({ diveId: id, diveData });

      // Add media URLs (only for non-uploaded media, uploaded photos are already saved)
      // Also update descriptions for already-uploaded photos
      const mediaPromises = [];

      for (const mediaUrl of mediaUrls) {
        // If photo was already uploaded, update its description if changed
        if (mediaUrl.uploaded && mediaUrl.id) {
          mediaPromises.push(
            updateDiveMedia(id, mediaUrl.id, mediaUrl.description || '', mediaUrl.is_public).catch(_error => {
              toast.error(`Failed to update media description: ${mediaUrl.url}`);
            })
          );
          continue;
        }

        // Add new media URLs
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
      } else {
        toast.success('Dive updated successfully!');
      }

      queryClient.invalidateQueries(['dives']);
      queryClient.invalidateQueries(['dive', id]);
      navigate(`/dives/${id}`);
    } catch (error) {
      let errorMessage = 'Failed to update dive';
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          // Handle validation errors array
          const firstError = error.response.data.detail[0];
          errorMessage = firstError.msg || 'Validation error';
        } else {
          // Handle simple string error
          errorMessage = error.response.data.detail;
        }
      }
      toast.error(errorMessage);
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
    <div className='max-w-4xl mx-auto'>
      <div className='flex items-center gap-4 mb-6'>
        <button
          onClick={() => navigate(`/dives/${id}`)}
          className='text-gray-600 hover:text-gray-800'
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className='text-3xl font-bold text-gray-900'>Edit Dive</h1>
      </div>

      <form onSubmit={handleSubmit} className='bg-white rounded-lg shadow p-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Basic Information */}
          <div className='md:col-span-2'>
            <h2 className='text-xl font-semibold mb-4'>Basic Information</h2>
          </div>

          <div className='relative' ref={diveSiteDropdownRef}>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Dive Site (Optional)
            </label>
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
                      {site.country && <div className='text-sm text-gray-500'>{site.country}</div>}
                    </div>
                  ))
                ) : (
                  <div className='px-3 py-2 text-gray-500 text-sm'>No dive sites found</div>
                )}
              </div>
            )}
          </div>

          <div className='relative' ref={divingCenterDropdownRef}>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Diving Center (Optional)
            </label>
            <div className='relative'>
              <input
                type='text'
                value={divingCenterSearch}
                onChange={e => handleDivingCenterSearchChange(e.target.value)}
                onFocus={() => setIsDivingCenterDropdownOpen(true)}
                onKeyDown={handleDivingCenterKeyDown}
                placeholder='Search for a diving center...'
                className='w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
              <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform ${isDivingCenterDropdownOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {/* Dropdown */}
            {isDivingCenterDropdownOpen && (
              <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto'>
                {filteredDivingCenters.length > 0 ? (
                  filteredDivingCenters.map(center => (
                    <div
                      key={center.id}
                      onClick={() => handleDivingCenterSelect(center.id, center.name)}
                      className='px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0'
                    >
                      <div className='font-medium text-gray-900'>{center.name}</div>
                      {center.description && (
                        <div className='text-sm text-gray-500'>
                          {center.description.substring(0, 50)}...
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className='px-3 py-2 text-gray-500 text-sm'>No diving centers found</div>
                )}
              </div>
            )}
          </div>

          {/* Route Selection */}
          <RouteSelection
            diveSiteId={formData.dive_site_id}
            selectedRouteId={formData.selected_route_id}
            onRouteSelect={handleRouteSelect}
          />

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Dive Name (Optional)
            </label>
            <input
              type='text'
              value={formData.name || ''}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder='Custom dive name or leave empty for automatic naming'
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Privacy Setting</label>
            <select
              value={formData.is_private ? 'true' : 'false'}
              onChange={e => handleInputChange('is_private', e.target.value === 'true')}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            >
              <option value='false'>Public (visible to everyone)</option>
              <option value='true'>Private (visible only to you)</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Dive Date *</label>
            <input
              type='date'
              value={formData.dive_date || ''}
              onChange={e => handleInputChange('dive_date', e.target.value)}
              required
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Dive Time (Optional)
            </label>
            <input
              type='time'
              value={formData.dive_time || ''}
              onChange={e => handleInputChange('dive_time', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Duration (minutes)
            </label>
            <input
              type='number'
              min='1'
              max='1440'
              value={formData.duration || ''}
              onChange={e => handleInputChange('duration', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              placeholder='60'
            />
          </div>

          {/* Dive Details */}
          <div className='md:col-span-2'>
            <h2 className='text-xl font-semibold mb-4'>Dive Details</h2>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Max Depth (meters)
            </label>
            <input
              type='number'
              min='0'
              max='1000'
              step='any'
              value={formData.max_depth || ''}
              onChange={e => handleInputChange('max_depth', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              placeholder='18.5'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Average Depth (meters)
            </label>
            <input
              type='number'
              min='0'
              max='1000'
              step='any'
              value={formData.average_depth || ''}
              onChange={e => handleInputChange('average_depth', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              placeholder='12.0'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Difficulty Level</label>
            <select
              value={formData.difficulty_code || ''}
              onChange={e => handleInputChange('difficulty_code', e.target.value)}
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
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Suit Type</label>
            <select
              value={formData.suit_type || ''}
              onChange={e => handleInputChange('suit_type', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            >
              <option value=''>Select suit type</option>
              <option value='wet_suit'>Wet Suit</option>
              <option value='dry_suit'>Dry Suit</option>
              <option value='shortie'>Shortie</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Visibility Rating (1-10)
            </label>
            <input
              type='number'
              min='1'
              max='10'
              value={formData.visibility_rating || ''}
              onChange={e => handleInputChange('visibility_rating', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              placeholder='8'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Your Rating (1-10)
            </label>
            <input
              type='number'
              min='1'
              max='10'
              value={formData.user_rating || ''}
              onChange={e => handleInputChange('user_rating', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              placeholder='9'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Gas Bottles Used</label>
            <textarea
              value={formData.gas_bottles_used || ''}
              onChange={e => handleInputChange('gas_bottles_used', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              rows='2'
              placeholder='e.g., 12L aluminum tank, 200 bar'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Dive Information</label>
            <textarea
              value={formData.dive_information || ''}
              onChange={e => handleInputChange('dive_information', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
              rows='4'
              placeholder='Describe your dive experience, what you saw, conditions, etc.'
            />
          </div>

          {/* Media */}
          <div className='md:col-span-2'>
            <h2 className='text-xl font-semibold mb-4'>Media</h2>
            <div className='space-y-4'>
              {/* Photo Upload */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Upload Photos
                </label>
                <div className='space-y-3'>
                  <div className='flex items-center gap-4'>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='image/jpeg,image/jpg,image/png,image/gif,image/webp'
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhotos}
                      className='hidden'
                      id='photo-upload-input'
                    />
                    <button
                      type='button'
                      onClick={(e) => {
                        e.preventDefault();
                        // Prevent multiple clicks
                        if (uploadingPhotos || !fileInputRef.current) {
                          return;
                        }
                        // Trigger file input click
                        fileInputRef.current.click();
                      }}
                      disabled={uploadingPhotos}
                      className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        uploadingPhotos ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Image size={16} />
                      {uploadingPhotos ? 'Uploading...' : 'Choose Photos'}
                    </button>
                    <span className='text-sm text-gray-500'>
                      Select one or more photos from your computer
                    </span>
                  </div>
                  
                  <div className='flex items-center'>
                    <input
                      id='photo-is-public'
                      type='checkbox'
                      checked={newMediaIsPublic}
                      onChange={e => setNewMediaIsPublic(e.target.checked)}
                      className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                    />
                    <label
                      htmlFor='photo-is-public'
                      className='ml-2 block text-sm text-gray-700'
                    >
                      Make photos public (visible on dive site)
                    </label>
                  </div>
                  
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                      Description (Optional) - Applied to all selected photos
                    </label>
                    <textarea
                      value={newMediaDescription}
                      onChange={e => setNewMediaDescription(e.target.value)}
                      placeholder='Describe these photos...'
                      className='w-full border border-gray-300 rounded-md px-3 py-2'
                      rows='2'
                    />
                  </div>
                </div>
              </div>

              {/* URL Upload for Videos and External Links */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Add Media URLs (Videos & External Links)
                </label>
                <div className='flex items-center gap-4'>
                  <button
                    type='button'
                    onClick={() => setShowMediaForm(true)}
                    className='flex items-center gap-2 px-4 py-2 text-white rounded-md'
                    style={{ backgroundColor: UI_COLORS.success }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#007a5c')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = UI_COLORS.success)}
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
                          <option value='video'>Video</option>
                          <option value='photo'>Photo</option>
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

                      <div className='flex items-center'>
                        <input
                          id='media-is-public'
                          type='checkbox'
                          checked={newMediaIsPublic}
                          onChange={e => setNewMediaIsPublic(e.target.checked)}
                          className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                        />
                        <label
                          htmlFor='media-is-public'
                          className='ml-2 block text-sm text-gray-700'
                        >
                          Make this media public (visible on dive site)
                        </label>
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
                            setNewMediaIsPublic(true);
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

              {/* Media Preview */}
              {mediaUrls.length > 0 && (
                <div className='space-y-3'>
                  <h3 className='text-lg font-medium text-gray-900'>Media Preview</h3>

                  {mediaUrls.map(media => (
                    <div
                      key={media.id}
                      className='flex items-start gap-3 p-3 border border-gray-200 rounded-lg'
                    >
                      <div className='flex-shrink-0'>
                        {media.type === 'photo' ? (
                          <Image size={24} className='text-blue-600' />
                        ) : media.type === 'video' ? (
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
                        <div className='text-xs text-gray-500 mb-2'>
                          Type: {media.type} •{' '}
                          <span
                            className={
                              media.is_public !== false
                                ? 'text-green-600 font-medium'
                                : 'text-orange-600 font-medium'
                            }
                          >
                            {media.is_public !== false ? 'Public' : 'Private'}
                          </span>
                        </div>
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
                      formData.selectedTags?.includes(tag.id)
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
    </div>
  );
};

export default EditDive;
