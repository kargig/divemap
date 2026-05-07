import { Upload, Camera, Trash2, Check, LayoutGrid, X } from 'lucide-react';
import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';

import Avatar from './Avatar';
import Button from './ui/Button';
import Modal from './ui/Modal';

const AvatarEditor = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  currentAvatarFullUrl,
  currentType,
  username,
  googleAvatarUrl,
  onAvatarUpdated,
}) => {
  const [activeTab, setActiveTab] = useState('gallery');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Fetch library icons (returns {path, full_url}[])
  const { data: libraryIcons = [], isLoading: isLibraryLoading } = useQuery(
    ['avatar-library'],
    async () => {
      const res = await api.get('/api/v1/users/avatars/library');
      return res.data;
    },
    { enabled: isOpen }
  );

  const uploadMutation = useMutation(
    async file => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/v1/users/me/avatar/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    {
      onSuccess: data => {
        toast.success('Avatar uploaded successfully!');
        onAvatarUpdated(data);
        onClose();
        queryClient.invalidateQueries(['user-me']);
      },
      onError: err => {
        toast.error(err.response?.data?.detail || 'Failed to upload avatar');
      },
    }
  );

  const selectLibraryMutation = useMutation(
    async path => {
      const res = await api.post('/api/v1/users/me/avatar/library', {
        avatar_url: path,
        avatar_type: 'library',
      });
      return res.data;
    },
    {
      onSuccess: data => {
        toast.success('Avatar updated!');
        onAvatarUpdated(data);
        onClose();
        queryClient.invalidateQueries(['user-me']);
      },
    }
  );

  const removeMutation = useMutation(async () => api.delete('/api/v1/users/me/avatar'), {
    onSuccess: res => {
      toast.success('Avatar reset');
      onAvatarUpdated(res.data);
      onClose();
      queryClient.invalidateQueries(['user-me']);
    },
  });

  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File too large (max 2MB)');
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  const hasGoogleAvatar = Boolean(googleAvatarUrl);
  // Show reset button if user has a custom/library avatar, OR if current avatar doesn't match google avatar
  const showResetButton =
    currentType === 'custom' ||
    currentType === 'library' ||
    (hasGoogleAvatar && currentAvatarUrl !== googleAvatarUrl);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Change Profile Picture'
      className='w-[95vw] md:w-full max-w-2xl h-[85vh] md:h-[600px] flex flex-col'
    >
      <div className='p-1 flex-1 flex flex-col min-h-0'>
        {/* Tabs */}
        <div className='flex border-b border-gray-200 mb-6 shrink-0'>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'gallery' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Gallery
            {activeTab === 'gallery' && (
              <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600' />
            )}
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'upload' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload Custom
            {activeTab === 'upload' && (
              <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600' />
            )}
          </button>
        </div>

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div className='flex-1 flex flex-col min-h-0'>
            <p className='text-sm text-gray-500 mb-4 shrink-0'>
              Choose one of our scuba-themed animal avatars:
            </p>
            {isLibraryLoading ? (
              <div className='grid grid-cols-4 sm:grid-cols-5 gap-3'>
                {[...Array(10)].map((_, i) => (
                  <div key={i} className='aspect-square bg-gray-100 animate-pulse rounded-lg' />
                ))}
              </div>
            ) : (
              <div className='flex-1 overflow-y-auto pr-2 min-h-0'>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  {libraryIcons.map(icon => (
                    <button
                      key={icon.path}
                      onClick={() => selectLibraryMutation.mutate(icon.path)}
                      className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        currentAvatarUrl === icon.path
                          ? 'border-blue-600 ring-2 ring-blue-100'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={icon.full_url}
                        alt='Library avatar'
                        className='w-full h-full min-w-full min-h-full object-cover group-hover:scale-110 transition-transform'
                        loading='lazy'
                      />
                      {currentAvatarUrl === icon.path && (
                        <div className='absolute inset-0 bg-blue-600/10 flex items-center justify-center'>
                          <div className='bg-blue-600 text-white rounded-full p-1 shadow-lg'>
                            <Check className='h-4 w-4' />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className='flex-1 flex flex-col items-center justify-center py-4'>
            <div className='relative mb-6'>
              <div className='h-32 w-32 rounded-full overflow-hidden border-4 border-gray-100 shadow-inner'>
                <Avatar
                  src={currentAvatarFullUrl}
                  alt={username}
                  size='xl'
                  className='w-full h-full'
                  username={username}
                />
              </div>
              <label className='absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors'>
                <Camera className='h-5 w-5' />
                <input
                  type='file'
                  className='hidden'
                  accept='image/*'
                  onChange={handleFileUpload}
                  disabled={uploadMutation.isLoading}
                />
              </label>
            </div>

            <div className='text-center max-w-sm'>
              <h3 className='font-semibold text-gray-900 mb-1'>Upload a new photo</h3>
              <p className='text-sm text-gray-500 mb-6'>
                JPG, PNG or WebP. Max size 2MB. Your photo will be cropped to a square.
              </p>
              <div className='flex flex-col gap-3'>
                <div className='w-full'>
                  <Button
                    variant='primary'
                    className='w-full'
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={uploadMutation.isLoading}
                  >
                    Select File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type='file'
                    className='hidden'
                    accept='image/*'
                    onChange={handleFileUpload}
                  />
                </div>

                {showResetButton && (
                  <Button
                    variant='danger-outline'
                    className='w-full'
                    onClick={() => removeMutation.mutate()}
                    isLoading={removeMutation.isLoading}
                  >
                    <Trash2 className='h-4 w-4 mr-2' />
                    {hasGoogleAvatar ? 'Reset to Google Photo' : 'Remove Photo'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AvatarEditor;
