import { Dropdown } from 'antd';
import {
  User,
  Check,
  AlertTriangle,
  CreditCard,
  Trash2,
  Edit2,
  Eye,
  Phone,
  Hourglass,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import React from 'react';

const PAID_STATUSES = new Set(['PAID_IN_FULL', 'PAID_ONLINE', 'PAID']);

const isPaidStatus = status => PAID_STATUSES.has(status);

const isMedicalCleared = status => status === 'CLEARED' || status === 'PHYSICIAN_APPROVED';

const certLine = p => {
  const agency = (p.certification_agency || '').trim();
  const level = (p.certification_level || '').trim();
  if (!agency && !level) return null;
  return [agency, level].filter(Boolean).join(' · ');
};

const tankLine = p => {
  // Compose without valve — DIN/YOKE is shown as a separate chip (tank_label embeds it)
  const count = p.tanks_count || 2;
  const size = p.selected_tank_id || '12';
  const gas = (p.selected_gas_mix_id || 'air').toUpperCase();
  return `${count}×${size}L ${gas}`;
};

const valveFitting = p => p.equipment_sizing?.regulator_fitting || 'DIN';

const amountLabel = p => {
  if (typeof p.amount_due === 'number' && p.amount_due > 0 && !isPaidStatus(p.payment_status)) {
    return `€${p.amount_due.toFixed(2)}`;
  }
  return p.formatted_total_due || `€${(p.total_due || 0).toFixed(2)}`;
};

const StatusDot = ({ ok, warn, label, title, onClick }) => {
  const tone = ok
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : warn
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';

  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${tone} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      }`}
    >
      {ok ? <Check size={10} /> : warn ? <AlertTriangle size={10} /> : <Hourglass size={10} />}
      <span>{label}</span>
    </Comp>
  );
};

const rowActions = (p, { onViewDetails, onEditDiver, onDeleteDiver }) => [
  {
    key: 'view',
    label: (
      <span className='flex items-center gap-2 text-xs font-medium py-0.5'>
        <Eye size={13} className='text-blue-600' />
        View details
      </span>
    ),
    onClick: () => onViewDetails(p),
  },
  {
    key: 'edit',
    label: (
      <span className='flex items-center gap-2 text-xs font-medium py-0.5'>
        <Edit2 size={13} className='text-indigo-600' />
        Edit equipment
      </span>
    ),
    onClick: () => onEditDiver(p),
  },
  { type: 'divider' },
  {
    key: 'cancel',
    danger: true,
    label: (
      <span className='flex items-center gap-2 text-xs font-medium py-0.5'>
        <Trash2 size={13} />
        Cancel & release seat
      </span>
    ),
    onClick: () => onDeleteDiver(p.id, p.diver_full_name),
  },
];

const BoardButton = ({ p, isMedicalHold, onToggleCheckin, onViewDetails, compact = false }) => {
  const gearPending = !p.gear_checked;
  const blocked = !p.onboard_checkin_status && (isMedicalHold || gearPending);

  const title = blocked
    ? isMedicalHold && gearPending
      ? 'Clear medical and complete gear check before boarding'
      : gearPending
        ? 'Complete gear check before boarding'
        : 'Medical clearance required before boarding'
    : p.onboard_checkin_status
      ? 'Revoke boarding'
      : 'Confirm diver boarded';

  const label = p.onboard_checkin_status
    ? 'Boarded'
    : isMedicalHold
      ? 'Med hold'
      : gearPending
        ? 'Gear hold'
        : 'Board';

  return (
    <button
      type='button'
      onClick={() => {
        if (isMedicalHold && !p.onboard_checkin_status) {
          onViewDetails(p);
          return;
        }
        if (gearPending && !p.onboard_checkin_status) return;
        onToggleCheckin(p.id);
      }}
      disabled={blocked}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ${
        compact ? 'px-3 py-1.5' : 'px-2.5 py-1 min-w-[5.75rem]'
      } ${
        blocked
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-70'
          : p.onboard_checkin_status
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-white dark:bg-gray-800 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
      }`}
    >
      {blocked ? (
        <Lock size={12} className='text-amber-500 shrink-0' />
      ) : p.onboard_checkin_status ? (
        <Check size={13} />
      ) : (
        <Hourglass size={12} className='text-emerald-600 shrink-0' />
      )}
      <span>{label}</span>
    </button>
  );
};

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
          No divers registered yet
        </h4>
        <p className='text-xs text-gray-500 mt-1 max-w-sm mx-auto'>
          Use Walk-in to register a diver at the desk, or wait for online bookings to appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop */}
      <div className='hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'>
        <table className='w-full text-left border-collapse text-xs'>
          <thead>
            <tr className='bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200 dark:border-gray-700 uppercase tracking-wider text-[10px]'>
              <th className='py-2.5 px-3 w-10 text-center'>#</th>
              <th className='py-2.5 px-3'>Diver</th>
              <th className='py-2.5 px-3'>Kit</th>
              <th className='py-2.5 px-3'>Status</th>
              <th className='py-2.5 px-3 text-center'>Pay</th>
              <th className='py-2.5 px-3 text-center'>Board</th>
              <th className='py-2.5 px-2 w-12 text-right'></th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300'>
            {participants.map((p, index) => {
              const paid = isPaidStatus(p.payment_status);
              const medOk = isMedicalCleared(p.medical_status);
              const medHold = !medOk;
              const waiverOk = Boolean(p.waivers_complete);
              const cert = certLine(p);
              const valve = valveFitting(p);

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-interactive-hover dark:hover:bg-interactive-hover-dark transition-colors ${
                    p.onboard_checkin_status ? 'bg-emerald-50/25 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  <td className='py-3 px-3 text-center font-mono font-bold text-gray-400'>
                    {index + 1}
                  </td>

                  <td className='py-3 px-3 min-w-[11rem]'>
                    <button
                      type='button'
                      onClick={() => onViewDetails(p)}
                      className='font-bold text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left leading-snug'
                      title={
                        p.diver_nationality ? `Nationality: ${p.diver_nationality}` : undefined
                      }
                    >
                      {p.diver_full_name}
                    </button>
                    {cert && (
                      <div className='text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[16rem]'>
                        {cert}
                      </div>
                    )}
                    {p.diver_phone ? (
                      <a
                        href={`tel:${p.diver_phone}`}
                        className='inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline'
                        onClick={e => e.stopPropagation()}
                      >
                        <Phone size={11} className='shrink-0' />
                        {p.diver_phone}
                      </a>
                    ) : (
                      <span className='block mt-1 text-[11px] text-gray-400'>No phone</span>
                    )}
                  </td>

                  <td className='py-3 px-3'>
                    <div className='inline-flex items-center gap-1.5 flex-wrap'>
                      <span className='font-mono font-semibold text-[11px] text-gray-800 dark:text-gray-200'>
                        {tankLine(p)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          valve === 'DIN'
                            ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                        }`}
                        title={
                          valve === 'DIN'
                            ? 'DIN first stage — remove yoke insert'
                            : 'Yoke first stage — keep insert fitted'
                        }
                      >
                        {valve}
                      </span>
                    </div>
                  </td>

                  <td className='py-3 px-3'>
                    <div className='flex flex-wrap items-center gap-1'>
                      <StatusDot
                        ok={medOk}
                        warn={medHold}
                        label={
                          p.medical_status === 'PHYSICIAN_APPROVED'
                            ? 'MD'
                            : medOk
                              ? 'Med'
                              : p.medical_status === 'PENDING'
                                ? 'Med?'
                                : 'Med!'
                        }
                        title={
                          p.medical_status === 'PHYSICIAN_APPROVED'
                            ? `Physician approved${p.medical_clearance_audit?.physician_name ? `: Dr. ${p.medical_clearance_audit.physician_name}` : ''}`
                            : medOk
                              ? 'Medically cleared'
                              : 'Needs medical review'
                        }
                        onClick={() => onViewDetails(p)}
                      />
                      <StatusDot
                        ok={p.gear_checked}
                        warn={!p.gear_checked}
                        label='Gear'
                        title={
                          p.gear_checked
                            ? 'Gear check complete'
                            : 'Gear check pending — use Gear tab'
                        }
                      />
                      <StatusDot
                        ok={waiverOk}
                        warn={!waiverOk}
                        label='Waiver'
                        title={waiverOk ? 'Waivers complete' : 'Waivers incomplete'}
                        onClick={() => onViewDetails(p)}
                      />
                    </div>
                  </td>

                  <td className='py-3 px-3 text-center'>
                    <button
                      type='button'
                      onClick={() => onTogglePayment(p.booking_id)}
                      title={
                        paid
                          ? `Paid ${amountLabel(p)}${p.payment_mode ? ` (${p.payment_mode})` : ''}. Click to revert.`
                          : `Collect ${amountLabel(p)}. Click when counter payment received.`
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        paid
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      {paid ? <Check size={12} /> : <CreditCard size={12} />}
                      <span className='font-mono tabular-nums'>{amountLabel(p)}</span>
                      {!paid && <span className='font-sans font-bold'>due</span>}
                    </button>
                    {p.payment_mode === 'PAY_ONLINE' || p.payment_status === 'PAID_ONLINE' ? (
                      <div className='text-[10px] text-gray-400 mt-0.5'>Online</div>
                    ) : null}
                  </td>

                  <td className='py-3 px-3 text-center'>
                    <BoardButton
                      p={p}
                      isMedicalHold={medHold}
                      onToggleCheckin={onToggleCheckin}
                      onViewDetails={onViewDetails}
                    />
                  </td>

                  <td className='py-3 px-2 text-right'>
                    <Dropdown
                      menu={{ items: rowActions(p, { onViewDetails, onEditDiver, onDeleteDiver }) }}
                      trigger={['click']}
                      placement='bottomRight'
                    >
                      <button
                        type='button'
                        className='p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                        title='More actions'
                        aria-label={`Actions for ${p.diver_full_name}`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </Dropdown>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className='block md:hidden space-y-3'>
        {participants.map((p, index) => {
          const paid = isPaidStatus(p.payment_status);
          const medOk = isMedicalCleared(p.medical_status);
          const medHold = !medOk;
          const cert = certLine(p);

          return (
            <div
              key={p.id}
              className={`rounded-none sm:rounded-2xl border-y sm:border p-3.5 sm:p-4 bg-white dark:bg-gray-800 shadow-sm ${
                p.onboard_checkin_status
                  ? 'border-emerald-300 dark:border-emerald-800/80'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-bold flex items-center justify-center shrink-0'>
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
                  {cert && <p className='text-[11px] text-gray-500 mt-0.5 ml-8 truncate'>{cert}</p>}
                  {p.diver_phone && (
                    <a
                      href={`tel:${p.diver_phone}`}
                      className='inline-flex items-center gap-1 ml-8 mt-1 text-[11px] font-medium text-blue-600'
                    >
                      <Phone size={11} />
                      {p.diver_phone}
                    </a>
                  )}
                </div>
                <Dropdown
                  menu={{ items: rowActions(p, { onViewDetails, onEditDiver, onDeleteDiver }) }}
                  trigger={['click']}
                  placement='bottomRight'
                >
                  <button
                    type='button'
                    className='p-1.5 text-gray-400'
                    aria-label={`Actions for ${p.diver_full_name}`}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </Dropdown>
              </div>

              <div className='flex flex-wrap items-center gap-1.5 mt-3 ml-8'>
                <span className='font-mono text-[11px] font-semibold text-gray-700 dark:text-gray-200'>
                  {tankLine(p)} · {valveFitting(p)}
                </span>
                <StatusDot
                  ok={medOk}
                  warn={medHold}
                  label='Med'
                  title='Medical status'
                  onClick={() => onViewDetails(p)}
                />
                <StatusDot
                  ok={p.gear_checked}
                  warn={!p.gear_checked}
                  label='Gear'
                  title='Gear check'
                />
                <StatusDot
                  ok={Boolean(p.waivers_complete)}
                  warn={!p.waivers_complete}
                  label='Waiver'
                  title='Waiver status'
                  onClick={() => onViewDetails(p)}
                />
              </div>

              <div className='flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60'>
                <BoardButton
                  p={p}
                  isMedicalHold={medHold}
                  onToggleCheckin={onToggleCheckin}
                  onViewDetails={onViewDetails}
                  compact
                />
                <button
                  type='button'
                  onClick={() => onTogglePayment(p.booking_id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                    paid
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}
                >
                  {paid ? <Check size={12} /> : <CreditCard size={12} />}
                  <span className='font-mono'>{amountLabel(p)}</span>
                  {!paid && <span>due</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoatManifestTable;
