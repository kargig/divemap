import { Modal, Dropdown } from 'antd';
import {
  Ship,
  Users,
  Calendar,
  Clock,
  Download,
  UserPlus,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Package,
  FileSpreadsheet,
  UserCheck,
  Check,
  PackageCheck,
  Coins,
  FileText,
  Edit,
  Settings2,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link, useNavigate } from 'react-router-dom';

import api from '../../api';
import { getDiveSite } from '../../services/diveSites';
import { broadcastTrip } from '../../services/divingCenters';
import { getParsedTrip, updateParsedTrip } from '../../services/newsletters';
import { extractErrorMessage } from '../../utils/apiErrors';
import SEO from '../SEO';
import TripFormModal from '../TripFormModal';

import AddDiverModal from './AddDiverModal';
import BoatManifestTable from './BoatManifestTable';
import BriefingReviewModal from './BriefingReviewModal';
import CenterRentalPricingModal from './CenterRentalPricingModal';
import DiverDetailsModal from './DiverDetailsModal';
import DiverEquipmentChecklist from './DiverEquipmentChecklist';
import GearPackingManifest from './GearPackingManifest';

const TripOperationsDashboard = () => {
  const { centerId, tripId, tab } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [manifestData, setManifestData] = useState(null);

  // Dedicated URL-driven view tab: 'manifest' vs 'gear-check' vs 'crates'
  const activeTab =
    tab === 'crates' || tab === 'loadout'
      ? 'crates'
      : tab === 'gear-check' || tab === 'equipment' || tab === 'checklist'
        ? 'gear-check'
        : 'manifest';

  const handleTabChange = newTab => {
    navigate(`/manage/centers/${centerId}/trips/${tripId}/${newTab}`);
  };

  // Modals
  const [addDiverModalOpen, setAddDiverModalOpen] = useState(false);
  const [detailsDiver, setDetailsDiver] = useState(null);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [rentalPricingModalOpen, setRentalPricingModalOpen] = useState(false);
  const [briefingModalOpen, setBriefingModalOpen] = useState(false);
  const [editTripModalOpen, setEditTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);
  const [loadingEditTrip, setLoadingEditTrip] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);

  // Staff state
  const [skipperName, setSkipperName] = useState('');
  const [skipperLicense, setSkipperLicense] = useState('');
  const [leadGuideName, setLeadGuideName] = useState('');
  const [leadGuideCert, setLeadGuideCert] = useState('');
  const [crewText, setCrewText] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);

  const fetchManifest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/manifest`);
      setManifestData(res.data);
      if (res.data?.staff) {
        setSkipperName(res.data.staff.skipper_name || '');
        setSkipperLicense(res.data.staff.skipper_license || '');
        setLeadGuideName(res.data.staff.lead_guide_name || '');
        setLeadGuideCert(res.data.staff.lead_guide_cert || '');
        setCrewText((res.data.staff.crew_names || []).join(', '));
      }
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

  const handleSaveStaff = async e => {
    e.preventDefault();
    try {
      setSavingStaff(true);
      const crewList = crewText
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const res = await api.put(`/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/staff`, {
        skipper_name: skipperName.trim() || 'Captain',
        skipper_license: skipperLicense.trim() || 'N/A',
        lead_guide_name: leadGuideName.trim() || 'Lead Divemaster',
        lead_guide_cert: leadGuideCert.trim() || 'N/A',
        crew_names: crewList,
      });

      setManifestData(prev => {
        if (!prev) return prev;
        return { ...prev, staff: res.data.staff };
      });

      toast.success('Boat crew and dive staff assignments updated!');
      setStaffModalOpen(false);
    } catch (err) {
      console.error('Failed to update trip staff:', err);
      toast.error('Failed to update trip staff assignments.');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleOpenEditTripDetails = async () => {
    const parsedTripId = manifestData?.parsed_trip_id;
    if (!parsedTripId) {
      toast.error(
        'This departure is not linked to a dive trip listing yet, so catalog details cannot be edited here.'
      );
      return;
    }
    try {
      setLoadingEditTrip(true);
      const trip = await getParsedTrip(parsedTripId);
      const siteIds = [...new Set((trip.dives || []).map(d => d.dive_site_id).filter(Boolean))];
      const sites = (
        await Promise.all(siteIds.map(id => getDiveSite(id).catch(() => null)))
      ).filter(Boolean);
      setAdditionalDiveSites(sites);
      setEditingTrip(trip);
      setEditTripModalOpen(true);
    } catch (err) {
      console.error('Failed to load trip for editing:', err);
      toast.error(extractErrorMessage(err, 'Failed to load trip details for editing.'));
    } finally {
      setLoadingEditTrip(false);
    }
  };

  const handleUpdateTripDetails = async tripData => {
    if (!editingTrip?.id) return;
    try {
      setSavingTrip(true);
      await updateParsedTrip(editingTrip.id, tripData);
      if (tripData.broadcast_to_followers && editingTrip.diving_center_id) {
        try {
          await broadcastTrip(editingTrip.diving_center_id, editingTrip.id, { is_update: true });
          toast.success('Trip updated and broadcasted to followers!');
        } catch (broadcastErr) {
          console.error('Failed to broadcast trip update:', broadcastErr);
          toast.success('Trip updated successfully');
          toast.error('Failed to broadcast trip update');
        }
      } else {
        toast.success('Trip details updated successfully');
      }
      setEditTripModalOpen(false);
      setEditingTrip(null);
      await fetchManifest();
    } catch (err) {
      console.error('Failed to update trip details:', err);
      toast.error(extractErrorMessage(err, 'Failed to update trip details.'));
    } finally {
      setSavingTrip(false);
    }
  };

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

  const handleToggleGearCheck = async participantId => {
    try {
      const res = await api.post(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/participants/${participantId}/toggle-gear-check`
      );
      setManifestData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.id === participantId ? { ...p, gear_checked: res.data.gear_checked } : p
          ),
        };
      });
      toast.success(
        res.data.gear_checked
          ? 'Equipment handover verified present!'
          : 'Equipment verification status reset.'
      );
    } catch (err) {
      console.error('Failed to toggle equipment verification:', err);
      toast.error(err.response?.data?.detail || 'Failed to update equipment check status.');
    }
  };

  const [exporting, setExporting] = useState(false);

  const triggerDownload = (blob, filename) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  };

  const getCleanTitle = () => {
    return (manifestData?.slot?.product_title || 'trip').replace(/[^a-zA-Z0-9_-]/g, '_');
  };

  const handleExportManifest = async (format = 'csv') => {
    try {
      setExporting(true);
      toast.loading(`Generating Port Authority ${format.toUpperCase()}...`, {
        id: 'export-dossier',
      });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/manifest/export-port-authority?format=${format}`,
        { responseType: 'blob' }
      );
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const blob = new window.Blob([res.data], { type: mimeType });
      triggerDownload(blob, `port_manifest_${getCleanTitle()}.${format}`);
      toast.success(`Manifest (${format}) downloaded!`, { id: 'export-dossier' });
    } catch (err) {
      console.error(`Failed to export manifest (${format}):`, err);
      toast.error(`Failed to export manifest (${format}).`, { id: 'export-dossier' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportChecklistPdf = async () => {
    try {
      setExporting(true);
      toast.loading('Generating Checklist (pdf)...', { id: 'export-dossier' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/equipment-checklist/pdf`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      triggerDownload(blob, `equipment_checklist_${getCleanTitle()}.pdf`);
      toast.success('Checklist (pdf) downloaded!', { id: 'export-dossier' });
    } catch (err) {
      console.error('Failed to export checklist PDF:', err);
      toast.error('Failed to export checklist PDF.', { id: 'export-dossier' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCratePdf = async () => {
    try {
      setExporting(true);
      toast.loading('Generating Crate Sheet (pdf)...', { id: 'export-dossier' });
      const res = await api.get(
        `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/crate-packing/pdf`,
        { responseType: 'blob' }
      );
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      triggerDownload(blob, `crate_sheet_${getCleanTitle()}.pdf`);
      toast.success('Crate Sheet (pdf) downloaded!', { id: 'export-dossier' });
    } catch (err) {
      console.error('Failed to export crate sheet PDF:', err);
      toast.error('Failed to export crate sheet PDF.', { id: 'export-dossier' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllPdfs = async () => {
    try {
      setExporting(true);
      toast.loading('Downloading All PDFs...', { id: 'export-dossier' });
      const [resManifest, resChecklist, resCrate] = await Promise.all([
        api.get(
          `/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/manifest/export-port-authority?format=pdf`,
          { responseType: 'blob' }
        ),
        api.get(`/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/equipment-checklist/pdf`, {
          responseType: 'blob',
        }),
        api.get(`/api/v1/centers/${centerId}/booking-ops/trips/${tripId}/crate-packing/pdf`, {
          responseType: 'blob',
        }),
      ]);

      const title = getCleanTitle();
      triggerDownload(
        new window.Blob([resManifest.data], { type: 'application/pdf' }),
        `port_manifest_${title}.pdf`
      );
      triggerDownload(
        new window.Blob([resChecklist.data], { type: 'application/pdf' }),
        `equipment_checklist_${title}.pdf`
      );
      triggerDownload(
        new window.Blob([resCrate.data], { type: 'application/pdf' }),
        `crate_sheet_${title}.pdf`
      );
      toast.success('All PDFs downloaded successfully!', { id: 'export-dossier' });
    } catch (err) {
      console.error('Failed to download all PDFs:', err);
      toast.error('Failed to download all PDFs.', { id: 'export-dossier' });
    } finally {
      setExporting(false);
    }
  };

  const exportMenuItems = [
    {
      key: 'manifest-pdf',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <FileText size={13} className='text-red-600' />
          <span>Manifest (pdf)</span>
        </span>
      ),
      onClick: () => handleExportManifest('pdf'),
    },
    {
      key: 'checklist-pdf',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <PackageCheck size={13} className='text-blue-600' />
          <span>Checklist (pdf)</span>
        </span>
      ),
      onClick: handleExportChecklistPdf,
    },
    {
      key: 'crates-pdf',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <Package size={13} className='text-indigo-600' />
          <span>Crate Sheet (pdf)</span>
        </span>
      ),
      onClick: handleExportCratePdf,
    },
    {
      type: 'divider',
    },
    {
      key: 'all-pdf',
      label: (
        <span className='flex items-center gap-2 font-bold text-xs py-0.5 text-blue-700 dark:text-blue-400'>
          <Download size={13} className='text-blue-600' />
          <span>All PDF</span>
        </span>
      ),
      onClick: handleExportAllPdfs,
    },
    {
      type: 'divider',
    },
    {
      key: 'manifest-csv',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <FileSpreadsheet size={13} className='text-emerald-600' />
          <span>Manifest (csv)</span>
        </span>
      ),
      onClick: () => handleExportManifest('csv'),
    },
  ];

  // Prep/config actions — kept out of the live ops toolbar so day-of controls stay scannable
  const tripSetupMenuItems = [
    {
      key: 'edit-trip',
      disabled: loadingEditTrip || !manifestData?.parsed_trip_id,
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <Edit size={13} className='text-amber-600' />
          <span>Edit trip details</span>
        </span>
      ),
      onClick: handleOpenEditTripDetails,
    },
    {
      key: 'briefing',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <FileText size={13} className='text-indigo-600' />
          <span>Pre-dive briefing</span>
        </span>
      ),
      onClick: () => setBriefingModalOpen(true),
    },
    {
      key: 'rental-pricing',
      label: (
        <span className='flex items-center gap-2 font-medium text-xs py-0.5'>
          <Coins size={13} className='text-blue-600' />
          <span>Rental pricing</span>
        </span>
      ),
      onClick: () => setRentalPricingModalOpen(true),
    },
  ];

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

  const { slot, vessel, center, participants, crate_packing_summary, financial_summary } =
    manifestData;
  const bookedCount = participants.length;
  const bookedPercent = Math.min(100, Math.round((bookedCount / slot.seats_total) * 100));
  const boardedCount = participants.filter(p => p.onboard_checkin_status).length;
  const gearCheckedCount = participants.filter(p => p.gear_checked).length;

  return (
    <div className='min-h-screen bg-gray-50/50 dark:bg-gray-900/50'>
      <SEO
        title={
          activeTab === 'crates'
            ? `Crate Packing Loadout: ${slot.product_title} - Divemap`
            : `Trip Ops: ${slot.product_title} - Divemap`
        }
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
        <div className='rounded-none sm:rounded-2xl border-y sm:border p-4 sm:p-6 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm space-y-4'>
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
            <div>
              <div className='flex items-center gap-2'>
                <span className='px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 uppercase tracking-wider'>
                  Operations Dashboard
                </span>
                <span className='text-xs text-gray-400'>•</span>
                <span className='text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1'>
                  <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></span>
                  Live Roster
                </span>
              </div>
              <div className='flex items-center gap-2 mt-1 flex-wrap'>
                <h1 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100'>
                  {slot.product_title}
                </h1>
                <button
                  type='button'
                  onClick={handleOpenEditTripDetails}
                  disabled={loadingEditTrip || !manifestData?.parsed_trip_id}
                  className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-gray-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                  title={
                    manifestData?.parsed_trip_id
                      ? 'Edit date, sites, price, description, and other catalog details'
                      : 'No linked dive trip listing for this departure'
                  }
                >
                  {loadingEditTrip ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <Edit size={12} />
                  )}
                  <span className='hidden sm:inline'>Edit details</span>
                </button>
              </div>
              <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-gray-600 dark:text-gray-300'>
                <span className='flex items-center gap-1'>
                  <Ship size={14} className='text-blue-600 dark:text-sky-400 shrink-0' />
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
            <div className='flex flex-row items-center gap-4 bg-gray-50 dark:bg-slate-700/60 p-3.5 rounded-xl border border-gray-100 dark:border-slate-600 shrink-0'>
              <div>
                <span className='text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider block'>
                  Capacity
                </span>
                <div className='flex items-baseline gap-1 mt-0.5'>
                  <span className='text-xl font-bold font-mono text-gray-900 dark:text-slate-100'>
                    {bookedCount}/{slot.seats_total}
                  </span>
                  <span className='text-xs text-gray-500 dark:text-slate-400 font-medium'>
                    ({slot.seats_available} open)
                  </span>
                </div>
                <div className='w-28 bg-gray-200 dark:bg-slate-600 h-1.5 rounded-full mt-1.5 overflow-hidden'>
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

              <div className='border-l pl-4 border-gray-200 dark:border-slate-600'>
                <span className='text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider block'>
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

              {financial_summary && (
                <div className='border-l pl-4 border-gray-200 dark:border-slate-600 hidden lg:block'>
                  <span className='text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider block'>
                    Settlement (OCTO)
                  </span>
                  <div className='flex items-baseline gap-1.5 mt-0.5'>
                    <span className='text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400'>
                      {financial_summary.formattedCollected}
                    </span>
                    <span className='text-xs text-gray-400 font-medium font-mono'>
                      / {financial_summary.formattedTotal}
                    </span>
                  </div>
                  <span className='text-[10px] text-amber-600 dark:text-amber-400 font-medium block mt-1'>
                    {financial_summary.totalOutstanding > 0
                      ? `${financial_summary.formattedOutstanding} due (${financial_summary.pendingDiverCount} pending)`
                      : 'All divers paid in full'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Boat Crew & Dive Staff Assignment Bar */}
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gray-50 dark:bg-slate-700/60 rounded-xl border border-gray-100 dark:border-slate-600 text-xs'>
            <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
              <div>
                <span className='text-[10px] text-gray-400 dark:text-slate-400 uppercase font-bold block'>
                  Master / Skipper
                </span>
                <strong className='text-gray-900 dark:text-slate-100 font-medium'>
                  {manifestData.staff?.skipper_name || 'Captain (Center Staff)'}
                </strong>
                {manifestData.staff?.skipper_license &&
                  manifestData.staff.skipper_license !== 'N/A' && (
                    <span className='text-[10px] text-gray-400 dark:text-slate-400 font-mono ml-1'>
                      (Lic: {manifestData.staff.skipper_license})
                    </span>
                  )}
              </div>
              <div className='border-l pl-4 border-gray-200 dark:border-slate-600'>
                <span className='text-[10px] text-gray-400 dark:text-slate-400 uppercase font-bold block'>
                  Dive Staff in Charge
                </span>
                <strong className='text-gray-900 dark:text-slate-100 font-medium'>
                  {manifestData.staff?.lead_guide_name || 'Lead Instructor'}
                </strong>
                {manifestData.staff?.lead_guide_cert &&
                  manifestData.staff.lead_guide_cert !== 'N/A' && (
                    <span className='text-[10px] text-gray-400 dark:text-slate-400 font-mono ml-1'>
                      ({manifestData.staff.lead_guide_cert})
                    </span>
                  )}
              </div>
              {manifestData.staff?.crew_names && manifestData.staff.crew_names.length > 0 && (
                <div className='border-l pl-4 border-gray-200 dark:border-slate-600'>
                  <span className='text-[10px] text-gray-400 dark:text-slate-400 uppercase font-bold block'>
                    Deck Crew
                  </span>
                  <span className='text-gray-700 dark:text-slate-300 font-medium'>
                    {manifestData.staff.crew_names.join(', ')}
                  </span>
                </div>
              )}
            </div>

            <button
              type='button'
              onClick={() => setStaffModalOpen(true)}
              className='text-xs text-blue-600 dark:text-sky-400 hover:underline font-bold flex items-center gap-1 shrink-0 self-start sm:self-auto'
            >
              <UserCheck size={13} />
              <span>Assign Staff & Crew</span>
            </button>
          </div>

          {/* Ops chrome: view switcher (left) vs day-of actions (right) */}
          <div className='flex flex-col gap-3 pt-3 border-t border-gray-100 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between'>
            {/* Segmented view tabs — short labels; counts as badges */}
            <div
              role='tablist'
              aria-label='Trip operations views'
              className='inline-flex w-full sm:w-auto p-0.5 rounded-xl bg-gray-100 dark:bg-slate-700/60 border border-gray-200/80 dark:border-slate-600'
            >
              <button
                type='button'
                role='tab'
                aria-selected={activeTab === 'manifest'}
                onClick={() => handleTabChange('manifest')}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                  activeTab === 'manifest'
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <Users size={14} className='shrink-0 opacity-70' />
                <span>Manifest</span>
                <span
                  className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    activeTab === 'manifest'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-gray-200/80 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {participants.length}
                </span>
              </button>

              <button
                type='button'
                role='tab'
                aria-selected={activeTab === 'gear-check'}
                onClick={() => handleTabChange('gear-check')}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                  activeTab === 'gear-check'
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <PackageCheck size={14} className='shrink-0 opacity-70' />
                <span>Gear</span>
                <span
                  className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                    activeTab === 'gear-check'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-gray-200/80 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {gearCheckedCount}/{participants.length}
                </span>
              </button>

              <button
                type='button'
                role='tab'
                aria-selected={activeTab === 'crates'}
                onClick={() => handleTabChange('crates')}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                  activeTab === 'crates'
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <Package size={14} className='shrink-0 opacity-70' />
                <span>Crates</span>
              </button>
            </div>

            {/* Day-of actions: one primary CTA + quiet utilities */}
            <div className='flex items-center justify-end gap-2 flex-wrap'>
              <Dropdown
                menu={{ items: tripSetupMenuItems }}
                placement='bottomRight'
                trigger={['click']}
              >
                <button
                  type='button'
                  className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors'
                  title='Trip setup: details, briefing, rental pricing'
                >
                  <Settings2 size={13} className='text-gray-500 dark:text-slate-400' />
                  <span>Trip</span>
                  <ChevronDown size={12} className='text-gray-400 dark:text-slate-400' />
                </button>
              </Dropdown>

              <Dropdown
                menu={{ items: exportMenuItems }}
                placement='bottomRight'
                trigger={['click']}
              >
                <button
                  type='button'
                  disabled={exporting}
                  className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50'
                  title='Export trip documents'
                >
                  {exporting ? (
                    <Loader2 size={13} className='animate-spin' />
                  ) : (
                    <Download size={13} className='text-gray-500 dark:text-slate-400' />
                  )}
                  <span>Export</span>
                  <ChevronDown size={12} className='text-gray-400 dark:text-slate-400' />
                </button>
              </Dropdown>

              <button
                type='button'
                onClick={() => setAddDiverModalOpen(true)}
                disabled={slot.seats_available <= 0}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <UserPlus size={14} />
                <span>Walk-in</span>
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
            onEditDiver={diver => {
              setDetailsDiver(diver);
              setModalEditMode(true);
            }}
            onViewDetails={diver => {
              setDetailsDiver(diver);
              setModalEditMode(false);
            }}
          />
        ) : activeTab === 'gear-check' ? (
          <DiverEquipmentChecklist
            participants={participants}
            onToggleGearCheck={handleToggleGearCheck}
            onEditDiver={diver => {
              setDetailsDiver(diver);
              setModalEditMode(true);
            }}
          />
        ) : (
          <GearPackingManifest summary={crate_packing_summary} participants={participants} />
        )}

        {/* Modals */}
        <AddDiverModal
          isOpen={addDiverModalOpen}
          onClose={() => setAddDiverModalOpen(false)}
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
          initialEditMode={modalEditMode}
        />

        {/* Staff Assignment Modal */}
        <Modal
          open={staffModalOpen}
          onCancel={() => setStaffModalOpen(false)}
          footer={null}
          width={540}
          title={
            <div className='flex items-center gap-2 pb-2 border-b'>
              <UserCheck className='h-5 w-5 text-blue-600' />
              <div>
                <h3 className='text-base font-bold text-gray-900 dark:text-white'>
                  Assign Boat Crew & Dive Staff
                </h3>
                <p className='text-xs text-gray-500 font-normal'>
                  Designate the vessel Master / Skipper and Lead Divemaster for Port Authority
                  compliance.
                </p>
              </div>
            </div>
          }
        >
          <form onSubmit={handleSaveStaff} className='pt-3 space-y-4 text-xs'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                  Master / Skipper Name *
                </label>
                <input
                  type='text'
                  value={skipperName}
                  onChange={e => setSkipperName(e.target.value)}
                  placeholder='e.g. Capt. Kostas'
                  required
                  className='w-full px-3 py-2 border rounded-lg text-xs'
                />
              </div>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                  Skipper License #
                </label>
                <input
                  type='text'
                  value={skipperLicense}
                  onChange={e => setSkipperLicense(e.target.value)}
                  placeholder='e.g. GR-SK-4491'
                  className='w-full px-3 py-2 border rounded-lg text-xs'
                />
              </div>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                  Lead Divemaster / Guide *
                </label>
                <input
                  type='text'
                  value={leadGuideName}
                  onChange={e => setLeadGuideName(e.target.value)}
                  placeholder='e.g. Elena M.'
                  required
                  className='w-full px-3 py-2 border rounded-lg text-xs'
                />
              </div>
              <div>
                <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                  Staff Cert / License #
                </label>
                <input
                  type='text'
                  value={leadGuideCert}
                  onChange={e => setLeadGuideCert(e.target.value)}
                  placeholder='e.g. PADI MSDT #284910'
                  className='w-full px-3 py-2 border rounded-lg text-xs'
                />
              </div>
            </div>

            <div>
              <label className='block font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                Deck Crew & Assistants (comma separated)
              </label>
              <input
                type='text'
                value={crewText}
                onChange={e => setCrewText(e.target.value)}
                placeholder='e.g. Nikos (Deckhand), Anna (Safety Diver)'
                className='w-full px-3 py-2 border rounded-lg text-xs'
              />
            </div>

            <div className='flex items-center justify-end gap-2 pt-3 border-t'>
              <button
                type='button'
                onClick={() => setStaffModalOpen(false)}
                className='px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md font-medium'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={savingStaff}
                className='flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm'
              >
                {savingStaff ? <Loader2 size={13} className='animate-spin' /> : <Check size={13} />}
                Save Assignments
              </button>
            </div>
          </form>
        </Modal>

        {/* Center Equipment Rental Pricing Modal */}
        <CenterRentalPricingModal
          isOpen={rentalPricingModalOpen}
          onClose={() => setRentalPricingModalOpen(false)}
          centerId={centerId}
        />

        {/* Pre-Dive Briefing Review Modal */}
        <BriefingReviewModal
          isOpen={briefingModalOpen}
          onClose={() => setBriefingModalOpen(false)}
          centerId={centerId}
          tripId={tripId}
          onBriefingDispatched={fetchManifest}
        />

        {editingTrip && (
          <TripFormModal
            isOpen={editTripModalOpen}
            onClose={() => {
              setEditTripModalOpen(false);
              setEditingTrip(null);
            }}
            onSubmit={handleUpdateTripDetails}
            trip={editingTrip}
            divingCenterId={Number(centerId)}
            isSubmitting={savingTrip}
            diveSites={additionalDiveSites}
            divingCenters={[{ id: Number(centerId), name: center.name }]}
            additionalDiveSites={additionalDiveSites}
            title='Edit Trip Details'
          />
        )}
      </div>
    </div>
  );
};

export default TripOperationsDashboard;
