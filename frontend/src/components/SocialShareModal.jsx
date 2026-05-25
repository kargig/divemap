import { Image as ImageIcon, Download, X, Maximize2, Check, Loader2 } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { generateSocialImage, downloadBlob } from '../utils/socialHelpers';

import Button from './ui/Button';
import Modal from './ui/Modal';

/**
 * SocialShareModal Component
 *
 * Allows users to select a dive photo, crop it, and generate a social-ready image.
 */
const SocialShareModal = ({ isOpen, onClose, dive, diveMedia = [] }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState();
  const [aspect, setAspect] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const imgRef = useRef(null);

  // Filter only photos
  const photos = diveMedia.filter(m => m.media_type === 'photo');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (photos.length > 0 && !selectedImage) {
        setSelectedImage(photos[0]);
      }
    } else {
      // Don't reset selectedImage immediately to avoid flicker during close animation
    }
  }, [isOpen, photos, selectedImage]);

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

  const handleGenerate = async () => {
    if (!selectedImage || !crop || !imgRef.current) {
      toast.error('Please select and crop an image first');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generating social image...');

    try {
      // Calculate pixel coordinates for the backend
      // imgRef.current.naturalWidth/Height are the original dimensions
      // imgRef.current.width/height are the displayed dimensions
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      const pixelCrop = {
        x: crop.x * scaleX,
        y: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY,
      };

      const blob = await generateSocialImage(
        dive.id,
        selectedImage.url,
        selectedImage.id,
        pixelCrop
      );

      const fileName = `dive_${dive.id}_social_${Date.now()}.jpg`;
      downloadBlob(blob, fileName);

      toast.success('Image generated and download started!', { id: toastId });
      onClose();
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error || 'Failed to generate social image', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Create Social Share Image'
      className='max-w-4xl w-full'
    >
      <div className='flex flex-col md:flex-row gap-6'>
        {/* Left Side: Photo Selection & Options */}
        <div className='w-full md:w-1/3 flex flex-col gap-4'>
          <div>
            <label className='text-sm font-medium text-gray-700 mb-2 block'>1. Select Photo</label>
            <div className='grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg'>
              {photos.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedImage(photo)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                    selectedImage?.id === photo.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-transparent'
                  }`}
                >
                  <img src={photo.url} alt='' className='w-full h-full object-cover' />
                  {selectedImage?.id === photo.id && (
                    <div className='absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center'>
                      <Check className='text-white w-6 h-6' />
                    </div>
                  )}
                </button>
              ))}
              {photos.length === 0 && (
                <div className='col-span-3 py-8 text-center text-gray-500 text-sm'>
                  No photos available for this dive.
                </div>
              )}
            </div>
          </div>

          <div>
            <label className='text-sm font-medium text-gray-700 mb-2 block'>
              2. Choose Aspect Ratio
            </label>
            <div className='grid grid-cols-1 gap-2'>
              <button
                onClick={() => handleAspectChange(1)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                  aspect === 1
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <Maximize2 className='w-4 h-4' />
                  <span>Square (1:1)</span>
                </div>
                <span className='text-xs text-gray-400 font-mono'>Instagram Post</span>
              </button>
              <button
                onClick={() => handleAspectChange(16 / 9)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                  aspect === 16 / 9
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <Maximize2 className='w-4 h-4' />
                  <span>Landscape (16:9)</span>
                </div>
                <span className='text-xs text-gray-400 font-mono'>Video/TV</span>
              </button>
              <button
                onClick={() => handleAspectChange(4 / 5)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                  aspect === 4 / 5
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <Maximize2 className='w-4 h-4' />
                  <span>Portrait (4:5)</span>
                </div>
                <span className='text-xs text-gray-400 font-mono'>Feed/FB</span>
              </button>
              <button
                onClick={() => handleAspectChange(9 / 16)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                  aspect === 9 / 16
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className='flex items-center gap-2'>
                  <Maximize2 className='w-4 h-4' />
                  <span>Story (9:16)</span>
                </div>
                <span className='text-xs text-gray-400 font-mono'>Stories/Reels</span>
              </button>
            </div>
          </div>

          <div className='mt-auto pt-4 border-t'>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedImage}
              variant='primary'
              className='w-full justify-center'
              icon={
                isGenerating ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Download className='w-4 h-4' />
                )
              }
            >
              {isGenerating ? 'Generating...' : 'Generate & Download'}
            </Button>
            <p className='text-[10px] text-gray-400 mt-2 text-center'>
              The generated image will overlay your dive profile and metadata.
            </p>
          </div>
        </div>

        {/* Right Side: Cropping Area */}
        <div className='w-full md:w-2/3 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px] md:min-h-[500px]'>
          {selectedImage ? (
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              aspect={aspect}
              className='max-h-full'
            >
              <img
                src={selectedImage.url}
                onLoad={onImageLoad}
                alt='Crop preview'
                className='max-h-[500px] object-contain'
              />
            </ReactCrop>
          ) : (
            <div className='text-center text-gray-500'>
              <ImageIcon className='w-12 h-12 mx-auto mb-2 opacity-20' />
              <p>Select a photo to begin cropping</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SocialShareModal;
