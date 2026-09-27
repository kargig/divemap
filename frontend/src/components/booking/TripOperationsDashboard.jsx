import {
  Ship,
  Users,
  Calendar,
  Clock,
  Download,
  Printer,
  UserPlus,
  Loader2,
  ChevronLeft,
  Package,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link } from 'react-router-dom';

import api from '../../api';
import SEO from '../SEO';

import AddDiverModal from './AddDiverModal';
import BoatManifestTable from './BoatManifestTable';
import DiverDetailsModal from './DiverDetailsModal';
import GearPackingManifest from './GearPackingManifest';

const TripOperationsDashboard = () => {
  const { centerId, tripId } = useParams();
  const [loading, setLoading] = useState(true);
  const [manifestData, setManifestData] = useState(null);
  const [activeTab, setActiveTab] = useState('manifest'); // manifest | crates

  // Modals
  const [addDiverOpen, setAddDiverOpen] = useState(false);
  const [detailsDiver, setDetailsDiver] = useState(null);

  const fetchManifest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/manifest`);
      setManifestData(res.data);
    } catch (err) {
      console.error('Failed to load trip operations manifest:', err);
      toast.error(err.response?.data?.detail || 'Failed to load trip manifest.');
    } finally {
      setLoading(false);
    }
  }, [centerId, tripId]);

  useEffect(() => {
    if (centerId && tripId) {
      fetchManifest();
    }
  }, [centerId, tripId, fetchManifest]);

  // Actions
  const handleToggleCheckin = async partId => {
    try {
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${partId}/toggle-checkin`
      );
      setManifestData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.id === partId ? { ...p, onboard_checkin_status: res.data.onboard_checkin_status } : p
          ),
        };
      });
      toast.success(
        res.data.onboard_checkin_status ? 'Diver marked as Boarded!' : 'Diver check-in revoked.'
      );
    } catch (err) {
      console.error('Failed to toggle check-in:', err);
      toast.error('Failed to update boarding status.');
    }
  };

  const handleTogglePayment = async bookingId => {
    try {
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/bookings/${bookingId}/toggle-payment`
      );
      const newStatus = res.data.payment_status;
      setManifestData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.booking_id === bookingId ? { ...p, payment_status: newStatus } : p
          ),
        };
      });
      toast.success(
        newStatus === 'PAID_IN_FULL'
          ? 'Payment marked as Paid in Full!'
          : 'Payment reverted to Due at Desk.'
      );
    } catch (err) {
      console.error('Failed to toggle payment:', err);
      toast.error('Failed to update payment status.');
    }
  };

  const handleDeleteDiver = async (partId, diverName) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel ${diverName}? Their seat will be immediately released back to available inventory.`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${partId}`
      );
      toast.success(`${diverName} cancelled and seat released.`);
      fetchManifest();
    } catch (err) {
      console.error('Failed to cancel participant:', err);
      toast.error('Failed to cancel participant.');
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true);
      toast.loading(`Generating Port Authority ${format.toUpperCase()}...`, {
        id: 'export-manifest',
      });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/manifest/export-port-authority?format=${format}`,
        { responseType: 'blob' }
      );

      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const blob = new window.Blob([res.data], { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanTitle = (manifestData?.slot?.product_title || 'manifest').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      link.setAttribute('download', `port_manifest_${cleanTitle}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      toast.success(`Port Authority ${format.toUpperCase()} downloaded!`, {
        id: 'export-manifest',
      });
    } catch (err) {
      console.error('Failed to export manifest:', err);
      toast.error(`Failed to export ${format.toUpperCase()} manifest.`, { id: 'export-manifest' });
    } finally {
      setExporting(false);
    }
  };

  if (loading && !manifestData) {
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600 mb-3' />
        <p className='text-sm text-gray-500'>Loading trip operations manifest...</p>
      </div>
    );
  }

  if (!manifestData) {
    return (
      <div className='max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border text-center'>
        <h3 className='font-bold text-base text-gray-800 dark:text-gray-200'>Trip Not Found</h3>
        <p className='text-xs text-gray-500 mt-1 mb-4'>
          The requested trip operations slot could not be located or you lack permissions.
        </p>
        <Link
          to={`/diving-centers/${centerId}`}
          className='px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold'
        >
          Return to Center
        </Link>
      </div>
    );
  }

  const { slot, vessel, center, participants, crate_packing_summary } = manifestData;
  const bookedCount = slot.seats_total - slot.seats_available;
  const bookedPercent = Math.min(100, Math.round((bookedCount / slot.seats_total) * 100));
  const boardedCount = participants.filter(p => p.onboard_checkin_status).length;

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50'>
      <SEO
        title={`Trip Ops: ${slot.product_title} - Divemap`}
        description='Center operations dashboard and boat manifest roll-call.'
      />

      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 space-y-6'>
        {/* Navigation Breadcrumb / Back Link */}
        <div className='flex items-center justify-between px-3 sm:px-0'>
          <Link
            to={`/diving-centers/${centerId}`}
            className='inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors'
          >
            <ChevronLeft size={16} />
            <span>Back to {center.name}</span>
          </Link>
          <span className='text-xs font-mono font-bold text-gray-400'>TRIP ID: {slot.id}</span>
        </div>

        {/* Master Trip Operations Header */}
        <div className='rounded-none sm:rounded-2xl border-y sm:border p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-sm space-y-4'>
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
            <div>
              <div className='flex items-center gap-2'>
                <span className='px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 uppercase tracking-wider'>
                  Operations Dashboard
                </span>
                <span className='text-xs text-gray-400'>•</span>
                <span className='text-xs font-semibold text-emerald-600 flex items-center gap-1'>
                  <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></span>
                  Live Roster
                </span>
              </div>
              <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1'>
                {slot.product_title}
              </h1>
              <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-600 dark:text-gray-300'>
                <span className='flex items-center gap-1'>
                  <Ship size={14} className='text-blue-600 shrink-0' />
                  <strong>{vessel.name}</strong> ({vessel.registration_number})
                </span>
                <span className='flex items-center gap-1'>
                  <Calendar size={14} className='text-gray-400 shrink-0' />
                  {slot.departure_date}
                </span>
                <span className='flex items-center gap-1'>
                  <Clock size={14} className='text-gray-400 shrink-0' />
                  Meet: {slot.meeting_time} (Dep: {slot.departure_time})
                </span>
              </div>
            </div>

            {/* Capacity & Boarding Metric Gauges */}
            <div className='flex flex-row items-center gap-4 bg-gray-50 dark:bg-gray-750 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shrink-0'>
              <div>
                <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block'>
                  Capacity
                </span>
                <div className='flex items-baseline gap-1 mt-0.5'>
                  <span className='text-xl font-bold font-mono text-gray-900 dark:text-white'>
                    {bookedCount}/{slot.seats_total}
                  </span>
                  <span className='text-xs text-gray-500 font-medium'>
                    ({slot.seats_available} open)
                  </span>
                </div>
                <div className='w-28 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-1.5 overflow-hidden'>
                  <div
                    className={`h-full rounded-full transition-all ${
                      slot.seats_available === 0
                        ? 'bg-red-500'
                        : slot.seats_available <= 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${bookedPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className='border-l pl-4 border-gray-200 dark:border-gray-700'>
                <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider block'>
                  Boarded
                </span>
                <div className='flex items-baseline gap-1 mt-0.5'>
                  <span className='text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400'>
                    {boardedCount}/{participants.length}
                  </span>
                  <span className='text-xs text-gray-400 font-medium'>checked in</span>
                </div>
                <span className='text-[10px] text-gray-400 block mt-1'>
                  {boardedCount === participants.length && participants.length > 0
                    ? 'All divers on board'
                    : `${participants.length - boardedCount} divers pending boarding`}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className='flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-700'>
            {/* View Tabs */}
            <div className='flex items-center gap-1.5'>
              <button
                type='button'
                onClick={() => setActiveTab('manifest')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'manifest'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <Users size={14} />
                <span>Boat Manifest & Roll Call ({participants.length})</span>
              </button>

              <button
                type='button'
                onClick={() => setActiveTab('crates')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'crates'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <Package size={14} />
                <span>Crate Packing Loadout</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                onClick={() => setAddDiverOpen(true)}
                disabled={slot.seats_available <= 0}
                className='flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <UserPlus size={14} />
                <span>+ Add Walk-In</span>
              </button>

              <div className='flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm bg-white dark:bg-gray-800 text-xs'>
                <button
                  type='button'
                  onClick={() => handleExport('pdf')}
                  disabled={exporting}
                  className='flex items-center gap-1 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold border-r border-gray-200 dark:border-gray-700 disabled:opacity-50'
                  title='Download Port Authority PDF'
                >
                  <Download size={13} className='text-red-600' />
                  <span>Port PDF</span>
                </button>
                <button
                  type='button'
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className='flex items-center gap-1 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold disabled:opacity-50'
                  title='Download Port Authority CSV'
                >
                  <FileSpreadsheet size={13} className='text-emerald-600' />
                  <span>Port CSV</span>
                </button>
              </div>

              <button
                type='button'
                onClick={() => window.print()}
                className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700'
                title='Print Manifest Page'
              >
                <Printer size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab View Content */}
        {activeTab === 'manifest' ? (
          <BoatManifestTable
            participants={participants}
            onToggleCheckin={handleToggleCheckin}
            onTogglePayment={handleTogglePayment}
            onDeleteDiver={handleDeleteDiver}
            onEditDiver={diver => setDetailsDiver(diver)}
            onViewDetails={diver => setDetailsDiver(diver)}
          />
        ) : (
          <GearPackingManifest summary={crate_packing_summary} participants={participants} />
        )}

        {/* Modals */}
        <AddDiverModal
          isOpen={addDiverOpen}
          onClose={() => setAddDiverOpen(false)}
          onDiverAdded={fetchManifest}
          centerId={centerId}
          tripId={tripId}
        />

        <DiverDetailsModal
          isOpen={Boolean(detailsDiver)}
          onClose={() => setDetailsDiver(null)}
          participant={detailsDiver}
          centerId={centerId}
          tripId={tripId}
          onUpdated={fetchManifest}
        />
      </div>
    </div>
  );
};

export default TripOperationsDashboard;
