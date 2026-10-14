import { Modal } from 'antd';
import { FileText, Check, AlertCircle, ArrowDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const WaiverSigningModal = ({
  isOpen,
  onClose,
  onSigned,
  diverName = '',
  bundleId = 'padi_10086',
}) => {
  const [typedName, setTypedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const textContainerRef = useRef(null);

  const isEu = bundleId?.includes('eu');
  const cleanDiver = diverName.trim();
  const nameMatches = Boolean(
    cleanDiver && typedName.trim().toLowerCase() === cleanDiver.toLowerCase()
  );

  useEffect(() => {
    if (isOpen && cleanDiver) {
      setTypedName(cleanDiver);
    }
  }, [isOpen, cleanDiver]);

  const handleScroll = () => {
    const el = textContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 25) {
      setHasScrolledToBottom(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const el = textContainerRef.current;
        if (el) {
          // If container fits without scrollbar (e.g. desktop full-height view), mark as seen
          if (el.scrollHeight <= el.clientHeight + 20) {
            setHasScrolledToBottom(true);
          }
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setHasScrolledToBottom(false);
      setAgreed(false);
    }
  }, [isOpen]);

  const handleSign = e => {
    e.preventDefault();
    if (!hasScrolledToBottom) {
      toast.error('Please scroll through and read the entire liability waiver text.');
      return;
    }
    if (!agreed) {
      toast.error('You must affirm that you have read and agree to the waiver terms.');
      return;
    }
    const cleanTyped = typedName.trim();
    if (!cleanTyped) {
      toast.error('Please type your full legal name to execute the digital signature.');
      return;
    }
    if (cleanDiver && cleanTyped.toLowerCase() !== cleanDiver.toLowerCase()) {
      toast.error(`Digital signature must match diver full legal name: "${cleanDiver}"`);
      return;
    }

    onSigned({
      signatureName: cleanDiver || cleanTyped,
      signedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={960}
      style={{ top: 20 }}
      title={
        <div className='flex items-center gap-2.5 pb-2 border-b'>
          <FileText className='h-5 w-5 text-blue-600' />
          <div>
            <h3 className='text-base sm:text-lg font-bold text-gray-900 dark:text-white'>
              {isEu
                ? 'Statement of Risk & Liability (EU Version)'
                : 'Certified Diver Activity Release & Liability Waiver'}
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 font-normal'>
              Legal agreement and assumption of inherent hyperbaric scuba risks.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSign} className='pt-3 space-y-4 max-h-[85vh] overflow-y-auto pr-1'>
        {/* Legal Clauses Box - Full size on desktop, scrollable on mobile */}
        <div
          ref={textContainerRef}
          onScroll={handleScroll}
          className='bg-gray-50 dark:bg-gray-800 p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-3.5 leading-relaxed max-h-[50vh] sm:max-h-none overflow-y-auto sm:overflow-visible'
        >
          <p className='font-bold text-gray-900 dark:text-white'>
            PLEASE READ CAREFULLY AND AFFIRM BEFORE SIGNING.
          </p>
          <p>
            I, <strong>{cleanDiver || '[Participant Name]'}</strong>, hereby affirm that I am a
            certified scuba diver trained in safe diving practices by a recognized certification
            agency (or am enrolled in authorized scuba instruction).
          </p>
          <p>
            I understand and agree that neither the host diving center, nor the vessel operators,
            dive instructors, divemasters, nor certifying training agencies, may be held liable or
            responsible in any way for any injury, decompression sickness, embolism, hyperbaric
            injury, or other damages that may occur as a result of my participation in this diving
            excursion, whether from active or passive risks.
          </p>
          <p>
            I acknowledge that scuba diving with compressed breathing gas involves inherent
            physiological and maritime hazards, including pressure changes, currents, vessel
            operations, and remote marine rescue delays. I affirm that I will inspect all rented or
            personal equipment prior to entry, maintain continuous buddy contact, monitor my gas
            supply, dive within no-decompression limits, and conduct a 3-minute safety stop at 5
            meters / 15 feet.
          </p>
          <p>
            I affirm that I have answered the Diver Medical Questionnaire truthfully and have no
            undisclosed medical conditions precluding safe hyperbaric exposure.
          </p>
        </div>

        {/* Scroll prompt on mobile / constrained view */}
        {!hasScrolledToBottom && (
          <div className='p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between'>
            <span className='flex items-center gap-1.5 font-medium'>
              <AlertCircle size={14} className='text-amber-600 shrink-0' />
              Please scroll down and review the full text above to enable signature.
            </span>
            <ArrowDown size={14} className='animate-bounce text-amber-600 shrink-0' />
          </div>
        )}

        {/* Affirmation Checkbox */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            hasScrolledToBottom
              ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 opacity-60'
          }`}
        >
          <label className='flex items-start gap-2.5 cursor-pointer'>
            <input
              type='checkbox'
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              disabled={!hasScrolledToBottom}
              required
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0 disabled:opacity-40'
            />
            <span className='text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium'>
              I have read, understood, and voluntarily agree to this Statement of Risk, Liability
              Release, and Assumption of Scuba Diving Hazards.
            </span>
          </label>
        </div>

        {/* Typed Digital Signature */}
        <div>
          <div className='flex items-center justify-between mb-1'>
            <label className='block text-xs font-semibold text-gray-700 dark:text-gray-300'>
              Digital Signature * (Must match:{' '}
              <span className='text-blue-600 font-bold'>{cleanDiver || 'Full Name'}</span>)
            </label>
            {cleanDiver && typedName !== cleanDiver && (
              <button
                type='button'
                onClick={() => setTypedName(cleanDiver)}
                className='text-xs text-blue-600 hover:underline font-medium'
              >
                Sign as {cleanDiver}
              </button>
            )}
          </div>
          <input
            type='text'
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder={cleanDiver || 'e.g. John Doe'}
            required
            className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-medium ${
              cleanDiver && !nameMatches ? 'border-red-300 bg-red-50/20' : 'border-gray-300'
            }`}
          />
          {cleanDiver && typedName.trim() && !nameMatches && (
            <p className='text-xs text-red-600 mt-1 flex items-center gap-1'>
              <AlertCircle size={13} />
              Signature name must match diver legal name: "{cleanDiver}"
            </p>
          )}
          <span className='text-[11px] text-gray-400 mt-1 block'>
            By typing your full legal name, you execute an enforceable electronic signature
            capturing your timestamp and audit hash.
          </span>
        </div>

        {/* Modal Actions */}
        <div className='flex items-center justify-end gap-3 pt-3 border-t'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={!hasScrolledToBottom || !agreed || !nameMatches}
            className='flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed'
          >
            <Check size={16} />
            Execute Signature & Accept
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default WaiverSigningModal;
