import {
  User,
  Check,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Trash2,
  Edit2,
  Eye,
  Phone,
  Mail,
  ShieldCheck,
  Hourglass,
  Stethoscope,
  Lock,
} from 'lucide-react';
import React from 'react';

const BoatManifestTable = ({
  participants = [],
  onToggleCheckin,
  onTogglePayment,
  onEditDiver,
  onDeleteDiver,
  onViewDetails,
}) => {
  if (participants.length === 0) {
    return (
      <div className='p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700'>
        <User className='mx-auto h-10 w-10 text-gray-400 mb-2' />
        <h4 className='text-sm font-bold text-gray-700 dark:text-gray-300'>
          No Divers Registered Yet
        </h4>
        <p className='text-xs text-gray-500 mt-1 max-w-sm mx-auto'>
          No participants have booked or been added to this trip slot. Use "+ Add Walk-In" to
          register a diver at the desk.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop / Tablet Multi-Column Table View */}
      <div className='hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'>
        <table className='w-full text-left border-collapse text-xs'>
          <thead>
            <tr className='bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 uppercase tracking-wider text-[11px]'>
              <th className='py-3 px-3 w-10 text-center'>#</th>
              <th className='py-3 px-3'>Diver & Contact</th>
              <th className='py-3 px-3'>Certification</th>
              <th className='py-3 px-3'>Assigned Tank / Gas</th>
              <th className='py-3 px-3 text-center'>Gear Check</th>
              <th className='py-3 px-3 text-center'>Medical</th>
              <th className='py-3 px-3 text-center'>Payment</th>
              <th className='py-3 px-3 text-center'>Boarded</th>
              <th className='py-3 px-3 text-right pr-4'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300'>
            {participants.map((p, index) => {
              const isPaid =
                p.payment_status === 'PAID_IN_FULL' || p.payment_status === 'PAID_ONLINE';
              const isCleared = p.medical_status === 'CLEARED';
              const isMedicalBlocked =
                p.medical_status === 'FLAGGED_CONTACT_CENTER' || p.medical_status === 'FLAGGED';

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors ${
                    p.onboard_checkin_status ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  <td className='py-3.5 px-3 text-center font-mono font-bold text-gray-400 text-xs'>
                    {index + 1}
                  </td>
                  <td className='py-3.5 px-3'>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={() => onViewDetails(p)}
                        className='font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors text-sm text-left'
                      >
                        {p.diver_full_name}
                      </button>
                      {p.diver_nationality && (
                        <span className='text-[10px] text-gray-400 font-medium'>
                          ({p.diver_nationality})
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-3 mt-0.5 text-[11px] text-gray-500'>
                      {p.diver_email && (
                        <span className='flex items-center gap-1 truncate max-w-[140px]'>
                          <Mail size={11} className='text-gray-400 shrink-0' />
                          {p.diver_email}
                        </span>
                      )}
                      {p.diver_phone && (
                        <span className='flex items-center gap-1'>
                          <Phone size={11} className='text-gray-400 shrink-0' />
                          {p.diver_phone}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className='py-3.5 px-3'>
                    <div className='font-semibold text-gray-800 dark:text-gray-200'>
                      {p.certification_agency} {p.certification_level}
                    </div>
                    {p.certification_number && (
                      <span className='text-[10px] font-mono text-gray-400'>
                        #{p.certification_number}
                      </span>
                    )}
                  </td>

                  <td className='py-3.5 px-3'>
                    <span className='inline-flex items-center px-2 py-0.5 rounded font-mono font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] border border-blue-200 dark:border-blue-800'>
                      {p.selected_tank_id}L • {p.selected_gas_mix_id.toUpperCase()} •{' '}
                      {p.equipment_sizing?.regulator_fitting || 'DIN'}
                    </span>
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    {p.gear_checked ? (
                      <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'>
                        <CheckCircle2
                          size={12}
                          className='text-emerald-600 dark:text-emerald-400'
                        />
                        <span>OK</span>
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'>
                        <AlertTriangle size={12} className='text-amber-600 dark:text-amber-400' />
                        <span>Pending</span>
                      </span>
                    )}
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    <button
                      type='button'
                      onClick={() => onViewDetails(p)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all hover:opacity-80 ${
                        p.medical_status === 'PHYSICIAN_APPROVED'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : isCleared
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse'
                      }`}
                      title={
                        p.medical_status === 'PHYSICIAN_APPROVED'
                          ? `Physician Approved: Dr. ${p.medical_clearance_audit?.physician_name || ''}`
                          : isCleared
                            ? 'Diver medically cleared'
                            : 'Click to review flagged conditions & approve physician clearance'
                      }
                    >
                      {p.medical_status === 'PHYSICIAN_APPROVED' ? (
                        <Stethoscope size={11} />
                      ) : isCleared ? (
                        <ShieldCheck size={11} />
                      ) : (
                        <AlertTriangle size={11} />
                      )}
                      <span>
                        {p.medical_status === 'PHYSICIAN_APPROVED'
                          ? 'PHYSICIAN'
                          : isCleared
                            ? 'CLEARED'
                            : 'FLAGGED'}
                      </span>
                    </button>
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    <div className='flex flex-col items-center gap-1'>
                      <button
                        type='button'
                        onClick={() => onTogglePayment(p.booking_id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          isPaid
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                        }`}
                        title={
                          isPaid
                            ? `Payment received: ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}. Click to revert.`
                            : `Outstanding balance: ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}. Click to mark counter payment received.`
                        }
                      >
                        {isPaid ? <Check size={12} /> : <CreditCard size={12} />}
                        <span className='font-mono'>
                          {isPaid
                            ? `${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`} Paid`
                            : `Collect ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}`}
                        </span>
                      </button>

                      {p.financials?.line_items && p.financials.line_items.length > 1 && (
                        <button
                          type='button'
                          onClick={() => onViewDetails(p)}
                          className='text-[10px] text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted'
                          title={p.financials.line_items
                            .map(li => `${li.title}: ${li.formatted}`)
                            .join('\n')}
                        >
                          {p.financials.line_items.length} items breakdown
                        </button>
                      )}
                    </div>
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    {(() => {
                      const isGearCheckPending = !p.gear_checked;
                      const isBoardingBlocked =
                        !p.onboard_checkin_status && (isMedicalBlocked || isGearCheckPending);

                      const blockedTitle = isBoardingBlocked
                        ? isMedicalBlocked && isGearCheckPending
                          ? 'Boarding Disabled: Both Gear Check and Medical Clearance are required before boarding.'
                          : isGearCheckPending
                            ? 'Boarding Disabled: Equipment handover and inspection (Gear Check) must be completed before boarding.'
                            : 'Boarding Disabled: Diver requires medical clearance / physician review before boarding.'
                        : p.onboard_checkin_status
                          ? 'Click to revoke boarding'
                          : 'Click to confirm diver has boarded';

                      const buttonText = p.onboard_checkin_status
                        ? 'Boarded'
                        : isMedicalBlocked
                          ? 'Medical Hold'
                          : isGearCheckPending
                            ? 'Gear Pending'
                            : 'Check In';

                      return (
                        <button
                          type='button'
                          onClick={() => {
                            if (isMedicalBlocked) {
                              onViewDetails(p);
                              return;
                            }
                            if (isGearCheckPending && !p.onboard_checkin_status) {
                              return;
                            }
                            onToggleCheckin(p.id);
                          }}
                          disabled={isBoardingBlocked}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                            isBoardingBlocked
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                              : p.onboard_checkin_status
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                          }`}
                          title={blockedTitle}
                        >
                          {isBoardingBlocked ? (
                            <Lock size={12} className='text-amber-500 shrink-0' />
                          ) : p.onboard_checkin_status ? (
                            <Check size={13} className='text-white' />
                          ) : (
                            <Hourglass size={12} className='text-amber-600 shrink-0' />
                          )}
                          <span>{buttonText}</span>
                        </button>
                      );
                    })()}
                  </td>

                  <td className='py-3.5 px-3 text-right pr-4'>
                    <div className='flex items-center justify-end gap-1.5'>
                      <button
                        type='button'
                        onClick={() => onViewDetails(p)}
                        className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                        title='View Diver Profile & Gear Sizing'
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type='button'
                        onClick={() => onEditDiver(p)}
                        className='p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                        title='Edit Equipment / Cylinder'
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type='button'
                        onClick={() => onDeleteDiver(p.id, p.diver_full_name)}
                        className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                        title='Cancel Participant & Release Seat'
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack View (Zero Horizontal Scrolling) */}
      <div className='block md:hidden space-y-3'>
        {participants.map((p, index) => {
          const isPaid = p.payment_status === 'PAID_IN_FULL' || p.payment_status === 'PAID_ONLINE';
          const isCleared = p.medical_status === 'CLEARED';
          const isMedicalBlocked =
            p.medical_status === 'FLAGGED_CONTACT_CENTER' || p.medical_status === 'FLAGGED';

          return (
            <div
              key={p.id}
              className={`rounded-none sm:rounded-2xl border-y sm:border p-3.5 sm:p-5 bg-white dark:bg-gray-800 shadow-sm transition-all ${
                p.onboard_checkin_status
                  ? 'border-emerald-300 dark:border-emerald-800/80'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Card Header Row */}
              <div className='flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100 dark:border-gray-700/60'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0'>
                    {index + 1}
                  </span>
                  <button
                    type='button'
                    onClick={() => onViewDetails(p)}
                    className='font-bold text-sm text-gray-900 dark:text-white truncate text-left'
                  >
                    {p.diver_full_name}
                  </button>
                </div>
                <div className='flex items-center gap-1.5 shrink-0'>
                  <button
                    type='button'
                    onClick={() => onViewDetails(p)}
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.medical_status === 'PHYSICIAN_APPROVED'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : isCleared
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                    }`}
                  >
                    {p.medical_status === 'PHYSICIAN_APPROVED' ? (
                      <Stethoscope size={11} />
                    ) : isCleared ? (
                      <ShieldCheck size={11} />
                    ) : (
                      <AlertTriangle size={11} />
                    )}
                    <span>
                      {p.medical_status === 'PHYSICIAN_APPROVED'
                        ? 'PHYSICIAN'
                        : isCleared
                          ? 'CLEARED'
                          : 'FLAGGED'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Badges & Credential Row */}
              <div className='flex flex-wrap items-center gap-1.5 mb-3 text-xs'>
                <span className='px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-semibold'>
                  {p.certification_agency} {p.certification_level}
                </span>
                <span className='px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded font-mono font-medium'>
                  {p.selected_tank_id}L • {p.selected_gas_mix_id.toUpperCase()} •{' '}
                  {p.equipment_sizing?.regulator_fitting || 'DIN'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 ${
                    p.gear_checked
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300'
                  }`}
                >
                  {p.gear_checked ? (
                    <>
                      <CheckCircle2 size={11} className='text-emerald-600' />
                      <span>Gear OK</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={11} className='text-amber-600' />
                      <span>Gear Pending</span>
                    </>
                  )}
                </span>
                {p.diver_nationality && (
                  <span className='text-gray-400 text-[11px]'>({p.diver_nationality})</span>
                )}
              </div>

              {/* Mobile Actions Footer */}
              <div className='flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700/60'>
                {/* Boarding Roll-Call Toggle */}
                {(() => {
                  const isGearCheckPending = !p.gear_checked;
                  const isBoardingBlocked =
                    !p.onboard_checkin_status && (isMedicalBlocked || isGearCheckPending);

                  const blockedTitle = isBoardingBlocked
                    ? isMedicalBlocked && isGearCheckPending
                      ? 'Boarding Disabled: Both Gear Check and Medical Clearance are required before boarding.'
                      : isGearCheckPending
                        ? 'Boarding Disabled: Equipment handover and inspection (Gear Check) must be completed before boarding.'
                        : 'Boarding Disabled: Diver requires medical clearance / physician review before boarding.'
                    : p.onboard_checkin_status
                      ? 'Click to revoke boarding'
                      : 'Click to confirm diver has boarded';

                  const buttonText = p.onboard_checkin_status
                    ? 'Boarded'
                    : isMedicalBlocked
                      ? 'Medical Hold'
                      : isGearCheckPending
                        ? 'Gear Pending'
                        : 'Board Boat';

                  return (
                    <button
                      type='button'
                      onClick={() => {
                        if (isMedicalBlocked) {
                          onViewDetails(p);
                          return;
                        }
                        if (isGearCheckPending && !p.onboard_checkin_status) {
                          return;
                        }
                        onToggleCheckin(p.id);
                      }}
                      disabled={isBoardingBlocked}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        isBoardingBlocked
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                          : p.onboard_checkin_status
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title={blockedTitle}
                    >
                      {isBoardingBlocked ? (
                        <Lock size={13} className='text-amber-500' />
                      ) : p.onboard_checkin_status ? (
                        <Check size={14} className='text-white' />
                      ) : (
                        <Hourglass size={13} className='text-amber-600' />
                      )}
                      <span>{buttonText}</span>
                    </button>
                  );
                })()}

                {/* Payment & Options */}
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => onTogglePayment(p.booking_id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                      isPaid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                    title={
                      isPaid
                        ? `Payment received: ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}. Click to revert.`
                        : `Outstanding balance: ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}. Click to mark counter payment received.`
                    }
                  >
                    {isPaid ? <Check size={12} /> : <CreditCard size={12} />}
                    <span className='font-mono'>
                      {isPaid
                        ? `${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`} Paid`
                        : `Collect ${p.formatted_total_due || `€${p.total_due?.toFixed(2)}`}`}
                    </span>
                  </button>
                  <button
                    type='button'
                    onClick={() => onViewDetails(p)}
                    className='p-1.5 text-gray-400 hover:text-blue-600'
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type='button'
                    onClick={() => onDeleteDiver(p.id, p.diver_full_name)}
                    className='p-1.5 text-gray-400 hover:text-red-600'
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoatManifestTable;
