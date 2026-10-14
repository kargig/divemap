import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';

import api from '../api';
import MedicalQuestionnaireModal from '../components/booking/MedicalQuestionnaireModal';
import WaiverSigningModal from '../components/booking/WaiverSigningModal';
import SEO from '../components/SEO';

/**
 * Guest co-diver claim intake via magic-link claim token.
 * Route: /bookings/:uuid/claim/:claimToken
 */
const GuestBookingClaimPage = () => {
  const { uuid, claimToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState(null);
  const [dmscAnswers, setDmscAnswers] = useState(null);
  const [showMedical, setShowMedical] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  const [waiverSignature, setWaiverSignature] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/bookings/${uuid}/claim/${claimToken}`);
        setContext(res.data);
      } catch (err) {
        console.error('Failed to load claim context:', err);
        toast.error(err.response?.data?.detail || 'Invalid or expired claim link.');
        setContext(null);
      } finally {
        setLoading(false);
      }
    };
    if (uuid && claimToken) load();
  }, [uuid, claimToken]);

  const handleSubmitClaim = async () => {
    if (!dmscAnswers || !waiverSignature?.signatureName) {
      toast.error('Please complete the medical questionnaire and sign the waiver.');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/api/v1/bookings/${uuid}/claim/${claimToken}`, {
        unitItemId: context.unitItemId,
        dmscAnswers,
        signatureName: waiverSignature.signatureName,
        selectedTankId: context.selectedTankId || '12',
        selectedGasMixId: context.selectedGasMixId || 'air',
        equipmentSizing: context.equipmentSizing || undefined,
      });
      toast.success('Paperwork submitted successfully!');
      // Prefer local claimed state; claim token may reject re-writes after CLAIMED
      setContext(prev =>
        prev ? { ...prev, claimStatus: 'CLAIMED', waiversComplete: true } : prev
      );
    } catch (err) {
      console.error('Claim submit failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to submit claim paperwork.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-[50vh] flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!context) {
    return (
      <div className='max-w-md mx-auto my-16 p-6 text-center'>
        <h1 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>Claim Link Invalid</h1>
        <p className='text-sm text-gray-500 dark:text-gray-400 mb-4'>
          This guest invitation link is invalid or has expired. Ask the lead booker or dive center
          for a new link.
        </p>
        <Link to='/' className='text-blue-600 text-sm font-medium hover:underline'>
          Back to Divemap
        </Link>
      </div>
    );
  }

  const alreadyClaimed = context.claimStatus === 'CLAIMED' && context.waiversComplete;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4'>
      <SEO title='Complete Your Dive Paperwork' />
      <div className='max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <ShieldCheck className='w-6 h-6 text-blue-600' />
          <h1 className='text-xl font-display font-bold text-gray-900 dark:text-white'>
            Guest Dive Paperwork
          </h1>
        </div>
        <p className='text-sm text-gray-600 dark:text-gray-300 mb-1'>
          Hello <span className='font-semibold'>{context.diverFullName}</span>
        </p>
        <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
          {context.centerName}
          {context.departureDate ? ` · ${context.departureDate}` : ''}
        </p>

        {alreadyClaimed ? (
          <div className='rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-800 dark:text-emerald-200'>
            Your medical questionnaire and waiver are already on file for this trip. See you on the
            boat!
          </div>
        ) : (
          <div className='space-y-3'>
            <button
              type='button'
              onClick={() => setShowMedical(true)}
              className='w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark'
            >
              {dmscAnswers
                ? '✓ Medical questionnaire completed'
                : '1. Complete medical questionnaire'}
            </button>
            <button
              type='button'
              onClick={() => setShowWaiver(true)}
              className='w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark'
            >
              {waiverSignature?.signatureName
                ? `✓ Signed as ${waiverSignature.signatureName}`
                : '2. Sign liability waiver'}
            </button>
            <button
              type='button'
              disabled={submitting || !dmscAnswers || !waiverSignature?.signatureName}
              onClick={handleSubmitClaim}
              className='w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50'
            >
              {submitting ? 'Submitting…' : 'Submit paperwork'}
            </button>
          </div>
        )}
      </div>

      <MedicalQuestionnaireModal
        isOpen={showMedical}
        onClose={() => setShowMedical(false)}
        onCompleted={answers => {
          setDmscAnswers(answers);
          setShowMedical(false);
        }}
      />
      <WaiverSigningModal
        isOpen={showWaiver}
        onClose={() => setShowWaiver(false)}
        diverName={context.diverFullName || ''}
        onSigned={sig => {
          setWaiverSignature(
            typeof sig === 'string'
              ? { signatureName: sig }
              : sig || { signatureName: context.diverFullName }
          );
          setShowWaiver(false);
        }}
      />
    </div>
  );
};

export default GuestBookingClaimPage;
