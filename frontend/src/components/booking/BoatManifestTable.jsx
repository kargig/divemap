import {
  User,
  Check,
  AlertTriangle,
  CreditCard,
  Trash2,
  Edit2,
  Eye,
  Phone,
  Mail,
  ShieldCheck,
  Hourglass,
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
              <th className='py-3 px-3'>Lead</th>
              <th className='py-3 px-3 text-center'>Medical</th>
              <th className='py-3 px-3 text-center'>Boarded</th>
              <th className='py-3 px-3 text-center'>Payment</th>
              <th className='py-3 px-3 text-right pr-4'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300'>
            {participants.map((p, index) => {
              const isPaid =
                p.payment_status === 'PAID_IN_FULL' || p.payment_status === 'PAID_ONLINE';
              const isCleared = p.medical_status === 'CLEARED';

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
                      {p.selected_tank_id}L • {p.selected_gas_mix_id.toUpperCase()}
                    </span>
                  </td>

                  <td className='py-3.5 px-3 font-mono font-medium'>
                    {p.estimated_lead_kg || 0} kg
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCleared
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {isCleared ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}
                      {isCleared ? 'CLEARED' : 'FLAGGED'}
                    </span>
                  </td>

                  <td className='py-3.5 px-3 text-center'>
                    <button
                      type='button'
                      onClick={() => onToggleCheckin(p.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        p.onboard_checkin_status
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                      }`}
                      title={
                        p.onboard_checkin_status
                          ? 'Click to revoke boarding'
                          : 'Click to confirm diver has boarded'
                      }
                    >
                      {p.onboard_checkin_status ? (
                        <Check size={13} className='text-white' />
                      ) : (
                        <Hourglass size={12} className='text-amber-600 shrink-0' />
                      )}
                      <span>{p.onboard_checkin_status ? 'Boarded' : 'Check In'}</span>
                    </button>
                  </td>

                  <td className='py-3.5 px-3 text-center'>
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
                          ? 'Click to revert payment to Due at Desk'
                          : 'Click to mark counter payment received'
                      }
                    >
                      {isPaid ? <Check size={12} /> : <CreditCard size={12} />}
                      <span>{isPaid ? 'Paid' : 'Mark Paid'}</span>
                    </button>
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
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCleared
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {isCleared ? 'CLEARED' : 'FLAGGED'}
                  </span>
                </div>
              </div>

              {/* Badges & Credential Row */}
              <div className='flex flex-wrap items-center gap-1.5 mb-3 text-xs'>
                <span className='px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-semibold'>
                  {p.certification_agency} {p.certification_level}
                </span>
                <span className='px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded font-mono font-medium'>
                  {p.selected_tank_id}L • {p.selected_gas_mix_id.toUpperCase()}
                </span>
                <span className='px-2 py-0.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 rounded font-mono'>
                  {p.estimated_lead_kg || 0} kg lead
                </span>
                {p.diver_nationality && (
                  <span className='text-gray-400 text-[11px]'>({p.diver_nationality})</span>
                )}
              </div>

              {/* Mobile Actions Footer */}
              <div className='flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700/60'>
                {/* Boarding Roll-Call Toggle */}
                <button
                  type='button'
                  onClick={() => onToggleCheckin(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    p.onboard_checkin_status
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {p.onboard_checkin_status ? (
                    <Check size={14} className='text-white' />
                  ) : (
                    <Hourglass size={13} className='text-amber-600' />
                  )}
                  <span>{p.onboard_checkin_status ? 'Boarded' : 'Board Boat'}</span>
                </button>

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
                        ? 'Click to revert payment to Due at Desk'
                        : 'Click to mark counter payment received'
                    }
                  >
                    {isPaid ? <Check size={12} /> : <CreditCard size={12} />}
                    <span>{isPaid ? 'Paid' : 'Mark Paid'}</span>
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
