import {
  Calendar,
  Clock,
  MapPin,
  Ship,
  Users,
  Coins,
  Bell,
  MessageSquare,
  Plus,
  UserPlus,
  Trash2,
  ExternalLink,
  ChevronLeft,
  Loader2,
  ShieldAlert,
  ClipboardList,
  Edit,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, Link } from 'react-router-dom';

import api from '../api';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { getFullAvatarUrl } from '../utils/avatarHelpers';

const DivingCenterManagePage = () => {
  const { id } = useParams();
  const centerId = parseInt(id, 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [managerUsername, setManagerUsername] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  // 1. Fetch Diving Center Details
  const {
    data: center,
    isLoading: loadingCenter,
    error: centerError,
  } = useQuery(['divingCenter', centerId], async () => {
    const res = await api.get(`/api/v1/diving-centers/${centerId}`);
    return res.data;
  });

  // 2. Fetch Trips Operations Summary
  const { data: tripsSummary = [], isLoading: loadingTrips } = useQuery(
    ['centerTripsSummary', centerId],
    async () => {
      const res = await api.get(`/api/v1/centers/${centerId}/booking-ops/trips-summary`);
      return res.data;
    },
    {
      enabled: !!centerId,
    }
  );

  // 3. Fetch Managers
  const { data: managers = [] } = useQuery(
    ['divingCenterManagers', centerId],
    async () => {
      const res = await api.get(`/api/v1/diving-centers/${centerId}/managers`);
      return res.data;
    },
    {
      enabled: !!centerId,
    }
  );

  // Mutations
  const broadcastMutation = useMutation(
    async message => {
      return await api.post(`/api/v1/diving-centers/${centerId}/broadcast`, {
        message,
      });
    },
    {
      onSuccess: () => {
        toast.success('Announcement broadcast successfully sent to followers.');
        setBroadcastMessage('');
      },
      onError: err => {
        toast.error(err.response?.data?.detail || 'Failed to send broadcast.');
      },
    }
  );

  const addManagerMutation = useMutation(
    async username => {
      return await api.post(`/api/v1/diving-centers/${centerId}/managers`, {
        username,
      });
    },
    {
      onSuccess: () => {
        toast.success(`User @${managerUsername} added as manager.`);
        setManagerUsername('');
        queryClient.invalidateQueries(['divingCenterManagers', centerId]);
      },
      onError: err => {
        toast.error(err.response?.data?.detail || 'Failed to add manager.');
      },
    }
  );

  const removeManagerMutation = useMutation(
    async userId => {
      return await api.delete(`/api/v1/diving-centers/${centerId}/managers/${userId}`);
    },
    {
      onSuccess: () => {
        toast.success('Manager removed successfully.');
        queryClient.invalidateQueries(['divingCenterManagers', centerId]);
      },
      onError: err => {
        toast.error(err.response?.data?.detail || 'Failed to remove manager.');
      },
    }
  );

  if (loadingCenter) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center py-24'>
        <Loader2 className='w-8 h-8 animate-spin text-blue-600' />
        <span className='ml-3 text-gray-600 dark:text-gray-300 font-medium'>
          Loading management portal...
        </span>
      </div>
    );
  }

  if (centerError || !center) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-16 text-center px-4'>
        <ShieldAlert className='w-12 h-12 text-rose-500 mx-auto mb-4' />
        <h2 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
          Unauthorized or Center Not Found
        </h2>
        <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
          You must be an authorized owner or manager of this diving center to access this hub.
        </p>
        <Button to='/diving-centers' variant='secondary'>
          Back to Diving Centers
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === center.owner_id;
  const isAdmin = user?.is_admin || user?.is_moderator;

  // KPIs
  const totalTrips = tripsSummary.length;
  const bookableTrips = tripsSummary.filter(t => t.isBookable).length;
  const totalBookedSeats = tripsSummary.reduce((acc, t) => acc + (t.seatsBooked || 0), 0);
  const totalCapacitySeats = tripsSummary.reduce((acc, t) => acc + (t.seatsTotal || 0), 0);
  const overallOccupancy =
    totalCapacitySeats > 0 ? Math.round((totalBookedSeats / totalCapacitySeats) * 100) : 0;

  const filteredTrips = tripsSummary.filter(t => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.tripDate?.includes(q) ||
      (t.isBookable && 'online booking'.includes(q))
    );
  });

  return (
    <>
      <SEO
        title={`Management Portal - ${center.name}`}
        description={`Manage dive trips, manifests, customer bookings, and staff for ${center.name}.`}
      />

      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8'>
        <div className='max-w-7xl mx-auto space-y-8'>
          {/* Breadcrumb & Navigation */}
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div className='flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400'>
              <Link to='/diving-centers' className='hover:underline'>
                Diving Centers
              </Link>
              <span>/</span>
              <Link to={`/diving-centers/${center.id}`} className='hover:underline'>
                {center.name}
              </Link>
              <span>/</span>
              <span className='font-semibold text-gray-800 dark:text-gray-200'>
                Management Portal
              </span>
            </div>

            <div className='flex items-center space-x-3'>
              <Button to={`/diving-centers/${center.id}`} variant='secondary' size='sm'>
                <ChevronLeft className='w-4 h-4 mr-1' /> View Public Page
              </Button>
            </div>
          </div>

          {/* Center Identity Banner */}
          <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
              <div className='flex items-center space-x-4'>
                {center.logo_url ? (
                  <img
                    src={getFullAvatarUrl(center.logo_url)}
                    alt={center.name}
                    className='w-16 h-16 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm'
                  />
                ) : (
                  <div className='w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl'>
                    {center.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                    {center.name}
                  </h1>
                  <p className='text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1'>
                    <MapPin className='w-4 h-4 mr-1 text-gray-400' />
                    {center.city ? `${center.city}, ` : ''}
                    {center.country}
                  </p>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className='flex flex-wrap items-center gap-3'>
                <Button
                  to={`/diving-centers/${center.id}/gear-rental`}
                  variant='secondary'
                  size='sm'
                  className='flex items-center'
                >
                  <Coins className='w-4 h-4 mr-2 text-emerald-500' />
                  Equipment Rental Pricing
                </Button>
                <Button
                  to={`/dive-trips/create?center_id=${center.id}`}
                  variant='primary'
                  size='sm'
                  className='flex items-center'
                >
                  <Plus className='w-4 h-4 mr-2' />
                  Create New Trip
                </Button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700/60'>
              <div className='bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700'>
                <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block'>
                  Scheduled Trips
                </span>
                <span className='text-2xl font-black text-gray-900 dark:text-white mt-1 block'>
                  {totalTrips}
                </span>
                <span className='text-xs text-gray-400 mt-0.5 block'>Upcoming organized dives</span>
              </div>

              <div className='bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700'>
                <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block'>
                  Instant Online Booking
                </span>
                <span className='text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block'>
                  {bookableTrips}
                  <span className='text-sm font-normal text-gray-400 ml-1.5'>
                    / {totalTrips} trips
                  </span>
                </span>
                <span className='text-xs text-gray-400 mt-0.5 block'>OCTO availability active</span>
              </div>

              <div className='bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-700'>
                <span className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block'>
                  Total Booked Occupancy
                </span>
                <span className='text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block'>
                  {overallOccupancy}%
                  <span className='text-sm font-normal text-gray-400 ml-1.5'>
                    ({totalBookedSeats}/{totalCapacitySeats} seats)
                  </span>
                </span>
                <span className='text-xs text-gray-400 mt-0.5 block'>Across all active trips</span>
              </div>
            </div>
          </div>

          {/* Section: Trips & Booking Operations Console */}
          <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-6'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
              <div>
                <h2 className='text-xl font-bold text-gray-900 dark:text-white flex items-center'>
                  <Ship className='w-5 h-5 mr-2 text-blue-600' />
                  Trips & Booking Console
                </h2>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Live boat rosters, crate packing sheets, equipment checklists, and Coast Guard
                  manifests.
                </p>
              </div>

              <div className='w-full sm:w-64'>
                <input
                  type='text'
                  id='trips-search-input'
                  name='trips-search-input'
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder='Search trips by title or date...'
                  className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            {loadingTrips ? (
              <div className='py-12 flex justify-center items-center'>
                <Loader2 className='w-6 h-6 animate-spin text-blue-600' />
                <span className='ml-2 text-sm text-gray-500'>Loading trip schedule...</span>
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className='text-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl'>
                <Calendar className='w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2' />
                <p className='text-gray-600 dark:text-gray-300 font-medium'>
                  No scheduled trips found matching your search.
                </p>
                <div className='mt-4'>
                  <Button
                    to={`/dive-trips/create?center_id=${center.id}`}
                    variant='primary'
                    size='sm'
                  >
                    Schedule a New Trip
                  </Button>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredTrips.map(trip => {
                  const occupancyPct =
                    trip.seatsTotal > 0
                      ? Math.round((trip.seatsBooked / trip.seatsTotal) * 100)
                      : 0;

                  return (
                    <div
                      key={trip.tripId}
                      className='border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800'
                    >
                      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                        {/* Left Info */}
                        <div className='space-y-2'>
                          <div className='flex flex-wrap items-center gap-2.5'>
                            <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 flex items-center'>
                              <Calendar className='w-3 h-3 mr-1' /> {trip.tripDate}
                              {trip.tripTime ? ` at ${trip.tripTime}` : ''}
                            </span>

                            {trip.isBookable ? (
                              <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center'>
                                <Sparkles className='w-3 h-3 mr-1' /> Online Booking Active
                              </span>
                            ) : (
                              <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'>
                                Inquiries Only
                              </span>
                            )}

                            {trip.hasBriefing && (
                              <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 flex items-center'>
                                <CheckCircle2 className='w-3 h-3 mr-1' /> Briefing Ready
                              </span>
                            )}
                          </div>

                          <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
                            {trip.title}
                          </h3>
                        </div>

                        {/* Middle Capacity Gauge */}
                        <div className='w-full lg:w-48 space-y-1.5'>
                          <div className='flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300'>
                            <span>Capacity</span>
                            <span>
                              {trip.seatsBooked} / {trip.seatsTotal} Divers ({occupancyPct}%)
                            </span>
                          </div>
                          <div className='w-full bg-gray-100 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden'>
                            <div
                              className={`h-full rounded-full transition-all ${
                                occupancyPct >= 90
                                  ? 'bg-rose-500'
                                  : occupancyPct >= 60
                                    ? 'bg-blue-600'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, occupancyPct)}%` }}
                            />
                          </div>
                          <div className='text-right text-[11px] text-gray-400'>
                            {trip.seatsAvailable} seats available
                          </div>
                        </div>

                        {/* Right Buttons */}
                        <div className='flex flex-wrap items-center gap-2 justify-end'>
                          <Link
                            to={`/dive-trips/${trip.tripId}`}
                            className='px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center'
                          >
                            <ExternalLink className='w-3.5 h-3.5 mr-1 text-gray-400' />
                            Public View
                          </Link>

                          {trip.octoSlotId ? (
                            <Button
                              to={`/manage/centers/${center.id}/trips/${trip.octoSlotId}`}
                              variant='primary'
                              size='sm'
                              className='flex items-center'
                            >
                              <ClipboardList className='w-4 h-4 mr-1.5' />
                              Operations & Manifest
                            </Button>
                          ) : (
                            <Button to={`/dive-trips/${trip.tripId}`} variant='secondary' size='sm'>
                              Configure Booking
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Broadcast Announcements */}
          <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm'>
            <div className='flex items-center space-x-2 mb-2'>
              <Bell className='w-5 h-5 text-blue-600' />
              <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                Broadcast Announcement
              </h2>
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
              Send a notification message to all registered divers following {center.name}.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!broadcastMessage.trim()) return;
                broadcastMutation.mutate(broadcastMessage.trim());
              }}
              className='space-y-4'
            >
              <textarea
                id='broadcast-message'
                name='broadcast-message'
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder='Announce new dive trips, visibility conditions, or special events...'
                maxLength={2000}
                className='w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]'
                required
              />
              <div className='flex items-center justify-between'>
                <span className='text-xs text-gray-400'>{broadcastMessage.length} / 2000</span>
                <Button
                  type='submit'
                  variant='secondary'
                  disabled={broadcastMutation.isLoading || !broadcastMessage.trim()}
                  className='flex items-center'
                >
                  <MessageSquare className='w-4 h-4 mr-2' />
                  {broadcastMutation.isLoading ? 'Sending...' : 'Send Broadcast'}
                </Button>
              </div>
            </form>
          </div>

          {/* Section: Authorized Team Management (Owner & Admins only) */}
          {(isOwner || isAdmin) && (
            <div className='bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center space-x-2'>
                  <Users className='w-5 h-5 text-blue-600' />
                  <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                    Team Management & Staff Access
                  </h2>
                </div>
                <span className='text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full'>
                  {managers.length} Manager{managers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-6'>
                Authorize instructors or staff members to manage daily rosters, check-in divers, and
                create dive trips on behalf of your center.
              </p>

              {/* Add Manager Form */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!managerUsername.trim()) return;
                  addManagerMutation.mutate(managerUsername.trim());
                }}
                className='flex flex-wrap sm:flex-nowrap gap-3 mb-6'
              >
                <input
                  type='text'
                  id='manager-username'
                  name='manager-username'
                  value={managerUsername}
                  onChange={e => setManagerUsername(e.target.value)}
                  placeholder='Enter username to authorize as manager...'
                  className='w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <Button
                  type='submit'
                  variant='primary'
                  disabled={addManagerMutation.isLoading || !managerUsername.trim()}
                  className='shrink-0 flex items-center'
                >
                  <UserPlus className='w-4 h-4 mr-2' />
                  {addManagerMutation.isLoading ? 'Adding...' : 'Authorize Manager'}
                </Button>
              </form>

              {/* Managers List */}
              {managers.length === 0 ? (
                <div className='text-center py-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400'>
                  No authorized managers assigned yet.
                </div>
              ) : (
                <div className='divide-y divide-gray-100 dark:divide-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden'>
                  {managers.map(mgr => (
                    <div
                      key={mgr.user_id}
                      className='flex items-center justify-between p-4 bg-white dark:bg-gray-800'
                    >
                      <div>
                        <span className='font-semibold text-gray-900 dark:text-white block'>
                          @{mgr.username}
                        </span>
                        <span className='text-xs text-gray-400'>{mgr.name || 'Staff Member'}</span>
                      </div>

                      <button
                        type='button'
                        onClick={() => removeManagerMutation.mutate(mgr.user_id)}
                        className='text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center'
                      >
                        <Trash2 className='w-3.5 h-3.5 mr-1' /> Remove Access
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DivingCenterManagePage;
