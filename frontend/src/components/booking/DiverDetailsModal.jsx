import { Modal } from 'antd';
import {
  User,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  CreditCard,
  Gauge,
  Edit2,
  Check,
  Loader2,
  Stethoscope,
  FileText,
  ExternalLink,
  LifeBuoy,
  Coins,
  CheckCircle,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../../api';
import { formatDate } from '../../utils/dateHelpers';

import DiverGearConfigForm from './DiverGearConfigForm';

const DiverDetailsModal = ({
  isOpen,
  onClose,
  participant,
  centerId,
  tripId,
  onUpdated,
  initialEditMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [loading, setLoading] = useState(false);
  const [diver, setDiver] = useState(participant);

  // Medical Review & Clearance state
  const [medicalReview, setMedicalReview] = useState(null);
  const [showClearanceForm, setShowClearanceForm] = useState(false);
  const [showEditAnswers, setShowEditAnswers] = useState(false);
  const [editableAnswers, setEditableAnswers] = useState({});
  const [modificationReason, setModificationReason] = useState('');
  const [savingMedicalAnswers, setSavingMedicalAnswers] = useState(false);
  const [physicianName, setPhysicianName] = useState('');
  const [physicianClinic, setPhysicianClinic] = useState('');
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [confirmedInspected, setConfirmedInspected] = useState(false);
  const [grantAnnualCenterApproval, setGrantAnnualCenterApproval] = useState(true);
  const [clearingMedical, setClearingMedical] = useState(false);
  const [downloadingDossier, setDownloadingDossier] = useState(false);

  useEffect(() => {
    if (isOpen && participant) {
      setDiver(participant);
      setIsEditing(initialEditMode);
      setShowClearanceForm(participant.medical_status === 'FLAGGED_CONTACT_CENTER');
      setShowEditAnswers(false);
      setModificationReason('');

      api
        .get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/medical-review`
        )
        .then(res => {
          setMedicalReview(res.data);
          if (res.data?.all_questions) {
            const ansObj = {};
            res.data.all_questions.forEach(q => {
              ansObj[q.id] = q.answered_yes;
            });
            setEditableAnswers(ansObj);
          }
        })
        .catch(err => console.error('Failed to load medical review:', err));
    }
  }, [isOpen, participant, initialEditMode, centerId, tripId]);

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
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/medical-answers`,
        {
          answers: editableAnswers,
          reason: modificationReason.trim(),
        }
      );

      toast.success('Medical questionnaire updated & audited!');
      setMedicalReview(res.data);
      setDiver(prev => ({ ...(prev || participant), medical_status: res.data.status }));
      setShowEditAnswers(false);
      setModificationReason('');
      onUpdated();
    } catch (err) {
      console.error('Failed to update medical answers:', err);
      toast.error(err.response?.data?.detail || 'Failed to update medical answers.');
    } finally {
      setSavingMedicalAnswers(false);
    }
  };

  if (!participant) return null;

  const currentDiver = diver || participant;
  const isPhysicianApproved = currentDiver.medical_status === 'PHYSICIAN_APPROVED';
  const isCleared = currentDiver.medical_status === 'CLEARED';
  const isPaid =
    currentDiver.payment_status === 'PAID_IN_FULL' || currentDiver.payment_status === 'PAID_ONLINE';
  const isMedicalBlocked =
    currentDiver.medical_status === 'FLAGGED_CONTACT_CENTER' ||
    currentDiver.medical_status === 'FLAGGED';

  const handleSaveGear = async payload => {
    try {
      setLoading(true);
      await api.put(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}`,
        payload
      );

      // Instantly reflect updated equipment in local diver view
      setDiver(prev => ({
        ...(prev || participant),
        selected_tank_id: payload.selected_tank_id,
        selected_gas_mix_id: payload.selected_gas_mix_id,
        estimated_lead_kg: payload.equipment_sizing?.estimated_lead_kg || 0,
        equipment_sizing: {
          ...((prev || participant)?.equipment_sizing || {}),
          ...payload.equipment_sizing,
        },
      }));

      toast.success('Equipment preferences updated!');
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      console.error('Failed to update equipment:', err);
      toast.error(err.response?.data?.detail || 'Failed to update equipment.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearMedical = async e => {
    e.preventDefault();
    if (!confirmedInspected) {
      toast.error('You must confirm physical inspection of the physician clearance form.');
      return;
    }
    if (!physicianName.trim()) {
      toast.error('Please enter the physician full name.');
      return;
    }

    try {
      setClearingMedical(true);
      if (grantAnnualCenterApproval && (participant.user_id || currentDiver.user_id)) {
        await api.post(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/grant-annual-approval`,
          {
            physician_name: physicianName.trim(),
            physician_clinic: physicianClinic.trim() || undefined,
            approval_notes: clearanceNotes.trim() || undefined,
            validity_days: 365,
          }
        );
        toast.success(
          `1-Year Medical Approval granted for ${currentDiver.diver_full_name} at this center!`
        );
      } else {
        await api.post(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/clear-medical`,
          {
            physician_name: physicianName.trim(),
            physician_clinic: physicianClinic.trim() || undefined,
            notes: clearanceNotes.trim() || undefined,
            confirmed_physical_form_inspected: true,
          }
        );
        toast.success(`Physician clearance approved for ${currentDiver.diver_full_name}!`);
      }

      setShowClearanceForm(false);
      setDiver(prev => ({
        ...(prev || participant),
        medical_status: 'PHYSICIAN_APPROVED',
        medical_clearance_audit: {
          physician_name: physicianName.trim(),
          physician_clinic: physicianClinic.trim() || undefined,
          cleared_by_name: 'Manager',
          cleared_at: new Date().toISOString(),
          reason: clearanceNotes.trim() || undefined,
        },
      }));
      onUpdated();

      // Refresh review
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/medical-review`
      );
      setMedicalReview(res.data);
    } catch (err) {
      console.error('Failed to clear medical condition:', err);
      toast.error(err.response?.data?.detail || 'Failed to clear medical condition.');
    } finally {
      setClearingMedical(false);
    }
  };

  const handleDownloadEmergencyDossier = async () => {
    try {
      setDownloadingDossier(true);
      toast.loading('Generating Emergency Medical Dossier PDF...', { id: 'emerg-dossier' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/emergency-dossier`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = currentDiver.diver_full_name.replace(/\s+/g, '_');
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

  const eq = currentDiver.equipment_sizing || {};

  return (
    <Modal
      open={isOpen}
      onCancel={() => {
        setIsEditing(false);
        setShowClearanceForm(false);
        onClose();
      }}
      footer={null}
      width={720}
      title={
        <div className='flex items-center justify-between pb-2 border-b pr-6'>
          <div className='flex items-center gap-2.5'>
            <User className='h-5 w-5 text-blue-600' />
            <div>
              <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                {currentDiver.diver_full_name}
              </h3>
              <p className='text-xs text-gray-400'>
                {currentDiver.diver_nationality || 'Participant'} • Ref:{' '}
                {currentDiver.booking_id?.slice(0, 8)}...
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Link
              to={`/manage/centers/${centerId}/trips/${tripId}/participants/${currentDiver.id}`}
              className='flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 font-semibold'
              title='Open full dedicated page'
            >
              <span>Full Page</span>
              <ExternalLink size={12} />
            </Link>
            <button
              type='button'
              onClick={() => setIsEditing(!isEditing)}
              className='flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold'
            >
              <Edit2 size={13} />
              {isEditing ? 'Cancel Edit' : 'Edit Gear'}
            </button>
          </div>
        </div>
      }
    >
      <div className='pt-3 space-y-4 text-xs'>
        {/* Status Highlights */}
        <div className='grid grid-cols-3 gap-2'>
          <div className='p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center'>
            <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
              Medical
            </span>
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPhysicianApproved
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : isCleared
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isPhysicianApproved ? (
                <Stethoscope size={11} />
              ) : isCleared ? (
                <ShieldCheck size={11} />
              ) : (
                <AlertTriangle size={11} />
              )}
              {isPhysicianApproved ? 'PHYSICIAN' : isCleared ? 'CLEARED' : 'FLAGGED'}
            </span>
          </div>

          <div className='p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center'>
            <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
              Boarding Status
            </span>
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                currentDiver.onboard_checkin_status
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <FileCheck size={11} />
              {currentDiver.onboard_checkin_status ? 'BOARDED' : 'NOT BOARDED'}
            </span>
          </div>

          <div className='p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center'>
            <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
              Payment Status
            </span>
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <CreditCard size={11} />
              {isPaid ? 'PAID' : 'DUE AT DESK'}
            </span>
          </div>
        </div>

        {/* OCTO Financial Settlement & Line Items Breakdown */}
        {currentDiver.financials && (
          <div className='p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/80 dark:border-blue-900/60 space-y-2.5 text-xs'>
            <div className='flex items-center justify-between pb-1.5 border-b border-blue-200/60 dark:border-blue-900/40'>
              <div className='flex items-center gap-1.5'>
                <Coins size={14} className='text-blue-600' />
                <h4 className='font-bold uppercase tracking-wider text-[11px] text-gray-900 dark:text-white'>
                  OCTO Financial Settlement & Rental Breakdown
                </h4>
              </div>
              <div className='flex items-center gap-2'>
                <span className='font-mono font-bold text-sm text-blue-900 dark:text-blue-200'>
                  {currentDiver.formatted_total_due || `€${currentDiver.total_due?.toFixed(2)}`}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                  }`}
                >
                  {isPaid ? 'Paid in Full' : 'Due at Desk'}
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div className='space-y-1.5 pt-1'>
              {currentDiver.financials.line_items?.map((item, idx) => (
                <div
                  key={idx}
                  className='flex items-center justify-between text-gray-600 dark:text-gray-300 pl-1'
                >
                  <span className='flex items-center gap-1.5'>
                    <span className='w-1.5 h-1.5 rounded-full bg-blue-500'></span>
                    <span>{item.title}</span>
                  </span>
                  <span className='font-mono font-semibold text-gray-900 dark:text-white'>
                    {item.formatted}
                  </span>
                </div>
              ))}

              {currentDiver.financials.package_cap?.applied && (
                <div className='mt-1.5 p-1.5 bg-blue-100/60 dark:bg-blue-900/40 rounded text-[11px] text-blue-900 dark:text-blue-200 font-medium flex items-center justify-between'>
                  <span>✓ {currentDiver.financials.package_cap.title}</span>
                  {currentDiver.financials.package_cap.savings > 0 && (
                    <span className='font-mono text-emerald-700 dark:text-emerald-300'>
                      Saved {currentDiver.financials.package_cap.formattedSavings}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medical Status & Review Section */}
        <div className='p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2.5 text-xs'>
          <div className='flex items-center justify-between pb-1.5 border-b border-gray-200/60 dark:border-gray-700'>
            <div className='flex items-center gap-1.5'>
              <Stethoscope size={14} className='text-blue-600' />
              <h4 className='font-bold uppercase tracking-wider text-[11px] text-gray-900 dark:text-white'>
                DMSC Medical Screening & Audit Trail
              </h4>
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
              {isMedicalBlocked && (
                <button
                  type='button'
                  onClick={() => {
                    setShowClearanceForm(!showClearanceForm);
                    setShowEditAnswers(false);
                  }}
                  className='text-emerald-600 dark:text-emerald-400 hover:underline font-semibold text-[11px] flex items-center gap-1'
                >
                  <ShieldCheck size={12} />
                  <span>{showClearanceForm ? 'Cancel Form' : 'Verify Clearance'}</span>
                </button>
              )}
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
          {isPhysicianApproved && currentDiver.medical_clearance_audit && (
            <div className='p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1 text-xs'>
              <div className='flex items-center gap-1.5 text-blue-900 dark:text-blue-200 font-bold'>
                <Stethoscope size={14} className='text-blue-600' />
                <span>Physician Clearance on Record</span>
              </div>
              <p className='text-gray-600 dark:text-gray-300 text-[11px]'>
                Examining Physician:{' '}
                <strong>Dr. {currentDiver.medical_clearance_audit.physician_name}</strong>
                {currentDiver.medical_clearance_audit.physician_clinic &&
                  ` (${currentDiver.medical_clearance_audit.physician_clinic})`}
              </p>
              {currentDiver.medical_clearance_audit.reason && (
                <p className='text-[10px] text-gray-500 italic'>
                  Notes: {currentDiver.medical_clearance_audit.reason}
                </p>
              )}
            </div>
          )}

          {/* Active 1-Year Center Approval Banner */}
          {medicalReview?.center_approval && (
            <div className='p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1 text-xs'>
              <div className='flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-bold'>
                <CheckCircle size={14} className='text-emerald-600' />
                <span>Active 1-Year Center Medical Approval</span>
              </div>
              <p className='text-emerald-800 dark:text-emerald-300 text-[11px]'>
                Approved by {medicalReview.center_approval.approved_by_name} • Dr.{' '}
                {medicalReview.center_approval.physician_name} • Valid until{' '}
                {formatDate(medicalReview.center_approval.expires_at)}
              </p>
            </div>
          )}

          {/* Uploaded Physician Document Link */}
          {medicalReview?.physician_certificate_url && (
            <div className='p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs flex items-center justify-between'>
              <span className='text-[11px] font-semibold text-blue-900 dark:text-blue-200'>
                Uploaded Physician Clearance Document
              </span>
              <a
                href={medicalReview.physician_certificate_url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1'
              >
                <span>View Document</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Flagged Medical Conditions Notice */}
          {isMedicalBlocked && !showEditAnswers && !showClearanceForm && (
            <div className='p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5'>
              <div className='flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold'>
                <AlertTriangle size={14} className='text-amber-600' />
                <span>Flagged Clinical Conditions (Boarding Blocked)</span>
              </div>
              {medicalReview?.flagged_questions && (
                <ul className='list-disc pl-4 space-y-0.5 text-[11px] text-gray-700 dark:text-gray-300'>
                  {medicalReview.flagged_questions.map(q => (
                    <li key={q.id}>
                      <span className='font-medium'>{q.text}</span>: Diver answered YES.
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
              className='p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3'
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
                  className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-gray-700'
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
              className='p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3'
            >
              <h4 className='font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-xs'>
                <Stethoscope size={14} className='text-blue-600' />
                Physician Clearance Approval Form
              </h4>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs'>
                <div>
                  <label className='block font-semibold mb-1 text-[11px]'>
                    Examining Physician Name *
                  </label>
                  <input
                    type='text'
                    required
                    value={physicianName}
                    onChange={e => setPhysicianName(e.target.value)}
                    placeholder='Dr. Sofia Karra, M.D.'
                    className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white'
                  />
                </div>
                <div>
                  <label className='block font-semibold mb-1 text-[11px]'>Clinic / Hospital</label>
                  <input
                    type='text'
                    value={physicianClinic}
                    onChange={e => setPhysicianClinic(e.target.value)}
                    placeholder='e.g. Athens Hyperbaric Center'
                    className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white'
                  />
                </div>
                <div className='sm:col-span-2'>
                  <label className='block font-semibold mb-1 text-[11px]'>
                    Clinical Notes / Approval Reason
                  </label>
                  <textarea
                    rows={2}
                    value={clearanceNotes}
                    onChange={e => setClearanceNotes(e.target.value)}
                    placeholder='e.g. Signed medical evaluation form verified; cleared for diving down to 30m.'
                    className='w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white'
                  />
                </div>
              </div>

              {(participant.user_id || currentDiver.user_id) && (
                <label className='flex items-start gap-2 pt-1 cursor-pointer p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40'>
                  <input
                    type='checkbox'
                    checked={grantAnnualCenterApproval}
                    onChange={e => setGrantAnnualCenterApproval(e.target.checked)}
                    className='mt-0.5 rounded text-blue-600'
                  />
                  <div>
                    <span className='font-bold text-gray-900 dark:text-white block text-[11px]'>
                      Grant 1-Year Center Approval (Recommended)
                    </span>
                    <span className='text-[10px] text-gray-500 dark:text-gray-400 block leading-tight'>
                      Allows this diver to fast-track bookings at this dive center for 365 days
                      without re-verifying paperwork each trip.
                    </span>
                  </div>
                </label>
              )}

              <label className='flex items-start gap-2 pt-1 cursor-pointer'>
                <input
                  type='checkbox'
                  required
                  checked={confirmedInspected}
                  onChange={e => setConfirmedInspected(e.target.checked)}
                  className='mt-0.5 rounded text-blue-600'
                />
                <span className='text-[11px] text-gray-600 dark:text-gray-400 leading-tight'>
                  I certify under penalty of center policy that I have physically inspected and
                  verified the signed diving medical evaluation form.
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
                  <span>Approve & Clear Diver</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Credentials & Contact Box */}
        <div className='p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2'>
          <h4 className='font-bold text-[11px] text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5'>
            <ShieldCheck size={13} className='text-blue-600' />
            Certification & Credentials
          </h4>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs'>
            <div>
              <span className='text-gray-400 block text-[10px]'>Agency & Level:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {currentDiver.certification_agency} {currentDiver.certification_level}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Cert Card # (Physical/App):</span>
              <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                {currentDiver.certification_number || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Passport / ID:</span>
              <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                {currentDiver.passport_number || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Date of Birth:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {currentDiver.date_of_birth || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Email:</span>
              <strong className='text-gray-800 dark:text-gray-200 truncate block'>
                {currentDiver.diver_email || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Phone / WhatsApp:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {currentDiver.diver_phone || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Dive Experience:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {currentDiver.diver_experience?.declared_dives ?? 'N/A'} declared
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Platform Logged:</span>
              <strong className='text-blue-600 dark:text-blue-400 font-semibold'>
                {currentDiver.diver_experience?.platform_logged_dives ?? 0} on Divemap
              </strong>
            </div>
            {currentDiver.diver_experience?.has_account && (
              <div>
                <span className='text-gray-400 block text-[10px]'>Divemap Diver:</span>
                <strong className='text-emerald-600 dark:text-emerald-400'>
                  @{currentDiver.diver_experience.username}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Equipment Sizing: Toggle between Form and Card */}
        {isEditing ? (
          <div className='p-4 bg-white dark:bg-gray-850 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm'>
            <h4 className='font-bold text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-1.5'>
              <Edit2 size={13} />
              Unified Diver Gear & Weights Configuration
            </h4>
            <DiverGearConfigForm
              initialData={currentDiver}
              onSave={handleSaveGear}
              onCancel={() => setIsEditing(false)}
              loading={loading}
              compact={true}
              showBallastCalculator={true}
              showEmergencyAndInsurance={true}
            />
          </div>
        ) : (
          <div className='p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2'>
            <h4 className='font-bold text-[11px] text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5'>
              <Gauge size={13} className='text-blue-600' />
              Equipment Assignment & Sizing
            </h4>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs'>
              <div>
                <span className='text-gray-400 block text-[10px]'>Cylinder:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {currentDiver.selected_tank_id}L Steel
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Breathing Gas:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {currentDiver.selected_gas_mix_id?.toUpperCase()}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Valve Connection:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {eq.regulator_fitting || 'DIN'}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Lead Weights:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {currentDiver.estimated_lead_kg || 0} kg (
                  {eq.weight_system === 'BOTH' ||
                  (Array.isArray(eq.weight_systems) &&
                    eq.weight_systems.includes('INTEGRATED') &&
                    eq.weight_systems.includes('BELT'))
                    ? 'Pockets + Belt'
                    : eq.weight_system === 'OWN_BELT' ||
                        (Array.isArray(eq.weight_systems) && eq.weight_systems.includes('OWN_BELT'))
                      ? 'Own Belt'
                      : eq.weight_system === 'BELT' ||
                          (Array.isArray(eq.weight_systems) && eq.weight_systems.includes('BELT'))
                        ? 'Weight Belt'
                        : 'Integrated Pockets'}
                  )
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Wetsuit:</span>
                <strong className='text-gray-800 dark:text-gray-200'>
                  {eq.wetsuit_size || 'None'} ({eq.wetsuit_thickness || '5mm'}{' '}
                  {eq.wetsuit_gender ? `• ${eq.wetsuit_gender}` : ''})
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>BCD Size:</span>
                <strong className='text-gray-800 dark:text-gray-200'>
                  {eq.bcd_size || 'None'}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Fins:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {eq.fin_type === 'FULL_FOOT' ? 'Full-Foot' : 'Open-Heel'} (EU{' '}
                  {eq.shoe_size_eu || 'N/A'})
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Personal Safety:</span>
                <span className='text-gray-800 dark:text-gray-200 flex items-center gap-1 text-[11px]'>
                  {eq.has_own_dive_computer ? '✓ Computer' : 'No Computer'} •{' '}
                  {eq.has_own_smb ? '✓ SMB' : 'No SMB'}
                </span>
              </div>
            </div>

            {/* Insurance & Emergency preview if exists */}
            {(eq.insurance_provider || eq.emergency_contact_name) && (
              <div className='pt-2 mt-2 border-t border-gray-200/60 dark:border-gray-700/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]'>
                {eq.insurance_provider && (
                  <div>
                    <span className='text-gray-400 block text-[10px]'>Insurance:</span>
                    <span className='text-gray-700 dark:text-gray-300'>
                      {eq.insurance_provider} (#{eq.insurance_policy_number || 'N/A'})
                    </span>
                  </div>
                )}
                {eq.emergency_contact_name && (
                  <div>
                    <span className='text-gray-400 block text-[10px]'>Next of Kin:</span>
                    <span className='text-gray-700 dark:text-gray-300'>
                      {eq.emergency_contact_name} ({eq.emergency_contact_phone || 'N/A'})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className='flex items-center justify-between pt-2 border-t'>
          <button
            type='button'
            onClick={handleDownloadEmergencyDossier}
            disabled={downloadingDossier}
            className='flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all disabled:opacity-50'
            title='Export official Court/Coast Guard/Hyperbaric emergency medical record'
          >
            {downloadingDossier ? (
              <Loader2 size={13} className='animate-spin' />
            ) : (
              <FileText size={13} />
            )}
            <span>Export Emergency Dossier (PDF)</span>
          </button>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-xs'
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DiverDetailsModal;
