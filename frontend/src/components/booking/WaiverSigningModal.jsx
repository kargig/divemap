import { Modal } from 'antd';
import { FileText, Check, AlertCircle } from 'lucide-react';
import { useState } from 'react';
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

  const isEu = bundleId?.includes('eu');

  const handleSign = e => {
    e.preventDefault();
    if (!agreed) {
      toast.error('You must affirm that you have read and agree to the waiver terms.');
      return;
    }
    if (!typedName.trim()) {
      toast.error('Please type your full legal name to execute the digital signature.');
      return;
    }

    onSigned({
      signatureName: typedName.trim(),
      signedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className='flex items-center gap-2.5 pb-2 border-b'>
          <FileText className='h-5 w-5 text-blue-600' />
          <div>
            <h3 className='text-base font-bold text-gray-900'>
              {isEu
                ? 'Statement of Risk & Liability (EU Version)'
                : 'Certified Diver Activity Release & Liability Waiver'}
            </h3>
            <p className='text-xs text-gray-500 font-normal'>
              Legal agreement and assumption of inherent hyperbaric scuba risks.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSign} className='pt-3 space-y-4 max-h-[72vh] overflow-y-auto pr-1'>
        {/* Scrollable Legal Clauses Box */}
        <div className='bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-3 leading-relaxed max-h-60 overflow-y-auto'>
          <p className='font-bold text-gray-900 dark:text-white'>
            PLEASE READ CAREFULLY AND AFFIRM BEFORE SIGNING.
          </p>
          <p>
            I, <strong>{diverName || '[Participant Name]'}</strong>, hereby affirm that I am a
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

        {/* Affirmation Checkbox */}
        <div className='p-3 bg-blue-50/50 rounded-lg border border-blue-200'>
          <label className='flex items-start gap-2.5 cursor-pointer'>
            <input
              type='checkbox'
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              required
              className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5 shrink-0'
            />
            <span className='text-xs sm:text-sm text-gray-800 font-medium'>
              I have read, understood, and voluntarily agree to this Statement of Risk, Liability
              Release, and Assumption of Scuba Diving Hazards.
            </span>
          </label>
        </div>

        {/* Typed Digital Signature */}
        <div>
          <label className='block text-xs font-semibold text-gray-700 mb-1'>
            Type Full Legal Name as Digital Signature *
          </label>
          <input
            type='text'
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder={diverName || 'e.g. John Doe'}
            required
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-medium'
          />
          <span className='text-[11px] text-gray-400 mt-1 block'>
            By typing your full name, you execute an enforceable electronic signature capturing your
            timestamp and audit hash.
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
            disabled={!agreed || !typedName.trim()}
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
