import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  QrCode,
  Download,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Ship,
  ExternalLink,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';

const UserBookingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/v1/bookings/my-bookings');
        setBookings(res.data || []);
      } catch (err) {
        console.error('Failed to load user bookings:', err);
        toast.error('Failed to load your bookings history.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const handleDownloadBriefing = async bookingUuid => {
    try {
      toast.loading('Generating safety briefing PDF...', { id: 'briefing-dl' });
      const res = await api.get(`/api/v1/bookings/${bookingUuid}/briefing`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(
        new window.Blob([res.data], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dive_briefing_${bookingUuid.substring(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Briefing downloaded successfully!', { id: 'briefing-dl' });
    } catch (err) {
      console.error('Failed to download briefing:', err);
      toast.error('Safety briefing not yet available or failed to download.', {
        id: 'briefing-dl',
      });
    }
  };

  const getStatusBadge = status => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'>
            <ShieldCheck className='w-3 h-3 mr-1' /> Confirmed
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'>
            <Clock className='w-3 h-3 mr-1' /> On Hold
          </span>
        );
      case 'CANCELLED':
        return (
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'>
            Cancelled
          </span>
        );
      default:
        return (
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'>
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <SEO
        title='My Dive Bookings'
        description='Manage your scuba dive trip reservations, access digital vouchers, and download safety briefings on Divemap.'
      />

      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-4xl mx-auto'>
          {/* Header */}
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-6 border-b border-gray-200 dark:border-gray-800 gap-4'>
            <div>
              <div className='flex items-center space-x-3'>
                <div className='p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl'>
                  <Ticket className='w-6 h-6' />
                </div>
                <div>
                  <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                    My Dive Bookings
                  </h1>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Digital vouchers, pre-dive safety briefings, and trip reservations.
                  </p>
                </div>
              </div>
            </div>

            <Button
              to='/dive-trips'
              variant='secondary'
              className='self-start sm:self-auto flex items-center'
            >
              <Ship className='w-4 h-4 mr-2' />
              Browse More Trips
            </Button>
          </div>

          {/* Loading */}
          {loading && (
            <div className='flex flex-col items-center justify-center py-24'>
              <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
              <span className='mt-3 text-sm text-gray-500 dark:text-gray-400 font-medium'>
                Loading your reservations...
              </span>
            </div>
          )}

          {/* Empty State */}
          {!loading && bookings.length === 0 && (
            <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12 text-center shadow-sm'>
              <div className='w-16 h-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center'>
                <Ticket className='w-8 h-8' />
              </div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
                No Bookings Yet
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6'>
                You haven&apos;t booked any organized dive trips through Divemap yet. Explore
                scheduled trips with instant online booking and certified dive centers.
              </p>
              <Button to='/dive-trips' variant='primary' size='lg'>
                Explore Available Trips
              </Button>
            </div>
          )}

          {/* Bookings List */}
          {!loading && bookings.length > 0 && (
            <div className='space-y-4'>
              {bookings.map(booking => {
                const tripDateFormatted = booking.tripDate
                  ? new Date(booking.tripDate).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Date Scheduled';

                const tripTimeFormatted = booking.tripDate
                  ? new Date(booking.tripDate).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null;

                return (
                  <div
                    key={booking.bookingUuid}
                    className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow'
                  >
                    <div className='p-5 sm:p-6'>
                      {/* Top Row: Center Name & Status */}
                      <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
                        <div>
                          <div className='flex items-center space-x-2'>
                            <span className='font-mono text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500'>
                              {booking.reference}
                            </span>
                            {getStatusBadge(booking.status)}
                          </div>
                          <Link
                            to={`/diving-centers/${booking.centerId}`}
                            className='text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-block mt-0.5'
                          >
                            {booking.centerName}
                          </Link>
                        </div>

                        <div className='text-right'>
                          <span className='text-xs text-gray-500 dark:text-gray-400 block'>
                            Total Price
                          </span>
                          <span className='text-lg font-bold text-gray-900 dark:text-white'>
                            {booking.totalAmount.toFixed(2)} {booking.currency}
                          </span>
                        </div>
                      </div>

                      {/* Middle Details Grid */}
                      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-y border-gray-100 dark:border-gray-700/60 text-sm'>
                        <div className='flex items-center text-gray-600 dark:text-gray-300'>
                          <Calendar className='w-4 h-4 mr-2 text-blue-500 shrink-0' />
                          <span>
                            {tripDateFormatted}
                            {tripTimeFormatted ? ` at ${tripTimeFormatted}` : ''}
                          </span>
                        </div>

                        <div className='flex items-center text-gray-600 dark:text-gray-300'>
                          <Ticket className='w-4 h-4 mr-2 text-indigo-500 shrink-0' />
                          <span>
                            {booking.participantsCount} Diver
                            {booking.participantsCount !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className='flex items-center text-gray-600 dark:text-gray-300'>
                          <CreditCard className='w-4 h-4 mr-2 text-emerald-500 shrink-0' />
                          <span>
                            {booking.paymentStatus === 'PAID'
                              ? 'Paid in Full'
                              : 'Pay at Dive Center'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Buttons */}
                      <div className='mt-4 flex flex-wrap items-center justify-between gap-3 pt-2'>
                        <div className='flex items-center space-x-3'>
                          {booking.tripId && (
                            <Link
                              to={`/dive-trips/${booking.tripId}`}
                              className='text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center font-medium'
                            >
                              <ExternalLink className='w-3.5 h-3.5 mr-1' /> View Trip Details
                            </Link>
                          )}
                        </div>

                        <div className='flex items-center space-x-2.5 w-full sm:w-auto justify-end'>
                          {booking.hasBriefing && (
                            <button
                              type='button'
                              onClick={() => handleDownloadBriefing(booking.bookingUuid)}
                              className='px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center'
                            >
                              <Download className='w-3.5 h-3.5 mr-1.5 text-blue-500' />
                              Briefing PDF
                            </button>
                          )}

                          <Button
                            to={`/bookings/${booking.bookingUuid}/voucher`}
                            variant='primary'
                            size='sm'
                            className='flex items-center'
                          >
                            <QrCode className='w-3.5 h-3.5 mr-1.5' />
                            View Voucher & QR
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserBookingsPage;
