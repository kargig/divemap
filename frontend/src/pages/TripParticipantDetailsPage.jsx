import {
  ChevronLeft,
  FileText,
  Loader2,
  Check,
  AlertTriangle,
  Hourglass,
  DollarSign,
  User,
  Shield,
  Stethoscope,
  HeartPulse,
  Edit2,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link } from 'react-router-dom';

import api from '../api';
import DiverGearConfigForm from '../components/booking/DiverGearConfigForm';
import SEO from '../components/SEO';

const TripParticipantDetailsPage = () => {
  const { centerId, tripId, participantId } = useParams();

  const [loading, setLoading] = useState(true);
  const [savingGear, setSavingGear] = useState(false);
  const [diver, setDiver] = useState(null);
  const [medicalReview, setMedicalReview] = useState(null);
  const [downloadingDossier, setDownloadingDossier] = useState(false);

  // Physician clearance form state
  const [showClearanceForm, setShowClearanceForm] = useState(false);
  const [showEditAnswers, setShowEditAnswers] = useState(false);
  const [editableAnswers, setEditableAnswers] = useState({});
  const [modificationReason, setModificationReason] = useState('');
  const [savingMedicalAnswers, setSavingMedicalAnswers] = useState(false);
  const [physicianName, setPhysicianName] = useState('');
  const [physicianClinic, setPhysicianClinic] = useState('');
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [confirmedInspected, setConfirmedInspected] = useState(false);
  const [clearingMedical, setClearingMedical] = useState(false);

  const fetchDiver = useCallback(async () => {
    try {
      setLoading(true);
      const [resDiver, resMed] = await Promise.all([
        api.get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}`
        ),
        api
          .get(
            `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/medical-review`
          )
          .catch(() => ({ data: null })),
      ]);
      setDiver(resDiver.data);
      if (resMed?.data) setMedicalReview(resMed.data);
    } catch (err) {
      console.error('Failed to load participant details:', err);
      toast.error('Failed to load participant details.');
    } finally {
      setLoading(false);
    }
  }, [centerId, tripId, participantId]);

  useEffect(() => {
    fetchDiver();
  }, [fetchDiver]);

  useEffect(() => {
    if (medicalReview?.all_questions) {
      const ansObj = {};
      medicalReview.all_questions.forEach(q => {
        ansObj[q.id] = q.answered_yes;
      });
      setEditableAnswers(ansObj);
    }
  }, [medicalReview]);

  const handleSaveMedicalAnswers = async e => {
    e.preventDefault();
    if (!modificationReason.trim()) {
      toast.error('Please provide an audit reason for modifying questionnaire answers.');
      return;
    }

    try {
      setSavingMedicalAnswers(true);
      const res = await api.put(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/medical-answers`,
        {
          answers: editableAnswers,
          reason: modificationReason.trim(),
        }
      );

      toast.success('Medical questionnaire updated & audited!');
      setMedicalReview(res.data);
      setDiver(prev => ({ ...prev, medical_status: res.data.status }));
      setShowEditAnswers(false);
      setModificationReason('');
      fetchDiver();
    } catch (err) {
      console.error('Failed to update medical answers:', err);
      toast.error(err.response?.data?.detail || 'Failed to update medical answers.');
    } finally {
      setSavingMedicalAnswers(false);
    }
  };

  const handleSaveGear = async payload => {
    try {
      setSavingGear(true);
      await api.put(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}`,
        payload
      );
      toast.success('Equipment preferences & sizing updated!');
      fetchDiver();
    } catch (err) {
      console.error('Failed to update equipment:', err);
      toast.error(err.response?.data?.detail || 'Failed to update equipment.');
    } finally {
      setSavingGear(false);
    }
  };

  const handleToggleCheckin = async () => {
    if (!diver) return;
    const isMedicalBlocked =
      diver.medical_status === 'FLAGGED_CONTACT_CENTER' || diver.medical_status === 'FLAGGED';
    if (isMedicalBlocked && !diver.onboard_checkin_status) {
      toast.error(
        `Safety Gate: ${diver.diver_full_name} has an unresolved medical flag. Verified physician clearance is required before boarding.`
      );
      setShowClearanceForm(true);
      return;
    }

    try {
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/toggle-checkin`
      );
      setDiver(prev => ({ ...prev, onboard_checkin_status: res.data.onboard_checkin_status }));
      toast.success(
        res.data.onboard_checkin_status
          ? `${diver.diver_full_name} boarded!`
          : `Boarding revoked for ${diver.diver_full_name}`
      );
    } catch (err) {
      console.error('Failed to toggle boarding:', err);
      toast.error(err.response?.data?.detail || 'Failed to update boarding status.');
    }
  };

  const handleTogglePayment = async () => {
    if (!diver?.booking_id) return;
    try {
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/bookings/${diver.booking_id}/toggle-payment`
      );
      setDiver(prev => ({ ...prev, payment_status: res.data.payment_status }));
      toast.success(
        res.data.payment_status === 'PAID_IN_FULL'
          ? 'Marked as Paid in Full'
          : 'Reverted to Due at Desk'
      );
    } catch (err) {
      console.error('Failed to toggle payment:', err);
      toast.error(err.response?.data?.detail || 'Failed to toggle payment.');
    }
  };

  const handleClearMedical = async e => {
    e.preventDefault();
    if (!confirmedInspected) {
      toast.error('You must confirm physical inspection of the signed physician clearance form.');
      return;
    }
    if (!physicianName.trim()) {
      toast.error('Please enter the physician full name.');
      return;
    }

    try {
      setClearingMedical(true);
      await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/clear-medical`,
        {
          physician_name: physicianName.trim(),
          physician_clinic: physicianClinic.trim() || undefined,
          notes: clearanceNotes.trim() || undefined,
          confirmed_physical_form_inspected: true,
        }
      );

      toast.success(`Physician clearance approved for ${diver.diver_full_name}!`);
      setShowClearanceForm(false);
      fetchDiver();
    } catch (err) {
      console.error('Failed to clear medical status:', err);
      toast.error(err.response?.data?.detail || 'Failed to approve physician clearance.');
    } finally {
      setClearingMedical(false);
    }
  };

  const handleDownloadEmergencyDossier = async () => {
    try {
      setDownloadingDossier(true);
      toast.loading('Generating Emergency Medical Dossier PDF...', { id: 'emerg-dossier' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/emergency-dossier`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = diver.diver_full_name.replace(/\s+/g, '_');
      link.setAttribute('download', `emergency_dossier_${cleanName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      toast.success('Emergency Dossier downloaded!', { id: 'emerg-dossier' });
    } catch (err) {
      console.error('Failed to download emergency dossier:', err);
      toast.error('Failed to download emergency dossier.', { id: 'emerg-dossier' });
    } finally {
      setDownloadingDossier(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex justify-center items-center py-24'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
        <span className='ml-3 text-gray-600 font-medium'>Loading diver operations profile...</span>
      </div>
    );
  }

  if (!diver) {
    return (
      <div className='max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border text-center'>
        <h3 className='font-bold text-base text-gray-800 dark:text-gray-200'>
          Participant Not Found
        </h3>
        <p className='text-xs text-gray-500 mt-1 mb-4'>
          The requested participant could not be found or you lack center management permissions.
        </p>
        <Link
          to={`/manage/centers/${centerId}/trips/${tripId}/manifest`}
          className='px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold'
        >
          Return to Manifest
        </Link>
      </div>
    );
  }

  const isPhysicianApproved = diver.medical_status === 'PHYSICIAN_APPROVED';
  const isCleared = diver.medical_status === 'CLEARED';
  const isMedicalBlocked =
    diver.medical_status === 'FLAGGED_CONTACT_CENTER' || diver.medical_status === 'FLAGGED';
  const isPaid = diver.payment_status === 'PAID_IN_FULL' || diver.payment_status === 'PAID_ONLINE';

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50 py-6'>
      <SEO
        title={`Diver Profile: ${diver.diver_full_name} - Trip Ops - Divemap`}
        description='Detailed diver gear configuration, medical review, and paperwork.'
      />

      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 space-y-6'>
        {/* Navigation Breadcrumb */}
        <div className='flex items-center justify-between'>
          <Link
            to={`/manage/centers/${centerId}/trips/${tripId}/manifest`}
            className='inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold'
          >
            <ChevronLeft size={14} />
            <span>Back to Trip Manifest & Roll Call</span>
          </Link>
          <span className='text-xs text-gray-400 font-mono'>
            Trip: {diver.slot?.departure_date} • {diver.slot?.meeting_time} (
            {diver.slot?.product_title})
          </span>
        </div>

        {/* Diver Summary Banner */}
        <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div className='flex items-center gap-3.5'>
            <div className='w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-lg'>
              <User size={24} />
            </div>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <h1 className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white'>
                  {diver.diver_full_name}
                </h1>
                {diver.diver_nationality && (
                  <span className='px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
                    {diver.diver_nationality}
                  </span>
                )}
                {diver.passport_number && (
                  <span className='text-xs text-gray-400 font-mono'>
                    ID: {diver.passport_number}
                  </span>
                )}
              </div>
              <p className='text-xs text-gray-500 mt-0.5'>
                Ref: <span className='font-mono'>{diver.booking_id?.slice(0, 8)}...</span> • Vessel:{' '}
                {diver.slot?.vessel_name}
              </p>
            </div>
          </div>

          {/* Quick Actions & Status Triggers */}
          <div className='flex flex-wrap items-center gap-2.5'>
            {/* Boarding Roll-Call Toggle */}
            <button
              type='button'
              onClick={handleToggleCheckin}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isMedicalBlocked
                  ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  : diver.onboard_checkin_status
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
              title={
                isMedicalBlocked
                  ? 'Boarding Blocked: Diver has an unresolved medical flag. Click to review & approve clearance.'
                  : diver.onboard_checkin_status
                    ? 'Click to revoke boarding'
                    : 'Click to confirm diver has boarded'
              }
            >
              {isMedicalBlocked ? (
                <AlertTriangle size={14} className='text-red-600' />
              ) : diver.onboard_checkin_status ? (
                <Check size={14} className='text-white' />
              ) : (
                <Hourglass size={14} className='text-amber-600' />
              )}
              <span>
                {isMedicalBlocked
                  ? 'Medical Hold'
                  : diver.onboard_checkin_status
                    ? 'Boarded'
                    : 'Board Boat'}
              </span>
            </button>

            {/* Payment Toggle */}
            <button
              type='button'
              onClick={handleTogglePayment}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
              title='Click to toggle paid in full vs due at desk'
            >
              <DollarSign size={13} />
              <span>{isPaid ? 'Paid in Full' : 'Due at Desk'}</span>
            </button>

            {/* Export Emergency Dossier */}
            <button
              type='button'
              onClick={handleDownloadEmergencyDossier}
              disabled={downloadingDossier}
              className='flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50'
              title='Export official Court/Coast Guard/Hyperbaric emergency medical record'
            >
              {downloadingDossier ? (
                <Loader2 size={13} className='animate-spin' />
              ) : (
                <FileText size={13} />
              )}
              <span>Emergency Dossier (PDF)</span>
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Workspace */}
        <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
          {/* Left Column: Credentials, Medical & Legal Audit (5 Cols) */}
          <div className='lg:col-span-5 space-y-5'>
            {/* 1. Certification & Credentials Card */}
            <div className='bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <div className='flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700'>
                <Shield className='text-blue-600 h-4 w-4' />
                <h3 className='font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white'>
                  Certification & Identity
                </h3>
              </div>

              <div className='space-y-2 text-xs'>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Agency & Level:</span>
                  <strong className='text-gray-900 dark:text-white'>
                    {diver.certification_agency} {diver.certification_level}
                  </strong>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Cert Card # (Physical/App):</span>
                  <strong className='text-gray-900 dark:text-white font-mono'>
                    {diver.certification_number || 'N/A'}
                  </strong>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Date of Birth:</span>
                  <span className='text-gray-900 dark:text-white font-mono'>
                    {diver.date_of_birth || 'N/A'}
                  </span>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Email:</span>
                  <span className='text-gray-900 dark:text-white truncate max-w-[200px]'>
                    {diver.diver_email || 'N/A'}
                  </span>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Phone:</span>
                  <span className='text-gray-900 dark:text-white font-mono'>
                    {diver.diver_phone || 'N/A'}
                  </span>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Declared Dives:</span>
                  <strong className='text-gray-900 dark:text-white'>
                    {diver.diver_experience?.declared_dives ?? 'N/A'} dives
                  </strong>
                </div>
                <div className='flex justify-between py-1 border-b border-gray-50 dark:border-gray-750'>
                  <span className='text-gray-500'>Platform Logged Dives:</span>
                  <strong className='text-blue-600 dark:text-blue-400 font-semibold'>
                    {diver.diver_experience?.platform_logged_dives ?? 0} on Divemap
                  </strong>
                </div>
                {diver.diver_experience?.has_account && (
                  <div className='flex justify-between py-1'>
                    <span className='text-gray-500'>Divemap Diver:</span>
                    <strong className='text-emerald-600 dark:text-emerald-400'>
                      @{diver.diver_experience.username}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Medical Review & Physician Clearance Card */}
            <div className='bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3'>
              <div className='flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700'>
                <div className='flex items-center gap-2'>
                  <HeartPulse className='text-red-500 h-4 w-4' />
                  <h3 className='font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white'>
                    DMSC Medical Screening
                  </h3>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowEditAnswers(!showEditAnswers);
                      setShowClearanceForm(false);
                    }}
                    className='text-blue-600 dark:text-blue-400 hover:underline font-semibold text-[11px] flex items-center gap-1'
                  >
                    <Edit2 size={12} />
                    <span>{showEditAnswers ? 'Cancel Edit' : 'Modify Answers (Audited)'}</span>
                  </button>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isPhysicianApproved
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                        : isCleared
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                    }`}
                  >
                    {diver.medical_status}
                  </span>
                </div>
              </div>

              {/* Audit Log Banner */}
              {medicalReview?.modification_audit && (
                <div className='p-2 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] text-blue-900 dark:text-blue-200'>
                  <div className='flex items-center justify-between'>
                    <span className='font-bold'>
                      Audit Log: Modified by {medicalReview.modification_audit.modified_by_name}
                    </span>
                    <span className='text-[10px] text-gray-400 font-mono'>
                      {medicalReview.modification_audit.modified_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className='text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 italic'>
                    Reason: "{medicalReview.modification_audit.modification_reason}"
                  </p>
                </div>
              )}

              {/* Physician Approved Banner */}
              {isPhysicianApproved && (
                <div className='p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1.5 text-xs'>
                  <div className='flex items-center gap-1.5 text-blue-900 dark:text-blue-300 font-bold'>
                    <Stethoscope size={14} className='text-blue-600' />
                    <span>Physician Clearance on Record</span>
                  </div>
                  <p className='text-gray-600 dark:text-gray-300 text-[11px]'>
                    Examining Doctor:{' '}
                    <strong>Dr. {diver.medical_clearance_audit?.physician_name}</strong>
                    {diver.medical_clearance_audit?.physician_clinic &&
                      ` (${diver.medical_clearance_audit.physician_clinic})`}
                  </p>
                  {diver.medical_clearance_audit?.reason && (
                    <p className='text-[10px] text-gray-500 italic'>
                      Notes: {diver.medical_clearance_audit.reason}
                    </p>
                  )}
                  <p className='text-[10px] text-gray-400 font-mono'>
                    Verified by {diver.medical_clearance_audit?.cleared_by_name} at{' '}
                    {diver.medical_clearance_audit?.cleared_at?.slice(0, 16)}
                  </p>
                </div>
              )}

              {/* Flagged Medical Conditions Alert */}
              {isMedicalBlocked && !showEditAnswers && !showClearanceForm && (
                <div className='p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl space-y-2.5 text-xs text-red-900 dark:text-red-200'>
                  <div className='flex items-center justify-between'>
                    <span className='font-bold flex items-center gap-1 text-red-700 dark:text-red-400'>
                      <AlertTriangle size={14} />
                      Flagged Condition (Physician Clearance Required)
                    </span>
                    <button
                      type='button'
                      onClick={() => setShowClearanceForm(!showClearanceForm)}
                      className='text-blue-600 underline font-semibold text-[11px]'
                    >
                      {showClearanceForm ? 'Cancel' : 'Approve Clearance'}
                    </button>
                  </div>

                  {medicalReview?.flagged_questions && (
                    <ul className='list-disc pl-4 space-y-1 text-[11px] text-gray-700 dark:text-gray-300'>
                      {medicalReview.flagged_questions.map(q => (
                        <li key={q.id}>
                          <strong>{q.text}</strong>: Diver answered YES.
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Audited Medical Answers Editor */}
              {showEditAnswers && (
                <form
                  onSubmit={handleSaveMedicalAnswers}
                  className='p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3 text-xs'
                >
                  <div className='flex items-center justify-between pb-1.5 border-b'>
                    <span className='font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1'>
                      <Stethoscope size={13} className='text-blue-600' />
                      Audited Medical Answers Editor
                    </span>
                    <span className='text-[10px] text-amber-600 font-semibold'>
                      * Modifications are permanently logged
                    </span>
                  </div>

                  <div className='space-y-2 max-h-56 overflow-y-auto pr-1'>
                    {(medicalReview?.all_questions || []).map(q => (
                      <div
                        key={q.id}
                        className='p-2 bg-gray-50 dark:bg-gray-750 rounded-lg flex items-center justify-between gap-2'
                      >
                        <span className='text-[11px] text-gray-800 dark:text-gray-200 leading-tight'>
                          {q.text}
                        </span>
                        <div className='flex items-center gap-1 shrink-0'>
                          <button
                            type='button'
                            onClick={() => setEditableAnswers(prev => ({ ...prev, [q.id]: false }))}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                              editableAnswers[q.id] === false
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            NO
                          </button>
                          <button
                            type='button'
                            onClick={() => setEditableAnswers(prev => ({ ...prev, [q.id]: true }))}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                              editableAnswers[q.id] === true
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            YES
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className='block font-semibold mb-1 text-[11px] text-gray-700 dark:text-gray-300'>
                      Manager Audit Reason *
                    </label>
                    <input
                      type='text'
                      required
                      value={modificationReason}
                      onChange={e => setModificationReason(e.target.value)}
                      placeholder='e.g. Diver confirmed no history of cardiovascular issues; misclick on mobile questionnaire'
                      className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-750'
                    />
                  </div>

                  <div className='flex justify-end gap-2 pt-2 border-t'>
                    <button
                      type='button'
                      onClick={() => setShowEditAnswers(false)}
                      className='px-3 py-1.5 text-gray-600 rounded-lg text-xs'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={savingMedicalAnswers}
                      className='px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm'
                    >
                      {savingMedicalAnswers ? (
                        <Loader2 size={12} className='animate-spin' />
                      ) : (
                        <Check size={12} />
                      )}
                      <span>Save & Audit Answers</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Physician Clearance Approval Form */}
              {showClearanceForm && (
                <form
                  onSubmit={handleClearMedical}
                  className='p-3.5 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 text-xs'
                >
                  <h4 className='font-bold text-gray-900 dark:text-white flex items-center gap-1.5'>
                    <Stethoscope size={14} className='text-blue-600' />
                    Verify Physician Evaluation Form
                  </h4>

                  <div>
                    <label className='block font-semibold mb-1 text-gray-700 dark:text-gray-300'>
                      Examining Physician Name *
                    </label>
                    <input
                      type='text'
                      required
                      value={physicianName}
                      onChange={e => setPhysicianName(e.target.value)}
                      placeholder='Dr. First Last, M.D.'
                      className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800'
                    />
                  </div>

                  <div>
                    <label className='block font-semibold mb-1 text-gray-700 dark:text-gray-300'>
                      Clinic / Hospital
                    </label>
                    <input
                      type='text'
                      value={physicianClinic}
                      onChange={e => setPhysicianClinic(e.target.value)}
                      placeholder='e.g. Athens Hyperbaric Center'
                      className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800'
                    />
                  </div>

                  <div>
                    <label className='block font-semibold mb-1 text-gray-700 dark:text-gray-300'>
                      Clearance Notes / Restrictions
                    </label>
                    <textarea
                      rows={2}
                      value={clearanceNotes}
                      onChange={e => setClearanceNotes(e.target.value)}
                      placeholder='e.g. Cleared for recreational diving to 30m without restrictions.'
                      className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-800'
                    />
                  </div>

                  <label className='flex items-start gap-2 pt-1 cursor-pointer'>
                    <input
                      type='checkbox'
                      required
                      checked={confirmedInspected}
                      onChange={e => setConfirmedInspected(e.target.checked)}
                      className='mt-0.5 rounded text-blue-600'
                    />
                    <span className='text-[11px] text-gray-600 dark:text-gray-400 leading-tight'>
                      I certify that I have physically inspected and verified the signed diving
                      medical clearance form.
                    </span>
                  </label>

                  <div className='flex justify-end gap-2 pt-2 border-t'>
                    <button
                      type='button'
                      onClick={() => setShowClearanceForm(false)}
                      className='px-3 py-1.5 text-gray-600 rounded-lg text-xs font-semibold'
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      disabled={clearingMedical}
                      className='px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm'
                    >
                      {clearingMedical ? (
                        <Loader2 size={12} className='animate-spin' />
                      ) : (
                        <Check size={12} />
                      )}
                      <span>Approve & Unlock Boarding</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* 3. Executed Liability Waiver Card */}
            <div className='bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2 text-xs'>
              <div className='flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700'>
                <h3 className='font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white'>
                  Executed Liability Waiver
                </h3>
                <span className='px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800'>
                  ✓ Signed
                </span>
              </div>
              <div className='space-y-1.5 text-gray-600 dark:text-gray-400 text-[11px]'>
                <p>
                  Electronic Signature: <strong>{diver.diver_full_name}</strong>
                </p>
                <p>Signed At: {diver.signed_at?.slice(0, 19).replace('T', ' ') || 'On File'}</p>
                <p className='text-[10px] font-mono text-gray-400 truncate'>
                  Bundle: padi_10086_eu • Hash verified
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Complete Unified Diver Gear Configuration (7 Cols) */}
          <div className='lg:col-span-7 space-y-4'>
            <div className='bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4'>
              <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                <div>
                  <h2 className='text-sm sm:text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight'>
                    Equipment, Cylinder & Weights Profile
                  </h2>
                  <p className='text-xs text-gray-500'>
                    Live equipment sizing, buoyancy calculations, and valve connections for dockside
                    packing.
                  </p>
                </div>
              </div>

              {/* Embedded Unified Configuration Form */}
              <DiverGearConfigForm
                initialData={diver}
                onSave={handleSaveGear}
                loading={savingGear}
                showWeightCalculator={true}
                showEmergencyAndInsurance={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripParticipantDetailsPage;
