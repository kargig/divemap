import {
  HeartPulse,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Trash2,
  FileText,
  Building,
  Calendar,
  Clock,
  ExternalLink,
  Shield,
  FileCheck,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../api';
import MedicalQuestionnaireModal from '../components/booking/MedicalQuestionnaireModal';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateHelpers';

const DiverMedicalProfilePage = () => {
  const { user } = useAuth();
  const [medicalData, setMedicalData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Questionnaire Modal
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [submittingDeclaration, setSubmittingDeclaration] = useState(false);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchMedicalStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/bookings/medical/me');
      setMedicalData(res.data);
    } catch (err) {
      console.error('Failed to load medical declaration status:', err);
      toast.error('Failed to load medical declaration details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicalStatus();
  }, [fetchMedicalStatus]);

  const handleSaveQuestionnaire = async (answers, status) => {
    try {
      setSubmittingDeclaration(true);
      const signature = user?.name || user?.username || 'Diver';
      await api.post('/api/v1/bookings/medical/me', {
        dmscAnswers: answers,
        signatureName: signature,
      });

      toast.success(
        status === 'CLEARED'
          ? 'Annual medical declaration cleared and saved for 1 year!'
          : 'Medical declaration saved with flagged conditions.'
      );
      setIsQuestionnaireOpen(false);
      await fetchMedicalStatus();
    } catch (err) {
      console.error('Failed to save medical declaration:', err);
      toast.error(err.response?.data?.detail || 'Failed to save medical declaration.');
    } finally {
      setSubmittingDeclaration(false);
    }
  };

  const handleDeleteMedicalData = async () => {
    try {
      setDeleting(true);
      await api.delete('/api/v1/bookings/medical/me');
      toast.success('Your annual medical declaration has been deleted.');
      setIsDeleteModalOpen(false);
      await fetchMedicalStatus();
    } catch (err) {
      console.error('Failed to delete medical declaration:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete medical declaration.');
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveRecord = Boolean(medicalData?.has_record && !medicalData?.is_expired);
  const isCleared = medicalData?.status === 'CLEARED';

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 transition-colors duration-200'>
      <SEO
        title='Medical Declaration & Paperwork - Divemap'
        description='Manage your annual DMSC 2020 medical declaration and center physician approvals on Divemap.'
      />

      <div className='max-w-[95vw] xl:max-w-[1200px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-6'>
        {/* Navigation Breadcrumb */}
        <Link
          to='/profile'
          className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-6 transition-colors'
        >
          <ChevronLeft size={18} className='mr-1' />
          Back to Profile
        </Link>

        {/* Header Bar */}
        <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2.5'>
                <HeartPulse className='h-6 w-6 text-red-600' />
                Annual Medical Declaration (DMSC 2020)
              </h1>
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl'>
                Under WRSTC / DMSC diving standards, a fully cleared medical declaration is valid
                for 1 year across all diving centers. Your answers are protected with envelope
                encryption (GDPR Article 9).
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <button
                type='button'
                onClick={() => setIsQuestionnaireOpen(true)}
                className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer'
              >
                <FileText size={16} />
                <span>{hasActiveRecord ? 'Update Declaration' : 'Complete Questionnaire'}</span>
              </button>

              {hasActiveRecord && (
                <button
                  type='button'
                  onClick={() => setIsDeleteModalOpen(true)}
                  className='px-3.5 py-2 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer'
                >
                  <Trash2 size={15} />
                  <span>Delete Medical Data</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Loading */}
        {loading ? (
          <div className='flex justify-center items-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm'>
            <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
            <span className='ml-3 text-gray-600 dark:text-gray-300 font-medium text-sm'>
              Loading your medical declaration status...
            </span>
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Status Card */}
            <div
              className={`p-6 sm:p-7 rounded-2xl border shadow-sm ${
                hasActiveRecord
                  ? isCleared
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200/60 dark:border-gray-700/60'>
                <div className='flex items-start sm:items-center gap-3.5'>
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      hasActiveRecord
                        ? isCleared
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {hasActiveRecord ? (
                      isCleared ? (
                        <CheckCircle2 size={24} />
                      ) : (
                        <AlertTriangle size={24} />
                      )
                    ) : (
                      <HeartPulse size={24} />
                    )}
                  </div>
                  <div>
                    <span className='text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block'>
                      Declaration Status
                    </span>
                    <h2 className='text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-0.5'>
                      {hasActiveRecord
                        ? isCleared
                          ? 'Cleared for Scuba Diving'
                          : 'Physician Clearance Required'
                        : 'No Active Declaration on File'}
                    </h2>
                  </div>
                </div>

                {hasActiveRecord && (
                  <div className='text-left sm:text-right bg-white/80 dark:bg-gray-800/80 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-gray-200 dark:border-gray-700'>
                    <span className='text-xs text-gray-500 font-medium block'>Validity Period</span>
                    <span className='text-base font-bold text-gray-900 dark:text-white'>
                      {medicalData.days_remaining} days remaining
                    </span>
                    <span className='text-xs text-gray-500 block mt-0.5'>
                      Expires: {formatDate(medicalData.expires_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Explanatory Description */}
              <div className='pt-4 text-xs sm:text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-2'>
                {hasActiveRecord ? (
                  isCleared ? (
                    <p>
                      Your annual DMSC 2020 questionnaire is fully cleared. When booking dive trips
                      with any center on Divemap, you can simply confirm that your physical health
                      has not changed since {formatDate(medicalData.completed_at)} to fast-track
                      your checkout.
                    </p>
                  ) : (
                    <p>
                      Your questionnaire flagged conditions that require medical physician review.
                      Under maritime regulations, each diving center independently inspects your
                      signed doctor certificate before approving you for their departures.
                    </p>
                  )
                ) : (
                  <p>
                    You do not currently have an active medical self-declaration. Complete the
                    standard 10-question DMSC screening to save your clearance for 1 year and enjoy
                    fast-track bookings across all diving centers.
                  </p>
                )}

                {medicalData?.physician_certificate_url && (
                  <div className='pt-2'>
                    <a
                      href={medicalData.physician_certificate_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold'
                    >
                      <span>View Uploaded Doctor Clearance Certificate</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Per-Center 1-Year Approvals Section */}
            <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4'>
              <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                <div>
                  <h3 className='font-bold text-base text-gray-900 dark:text-white flex items-center gap-2'>
                    <Building className='h-5 w-5 text-blue-600' />
                    <span>Diving Center Sovereign Approvals</span>
                  </h3>
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
                    Diving center managers who have reviewed your doctor certificate and granted
                    annual approval for their center.
                  </p>
                </div>
                <span className='px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'>
                  {medicalData?.center_approvals?.length || 0} Centers
                </span>
              </div>

              {medicalData?.center_approvals && medicalData.center_approvals.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3.5'>
                  {medicalData.center_approvals.map(ca => (
                    <div
                      key={ca.center_id}
                      className='p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-750 space-y-2'
                    >
                      <div className='flex items-center justify-between'>
                        <span className='font-bold text-sm text-gray-900 dark:text-white'>
                          {ca.center_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !ca.is_expired
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {!ca.is_expired ? 'ACTIVE' : 'EXPIRED'}
                        </span>
                      </div>

                      <div className='text-xs text-gray-600 dark:text-gray-300 space-y-1'>
                        {ca.physician_name && (
                          <div className='flex items-center gap-1.5'>
                            <FileCheck size={13} className='text-blue-500 shrink-0' />
                            <span>
                              Dr. {ca.physician_name}
                              {ca.physician_clinic && ` (${ca.physician_clinic})`}
                            </span>
                          </div>
                        )}
                        <div className='flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]'>
                          <Calendar size={13} className='shrink-0' />
                          <span>Approved: {formatDate(ca.approved_at)}</span>
                          <span>•</span>
                          <span>Expires: {formatDate(ca.expires_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='p-6 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700'>
                  No center-specific physician approvals on record. If your declaration flags any
                  condition, diving center managers can review and grant approval during your trips.
                </div>
              )}
            </div>

            {/* Privacy & Legal Retention Notice */}
            <div className='p-4 bg-gray-100/70 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1.5 leading-relaxed'>
              <div className='font-bold text-gray-900 dark:text-gray-200 flex items-center gap-1.5'>
                <Shield size={14} className='text-blue-600' />
                <span>GDPR Article 9 Privacy & Maritime Safety Retention</span>
              </div>
              <p>
                Your annual medical profile is encrypted using AES-256-GCM envelope encryption and
                is used to streamline your future bookings. Deleting this profile immediately
                removes your saved declaration for future reservations. However, declarations and
                signed waivers linked to completed dive trips are preserved in an encrypted archive
                under GDPR Article 17(3)(e) for statutory maritime liability defense.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* DMSC Questionnaire Modal */}
      <MedicalQuestionnaireModal
        isOpen={isQuestionnaireOpen}
        onClose={() => setIsQuestionnaireOpen(false)}
        onComplete={handleSaveQuestionnaire}
      />

      {/* Delete Medical Profile Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title='Delete Annual Medical Declaration'
        className='w-[95vw] max-w-md rounded-2xl p-5 sm:p-6 text-gray-900 dark:text-gray-100 dark:bg-gray-800'
      >
        <div className='space-y-4 pt-2'>
          <div className='p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-900 dark:text-red-200 leading-relaxed flex items-start gap-2.5'>
            <AlertTriangle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' />
            <div>
              <span className='font-bold block'>Permanently delete saved medical profile?</span>
              This action will clear your saved 1-year questionnaire. Future dive trip bookings will
              require you to fill out the medical questionnaire again.
            </div>
          </div>

          <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
            <strong>Note on Past Trips:</strong> Under GDPR Article 17(3)(e), medical declarations
            and liability waivers submitted for specific completed dive trips are maintained in an
            encrypted archive for maritime safety regulatory compliance and legal defense.
          </p>

          <div className='flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700'>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <button
              type='button'
              onClick={handleDeleteMedicalData}
              disabled={deleting}
              className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50'
            >
              {deleting ? <Loader2 size={13} className='animate-spin' /> : <Trash2 size={13} />}
              <span>{deleting ? 'Deleting...' : 'Confirm Deletion'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DiverMedicalProfilePage;
