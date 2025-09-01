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
  getDivingCenters,
} from '../api';
import { useAuth } from '../contexts/AuthContext';
import { getDifficultyValue } from '../utils/difficultyHelpers';

const EditDive = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({});
  const [newTag, setNewTag] = useState('');
  const [diveSiteSearch, setDiveSiteSearch] = useState('');
  const [isDiveSiteDropdownOpen, setIsDiveSiteDropdownOpen] = useState(false);
  const diveSiteDropdownRef = useRef(null);
  const [divingCenterSearch, setDivingCenterSearch] = useState('');
  const [isDivingCenterDropdownOpen, setIsDivingCenterDropdownOpen] = useState(false);
  const divingCenterDropdownRef = useRef(null);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState('external_link');
  const [newMediaDescription, setNewMediaDescription] = useState('');

  // Fetch dive data
  const {
    data: dive,
    isLoading,
    error,
  } = useQuery(['dive', id], () => getDive(id), {
    enabled: !!id && !authLoading && !!user,
    onSuccess: data => {
      // Check if the dive belongs to the current user
      if (data.user_id !== user?.id) {
        toast.error('You can only edit your own dives');
        navigate('/dives');
        return;
      }

      setFormData({
        dive_site_id: data.dive_site_id ? data.dive_site_id.toString() : '',
        diving_center_id: data.diving_center_id ? data.diving_center_id.toString() : '',
        name: data.name || '',
        is_private: data.is_private || false,
        dive_information: data.dive_information || '',
        max_depth: data.max_depth || '',
        average_depth: data.average_depth || '',
        gas_bottles_used: data.gas_bottles_used || '',
        suit_type: data.suit_type || '',
        difficulty_level: data.difficulty_level || '',
        visibility_rating: data.visibility_rating || '',
        user_rating: data.user_rating || '',
        dive_date: data.dive_date || new Date().toISOString().split('T')[0],
        dive_time: data.dive_time ? data.dive_time.substring(0, 5) : '',
        duration: data.duration || '',
        selectedTags: data.tags ? data.tags.map(tag => tag.id) : [],
      });
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
    if (dive && dive.dive_site_id && Array.isArray(diveSites) && diveSites.length > 0) {
      const selectedSite = diveSites.find(site => site.id === dive.dive_site_id);
      if (selectedSite) {
        setDiveSiteSearch(selectedSite.name);
      }
    }
  }, [dive, diveSites]);

  // Initialize diving center search when dive data loads
  useEffect(() => {
    if (dive && dive.diving_center_id && Array.isArray(divingCenters) && divingCenters.length > 0) {
      const selectedCenter = divingCenters.find(center => center.id === dive.diving_center_id);
      if (selectedCenter) {
        setDivingCenterSearch(selectedCenter.name);
      }
    }
  }, [dive, divingCenters]);

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
        errorMessage = 'You can only edit your own dives. This dive belongs to another user.';
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
      toast.info('Tag creation feature coming soon!');
      setNewTag('');
    }
  };

  // Filter dive sites based on search input
  const filteredDiveSites = Array.isArray(diveSites)
    ? diveSites.filter(site => site.name.toLowerCase().includes(diveSiteSearch.toLowerCase()))
    : [];

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
    }
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
      };
      setMediaUrls(prev => [...prev, newMedia]);

      // Reset form
      setNewMediaUrl('');
      setNewMediaType('external_link');
      setNewMediaDescription('');
      setShowMediaForm(false);
    }
  };

  const handleMediaRemove = id => {
    setMediaUrls(prev => prev.filter(item => item.id !== id));
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
      name: formData.name !== undefined ? formData.name : null,
      is_private: formData.is_private || false,
      dive_information: formData.dive_information || null,
      max_depth: formData.max_depth ? parseFloat(formData.max_depth) : null,
      average_depth: formData.average_depth ? parseFloat(formData.average_depth) : null,
      gas_bottles_used: formData.gas_bottles_used || null,
      suit_type: formData.suit_type && formData.suit_type !== '' ? formData.suit_type : null,
      difficulty_level:
        formData.difficulty_level && formData.difficulty_level !== ''
          ? getDifficultyValue(formData.difficulty_level)
          : null,
      visibility_rating: formData.visibility_rating ? parseInt(formData.visibility_rating) : null,
      user_rating: formData.user_rating ? parseInt(formData.user_rating) : null,
      dive_date: formData.dive_date || new Date().toISOString().split('T')[0],
      dive_time:
        formData.dive_time && formData.dive_time !== '' ? `${formData.dive_time}:00` : null,
      duration: formData.duration ? parseInt(formData.duration) : null,
      tags: formData.selectedTags || [],
    };

    try {
      await updateDiveMutation.mutateAsync({ diveId: id, diveData });

      // Add media URLs
      const mediaPromises = [];

      for (const mediaUrl of mediaUrls) {
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
                {filteredDiveSites.length > 0 ? (
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
              value={formData.difficulty_level || ''}
              onChange={e => handleInputChange('difficulty_level', e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2'
            >
              <option value=''>Select difficulty</option>
              <option value='beginner'>Beginner</option>
              <option value='intermediate'>Intermediate</option>
              <option value='advanced'>Advanced</option>
              <option value='expert'>Expert</option>
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
              {/* URL Upload */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Add Media URLs
                </label>
                <div className='flex items-center gap-4'>
                  <button
                    type='button'
                    onClick={() => setShowMediaForm(true)}
                    className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700'
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
                          <option value='photo'>Photo</option>
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
                          className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          Add Media
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setShowMediaForm(false);
                            setNewMediaUrl('');
                            setNewMediaType('external_link');
                            setNewMediaDescription('');
                          }}
                          className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700'
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
                            onClick={() => handleMediaRemove(media.id)}
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
            onClick={() => navigate(`/dives/${id}`)}
            className='px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={updateDiveMutation.isLoading}
            className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
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
