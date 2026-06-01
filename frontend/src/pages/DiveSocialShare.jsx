import {
  Image as ImageIcon,
  Download,
  Upload,
  X,
  Maximize2,
  Check,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Edit,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import 'react-image-crop/dist/ReactCrop.css';

import api from '../api';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { getDive, getDiveMedia, uploadDivePhoto } from '../services/dives';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatDate } from '../utils/dateHelpers';
import { generateSocialImage, downloadBlob } from '../utils/socialHelpers';

/**
 * DiveSocialShare Page
 *
 * Allows users to select a dive photo, crop it, and generate a social-ready image.
 */
const availableFeatures = [
  { id: 'TIME', label: 'Duration' },
  { id: 'DEPTH', label: 'Max Depth' },
  { id: 'AVG', label: 'Avg Depth' },
  { id: 'TEMP', label: 'Temp' },
  { id: 'TANKS', label: 'Tanks' },
  { id: 'VISIBILITY', label: 'Visibility' },
  { id: 'RATING', label: 'Star Rating' },
];

const DiveSocialShare = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState();
  const [aspect, setAspect] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef(null);
  const [selectedMetrics, setSelectedMetrics] = useState(['TIME', 'DEPTH', 'AVG', 'TEMP']);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [isFeatureDropdownOpen, setIsFeatureDropdownOpen] = useState(false);

  // Fetch dive data
  const {
    data: dive,
    isLoading: diveLoading,
    error: diveError,
  } = useQuery(['dive', id], () => getDive(id), {
    enabled: !!id,
  });

  // Fetch dive media
  const {
    data: diveMedia = [],
    isLoading: mediaLoading,
    error: mediaError,
  } = useQuery(['dive-media', id], () => getDiveMedia(id), {
    enabled: !!id,
  });

  // Filter only photos
  const photos = diveMedia.filter(m => m.media_type === 'photo');

  // Initial photo selection
  useEffect(() => {
    if (photos.length > 0 && !selectedImage) {
      setSelectedImage(photos[0]);
    }
  }, [photos, selectedImage]);

  const onImageLoad = e => {
    const { width, height } = e.currentTarget;
    imgRef.current = e.currentTarget;

    // Initial crop: center crop with current aspect ratio
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  };

  const handleAspectChange = newAspect => {
    setAspect(newAspect);
    setZoom(1); // Reset zoom when aspect ratio changes
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const newCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          newAspect,
          width,
          height
        ),
        width,
        height
      );
      setCrop(newCrop);
    }
  };

  const handleZoomChange = useCallback(
    newZoom => {
      setZoom(newZoom);
      if (imgRef.current) {
        const { width, height } = imgRef.current;
        // Calculate crop width based on zoom (1x = 90% width, 3x = 30% width)
        const cropWidth = 90 / newZoom;
        const newCrop = centerCrop(
          makeAspectCrop(
            {
              unit: '%',
              width: cropWidth,
            },
            aspect,
            width,
            height
          ),
          width,
          height
        );
        setCrop(newCrop);
      }
    },
    [aspect]
  );

  const metricLimit = 6;

  const toggleMetric = metric => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) {
        return prev.filter(m => m !== metric);
      }
      if (prev.length >= metricLimit) {
        toast.error(`Maximum ${metricLimit} features allowed for this aspect ratio`);
        return prev;
      }
      return [...prev, metric];
    });
  };

  // Handle manual crop changes to update zoom slider
  const handleCropChange = (c, percentCrop) => {
    setCrop(percentCrop);
    // If the user manually resizes, we should update the zoom level
    // to match the new width percentage relative to our base 90%
    if (percentCrop.width > 0) {
      const newZoom = 90 / percentCrop.width;
      // Clamp between our 1x-3x range
      setZoom(Math.max(1, Math.min(3, newZoom)));
    }
  };

  const handleLocalPhotoUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading and selecting photo...');

    try {
      const newMedia = await uploadDivePhoto(id, file, '', true);
      toast.success('Photo uploaded and saved to dive log!', { id: toastId });

      // Auto-select the new photo
      setSelectedImage(newMedia);

      // Invalidate query to update the sidebar gallery
      queryClient.invalidateQueries(['dive-media', id]);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(extractErrorMessage(error, 'Failed to upload photo'), { id: toastId });
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  };

  const handleBack = () => {
    navigate(`/dives/${id}/${slug}`);
  };

  const handleGenerate = async () => {
    if (!selectedImage || !crop || !imgRef.current) {
      toast.error('Please select and crop an image first');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generating your masterpiece...');

    try {
      // Cleanup previous URL if exists
      if (generatedImageUrl) {
        URL.revokeObjectURL(generatedImageUrl);
      }

      const isPercent = crop.unit === '%';
      const pixelCrop = isPercent
        ? {
            x: (crop.x / 100) * imgRef.current.naturalWidth,
            y: (crop.y / 100) * imgRef.current.naturalHeight,
            width: (crop.width / 100) * imgRef.current.naturalWidth,
            height: (crop.height / 100) * imgRef.current.naturalHeight,
          }
        : {
            x: crop.x * (imgRef.current.naturalWidth / imgRef.current.width),
            y: crop.y * (imgRef.current.naturalHeight / imgRef.current.height),
            width: crop.width * (imgRef.current.naturalWidth / imgRef.current.width),
            height: crop.height * (imgRef.current.naturalHeight / imgRef.current.height),
          };

      const blob = await api
        .post(
          `/api/v1/dives/${dive.id}/social-image`,
          {
            media_url: selectedImage.url,
            media_id: selectedImage.id,
            crop: pixelCrop,
            metrics: selectedMetrics,
          },
          {
            responseType: 'blob',
          }
        )
        .then(res => res.data);

      const url = URL.createObjectURL(blob);
      setGeneratedImageUrl(url);
      setGeneratedBlob(blob);

      toast.success('Image ready for sharing!', { id: toastId });
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(extractErrorMessage(error, 'Failed to generate social image'), { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedBlob) return;
    const fileName = `dive_${dive.id}_social_${Date.now()}.jpg`;
    downloadBlob(generatedBlob, fileName);
    toast.success('Download started!');
  };

  const handleEditAgain = () => {
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl);
    }
    setGeneratedImageUrl(null);
    setGeneratedBlob(null);
  };

  if (diveLoading || mediaLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading editor...</p>
        </div>
      </div>
    );
  }

  if (diveError || mediaError) {
    const error = diveError || mediaError;
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
        <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center'>
          <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
          <h1 className='text-xl font-bold text-gray-900 mb-2'>Error Loading Photos</h1>
          <p className='text-gray-600 mb-6'>{extractErrorMessage(error)}</p>
          <Button onClick={handleBack} variant='primary'>
            Back to Dive Details
          </Button>
        </div>
      </div>
    );
  }

  const diveName = dive?.name || dive?.dive_site?.name || 'Unnamed Dive';

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col relative'>
      <SEO
        title={`Share ${diveName} - Social Image Creator`}
        description={`Create a social-ready share image for ${diveName}.`}
        noindex={true}
      />

      {!user && (
        <div
          className='fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-4xl bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-2xl backdrop-blur-sm'
          style={{
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          <div className='flex flex-col sm:flex-row items-center gap-4 sm:gap-6'>
            <div className='w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0'>
              <LogIn className='h-7 w-7 text-blue-600' />
            </div>
            <div className='flex-1 text-center sm:text-left'>
              <h3 className='text-lg font-bold text-blue-900 mb-1'>Login Required</h3>
              <p className='text-sm text-blue-700 mb-4 sm:mb-0'>
                The Social Image Creator is a member-only feature. Please log in or register to
                create beautiful shareable cards.
              </p>
            </div>
            <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
              <Button
                to='/login'
                variant='primary'
                size='md'
                icon={<LogIn className='h-4 w-4' />}
                className='w-full sm:w-auto justify-center'
              >
                Login
              </Button>
              <Button
                to='/register'
                variant='secondary'
                size='md'
                className='w-full sm:w-auto justify-center'
              >
                Register
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header Navigation */}
      <header className='bg-white border-b border-gray-200 sticky top-0 z-10'>
        <div className='max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-4 min-w-0'>
            <button
              onClick={handleBack}
              className='p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0'
              aria-label='Back to dive details'
            >
              <ArrowLeft className='h-6 w-6 text-gray-600' />
            </button>
            <div className='min-w-0'>
              <h1 className='text-lg font-bold text-gray-900 truncate'>
                {generatedImageUrl ? 'Preview Shared Image' : 'Create Social Image'}
              </h1>
              <p className='text-xs text-gray-500 truncate'>{diveName}</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {!generatedImageUrl && (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedImage}
                variant='primary'
                size='sm'
                className='hidden sm:flex'
                icon={
                  isGenerating ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Download className='w-4 h-4' />
                  )
                }
              >
                Generate Image
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 overflow-hidden flex ${
          generatedImageUrl ? 'flex-col-reverse' : 'flex-col'
        } md:flex-row relative`}
      >
        {!user && <div className='absolute inset-0 z-40 bg-gray-50/10 cursor-not-allowed' />}
        {generatedImageUrl ? (
          /* Preview View */
          <>
            {/* Left Side: Preview Actions */}
            <aside className='w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 overflow-y-auto p-4 sm:p-6'>
              <div className='space-y-6'>
                <div className='hidden md:block bg-green-50 border border-green-100 rounded-xl p-4 text-center'>
                  <Check className='w-8 h-8 text-green-500 mx-auto mb-2' />
                  <h3 className='font-bold text-green-900'>Your image is ready!</h3>
                  <p className='text-xs text-green-700 mt-1'>
                    Download it now to share on your social media.
                  </p>
                </div>

                <div className='space-y-3'>
                  <Button
                    onClick={handleDownload}
                    variant='primary'
                    className='w-full justify-center py-4 text-base'
                    icon={<Download className='w-5 h-5' />}
                  >
                    Download Image
                  </Button>
                  <Button
                    onClick={handleEditAgain}
                    variant='secondary'
                    className='w-full justify-center'
                    icon={<Edit className='w-4 h-4' />}
                  >
                    Back to Editor
                  </Button>
                </div>

                <div className='pt-6 border-t border-gray-100'>
                  <h4 className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-4'>
                    Sharing Tips
                  </h4>
                  <ul className='space-y-3 text-xs text-gray-500'>
                    <li className='flex gap-2'>
                      <div className='w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0' />
                      <span>
                        Tag{' '}
                        <a
                          href='https://www.instagram.com/divemap.blue'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:text-blue-700 font-bold transition-colors'
                        >
                          @divemap.blue
                        </a>{' '}
                        in your stories to get featured!
                      </span>
                    </li>
                    <li className='flex gap-2'>
                      <div className='w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0' />
                      <span>The 9:16 Story ratio is perfect for Instagram Reels and TikTok.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </aside>

            {/* Right Side: Final Preview */}
            <section className='flex-1 bg-gray-900 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-auto'>
              <div className='max-w-full max-h-full'>
                <div className='bg-black shadow-2xl rounded-sm overflow-hidden relative group'>
                  <img
                    src={generatedImageUrl}
                    alt='Final social share'
                    className='max-h-[75vh] w-auto shadow-2xl'
                  />
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4'>
                    <button
                      onClick={handleDownload}
                      className='bg-white text-gray-900 px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-blue-50 transition-colors'
                    >
                      <Download className='w-4 h-4' />
                      Download
                    </button>
                  </div>
                </div>
                <p className='text-center text-gray-500 text-xs mt-4'>
                  Final Preview (Actual quality will be higher in download)
                </p>
              </div>
            </section>
          </>
        ) : (
          /* Editor View (Original) */
          <>
            {/* Left Side: Photo Selection & Options (Sidebar) */}
            <aside className='w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 overflow-y-auto p-4 sm:p-6'>
              <div className='space-y-8'>
                <section>
                  <div className='flex items-center justify-between mb-3'>
                    <label className='text-sm font-bold text-gray-900 uppercase tracking-wider'>
                      1. Select Photo
                    </label>
                    <button
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={isUploading}
                      className='text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors'
                    >
                      <Upload className='w-3 h-3' />
                      UPLOAD NEW
                    </button>
                    <input
                      type='file'
                      ref={uploadInputRef}
                      onChange={handleLocalPhotoUpload}
                      accept='image/*'
                      className='hidden'
                    />
                  </div>
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 p-1'>
                    {photos.map(photo => (
                      <button
                        key={photo.id}
                        onClick={() => setSelectedImage(photo)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImage?.id === photo.id
                            ? 'border-blue-500 ring-4 ring-blue-50'
                            : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        <img src={photo.url} alt='' className='w-full h-full object-cover' />
                        {selectedImage?.id === photo.id && (
                          <div className='absolute inset-0 bg-blue-500/20 flex items-center justify-center'>
                            <div className='bg-blue-600 rounded-full p-1'>
                              <Check className='text-white w-4 h-4' />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                    {photos.length === 0 && (
                      <div className='col-span-3 py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200'>
                        <ImageIcon className='w-8 h-8 text-gray-300 mx-auto mb-2' />
                        <p className='text-sm text-gray-500 px-4'>
                          No photos available for this dive.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <label className='text-sm font-bold text-gray-900 mb-3 block uppercase tracking-wider'>
                    2. Choose Aspect Ratio
                  </label>

                  {/* Mobile Dropdown */}
                  <div className='block sm:hidden mb-4'>
                    <select
                      value={aspect}
                      onChange={e => handleAspectChange(parseFloat(e.target.value))}
                      className='w-full p-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none appearance-none'
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 1rem center',
                        backgroundSize: '1em',
                      }}
                    >
                      {[
                        { label: 'Square (1:1) - Instagram Post', val: 1 },
                        { label: 'Landscape (1.91:1) - Instagram/FB Standard', val: 1.91 },
                        { label: 'Wide (16:9) - Video/TV', val: 16 / 9 },
                        { label: 'Portrait (4:5) - Instagram/FB Feed', val: 4 / 5 },
                        { label: 'Story (9:16) - Stories/Reels', val: 9 / 16 },
                      ].map(opt => (
                        <option key={opt.val} value={opt.val}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Desktop Button List */}
                  <div className='hidden sm:block space-y-2'>
                    {[
                      { label: 'Square (1:1)', sub: 'Instagram Post', val: 1 },
                      { label: 'Landscape (1.91:1)', sub: 'Instagram/FB Standard', val: 1.91 },
                      { label: 'Wide (16:9)', sub: 'Video/TV', val: 16 / 9 },
                      { label: 'Portrait (4:5)', sub: 'Instagram/FB Feed', val: 4 / 5 },
                      { label: 'Story (9:16)', sub: 'Stories/Reels', val: 9 / 16 },
                    ].map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => handleAspectChange(opt.val)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                          aspect === opt.val
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <Maximize2
                            className={`w-4 h-4 ${aspect === opt.val ? 'text-blue-500' : 'text-gray-400'}`}
                          />
                          <span>{opt.label}</span>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-tighter ${aspect === opt.val ? 'text-blue-400' : 'text-gray-400'}`}
                        >
                          {opt.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className='flex items-center justify-between mb-3'>
                    <label className='text-sm font-bold text-gray-900 uppercase tracking-wider'>
                      3. Zoom In
                    </label>
                    <span className='text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100'>
                      {zoom.toFixed(1)}x
                    </span>
                  </div>
                  <div className='px-2'>
                    <input
                      type='range'
                      min='1'
                      max='3'
                      step='0.1'
                      value={zoom}
                      onInput={e => handleZoomChange(parseFloat(e.target.value))}
                      className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600'
                    />
                    <div className='flex justify-between mt-2 text-[10px] text-gray-400 font-medium'>
                      <span>NORMAL</span>
                      <span>3.0x ZOOM</span>
                    </div>
                  </div>
                </section>

                <section>
                  <div className='flex items-center justify-between mb-3'>
                    <label className='text-sm font-bold text-gray-900 uppercase tracking-wider'>
                      4. Select Features
                    </label>
                    <span className='text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>
                      {selectedMetrics.length}/{metricLimit}
                    </span>
                  </div>

                  {/* Mobile Multi-select Dropdown */}
                  <div className='block sm:hidden relative'>
                    <button
                      onClick={() => setIsFeatureDropdownOpen(!isFeatureDropdownOpen)}
                      className='w-full flex items-center justify-between p-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none'
                    >
                      <span className='truncate mr-2'>
                        {selectedMetrics.length === 0
                          ? 'Select features...'
                          : `${selectedMetrics.length} selected (${selectedMetrics
                              .map(m => availableFeatures.find(f => f.id === m)?.label)
                              .filter(Boolean)
                              .join(', ')})`}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${
                          isFeatureDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <Modal
                      isOpen={isFeatureDropdownOpen}
                      onClose={() => setIsFeatureDropdownOpen(false)}
                      title='Select Features'
                      className='w-[90vw] max-w-md'
                    >
                      <div className='space-y-4'>
                        <div className='flex items-center justify-between'>
                          <p className='text-xs text-gray-500'>
                            Choose up to 6 features to overlay on your image.
                          </p>
                          <span className='text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full'>
                            {selectedMetrics.length}/6
                          </span>
                        </div>
                        <div className='space-y-1 max-h-[50vh] overflow-y-auto pr-1'>
                          {availableFeatures.map(metric => (
                            <button
                              key={metric.id}
                              onClick={() => toggleMetric(metric.id)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${
                                selectedMetrics.includes(metric.id)
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              <span>{metric.label}</span>
                              {selectedMetrics.includes(metric.id) && (
                                <div className='bg-blue-600 rounded-full p-1'>
                                  <Check className='w-3 h-3 text-white' />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        <div className='pt-2'>
                          <Button
                            onClick={() => setIsFeatureDropdownOpen(false)}
                            variant='primary'
                            className='w-full justify-center py-3'
                          >
                            Apply Selection
                          </Button>
                        </div>
                      </div>
                    </Modal>
                  </div>

                  {/* Desktop Grid */}
                  <div className='hidden sm:grid grid-cols-2 gap-2'>
                    {availableFeatures.map(metric => (
                      <button
                        key={metric.id}
                        onClick={() => toggleMetric(metric.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                          selectedMetrics.includes(metric.id)
                            ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                            selectedMetrics.includes(metric.id)
                              ? 'border-white bg-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {selectedMetrics.includes(metric.id) && (
                            <div className='w-1.5 h-1.5 bg-blue-600 rounded-full' />
                          )}
                        </div>
                        {metric.label}
                      </button>
                    ))}
                  </div>
                </section>

                <div className='hidden md:block pt-6 border-t border-gray-100 text-center'>
                  <p className='text-xs text-gray-400'>
                    Your dive profile and metadata will be overlaid on the final image
                    automatically.
                  </p>
                </div>
              </div>
            </aside>

            {/* Right Side: Cropping Area */}
            <section className='flex-1 bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 overflow-auto'>
              <div className='w-full max-w-sm sm:hidden mb-4'>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedImage}
                  variant='primary'
                  className='w-full justify-center py-3 shadow-lg shadow-blue-900/20'
                  icon={
                    isGenerating ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      <Download className='w-4 h-4' />
                    )
                  }
                >
                  Generate Shared Image
                </Button>
              </div>
              <div className='max-w-full max-h-full'>
                {selectedImage ? (
                  <div className='bg-black shadow-2xl rounded-sm overflow-hidden'>
                    <ReactCrop
                      crop={crop}
                      onChange={handleCropChange}
                      aspect={aspect}
                      className='max-w-full'
                    >
                      <img
                        src={selectedImage.url}
                        onLoad={onImageLoad}
                        alt='Crop preview'
                        className='max-h-[75vh] w-auto object-contain'
                      />
                    </ReactCrop>
                  </div>
                ) : (
                  <div className='text-center text-gray-500'>
                    <div className='bg-gray-800/50 p-12 rounded-3xl border-2 border-dashed border-gray-700'>
                      <ImageIcon className='w-16 h-16 mx-auto mb-4 text-gray-700' />
                      <h3 className='text-gray-300 font-semibold'>No photo selected</h3>
                      <p className='text-sm mt-1'>Select a photo from the gallery to start</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            <div className='md:hidden mt-6 text-center pb-8'>
              <p className='text-xs text-gray-500 italic px-6'>
                Your dive profile and metadata will be overlaid on the final image automatically.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default DiveSocialShare;
