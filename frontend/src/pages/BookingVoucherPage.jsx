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
  QrCode,
  Gauge,
  CreditCard,
  FileCheck,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, Link } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';

const BookingVoucherPage = () => {
  const { uuid } = useParams();
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState(null);

  useEffect(() => {
    const fetchVoucher = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/v1/bookings/${uuid}/voucher`);
        setVoucher(res.data);
      } catch (err) {
        console.error('Failed to load voucher:', err);
        toast.error('Failed to load booking voucher.');
      } finally {
        setLoading(false);
      }
    };

    if (uuid) {
      fetchVoucher();
    }
  }, [uuid]);

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
          <button
            onClick={() => window.print()}
            className='inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-all'
          >
            <Printer size={16} className='mr-2' />
            Print Voucher
          </button>
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

              {/* QR Token Box */}
              <div className='bg-white p-3 rounded-xl shadow-md text-gray-900 flex flex-col items-center shrink-0'>
                <QrCode size={52} className='text-gray-800' />
                <span className='text-[9px] font-mono font-bold text-gray-500 mt-1 tracking-tighter'>
                  SCAN AT DESK
                </span>
              </div>
            </div>
          </div>

          <div className='p-6 space-y-6'>
            {/* Booking Reference & Schedule Strip */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-xl border border-gray-100 dark:border-gray-700'>
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
                      <span className='text-gray-400 block'>Lead Ballast</span>
                      <strong className='text-gray-800 dark:text-gray-200'>
                        {primaryItem.equipmentSizing?.lead_kg || 4} kg
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
