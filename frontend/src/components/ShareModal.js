import { Copy, Check, Mail, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { decodeHtmlEntities } from '../utils/htmlDecode';
import {
  copyToClipboard,
  openNativeShare,
  generateShareContent,
  getPlatformShareUrl,
} from '../utils/shareUtils';

import { TwitterIcon, FacebookIcon, WhatsAppIcon, ViberIcon, RedditIcon } from './SocialMediaIcons';
import Modal from './ui/Modal';

/**
 * ShareModal Component
 *
 * Comprehensive share modal for sharing dives, dive sites, and dive routes
 * across multiple social media platforms and communication channels.
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback to close the modal
 * @param {string} entityType - Type of entity: 'dive', 'dive-site', or 'route'
 * @param {object} entityData - Entity data (id, name, description, etc.)
 * @param {object} additionalParams - Additional URL parameters (optional)
 */
const ShareModal = ({ isOpen, onClose, entityType, entityData, additionalParams = {} }) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareContent, setShareContent] = useState({ title: '', description: '', url: '' });

  // Generate share content when modal opens or entity data changes
  useEffect(() => {
    if (isOpen && entityData) {
      try {
        const content = generateShareContent(entityType, entityData);
        // Decode HTML entities in description for clean display and sharing
        if (content.description) {
          content.description = decodeHtmlEntities(content.description);
        }
        setShareContent(content);
        setShareUrl(content.url);
      } catch (error) {
        console.error('Error generating share content:', error);
        toast.error('Failed to generate share content');
      }
    }
  }, [isOpen, entityType, entityData]);

  // Reset copy success state after delay
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopySuccess(true);
      toast.success('Link copied to clipboard!');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Handle native share (mobile devices)
  const handleNativeShare = async () => {
    const shared = await openNativeShare({
      title: shareContent.title,
      text: shareContent.description,
      url: shareUrl,
    });

    if (shared) {
      onClose();
    }
  };

  // Handle platform share
  const handlePlatformShare = platform => {
    try {
      const platformUrl = getPlatformShareUrl(
        platform,
        shareUrl,
        shareContent.title,
        shareContent.description,
        entityType
      );

      if (platform === 'email') {
        // Email opens mailto link
        window.location.href = platformUrl;
      } else {
        // Other platforms open in new window
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(
          platformUrl,
          '_blank',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes`
        );
      }
    } catch (error) {
      console.error(`Error sharing to ${platform}:`, error);
      toast.error(`Failed to share to ${platform}`);
    }
  };

  // Check if native share is available (mobile devices)
  const hasNativeShare = typeof navigator !== 'undefined' && navigator.share;

  // Social media platform configurations
  const platforms = [
    {
      id: 'twitter',
      name: 'Twitter/X',
      color: 'bg-blue-400 hover:bg-blue-500',
      icon: <TwitterIcon className='w-5 h-5' color='ffffff' />,
      action: () => handlePlatformShare('twitter'),
    },
    {
      id: 'facebook',
      name: 'Facebook',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: <FacebookIcon className='w-5 h-5' color='ffffff' />,
      action: () => handlePlatformShare('facebook'),
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      color: 'bg-green-500 hover:bg-green-600',
      icon: <WhatsAppIcon className='w-5 h-5' color='ffffff' />,
      action: () => handlePlatformShare('whatsapp'),
    },
    {
      id: 'viber',
      name: 'Viber',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: <ViberIcon className='w-5 h-5' color='ffffff' />,
      action: () => handlePlatformShare('viber'),
    },
    {
      id: 'reddit',
      name: 'Reddit',
      color: 'bg-orange-500 hover:bg-orange-600',
      icon: <RedditIcon className='w-5 h-5' color='ffffff' />,
      action: () => handlePlatformShare('reddit'),
    },
    {
      id: 'email',
      name: 'Email',
      color: 'bg-gray-600 hover:bg-gray-700',
      icon: <Mail className='w-5 h-5' />,
      action: () => handlePlatformShare('email'),
    },
  ];

  // Get entity type label for display
  const getEntityTypeLabel = () => {
    switch (entityType) {
      case 'dive':
        return 'Dive';
      case 'dive-site':
        return 'Dive Site';
      case 'route':
        return 'Dive Route';
      default:
        return 'Item';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share ${getEntityTypeLabel()}`}
      className='max-w-md w-full max-h-[90vh] overflow-y-auto'
    >
      {/* Preview Section */}
      {shareContent.title && (
        <div className='mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200'>
          <div className='text-sm font-medium text-gray-900 mb-1'>{shareContent.title}</div>
          {shareContent.description && (
            <div className='text-xs text-gray-600 line-clamp-2 mt-1'>
              {shareContent.description}
            </div>
          )}
        </div>
      )}

      {/* URL Copy Section */}
      <div className='mb-4'>
        <p className='text-sm text-gray-600 mb-2'>Share URL:</p>
        <div className='flex items-center gap-2'>
          <input
            type='text'
            value={shareUrl}
            readOnly
            className='flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
            onClick={e => e.target.select()}
          />
          <button
            onClick={handleCopyToClipboard}
            className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              copySuccess
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
            aria-label='Copy URL to clipboard'
          >
            {copySuccess ? (
              <>
                <Check className='w-4 h-4' />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className='w-4 h-4' />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Native Share Button (Mobile) */}
      {hasNativeShare && (
        <div className='mb-4'>
          <button
            onClick={handleNativeShare}
            className='w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium'
          >
            <Share2 className='w-5 h-5' />
            <span>Share via System Share</span>
          </button>
        </div>
      )}

      {/* Social Media Platforms */}
      <div className='mb-4'>
        <p className='text-sm text-gray-600 mb-3'>Share via:</p>
        <div className='grid grid-cols-3 gap-2'>
          {platforms.map(platform => (
            <button
              key={platform.id}
              onClick={platform.action}
              className={`${platform.color} text-white rounded-lg p-3 transition-colors flex flex-col items-center justify-center gap-1 min-h-[80px]`}
              aria-label={`Share to ${platform.name}`}
            >
              <div className='flex items-center justify-center'>{platform.icon}</div>
              <span className='text-xs font-medium'>{platform.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className='text-xs text-gray-500 text-center pt-2 border-t border-gray-200'>
        Share this {getEntityTypeLabel().toLowerCase()} and invite others to explore it!
      </div>
    </Modal>
  );
};

export default ShareModal;
