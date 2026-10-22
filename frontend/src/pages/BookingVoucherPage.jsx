import { QRCode } from 'antd';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shield,
  Printer,
  ChevronLeft,
  Loader2,
  Gauge,
  CreditCard,
  FileCheck,
  Ship,
  Download,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';

function resolveBookingAccessToken(uuid, searchParams) {
  const fromQuery = searchParams.get('access_token');
  if (fromQuery) {
    try {
      window.sessionStorage.setItem(`divemap_booking_access_${uuid}`, fromQuery);
    } catch (_e) {
      // ignore storage errors
    }
    return fromQuery;
  }
  try {
    return window.sessionStorage.getItem(`divemap_booking_access_${uuid}`);
  } catch (_e) {
    return null;
  }
}

const BookingVoucherPage = () => {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloadingVoucherPdf, setDownloadingVoucherPdf] = useState(false);
  const [downloadingBriefingPdf, setDownloadingBriefingPdf] = useState(false);
  const [voucher, setVoucher] = useState(null);

  const accessToken = useMemo(
    () => (uuid ? resolveBookingAccessToken(uuid, searchParams) : null),
    [uuid, searchParams]
  );

  // Strip access_token from the URL after hydrating sessionStorage (history / Referer / QR safety)
  useEffect(() => {
    if (!uuid || !searchParams.get('access_token')) return;
    navigate(`/bookings/${uuid}/voucher`, { replace: true });
  }, [uuid, searchParams, navigate]);

  const bookingAuthConfig = useMemo(() => {
    if (!accessToken) return {};
    return { headers: { 'X-Booking-Access-Token': accessToken } };
  }, [accessToken]);

  useEffect(() => {
    const fetchVoucher = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/bookings/${uuid}/voucher`, bookingAuthConfig);
        setVoucher(res.data);
      } catch (err) {
        console.error('Failed to load voucher:', err);
        toast.error('Could not load booking voucher details.');
      } finally {
        setLoading(false);
      }
    };

    if (uuid) {
      fetchVoucher();
    }
  }, [uuid, bookingAuthConfig]);

  const handleDownloadVoucherPdf = async () => {
    try {
      setDownloadingVoucherPdf(true);
      toast.loading('Generating official voucher PDF with QR pass...', { id: 'voucher-pdf' });
      const res = await api.get(`/api/v1/bookings/${uuid}/voucher/pdf`, {
        responseType: 'blob',
        ...bookingAuthConfig,
      });
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dive_voucher_${uuid.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Voucher PDF downloaded successfully!', { id: 'voucher-pdf' });
    } catch (err) {
      console.error('Failed to download voucher PDF:', err);
      toast.error('Failed to generate voucher PDF.', { id: 'voucher-pdf' });
    } finally {
      setDownloadingVoucherPdf(false);
    }
  };

  const handleDownloadBriefingPdf = async () => {
    try {
      setDownloadingBriefingPdf(true);
      toast.loading('Downloading briefing PDF...', { id: 'briefing-pdf' });
      const res = await api.get(`/api/v1/bookings/${uuid}/briefing`, {
        responseType: 'blob',
        ...bookingAuthConfig,
      });
      const blob = new window.Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dive_briefing_${uuid.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Briefing PDF downloaded.', { id: 'briefing-pdf' });
    } catch (err) {
      console.error('Failed to download briefing PDF:', err);
      const status = err.response?.status;
      toast.error(
        status === 401
          ? 'Authentication required to download the briefing.'
          : 'Failed to download briefing PDF.',
        { id: 'briefing-pdf' }
      );
    } finally {
      setDownloadingBriefingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex justify-center items-center py-24'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
        <span className='ml-3 text-gray-600 font-medium'>Generating your digital voucher...</span>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className='min-h-screen bg-gray-50 py-16 text-center'>
        <p className='text-gray-600'>Voucher not found for booking reference {uuid}.</p>
        <Link to='/' className='mt-4 inline-block text-blue-600 underline font-semibold'>
          Back to Home
        </Link>
      </div>
    );
  }

  const primaryItem = voucher.unitItems?.[0];

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 pt-6 transition-colors duration-200'>
      <SEO
        title={`Voucher: ${voucher.productTitle} - Divemap`}
        description='Digital check-in voucher and equipment pass for your dive trip.'
      />

      <div className='max-w-[95vw] xl:max-w-[800px] mx-auto px-0 sm:px-4'>
        {/* Navigation & Print Actions */}
        <div className='flex items-center justify-between mb-6 no-print'>
          <Link
            to='/'
            className='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400'
          >
            <ChevronLeft size={18} className='mr-1' />
            Back to Home
          </Link>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={handleDownloadBriefingPdf}
              disabled={downloadingBriefingPdf}
              className='inline-flex items-center px-3.5 py-1.5 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs transition-all disabled:opacity-50'
              title='Download official Pre-Dive Briefing PDF'
            >
              <Download size={14} className='mr-1.5 text-indigo-600 dark:text-indigo-400' />
              {downloadingBriefingPdf ? 'Downloading…' : 'Briefing PDF'}
            </button>
            <button
              onClick={handleDownloadVoucherPdf}
              disabled={downloadingVoucherPdf}
              className='inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50'
            >
              <Download size={14} className='mr-1.5' />
              {downloadingVoucherPdf ? 'Generating PDF...' : 'Download Voucher PDF'}
            </button>
          </div>
        </div>

        {/* The Voucher Card */}
        <div className='bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {/* Top Banner */}
          <div className='bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <span className='px-2.5 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white uppercase tracking-wider'>
                  Reservation Confirmed
                </span>
                <h1 className='text-xl sm:text-2xl font-bold mt-2'>{voucher.productTitle}</h1>
                <p className='text-sm text-blue-100 mt-1 flex items-center gap-1.5'>
                  <MapPin size={15} />
                  <span>{voucher.centerName}</span>
                </p>
              </div>

              {/* QR boarding pass — non-secret payload from API (never encode access_token URLs) */}
              <div className='bg-white p-2.5 rounded-xl shadow-md text-gray-900 flex flex-col items-center shrink-0'>
                <QRCode
                  value={voucher.qrCodeData || `DIVEMAP:BOOKING:${uuid}`}
                  size={76}
                  bordered={false}
                  errorLevel='M'
                />
                <span className='text-[9px] font-mono font-bold text-gray-500 mt-1 tracking-tighter'>
                  SCAN AT DESK
                </span>
              </div>
            </div>
          </div>

          <div className='p-6 space-y-6'>
            {/* Booking Reference & Schedule Strip */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-100 dark:border-gray-700'>
              <div>
                <span className='text-xs text-gray-400 block font-medium uppercase tracking-wider'>
                  Booking Reference
                </span>
                <span className='text-xs font-mono font-bold text-gray-800 dark:text-gray-200 select-all'>
                  {voucher.bookingUuid}
                </span>
              </div>

              <div>
                <span className='text-xs text-gray-400 block font-medium uppercase tracking-wider'>
                  Departure Date
                </span>
                <span className='text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 mt-0.5'>
                  <Calendar size={14} className='text-blue-600' />
                  {voucher.departureDate}
                </span>
              </div>

              <div>
                <span className='text-xs text-gray-400 block font-medium uppercase tracking-wider'>
                  Meeting Time
                </span>
                <span className='text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 mt-0.5'>
                  <Clock size={14} className='text-blue-600' />
                  {voucher.meetingTime} (Dep: {voucher.departureTime})
                </span>
              </div>

              <div>
                <span className='text-xs text-gray-400 block font-medium uppercase tracking-wider'>
                  Dive Vessel
                </span>
                <span className='text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 mt-0.5'>
                  <Ship size={14} className='text-blue-600' />
                  {voucher.vesselName || 'Dive Boat'}
                  {voucher.vesselRegistration && (
                    <span className='text-xs text-gray-400 font-mono font-normal'>
                      ({voucher.vesselRegistration})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Required Check-in Documents & Verifications */}
            <div className='bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-gray-800 dark:to-gray-800/80 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 p-4 space-y-3 shadow-sm'>
              <div className='flex items-center gap-2'>
                <Shield className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                <h2 className='text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider'>
                  Mandatory Check-in Documents — Please Bring to Dive Center
                </h2>
              </div>

              <div className='space-y-2 text-xs'>
                {/* 1. Scuba Certification Card */}
                <div className='flex items-start gap-2.5 p-2.5 bg-white dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700'>
                  <Award className='h-4 w-4 text-blue-600 shrink-0 mt-0.5' />
                  <div>
                    <strong className='text-gray-900 dark:text-white block'>
                      Scuba Certification Card
                    </strong>
                    <span className='text-gray-600 dark:text-gray-300 text-[11px] block'>
                      Please present your physical certification card or digital agency app (PADI,
                      SSI, CMAS, etc.) at the reception desk.
                    </span>
                  </div>
                </div>

                {/* 2. Doctor's Medical Certificate (if flagged/physician clearance needed) */}
                {(primaryItem?.medicalStatus === 'PHYSICIAN_APPROVED' ||
                  primaryItem?.medicalStatus === 'FLAGGED_CONTACT_CENTER') && (
                  <div className='flex items-start gap-2.5 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'>
                    <AlertTriangle className='h-4 w-4 text-amber-600 shrink-0 mt-0.5' />
                    <div>
                      <strong className='block text-amber-900 dark:text-amber-300'>
                        ⚠️ Signed Physician Medical Clearance Required
                      </strong>
                      <span className='text-[11px] block text-amber-800 dark:text-amber-300/90 leading-relaxed'>
                        Because a medical condition was flagged on your diving questionnaire, you
                        must present an official doctor&apos;s signed written approval declaring you
                        medically fit for scuba diving to board the boat.
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Nitrox (EANx) Certification Card (if EANx selected) */}
                {primaryItem?.selectedGasMixId &&
                  primaryItem.selectedGasMixId.toLowerCase() !== 'air' && (
                    <div
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
                        primaryItem.gasMixStatus === 'APPROVED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                      }`}
                    >
                      <Gauge className='h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5' />
                      <div>
                        <strong className='block'>
                          {primaryItem.gasMixStatus === 'APPROVED'
                            ? '✓ Nitrox (EAN32) Reserved & Confirmed'
                            : '⚠️ Nitrox (EAN32) Requested — Verification Required at Check-in'}
                        </strong>
                        <span className='text-[11px] block leading-relaxed opacity-90'>
                          {primaryItem.gasMixStatus === 'APPROVED'
                            ? 'Your Enriched Air Nitrox qualification is on file. Please keep your certification card accessible for cylinder gas analysis sign-off.'
                            : 'You requested an Enriched Air (Nitrox) cylinder. You must show your Nitrox certification card to the dive center manager on arrival, or standard Air (21% O2) will be supplied.'}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Diver & Equipment Checklist */}
            <div>
              <h2 className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-3'>
                Participant & Equipment Pass
              </h2>
              {primaryItem && (
                <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4'>
                  <div className='flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700'>
                    <div>
                      <strong className='text-base text-gray-900 dark:text-white block'>
                        {primaryItem.diverFullName}
                      </strong>
                      <span className='text-xs text-blue-600 font-medium'>
                        {primaryItem.unitTitle}
                      </span>
                    </div>
                    <span className='px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md flex items-center gap-1'>
                      <FileCheck size={14} />
                      Paperwork Signed
                    </span>
                  </div>

                  {/* Gear Specs List */}
                  <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs'>
                    <div>
                      <span className='text-gray-400 block'>Assigned Cylinder</span>
                      <strong className='text-gray-800 dark:text-gray-200'>
                        {primaryItem.selectedTankId}L Steel
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block'>Breathing Gas</span>
                      <strong className='text-gray-800 dark:text-gray-200'>
                        {primaryItem.selectedGasMixId.toUpperCase()}
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block'>Lead Weights</span>
                      <strong className='text-gray-800 dark:text-gray-200'>
                        {primaryItem.equipmentSizing?.has_own_lead_weights
                          ? '0 kg (Own Lead)'
                          : `${primaryItem.equipmentSizing?.lead_kg || 4} kg`}
                      </strong>
                    </div>
                    <div>
                      <span className='text-gray-400 block'>Wetsuit</span>
                      <strong className='text-gray-800 dark:text-gray-200'>
                        Size {primaryItem.equipmentSizing?.wetsuit_size || 'L'} (
                        {primaryItem.equipmentSizing?.wetsuit_thickness || '5mm'})
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment & Arrival Notice */}
            <div className='bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900'>
              <CreditCard className='h-5 w-5 text-amber-600 shrink-0 mt-0.5' />
              <div className='text-xs sm:text-sm'>
                <strong className='block font-bold mb-0.5'>
                  Payment Due on Arrival: €{voucher.totalAmount.toFixed(2)}
                </strong>
                <span>
                  Zero charges were processed online. Please present this voucher or your booking
                  reference at the <strong>{voucher.centerName}</strong> reception desk on arrival
                  to settle payment by cash or card.
                </span>
              </div>
            </div>

            {/* Dive Center Contact & Pier Instructions */}
            <div className='pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 space-y-1.5'>
              <p>
                <strong>Meeting Location:</strong> {voucher.meetingInstructions}
              </p>
              {voucher.centerPhone && (
                <p className='flex items-center gap-1.5'>
                  <Phone size={13} className='text-gray-400' />
                  <span>
                    Center Helpline / WhatsApp: <strong>{voucher.centerPhone}</strong>
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingVoucherPage;
