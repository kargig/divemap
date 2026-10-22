import {
  X,
  Check,
  Loader2,
  FileText,
  Wind,
  Waves,
  Thermometer,
  ShieldAlert,
  Send,
  Download,
  AlertTriangle,
  Compass,
  Fish,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import api from '../../api';

const BriefingReviewModal = ({ isOpen, onClose, centerId, tripId, onBriefingDispatched }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [briefingData, setBriefingData] = useState(null);

  // Editable fields
  const [meetingNotes, setMeetingNotes] = useState('');
  const [siteProfileNotes, setSiteProfileNotes] = useState('');
  const [hazardsNotes, setHazardsNotes] = useState('');
  const [contingencyNotes, setContingencyNotes] = useState('');
  const [marineLife, setMarineLife] = useState([]);

  useEffect(() => {
    if (!isOpen || !centerId || !tripId) return;

    const fetchBriefing = async () => {
      try {
        setLoading(true);
        const res = await api.get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/briefing`
        );
        const b = res.data;
        setBriefingData(b);
        setMeetingNotes(b.meeting_notes || '');
        setSiteProfileNotes(b.site_profile_notes || '');
        setHazardsNotes(b.hazards_and_safety_notes || '');
        setContingencyNotes(b.contingency_notes || '');
        setMarineLife(b.marine_life_highlights || []);
      } catch (err) {
        console.error('Failed to load briefing:', err);
        toast.error('Failed to load pre-dive briefing.');
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, [isOpen, centerId, tripId]);

  const handleUpdateMarineLife = (index, field, value) => {
    setMarineLife(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveNotes = async () => {
    try {
      setSaving(true);
      const payload = {
        meeting_notes: meetingNotes,
        site_profile_notes: siteProfileNotes,
        hazards_and_safety_notes: hazardsNotes,
        contingency_notes: contingencyNotes,
        marine_life_highlights: marineLife,
      };
      const res = await api.put(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/briefing`,
        payload
      );
      setBriefingData(res.data);
      toast.success('Pre-dive briefing updated successfully!');
    } catch (err) {
      console.error('Failed to update briefing:', err);
      toast.error('Failed to update briefing.');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatch = async () => {
    try {
      setDispatching(true);
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/briefing/dispatch`
      );
      toast.success(res.data?.message || 'Briefing dispatched to confirmed divers!');
      if (onBriefingDispatched) onBriefingDispatched();
      onClose();
    } catch (err) {
      console.error('Failed to dispatch briefing:', err);
      toast.error('Failed to dispatch briefing.');
    } finally {
      setDispatching(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      toast.loading('Generating Pre-Dive Briefing PDF...', { id: 'briefing-pdf' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/briefing/pdf`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      toast.success('Briefing PDF generated!', { id: 'briefing-pdf' });
    } catch (err) {
      console.error('Failed to preview briefing PDF:', err);
      toast.error(err.response?.data?.detail || 'Failed to preview briefing PDF.', {
        id: 'briefing-pdf',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  const weather = briefingData?.weather_forecast_data || {};
  const eap = briefingData?.emergency_action_plan || {};
  const isDispatched = briefingData?.status === 'APPROVED_DISPATCHED';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
      <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200'>
        {/* Modal Header */}
        <div className='p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-750'>
          <div className='flex items-center gap-2.5'>
            <div className='w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center'>
              <Compass size={18} />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                  Pre-Dive Briefing & Emergency Action Plan
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isDispatched
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {isDispatched ? 'Approved & Sent' : 'Draft Pending Review'}
                </span>
              </div>
              <p className='text-xs text-gray-500'>
                Site:{' '}
                <span className='font-semibold text-gray-700 dark:text-gray-300'>
                  {briefingData?.active_dive_site_name}
                </span>{' '}
                • Synthesized with live Open-Meteo marine forecast.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg'
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className='p-16 text-center text-gray-500 text-xs font-medium'>
            <Loader2 className='animate-spin mx-auto h-6 w-6 text-blue-600 mb-2' />
            Synthesizing topography, marine conditions & EAP...
          </div>
        ) : (
          <div className='overflow-y-auto p-5 space-y-4 text-xs'>
            {/* Live Weather Forecast Card (Dual-Unit) */}
            <div className='p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5 text-xs'>
                  <Wind size={14} className='text-blue-600' />
                  Live Marine Weather & Sea Conditions
                </span>
                <span className='text-[10px] font-semibold text-blue-700 dark:text-blue-300'>
                  Forecast @ Departure
                </span>
              </div>

              <div className='grid grid-cols-3 gap-2 pt-1'>
                <div className='p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/40 text-center'>
                  <div className='flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-0.5'>
                    <Wind size={12} className='text-blue-500' />
                    <span>Wind Velocity</span>
                  </div>
                  <span className='font-mono font-bold text-gray-900 dark:text-white text-xs'>
                    {weather.wind_speed_kts ?? 8} kts
                  </span>
                  <span className='text-[10px] text-gray-400 block'>
                    Gusts: {weather.wind_gusts_kts ?? 11} kts
                  </span>
                </div>

                <div className='p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/40 text-center'>
                  <div className='flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-0.5'>
                    <Waves size={12} className='text-cyan-500' />
                    <span>Wave Height</span>
                  </div>
                  <span className='font-mono font-bold text-gray-900 dark:text-white text-xs'>
                    {weather.wave_height_m ?? 0.4}m
                  </span>
                  <span className='text-[10px] text-gray-400 block'>
                    ({weather.wave_height_ft ?? 1.3} ft)
                  </span>
                </div>

                <div className='p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/40 text-center'>
                  <div className='flex items-center justify-center gap-1 text-gray-500 text-[10px] mb-0.5'>
                    <Thermometer size={12} className='text-amber-500' />
                    <span>Sea Temperature</span>
                  </div>
                  <span className='font-mono font-bold text-gray-900 dark:text-white text-xs'>
                    {weather.sea_surface_temp_c ?? 22}°C
                  </span>
                  <span className='text-[10px] text-gray-400 block'>
                    ({weather.sea_surface_temp_f ?? 72}°F)
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Briefing Notes */}
            <div className='space-y-3'>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-xs'>
                  Meeting & Preparation Instructions
                </label>
                <textarea
                  rows={2}
                  value={meetingNotes}
                  onChange={e => setMeetingNotes(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 font-normal leading-relaxed'
                  placeholder='Specify dock meeting gate, items to bring...'
                />
              </div>

              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-xs'>
                  Dive Site Profile & Topography (Dual-Unit)
                </label>
                <textarea
                  rows={3}
                  value={siteProfileNotes}
                  onChange={e => setSiteProfileNotes(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 font-normal leading-relaxed'
                  placeholder='Topography, maximum planned depth, descent/ascent line procedures...'
                />
              </div>

              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-xs'>
                  Safety Instructions & Diver Procedures
                </label>
                <textarea
                  rows={2}
                  value={hazardsNotes}
                  onChange={e => setHazardsNotes(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 font-normal leading-relaxed'
                  placeholder='Minimum gas reserve (50 bar / 700 psi), 3-min safety stop, SMB rules...'
                />
              </div>

              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1 text-xs flex items-center gap-1.5'>
                  <AlertTriangle size={13} className='text-amber-500' />
                  Weather Contingency / Diversion Plan
                </label>
                <input
                  type='text'
                  value={contingencyNotes}
                  onChange={e => setContingencyNotes(e.target.value)}
                  className='w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-gray-800 font-normal'
                  placeholder='e.g. In case of south swell exceeding 1.2m, trip diverts to sheltered North Bay'
                />
              </div>
            </div>

            {/* Marine Wildlife Highlights */}
            {marineLife && marineLife.length > 0 && (
              <div className='p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-2'>
                <span className='font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-xs'>
                  <Fish size={14} className='text-blue-600' />
                  Marine Wildlife & Species Highlights (From Dive Site Profile)
                </span>
                <div className='space-y-1.5'>
                  {marineLife.map((item, idx) => (
                    <div key={idx} className='grid grid-cols-12 gap-2 items-center text-xs'>
                      <input
                        type='text'
                        value={item.species || ''}
                        onChange={e => handleUpdateMarineLife(idx, 'species', e.target.value)}
                        className='col-span-5 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs font-semibold'
                        placeholder='Species name'
                      />
                      <input
                        type='text'
                        value={item.depth || ''}
                        onChange={e => handleUpdateMarineLife(idx, 'depth', e.target.value)}
                        className='col-span-3 px-2 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs font-mono text-gray-700 dark:text-gray-300'
                        placeholder='Depth (e.g. 10-25m)'
                      />
                      <input
                        type='text'
                        value={item.notes || ''}
                        onChange={e => handleUpdateMarineLife(idx, 'notes', e.target.value)}
                        className='col-span-4 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300'
                        placeholder='Habitat / behavior notes'
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Action Plan (EAP) Box */}
            <div className='p-3.5 bg-red-50/70 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/60 space-y-1.5'>
              <span className='font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5 text-xs'>
                <ShieldAlert size={14} className='text-red-600' />
                Emergency Action Plan (EAP)
              </span>
              <div className='grid grid-cols-2 gap-2 text-[11px] pt-1 text-gray-600 dark:text-gray-400'>
                <div>
                  <span className='font-semibold text-gray-900 dark:text-white block'>
                    VHF Emergency:
                  </span>
                  <span>{eap.coast_guard_vhf || 'VHF 16'}</span>
                </div>
                <div>
                  <span className='font-semibold text-gray-900 dark:text-white block'>
                    Rescue Center (JRCC):
                  </span>
                  <span>{eap.mrcc_phone || '112 / +30 210 4112500'}</span>
                </div>
                <div className='col-span-2'>
                  <span className='font-semibold text-gray-900 dark:text-white block'>
                    Hyperbaric Chamber:
                  </span>
                  <span className='truncate block'>
                    {eap.hyperbaric_chamber || 'Navy Hospital Recompression Facility'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className='flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700'>
              <button
                type='button'
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-xs transition-all disabled:opacity-50'
                title='Preview generated briefing PDF'
              >
                {downloadingPdf ? (
                  <Loader2 size={13} className='animate-spin' />
                ) : (
                  <Download size={13} />
                )}
                <span>Preview PDF</span>
              </button>

              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className='px-3.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg font-bold border border-blue-200 dark:border-blue-800 disabled:opacity-50'
                >
                  {saving ? <Loader2 size={13} className='animate-spin inline mr-1' /> : null}
                  <span>Save Notes</span>
                </button>

                <button
                  type='button'
                  onClick={handleDispatch}
                  disabled={dispatching}
                  className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50'
                >
                  {dispatching ? (
                    <Loader2 size={13} className='animate-spin' />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Approve & Dispatch Briefing</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BriefingReviewModal;
