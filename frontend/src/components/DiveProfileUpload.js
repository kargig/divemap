import { Upload, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import api from '../api';

import Modal from './ui/Modal';

const DiveProfileUpload = ({ onUpload, onClose, isOpen, diveId }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = event => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/xml') {
        setError('Only XML files are allowed.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await api.post(`/api/v1/dives/${diveId}/profile`, formData);

      onUpload(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title='Upload Dive Profile'
      className='max-w-md w-full mx-4'
    >
      <div className='p-0'>
        {error && (
          <div className='flex items-center p-3 mb-4 text-sm text-red-800 rounded-lg bg-red-50'>
            <AlertCircle className='h-4 w-4 mr-2' />
            {error}
          </div>
        )}
        <div className='mb-4'>
          <label htmlFor='file-upload' className='block text-sm font-medium text-gray-700 mb-2'>
            Select XML File
          </label>
          <div
            className='mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6 cursor-pointer hover:border-gray-400'
            onClick={() => document.getElementById('file-upload').click()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('file-upload').click();
              }
            }}
            role='button'
            tabIndex={0}
          >
            <div className='space-y-1 text-center'>
              <Upload className='mx-auto h-12 w-12 text-gray-400' />
              <div className='flex text-sm text-gray-600'>
                <label
                  htmlFor='file-upload'
                  className='relative cursor-pointer rounded-md bg-white font-medium text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:text-blue-500'
                >
                  <span>Click to select XML file</span>
                  <input
                    id='file-upload'
                    name='file-upload'
                    type='file'
                    className='sr-only'
                    onChange={handleFileSelect}
                    accept='.xml'
                  />
                </label>
                <p className='pl-1'>or drag and drop</p>
              </div>
              <p className='text-xs text-gray-500'>Subsurface XML format</p>
            </div>
          </div>
        </div>
        <div className='flex justify-end space-x-3'>
          <button
            type='button'
            onClick={handleClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleUpload}
            disabled={!file || isUploading}
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isUploading ? 'Uploading...' : 'Upload Profile'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

DiveProfileUpload.propTypes = {
  onUpload: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  diveId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default DiveProfileUpload;
