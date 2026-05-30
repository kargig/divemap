import { Upload, X, FileImage, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from 'react-query';

import { uploadDivePhoto } from '../services/dives';
import { extractErrorMessage } from '../utils/apiErrors';

import Button from './ui/Button';
import Modal from './ui/Modal';

const MultiPhotoUploadModal = ({ isOpen, onClose, diveId, onUploadSuccess }) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFileSelect = e => {
    const selectedFiles = Array.from(e.target.files);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));

    if (selectedFiles.length !== imageFiles.length) {
      toast.error('Only image files are supported');
    }

    setFiles(prev => [...prev, ...imageFiles]);
    e.target.value = ''; // Reset input
  };

  const removeFile = indexToRemove => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prev => ({ ...prev, [i]: 'uploading' }));

      try {
        await uploadDivePhoto(diveId, file, '', true); // description='', isPublic=true
        setUploadProgress(prev => ({ ...prev, [i]: 'success' }));
        successCount++;
      } catch (error) {
        console.error('Failed to upload photo:', error);
        setUploadProgress(prev => ({ ...prev, [i]: 'error' }));
        errorCount++;
      }
    }

    setIsUploading(false);

    // Notify parent to refresh queries
    if (onUploadSuccess) {
      onUploadSuccess();
    } else {
      // Fallback: Ensure ID is a string to match useParams() used in parent page query keys
      queryClient.invalidateQueries(['dive-media', String(diveId)]);
      queryClient.invalidateQueries(['dive', String(diveId)]);
    }

    if (errorCount === 0) {
      toast.success(`Successfully uploaded ${successCount} photo(s)`);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } else {
      toast.error(`Uploaded ${successCount}, failed ${errorCount}. Please try again.`);
    }
  };

  const handleClose = () => {
    if (isUploading) return; // Prevent closing while uploading
    setFiles([]);
    setUploadProgress({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Upload Photos'>
      <div className='space-y-4'>
        {/* Drag & Drop Zone / Select Button */}
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isUploading
              ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
              : 'border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50'
          }`}
        >
          <input
            type='file'
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept='image/*'
            className='hidden'
            disabled={isUploading}
          />
          <Upload className='w-10 h-10 text-blue-500 mx-auto mb-3' />
          <h3 className='text-sm font-medium text-gray-900 mb-1'>Click to select photos</h3>
          <p className='text-xs text-gray-500'>JPG, PNG, GIF, WEBP up to 10MB</p>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className='space-y-2 max-h-60 overflow-y-auto pr-2'>
            {files.map((file, index) => {
              const status = uploadProgress[index];
              return (
                <div
                  key={`${file.name}-${index}`}
                  className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100'
                >
                  <div className='flex items-center gap-3 overflow-hidden'>
                    <div className='w-10 h-10 bg-white rounded flex items-center justify-center flex-shrink-0'>
                      <FileImage className='w-5 h-5 text-blue-500' />
                    </div>
                    <div className='min-w-0'>
                      <p className='text-sm font-medium text-gray-700 truncate'>{file.name}</p>
                      <p className='text-xs text-gray-400'>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    {status === 'uploading' && (
                      <Loader2 className='w-5 h-5 text-blue-500 animate-spin' />
                    )}
                    {status === 'success' && <CheckCircle2 className='w-5 h-5 text-green-500' />}
                    {status === 'error' && <AlertCircle className='w-5 h-5 text-red-500' />}

                    {!status && !isUploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className='p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-red-500 transition-colors'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className='flex justify-end gap-3 pt-4 border-t border-gray-100'>
          <Button onClick={handleClose} variant='secondary' disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant='primary'
            disabled={files.length === 0 || isUploading}
            icon={
              isUploading ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Upload className='w-4 h-4' />
              )
            }
          >
            {isUploading
              ? 'Uploading...'
              : `Upload ${files.length} Photo${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MultiPhotoUploadModal;
