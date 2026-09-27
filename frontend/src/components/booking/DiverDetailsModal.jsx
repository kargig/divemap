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
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

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

  // Medical Review & Clearance state
  const [medicalReview, setMedicalReview] = useState(null);
  const [showClearanceForm, setShowClearanceForm] = useState(false);
  const [physicianName, setPhysicianName] = useState('');
  const [physicianClinic, setPhysicianClinic] = useState('');
  const [clearanceNotes, setClearanceNotes] = useState('');
  const [confirmedInspected, setConfirmedInspected] = useState(false);
  const [clearingMedical, setClearingMedical] = useState(false);

  // Edit fields
  const [tankId, setTankId] = useState('12');
  const [gasMixId, setGasMixId] = useState('air');
  const [regulatorFitting, setRegulatorFitting] = useState('DIN');
  const [leadKg, setLeadKg] = useState('0');
  const [wetsuitSize, setWetsuitSize] = useState('None');
  const [wetsuitThickness, setWetsuitThickness] = useState('5mm');
  const [bcdSize, setBcdSize] = useState('None');
  const [shoeSizeEu, setShoeSizeEu] = useState('');

  const syncFieldsWithParticipant = React.useCallback((p, editMode = false) => {
    if (!p) return;
    setIsEditing(editMode);
    setTankId(p.selected_tank_id || '12');
    setGasMixId(p.selected_gas_mix_id || 'air');
    setRegulatorFitting(p.equipment_sizing?.regulator_fitting || 'DIN');
    setLeadKg(
      p.estimated_lead_kg !== undefined && p.estimated_lead_kg !== null
        ? p.estimated_lead_kg.toString()
        : '0'
    );
    setWetsuitSize(p.equipment_sizing?.wetsuit_size || 'None');
    setWetsuitThickness(p.equipment_sizing?.wetsuit_thickness || '5mm');
    setBcdSize(p.equipment_sizing?.bcd_size || 'None');
    setShoeSizeEu(p.equipment_sizing?.shoe_size_eu?.toString() || '');
  }, []);

  useEffect(() => {
    if (isOpen && participant) {
      syncFieldsWithParticipant(participant, initialEditMode);
      setShowClearanceForm(false);

      api
        .get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}/medical-review`
        )
        .then(res => setMedicalReview(res.data))
        .catch(err => console.error('Failed to load medical review:', err));
    }
  }, [isOpen, participant, initialEditMode, centerId, tripId, syncFieldsWithParticipant]);

  if (!participant) return null;

  const isPhysicianApproved = participant.medical_status === 'PHYSICIAN_APPROVED';
  const isCleared = participant.medical_status === 'CLEARED';
  const isPaid =
    participant.payment_status === 'PAID_IN_FULL' || participant.payment_status === 'PAID_ONLINE';

  const handleSaveEquipment = async e => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        selected_tank_id: tankId,
        selected_gas_mix_id: gasMixId,
        equipment_sizing: {
          regulator_fitting: regulatorFitting,
          wetsuit_size: wetsuitSize === 'None' ? null : wetsuitSize,
          wetsuit_thickness: wetsuitThickness,
          bcd_size: bcdSize === 'None' ? null : bcdSize,
          shoe_size_eu: parseFloat(shoeSizeEu) || null,
          estimated_lead_kg: parseFloat(leadKg) || 0,
        },
      };

      await api.put(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participant.id}`,
        payload
      );

      toast.success('Equipment preferences updated!');
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      console.error('Failed to update equipment:', err);
      toast.error(err.response?.data?.detail || 'Failed to update equipment sizing.');
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

      toast.success(`Physician clearance approved for ${participant.diver_full_name}!`);
      setShowClearanceForm(false);
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

  return (
    <Modal
      open={isOpen}
      onCancel={() => {
        setIsEditing(false);
        setShowClearanceForm(false);
        onClose();
      }}
      footer={null}
      width={640}
      title={
        <div className='flex items-center justify-between pb-2 border-b pr-6'>
          <div className='flex items-center gap-2.5'>
            <User className='h-5 w-5 text-blue-600' />
            <div>
              <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                {participant.diver_full_name}
              </h3>
              <p className='text-xs text-gray-400'>
                {participant.diver_nationality || 'Participant'} • Ref:{' '}
                {participant.booking_id?.slice(0, 8)}...
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => {
              if (!isEditing && participant) {
                syncFieldsWithParticipant(participant, true);
              } else {
                setIsEditing(false);
              }
            }}
            className='flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold'
          >
            <Edit2 size={13} />
            {isEditing ? 'Cancel Edit' : 'Edit Gear'}
          </button>
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
              {isPhysicianApproved ? 'PHYSICIAN CLEARED' : isCleared ? 'CLEARED' : 'FLAGGED'}
            </span>
          </div>

          <div className='p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center'>
            <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>Waiver</span>
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                participant.waivers_complete
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <FileCheck size={11} />
              {participant.waivers_complete ? 'SIGNED' : 'PENDING'}
            </span>
          </div>

          <div className='p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center'>
            <span className='text-[10px] text-gray-400 uppercase font-bold block mb-1'>
              Payment
            </span>
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <CreditCard size={11} />
              {isPaid ? 'PAID' : 'DUE AT DESK'}
            </span>
          </div>
        </div>

        {/* Flagged Medical Conditions & Manager Clearance Box */}
        {medicalReview?.flagged_questions && medicalReview.flagged_questions.length > 0 && (
          <div className='p-3.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-300 dark:border-amber-800 space-y-2.5'>
            <div className='flex items-center justify-between'>
              <h4 className='font-bold text-[11px] text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5'>
                <AlertTriangle size={14} className='text-amber-600 shrink-0' />
                Flagged Medical Conditions ({medicalReview.flagged_questions.length})
              </h4>
              {!isPhysicianApproved && !showClearanceForm && (
                <button
                  type='button'
                  onClick={() => setShowClearanceForm(true)}
                  className='px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all'
                >
                  Verify Physician Clearance
                </button>
              )}
            </div>

            <p className='text-[11px] text-amber-800 dark:text-amber-300'>
              The diver answered YES to the following clinical screening question(s). Dive center
              managers can inspect these items to evaluate physician clearance:
            </p>

            <div className='space-y-1.5 pt-0.5'>
              {medicalReview.flagged_questions.map(q => (
                <div
                  key={q.id}
                  className='text-xs text-amber-950 dark:text-amber-100 bg-white/70 dark:bg-gray-800/80 p-2 rounded-lg border border-amber-200 dark:border-amber-700/60 font-medium'
                >
                  {q.text}
                </div>
              ))}
            </div>

            {/* Clearance Audit Banner (If already approved by physician) */}
            {isPhysicianApproved && medicalReview.clearance_audit && (
              <div className='mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 space-y-1'>
                <div className='flex items-center gap-1.5 font-bold'>
                  <ShieldCheck size={14} className='text-emerald-600' />
                  <span>Physician Clearance Form Inspected & Approved</span>
                </div>
                <div className='text-[11px]'>
                  <strong>Physician:</strong> Dr. {medicalReview.clearance_audit.physician_name}{' '}
                  {medicalReview.clearance_audit.physician_clinic &&
                    `(${medicalReview.clearance_audit.physician_clinic})`}
                </div>
                <div className='text-[10px] text-emerald-700 dark:text-emerald-300'>
                  Verified by staff:{' '}
                  <strong>{medicalReview.clearance_audit.cleared_by_name}</strong> on{' '}
                  {medicalReview.clearance_audit.cleared_at
                    ? new Date(medicalReview.clearance_audit.cleared_at).toLocaleString()
                    : 'N/A'}
                  {medicalReview.clearance_audit.reason &&
                    ` • ${medicalReview.clearance_audit.reason}`}
                </div>
              </div>
            )}

            {/* Inline Clearance Approval Sub-Form */}
            {showClearanceForm && (
              <form
                onSubmit={handleClearMedical}
                className='mt-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-amber-300 dark:border-amber-700 space-y-2.5'
              >
                <div className='flex items-center gap-1.5 pb-1 border-b border-gray-100 font-bold text-gray-900 dark:text-white text-xs'>
                  <Stethoscope size={13} className='text-blue-600' />
                  Record Physician Clearance (Port Authority Compliance)
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  <div>
                    <label className='block font-semibold mb-1 text-[11px]'>
                      Physician Full Name *
                    </label>
                    <input
                      type='text'
                      value={physicianName}
                      onChange={e => setPhysicianName(e.target.value)}
                      placeholder='e.g. Dr. A. Smith, MD'
                      required
                      className='w-full px-2 py-1.5 border rounded-lg text-xs'
                    />
                  </div>
                  <div>
                    <label className='block font-semibold mb-1 text-[11px]'>
                      Clinic / Hospital
                    </label>
                    <input
                      type='text'
                      value={physicianClinic}
                      onChange={e => setPhysicianClinic(e.target.value)}
                      placeholder='e.g. Athens Hyperbaric Center'
                      className='w-full px-2 py-1.5 border rounded-lg text-xs'
                    />
                  </div>
                </div>

                <div>
                  <label className='block font-semibold mb-1 text-[11px]'>
                    Clearance Notes / Restrictions
                  </label>
                  <input
                    type='text'
                    value={clearanceNotes}
                    onChange={e => setClearanceNotes(e.target.value)}
                    placeholder='e.g. Form dated 2026-09-28 physically reviewed. Cleared for recreational diving.'
                    className='w-full px-2 py-1.5 border rounded-lg text-xs'
                  />
                </div>

                <label className='flex items-start gap-2 cursor-pointer pt-1'>
                  <input
                    type='checkbox'
                    checked={confirmedInspected}
                    onChange={e => setConfirmedInspected(e.target.checked)}
                    required
                    className='rounded text-blue-600 h-4 w-4 mt-0.5 shrink-0'
                  />
                  <span className='text-[11px] font-semibold text-gray-800 dark:text-gray-200'>
                    I confirm that I have physically inspected the signed DMSC / WRSTC Physician
                    Evaluation Form certifying this diver medically fit for hyperbaric exposure.
                  </span>
                </label>

                <div className='flex items-center justify-end gap-2 pt-2 border-t'>
                  <button
                    type='button'
                    onClick={() => setShowClearanceForm(false)}
                    className='px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={clearingMedical || !confirmedInspected || !physicianName.trim()}
                    className='px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50'
                  >
                    {clearingMedical ? (
                      <Loader2 size={13} className='animate-spin' />
                    ) : (
                      <Check size={13} />
                    )}
                    Formally Clear Diver for Boarding
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Credentials & Identification Strip */}
        <div className='p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2'>
          <h4 className='font-bold text-[11px] text-gray-900 dark:text-white uppercase tracking-wider'>
            Credentials & Identification
          </h4>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs'>
            <div>
              <span className='text-gray-400 block text-[10px]'>Agency & Level:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {participant.certification_agency} {participant.certification_level}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>C-Card #:</span>
              <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                {participant.certification_number || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Passport / ID:</span>
              <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                {participant.passport_number || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Date of Birth:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {participant.date_of_birth || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Email:</span>
              <strong className='text-gray-800 dark:text-gray-200 truncate block'>
                {participant.diver_email || 'N/A'}
              </strong>
            </div>
            <div>
              <span className='text-gray-400 block text-[10px]'>Phone / WhatsApp:</span>
              <strong className='text-gray-800 dark:text-gray-200'>
                {participant.diver_phone || 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        {/* Assigned Equipment Sizing */}
        {isEditing ? (
          <form
            onSubmit={handleSaveEquipment}
            className='p-3.5 bg-blue-50/40 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3'
          >
            <h4 className='font-bold text-[11px] text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5'>
              <Edit2 size={13} />
              Edit Equipment Sizing & Cylinder
            </h4>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Cylinder</label>
                <select
                  value={tankId}
                  onChange={e => setTankId(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  <option value='12'>12L Steel</option>
                  <option value='15'>15L Steel</option>
                  <option value='al80'>AL80 (11L Alu)</option>
                  <option value='10'>10L Steel</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Gas Mix</label>
                <select
                  value={gasMixId}
                  onChange={e => setGasMixId(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  <option value='air'>Air (21%)</option>
                  <option value='ean32'>EAN32 (Nitrox)</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Valve Fitting</label>
                <select
                  value={regulatorFitting}
                  onChange={e => setRegulatorFitting(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white font-medium'
                >
                  <option value='DIN'>DIN (5/8" Threaded)</option>
                  <option value='YOKE'>Yoke (INT / A-clamp)</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Lead (kg)</label>
                <input
                  type='number'
                  step='0.5'
                  value={leadKg}
                  onChange={e => setLeadKg(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs'
                />
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Wetsuit Size</label>
                <select
                  value={wetsuitSize}
                  onChange={e => setWetsuitSize(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  <option value='None'>None (Own Suit)</option>
                  <option value='XS'>XS</option>
                  <option value='S'>S</option>
                  <option value='M'>M</option>
                  <option value='L'>L</option>
                  <option value='XL'>XL</option>
                  <option value='XXL'>XXL</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Thickness</label>
                <select
                  value={wetsuitThickness}
                  onChange={e => setWetsuitThickness(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  <option value='3mm'>3mm</option>
                  <option value='5mm'>5mm</option>
                  <option value='7mm'>7mm</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>BCD Size</label>
                <select
                  value={bcdSize}
                  onChange={e => setBcdSize(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs bg-white'
                >
                  <option value='None'>None (Own BCD)</option>
                  <option value='XS'>XS</option>
                  <option value='S'>S</option>
                  <option value='M'>M</option>
                  <option value='L'>L</option>
                  <option value='XL'>XL</option>
                </select>
              </div>
              <div>
                <label className='block font-semibold mb-1 text-[11px]'>Shoe (EU)</label>
                <input
                  type='number'
                  value={shoeSizeEu}
                  onChange={e => setShoeSizeEu(e.target.value)}
                  className='w-full px-2 py-1.5 border rounded-lg text-xs'
                />
              </div>
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setIsEditing(false)}
                className='px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading}
                className='px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs flex items-center gap-1 shadow-sm'
              >
                {loading ? <Loader2 size={13} className='animate-spin' /> : <Check size={13} />}
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className='p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2'>
            <h4 className='font-bold text-[11px] text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5'>
              <Gauge size={13} className='text-blue-600' />
              Equipment Assignment
            </h4>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs'>
              <div>
                <span className='text-gray-400 block text-[10px]'>Cylinder:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {participant.selected_tank_id}L Steel
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Breathing Gas:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {participant.selected_gas_mix_id?.toUpperCase()}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Valve Connection:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {participant.equipment_sizing?.regulator_fitting || 'DIN'}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Lead Ballast:</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {participant.estimated_lead_kg || 0} kg
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Wetsuit:</span>
                <strong className='text-gray-800 dark:text-gray-200'>
                  {participant.equipment_sizing?.wetsuit_size || 'None'} (
                  {participant.equipment_sizing?.wetsuit_thickness || '5mm'})
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>BCD Size:</span>
                <strong className='text-gray-800 dark:text-gray-200'>
                  {participant.equipment_sizing?.bcd_size || 'None'}
                </strong>
              </div>
              <div>
                <span className='text-gray-400 block text-[10px]'>Fins (EU):</span>
                <strong className='text-gray-800 dark:text-gray-200 font-mono'>
                  {participant.equipment_sizing?.shoe_size_eu || 'N/A'}
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className='flex justify-end pt-2 border-t'>
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
