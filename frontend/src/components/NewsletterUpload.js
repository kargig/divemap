import { Upload, FileText } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from 'react-query';

import { uploadNewsletter, parseNewsletterText, extractErrorMessage } from '../api';

const NewsletterUpload = ({ divingCenters = [], onSuccess }) => {
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState(null);
  const [newsletterText, setNewsletterText] = useState('');
  const [selectedDivingCenterId, setSelectedDivingCenterId] = useState('');
  const [useOpenai, setUseOpenai] = useState(true);
  const [useOpenaiText, setUseOpenaiText] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsingText, setIsParsingText] = useState(false);

  // Upload mutation
  const uploadMutation = useMutation(uploadNewsletter, {
    onSuccess: data => {
      toast.success(`Newsletter uploaded successfully! ${data.trips_created} trips created.`);
      setSelectedFile(null);
      queryClient.invalidateQueries('parsedTrips');
      queryClient.invalidateQueries('newsletters');
      if (onSuccess) onSuccess(data);
    },
    onError: error => {
      toast.error(`Upload failed: ${extractErrorMessage(error)}`);
    },
  });

  // Parse text mutation
  const parseTextMutation = useMutation(
    ({ content, divingCenterId, useOpenai }) =>
      parseNewsletterText(content, divingCenterId || null, useOpenai),
    {
      onSuccess: data => {
        toast.success(`Newsletter text parsed successfully! ${data.trips_created} trips created.`);
        setNewsletterText('');
        setSelectedDivingCenterId('');
        queryClient.invalidateQueries('parsedTrips');
        queryClient.invalidateQueries('newsletters');
        if (onSuccess) onSuccess(data);
      },
      onError: error => {
        toast.error(`Parse failed: ${extractErrorMessage(error)}`);
      },
    }
  );

  const handleFileChange = event => {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
      setSelectedFile(file);
    } else {
      toast.error('Please select a valid .txt file');
      event.target.value = null;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(selectedFile, useOpenai);
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseText = async () => {
    if (!newsletterText || !newsletterText.trim()) {
      toast.error('Please enter newsletter content to parse');
      return;
    }

    setIsParsingText(true);
    try {
      await parseTextMutation.mutateAsync({
        content: newsletterText,
        divingCenterId: selectedDivingCenterId ? parseInt(selectedDivingCenterId) : null,
        useOpenai: useOpenaiText,
      });
    } finally {
      setIsParsingText(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Upload Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Upload Newsletter</h2>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='newsletter-file'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Newsletter File (.txt only)
            </label>
            <div className='flex items-center space-x-4'>
              <input
                id='newsletter-file'
                type='file'
                accept='.txt'
                onChange={handleFileChange}
                className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
              />
              {selectedFile && (
                <div className='flex items-center text-sm text-gray-600'>
                  <FileText className='h-4 w-4 mr-2' />
                  {selectedFile.name}
                </div>
              )}
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='useOpenai'
              checked={useOpenai}
              onChange={e => setUseOpenai(e.target.checked)}
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
            />
            <label htmlFor='useOpenai' className='text-sm text-gray-700'>
              Use OpenAI for parsing (recommended)
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Upload className='h-4 w-4 mr-2' />
            {isUploading ? 'Uploading...' : 'Upload Newsletter'}
          </button>
        </div>
      </div>

      {/* Parse Text Section */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Parse Newsletter Text</h2>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='diving-center-select'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Diving Center (Optional)
            </label>
            <select
              id='diving-center-select'
              value={selectedDivingCenterId}
              onChange={e => setSelectedDivingCenterId(e.target.value)}
              className='w-full p-2 border border-gray-300 rounded-md text-sm'
            >
              <option value=''>Select diving center (optional)</option>
              {divingCenters.map(center => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            <p className='text-xs text-gray-500 mt-1'>
              Select the diving center organizing this trip. If not selected, the system will try to
              extract it from the text.
            </p>
          </div>

          <div>
            <label
              htmlFor='newsletter-text'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              Newsletter Content
            </label>
            <textarea
              id='newsletter-text'
              value={newsletterText}
              onChange={e => setNewsletterText(e.target.value)}
              placeholder='Paste newsletter content here...'
              className='w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='useOpenaiText'
              checked={useOpenaiText}
              onChange={e => setUseOpenaiText(e.target.checked)}
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
            />
            <label htmlFor='useOpenaiText' className='text-sm text-gray-700'>
              Use OpenAI for parsing (recommended)
            </label>
          </div>

          <button
            onClick={handleParseText}
            disabled={!newsletterText || !newsletterText.trim() || isParsingText}
            className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <FileText className='h-4 w-4 mr-2' />
            {isParsingText ? 'Parsing...' : 'Parse Newsletter Text'}
          </button>
        </div>
      </div>
    </div>
  );
};

NewsletterUpload.propTypes = {
  divingCenters: PropTypes.array.isRequired,
  onSuccess: PropTypes.func,
};

export default NewsletterUpload;
