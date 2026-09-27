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
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../../api';

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
  const [physicianName, setPhysicianName] = useState('');
  const [physicianClinic, setPhysicianClinic] = useState('');
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [confirmedInspected, setConfirmedInspected] = useState(false);
  const [clearingMedical, setClearingMedical] = useState(false);
  const [downloadingDossier, setDownloadingDossier] = useState(false);

  useEffect(() => {
    if (isOpen && participant) {
      setDiver(participant);
      setIsEditing(initialEditMode);
      setShowClearanceForm(false);

      api
        .get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/medical-review`
        )
        .then(res => setMedicalReview(res.data))
        .catch(err => console.error('Failed to load medical review:', err));
    }
  }, [isOpen, participant, initialEditMode, centerId, tripId]);

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

        {/* Medical Alerts & Physician Clearance Form */}
        {isPhysicianApproved && currentDiver.medical_clearance_audit && (
          <div className='p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1 text-xs'>
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
            <p className='text-[10px] text-gray-400 font-mono'>
              Cleared by {currentDiver.medical_clearance_audit.cleared_by_name} at{' '}
              {currentDiver.medical_clearance_audit.cleared_at?.slice(0, 16)}
            </p>
          </div>
        )}

        {isMedicalBlocked && (
          <div className='p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold'>
                <AlertTriangle size={14} className='text-amber-600' />
                <span>Flagged Medical Conditions</span>
              </div>
              <button
                type='button'
                onClick={() => setShowClearanceForm(!showClearanceForm)}
                className='text-blue-600 underline font-semibold text-[11px]'
              >
                {showClearanceForm ? 'Cancel Form' : 'Verify Physician Clearance'}
              </button>
            </div>

            {medicalReview?.flagged_questions && (
              <div className='space-y-1 text-[11px] text-gray-600 dark:text-gray-300'>
                <p className='font-semibold text-gray-700 dark:text-gray-200'>
                  Diver indicated "YES" on the following DMSC screening question(s):
                </p>
                <ul className='list-disc pl-4 space-y-0.5'>
                  {medicalReview.flagged_questions.map(q => (
                    <li key={q.id}>
                      <span className='font-medium'>{q.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
              <span className='text-gray-400 block text-[10px]'>C-Card #:</span>
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
          </div>
        </div>

        {/* Assigned Equipment Sizing: Toggle between Form and Card */}
        {isEditing ? (
          <div className='p-4 bg-white dark:bg-gray-850 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm'>
            <h4 className='font-bold text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-1.5'>
              <Edit2 size={13} />
              Unified Diver Gear & Ballast Configuration
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
                <span className='text-gray-400 block text-[10px]'>Lead Ballast:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {currentDiver.estimated_lead_kg || 0} kg (
                  {eq.weight_system === 'BELT' ? 'Weight Belt' : 'Integrated Pockets'})
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
