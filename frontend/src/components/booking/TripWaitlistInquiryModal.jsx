import {
  MessageSquare,
  Phone,
  Mail,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { createChatRoom } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/dateHelpers';
import { decodeHtmlEntities } from '../../utils/htmlDecode';
import { WhatsAppIcon } from '../SocialMediaIcons';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const TripWaitlistInquiryModal = ({ isOpen, onClose, trip, divingCenter }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  if (!trip) return null;

  const center = divingCenter || trip.diving_center || {};
  const centerName = decodeHtmlEntities(center.name || 'the diving center');
  const tripDateStr = trip.trip_date ? formatDate(trip.trip_date) : '';
  const tripTimeStr = trip.trip_time ? trip.trip_time.slice(0, 5) : '';
  const tripTitle = decodeHtmlEntities(trip.trip_description || trip.title || 'Dive Trip');

  const sitesList = (trip.dive_sites || trip.diveSites || [])
    .map(s => s.name || s.site_name)
    .filter(Boolean);
  const sitesStr = sitesList.length > 0 ? sitesList.join(', ') : '';

  const inquiryMessage = `Hi ${centerName}! I noticed online spots are full on Divemap for "${tripTitle}"${tripDateStr ? ` on ${tripDateStr}` : ''}${tripTimeStr ? ` at ${tripTimeStr}` : ''}${sitesStr ? ` (${sitesStr})` : ''}. Do you have any reserved boat spots available or a cancellation waitlist I could join?`;

  const emailSubject = `Trip Spot Inquiry: ${tripTitle}${tripDateStr ? ` (${tripDateStr})` : ''}`;

  const cleanPhone = (center.phone || '').replace(/[^0-9]/g, '');
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(inquiryMessage)}`
    : null;
  const emailUrl = center.email
    ? `mailto:${center.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(inquiryMessage)}`
    : null;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(inquiryMessage);
      setCopied(true);
      toast.success('Inquiry copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy text');
    }
  };

  const handleStartInAppChat = async () => {
    if (!center.id) {
      toast.error('Diving center information is not available');
      return;
    }
    if (!user) {
      toast.error('Please log in to chat directly with this diving center');
      return;
    }

    try {
      setStartingChat(true);
      const room = await createChatRoom([], false, null, center.id);
      onClose();
      navigate('/messages', {
        state: {
          roomId: room.id,
          draftMessage: inquiryMessage.slice(0, 500),
        },
      });
    } catch (err) {
      console.error('Failed to open chat room:', err);
      toast.error('Could not start conversation with diving center');
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Inquire About Open Spots'
      className='w-[95vw] max-w-lg rounded-2xl p-5 sm:p-6 text-gray-900 dark:text-gray-100 dark:bg-gray-800'
    >
      <div className='space-y-4 pt-2'>
        {/* Notice Card */}
        <div className='flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-relaxed'>
          <AlertCircle className='w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
          <div>
            <span className='font-bold block'>Online booking is full for this departure.</span>
            Diving centers often have last-minute cancellations or keep unlisted boat spots reserved
            for direct inquiries. Contact {centerName} directly to check availability.
          </div>
        </div>

        {/* Trip Summary Chip */}
        <div className='p-3 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs space-y-1.5'>
          <div className='font-bold text-gray-900 dark:text-white text-sm'>{tripTitle}</div>
          <div className='flex flex-wrap items-center gap-3 text-gray-600 dark:text-gray-400'>
            {tripDateStr && (
              <span className='inline-flex items-center gap-1'>
                <Calendar className='w-3.5 h-3.5 text-blue-500' />
                {tripDateStr}
              </span>
            )}
            {tripTimeStr && (
              <span className='inline-flex items-center gap-1'>
                <Clock className='w-3.5 h-3.5 text-blue-500' />
                {tripTimeStr}
              </span>
            )}
            {sitesStr && (
              <span className='inline-flex items-center gap-1'>
                <MapPin className='w-3.5 h-3.5 text-blue-500' />
                {sitesStr}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className='space-y-2 pt-1'>
          {/* Divemap In-App Chat */}
          {center.id && (
            <button
              type='button'
              onClick={handleStartInAppChat}
              disabled={startingChat}
              className='w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 transition-colors text-left font-medium text-xs sm:text-sm cursor-pointer'
            >
              <div className='flex items-center gap-2.5'>
                <div className='w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0'>
                  <MessageSquare className='w-4 h-4' />
                </div>
                <div>
                  <div className='font-bold text-gray-900 dark:text-white'>Divemap Direct Chat</div>
                  <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                    {user ? 'Chat in-app with the center team' : 'Log in to chat in-app'}
                  </div>
                </div>
              </div>
              <ExternalLink className='w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0' />
            </button>
          )}

          {/* WhatsApp */}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 transition-colors text-left font-medium text-xs sm:text-sm'
            >
              <div className='flex items-center gap-2.5'>
                <div className='w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0'>
                  <WhatsAppIcon className='w-4 h-4' color='ffffff' />
                </div>
                <div>
                  <div className='font-bold text-gray-900 dark:text-white'>WhatsApp Message</div>
                  <div className='text-[11px] text-gray-500 dark:text-gray-400'>
                    Send pre-filled inquiry to {center.phone}
                  </div>
                </div>
              </div>
              <ExternalLink className='w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0' />
            </a>
          )}

          {/* Email */}
          {emailUrl && (
            <a
              href={emailUrl}
              className='w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 transition-colors text-left font-medium text-xs sm:text-sm'
            >
              <div className='flex items-center gap-2.5'>
                <div className='w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0'>
                  <Mail className='w-4 h-4' />
                </div>
                <div>
                  <div className='font-bold text-gray-900 dark:text-white'>Email Center</div>
                  <div className='text-[11px] text-gray-500 dark:text-gray-400'>{center.email}</div>
                </div>
              </div>
              <ExternalLink className='w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0' />
            </a>
          )}

          {/* Phone Call */}
          {center.phone && (
            <a
              href={`tel:${center.phone}`}
              className='w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-colors text-left font-medium text-xs sm:text-sm'
            >
              <div className='flex items-center gap-2.5'>
                <div className='w-8 h-8 rounded-lg bg-gray-700 text-white flex items-center justify-center shrink-0'>
                  <Phone className='w-4 h-4' />
                </div>
                <div>
                  <div className='font-bold text-gray-900 dark:text-white'>Call Directly</div>
                  <div className='text-[11px] text-gray-500 dark:text-gray-400'>{center.phone}</div>
                </div>
              </div>
              <ExternalLink className='w-4 h-4 text-gray-400 shrink-0' />
            </a>
          )}
        </div>

        <div className='pt-2 flex items-center justify-between gap-3'>
          <button
            type='button'
            onClick={handleCopyMessage}
            className='inline-flex items-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
            title='Copy pre-filled message text to paste in other apps'
          >
            {copied ? (
              <>
                <Check className='w-3.5 h-3.5 text-emerald-600' />
                <span>Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className='w-3.5 h-3.5 text-gray-500 dark:text-gray-400' />
                <span>Copy Message Text</span>
              </>
            )}
          </button>
          <Button variant='secondary' size='sm' onClick={onClose} className='justify-center'>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

TripWaitlistInquiryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  trip: PropTypes.object,
  divingCenter: PropTypes.object,
};

export default TripWaitlistInquiryModal;
