import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Navigation,
  Share2,
  Info,
  Building,
  Ticket,
  LogIn,
  Edit,
  X,
  Upload,
  CheckCircle,
  Sparkles,
  ClipboardList,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Users,
  Clock,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';

import TripWaitlistInquiryModal from '../components/booking/TripWaitlistInquiryModal';
import Breadcrumbs from '../components/Breadcrumbs';
import DivingCenterSummaryCard from '../components/DivingCenterSummaryCard';
import MaskedEmail from '../components/MaskedEmail';
import SEO from '../components/SEO';
import { WhatsAppIcon } from '../components/SocialMediaIcons';
import TripFormModal from '../components/TripFormModal';
import TripHeader from '../components/TripHeader';
import Button from '../components/ui/Button';
import DepthIcon from '../components/ui/DepthIcon';
import RichText from '../components/ui/RichText';
import { useAuth } from '../contexts/AuthContext';
import { useSetting } from '../hooks/useSettings';
import { uploadDiveProfile } from '../services/dives';
import { getDiveSites, getDiveSite } from '../services/diveSites';
import { getDivingCenter, getDivingCenters, broadcastTrip } from '../services/divingCenters';
import { getParsedTrip, updateParsedTrip, deleteParsedTrip } from '../services/newsletters';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatDate } from '../utils/dateHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

import NotFound from './NotFound';
import UnprocessableEntity from './UnprocessableEntity';

const DiveSiteInfo = ({ dive, index }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: diveSite } = useQuery(
    ['diveSite', dive.dive_site_id],
    () => getDiveSite(dive.dive_site_id),
    {
      enabled: !!dive.dive_site_id,
      retry: (failureCount, error) => {
        if (error.response?.status === 404 || error.response?.status === 422) return false;
        return failureCount < 1;
      },
    }
  );

  const handleUploadProfile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (
      !name.endsWith('.xml') &&
      !name.endsWith('.uddf') &&
      !name.endsWith('.fit') &&
      !name.endsWith('.json')
    ) {
      toast.error('Please select a valid dive profile file (.xml, .uddf, .fit, .json)');
      return;
    }

    const toastId = toast.loading('Uploading dive profile...');
    try {
      await uploadDiveProfile(dive.user_dive_id, file);
      toast.success('Dive profile uploaded successfully', { id: toastId });
      queryClient.invalidateQueries(['dive-profile', dive.user_dive_id]);
      queryClient.invalidateQueries(['dive', dive.user_dive_id]);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Failed to upload profile'), { id: toastId });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className='bg-gray-50 rounded-lg p-4'>
      <div className='flex items-center justify-between mb-3'>
        <h4 className='font-medium text-gray-900'>
          Dive {index + 1}:{' '}
          {dive.dive_site_id ? (
            <Link
              to={`/dive-sites/${dive.dive_site_id}`}
              state={{ from: window.location.pathname + window.location.search }}
              className='text-blue-600 hover:text-blue-800 hover:underline transition-colors'
            >
              {dive.dive_site_name || diveSite?.name || 'Unnamed Site'}
            </Link>
          ) : (
            dive.dive_site_name || 'Unnamed Site'
          )}
        </h4>
        <div className='text-sm text-gray-500 font-medium flex items-center gap-1.5'>
          <DepthIcon className='text-divemap-blue font-bold' size={16} />
          {diveSite?.max_depth ? `${diveSite.max_depth}m max` : 'Depth TBD'}
        </div>
      </div>
      {dive.dive_site_id && diveSite && (
        <div className='text-sm text-gray-700 break-words overflow-hidden'>
          <div className='mb-2 break-words overflow-hidden max-w-full'>
            {diveSite.description ? (
              <RichText content={diveSite.description} />
            ) : (
              'No description available'
            )}
          </div>
          {dive.dive_description && (
            <div className='mb-2 text-gray-700 break-words overflow-hidden max-w-full'>
              <strong>Dive Description:</strong>
              <RichText content={dive.dive_description} className='mt-1' />
            </div>
          )}
          {dive.dive_duration && (
            <p className='mb-2 text-gray-700'>
              <strong>Duration:</strong> {dive.dive_duration} minutes
            </p>
          )}
          <div className='flex items-center space-x-4 text-xs text-gray-500 mt-3'>
            {diveSite.country && <span>📍 {diveSite.country}</span>}
            {diveSite.region && <span>🏛️ {diveSite.region}</span>}
          </div>{' '}
        </div>
      )}

      {dive.user_dive_id && (
        <div className='mt-4 pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <div className='flex items-center gap-2 text-sm text-green-700'>
            <CheckCircle className='w-4 h-4 flex-shrink-0' />
            <span className='min-w-0 flex-1'>
              Matched with your dive:{' '}
              <Link
                to={`/dives/${dive.user_dive_id}/${slugify(dive.user_dive_name || 'dive')}`}
                className='font-bold hover:underline transition-colors'
              >
                {dive.user_dive_name || 'My Dive'}
              </Link>
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              onClick={handleUploadProfile}
              variant='secondary'
              size='sm'
              icon={<Upload className='h-3.5 w-3.5' />}
              className='whitespace-nowrap'
            >
              Re-upload Profile
            </Button>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileChange}
              accept='.xml,.uddf,.fit,.json'
              className='hidden'
            />
          </div>
        </div>
      )}
    </div>
  );
};

const TripDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dive-sites');
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);

  const { data: reviewsDisabledSetting } = useSetting('disable_diving_center_reviews');
  const reviewsEnabled = reviewsDisabledSetting?.value === false;

  // Fetch trip data
  const {
    data: trip,
    isLoading: tripLoading,
    error: tripError,
  } = useQuery(['parsedTrip', id], () => getParsedTrip(id), {
    enabled: !!id,
    retry: (failureCount, error) => {
      if (error.response?.status === 404 || error.response?.status === 422) return false;
      return failureCount < 1;
    },
  });

  // Query for dive sites (for dropdown)
  const { data: diveSites = [] } = useQuery(
    'dive-sites',
    () => getDiveSites({ page_size: 100 }).then(res => res.items || []),
    {
      enabled: !!id && isEditTripModalOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Query for diving centers (for dropdown)
  const { data: divingCenters = [] } = useQuery(
    'diving-centers',
    () => getDivingCenters({ page_size: 100 }).then(res => res.items || []),
    {
      enabled: !!id && isEditTripModalOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  // State to store additional dive sites that are not in the main list
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);

  // Function to get dive site by ID if not in the list
  const getDiveSiteById = async siteId => {
    try {
      const site = await getDiveSite(siteId);
      return site;
    } catch (error) {
      console.error('Error fetching dive site by ID:', error);
    }
    return null;
  };

  // Function to ensure dive site is available in dropdown
  const ensureDiveSiteAvailable = async siteId => {
    if (!siteId) return;

    const existingSite =
      diveSites.find(s => s.id === siteId) || additionalDiveSites.find(s => s.id === siteId);

    if (!existingSite) {
      const site = await getDiveSiteById(siteId);
      if (site) {
        setAdditionalDiveSites(prev => {
          // Avoid duplicates
          if (prev.find(s => s.id === siteId)) return prev;
          return [...prev, site];
        });
      }
    }
  };

  const updateTripMutation = useMutation(({ tripId, data }) => updateParsedTrip(tripId, data), {
    onSuccess: () => {
      toast.success('Trip updated successfully');
      setIsEditTripModalOpen(false);
      queryClient.invalidateQueries(['parsedTrip', id]);
    },
    onError: error => {
      toast.error(`Update failed: ${extractErrorMessage(error)}`);
    },
  });

  const deleteTripMutation = useMutation(deleteParsedTrip, {
    onSuccess: () => {
      toast.success('Trip deleted successfully');
      navigate('/dive-trips');
    },
    onError: error => {
      toast.error(`Delete failed: ${extractErrorMessage(error)}`);
    },
  });

  const handleEditTrip = () => {
    // Ensure the dive sites are available in the dropdown
    if (trip.dives && trip.dives.length > 0) {
      trip.dives.forEach(dive => {
        if (dive.dive_site_id) {
          ensureDiveSiteAvailable(dive.dive_site_id);
        }
      });
    }
    setIsEditTripModalOpen(true);
  };

  const handleUpdateTrip = async (tripId, tripData) => {
    try {
      await updateTripMutation.mutateAsync({ tripId, data: tripData });

      // Handle broadcast if checked
      if (tripData.broadcast_to_followers && trip.diving_center_id) {
        try {
          await broadcastTrip(trip.diving_center_id, tripId, { is_update: true });
          toast.success('Trip broadcasted to followers!');
        } catch (err) {
          toast.error('Failed to broadcast trip update');
        }
      }
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDeleteTrip = () => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      deleteTripMutation.mutate(id);
    }
  };

  // Redirect to canonical URL with slug
  useEffect(() => {
    if (trip) {
      const name = generateTripName(trip);
      const expectedSlug = slugify(name);
      if (!slug || slug !== expectedSlug) {
        navigate(`/dive-trips/${id}/${expectedSlug}${location.search}`, { replace: true });
      }
    }
  }, [trip, id, slug, navigate, location.search]);

  // Fetch diving center data
  const { data: divingCenter } = useQuery(
    ['divingCenter', trip?.diving_center_id],
    () => getDivingCenter(trip?.diving_center_id),
    {
      enabled: !!trip?.diving_center_id,
      retry: (failureCount, error) => {
        if (error.response?.status === 404 || error.response?.status === 422) return false;
        return failureCount < 1;
      },
    }
  );

  const isOwner = Boolean(
    user &&
      divingCenter &&
      ((user.id && (user.id === divingCenter.created_by || user.id === divingCenter.owner_id)) ||
        (divingCenter.owner_username &&
          divingCenter.owner_username === user.username &&
          divingCenter.ownership_status === 'approved'))
  );
  const isAdmin = Boolean(user?.is_admin);
  const isManager = Boolean(divingCenter?.is_manager);
  const shouldShowManage = isOwner || isAdmin || isManager;

  const isFullyBooked = Boolean(
    trip?.is_bookable &&
      trip?.seats_available !== undefined &&
      trip?.seats_available !== null &&
      trip?.seats_available <= 0
  );

  const getMetaDescription = () => {
    if (!trip) return '';

    const tripName = generateTripName(trip);
    const date = formatDate(trip.trip_date, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    let desc = `Join the ${tripName} dive trip on ${date}.`;

    if (divingCenter) {
      desc += ` Organized by ${divingCenter.name}.`;
    }

    if (trip.dives && trip.dives.length > 0) {
      desc += ` Includes ${trip.dives.length} dives.`;
    }

    return desc;
  };

  const getSchema = () => {
    if (!trip) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: generateTripName(trip),
      startDate: trip.trip_date,
      description: decodeHtmlEntities(trip.trip_description) || getMetaDescription(),
      eventStatus: 'https://schema.org/EventScheduled',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: window.location.origin,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Dive Trips',
            item: `${window.location.origin}/dive-trips`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: generateTripName(trip),
            item: window.location.href,
          },
        ],
      },
    };

    if (divingCenter) {
      schema.organizer = {
        '@type': 'Organization',
        name: divingCenter.name,
        url: divingCenter.website,
      };
    }

    if (trip.dives && trip.dives.length > 0) {
      // If single location/site, use it. If multiple, maybe just pick first or generic
      // Schema.org Event location is usually singular.
      const firstLocation = trip.dives[0];
      if (firstLocation.dive_site_name) {
        schema.location = {
          '@type': 'Place',
          name: firstLocation.dive_site_name,
          address: {
            '@type': 'PostalAddress',
            addressCountry: firstLocation.country, // Assuming these fields exist or we'd need to fetch
          },
        };
      }
    }

    return schema;
  };

  if (tripLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }
  // Check if error is an authentication error (401 or 403)
  const isAuthError =
    tripError &&
    (tripError?.response?.status === 401 ||
      tripError?.response?.status === 403 ||
      tripError?.response?.data?.detail?.toLowerCase().includes('not authenticated') ||
      tripError?.response?.data?.detail?.toLowerCase().includes('authentication') ||
      tripError?.message?.includes('401') ||
      tripError?.message?.includes('403') ||
      tripError?.message?.toLowerCase().includes('not authenticated'));

  if (tripError && isAuthError) {
    return (
      <div className='max-w-6xl mx-auto px-4 py-12'>
        <div className='bg-blue-50 border border-blue-200 rounded-lg p-8 shadow-lg'>
          <div className='flex items-start'>
            <LogIn className='h-8 w-8 text-blue-600 mr-4 flex-shrink-0 mt-1' />
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-blue-900 mb-2'>Login Required</h3>
              <p className='text-blue-700 mb-4'>
                To view dive trip details and access all information, please log in to your account.
              </p>
              <div className='flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3'>
                <Button
                  to='/login'
                  state={{ from: location.pathname }}
                  variant='primary'
                  size='lg'
                  icon={<LogIn className='h-4 w-4' />}
                  className='w-full sm:w-auto'
                >
                  Login
                </Button>
                <Button to='/register' variant='secondary' size='lg' className='w-full sm:w-auto'>
                  Register
                </Button>
                <Button
                  onClick={() => navigate('/dive-trips')}
                  variant='secondary'
                  size='lg'
                  className='w-full sm:w-auto'
                >
                  Back to Trips
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tripError) {
    if (tripError.response?.status === 404) {
      return <NotFound />;
    }
    if (tripError.response?.status === 422) {
      return <UnprocessableEntity />;
    }
    return (
      <div className='text-center py-8'>
        <div className='text-red-600 text-lg mb-4'>Error loading trip details</div>
        <Button onClick={() => navigate('/dive-trips')} variant='primary'>
          Back to Trips
        </Button>
      </div>
    );
  }
  if (!trip) {
    return <NotFound />;
  }
  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
      {trip && (
        <SEO
          title={`Dive Trip - ${generateTripName(trip)}`}
          description={getMetaDescription()}
          type='event'
          siteName='Divemap'
          schema={getSchema()}
        />
      )}
      {trip && (
        <Breadcrumbs
          items={[{ label: 'Dive Trips', to: '/dive-trips' }, { label: generateTripName(trip) }]}
        />
      )}

      <div className='flex flex-wrap justify-end items-center gap-2 mb-4'>
        {trip.is_bookable &&
          trip.octo_slot_id &&
          (isFullyBooked ? (
            <Button
              onClick={() => setIsInquiryModalOpen(true)}
              variant='primary'
              size='sm'
              icon={<MessageSquare className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-200' />}
              className='!bg-amber-600 hover:!bg-amber-700 !text-white font-bold cursor-pointer'
            >
              Inquire for Spots
            </Button>
          ) : (
            <Button
              to={`/book/${trip.octo_slot_id}`}
              variant='primary'
              size='sm'
              icon={<Sparkles className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-200' />}
              className='!bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold'
            >
              Book Online{' '}
              {trip.base_price
                ? `(${trip.base_price.toFixed(2)} ${trip.trip_currency || 'EUR'})`
                : ''}
            </Button>
          ))}

        {shouldShowManage && trip.octo_slot_id && (
          <Button
            to={`/manage/centers/${trip.diving_center_id}/trips/${trip.octo_slot_id}`}
            variant='secondary'
            size='sm'
            icon={<ClipboardList className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600' />}
          >
            Operations & Manifest
          </Button>
        )}

        {/* Share Button (everyone can see) */}
        <Button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `Dive Trip - ${generateTripName(trip)}`,
                text: `Check out this dive trip on Divemap: ${generateTripName(trip)}`,
                url: window.location.href,
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard!');
            }
          }}
          variant='secondary'
          size='sm'
          title='Share trip'
          icon={<Share2 className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
        >
          Share
        </Button>

        {shouldShowManage && (
          <>
            <Button
              onClick={handleEditTrip}
              variant='primary'
              size='sm'
              icon={<Edit className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
            >
              Edit
            </Button>
            <Button
              onClick={handleDeleteTrip}
              variant='danger'
              size='sm'
              icon={<X className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
            >
              Delete
            </Button>
          </>
        )}
      </div>

      <TripHeader trip={trip} />
      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='grid grid-cols-2 sm:flex sm:space-x-8 px-2 sm:px-6'>
            {[
              { id: 'dive-sites', label: 'Dive Sites', icon: MapPin },
              { id: 'overview', label: 'Additional Info', icon: Info },
              { id: 'diving-center', label: 'Diving Center', icon: Building },
              { id: 'booking', label: 'Booking', icon: Ticket },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center justify-center sm:justify-start space-x-1.5 sm:space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {/* Tab Content */}
        <div className='p-4 sm:p-6'>
          {activeTab === 'overview' && (
            <div className='space-y-4 sm:space-y-6'>
              {trip.special_requirements && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>Special Requirements</h3>
                  <RichText
                    content={trip.special_requirements}
                    className='text-gray-700 break-words max-w-full overflow-hidden'
                  />
                </div>
              )}

              {trip.trip_duration && (
                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-3'>Trip Duration</h3>
                  <p className='text-gray-700 leading-relaxed break-words'>
                    {Math.floor(trip.trip_duration / 60)} hours {trip.trip_duration % 60} minutes
                  </p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'dive-sites' && (
            <div className='space-y-4 sm:space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Dive Sites</h3>
              {trip.dives && trip.dives.length > 0 ? (
                <div className='space-y-4'>
                  {trip.dives.map((dive, index) => (
                    <DiveSiteInfo
                      key={`dive-${trip.id}-${dive.dive_site_id || index}`}
                      dive={dive}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <p className='text-gray-500'>No dive sites information available for this trip.</p>
              )}
            </div>
          )}
          {activeTab === 'diving-center' && (
            <div className='space-y-4 sm:space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Diving Center</h3>
              {divingCenter ? (
                <DivingCenterSummaryCard
                  center={divingCenter}
                  user={user}
                  reviewsEnabled={reviewsEnabled}
                />
              ) : (
                <p className='text-gray-500'>Diving center information not available.</p>
              )}
            </div>
          )}{' '}
          {activeTab === 'booking' && (
            <div className='space-y-4 sm:space-y-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>Book This Trip</h3>

              {trip.is_bookable &&
                trip.octo_slot_id &&
                (isFullyBooked ? (
                  <div className='bg-white border-2 border-amber-500 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100'>
                      <div>
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 mb-2'>
                          <AlertCircle className='w-3.5 h-3.5 mr-1 text-amber-600' /> All Online
                          Spots Reserved
                        </span>
                        <h4 className='text-2xl font-black text-gray-900'>Departure Full Online</h4>
                        <p className='text-sm text-gray-600 mt-1 max-w-xl'>
                          Online slots for this departure are currently full. However, dive centers
                          frequently have last-minute schedule changes or reserve unlisted boat
                          spots for direct bookings.
                        </p>
                      </div>

                      <div className='text-left sm:text-right bg-amber-50/60 sm:bg-transparent p-4 sm:p-0 rounded-xl'>
                        <span className='text-xs text-gray-500 font-medium block'>Status</span>
                        <span className='text-xl sm:text-2xl font-black text-amber-700'>
                          Fully Booked
                        </span>
                        <span className='text-xs text-amber-800 font-semibold block mt-0.5'>
                          Inquire for openings / waitlist
                        </span>
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600'>
                      <div className='flex items-start space-x-3'>
                        <Users className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Reserved Boat Capacity</strong>
                          <span>
                            Diving centers often hold extra spots on board that are not listed
                            online.
                          </span>
                        </div>
                      </div>
                      <div className='flex items-start space-x-3'>
                        <Clock className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Cancellation Waitlist</strong>
                          <span>
                            Spots frequently open up 24 to 48 hours prior to departure due to travel
                            adjustments.
                          </span>
                        </div>
                      </div>
                      <div className='flex items-start space-x-3'>
                        <MessageSquare className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Direct Inquiry</strong>
                          <span>
                            Reach out directly via in-app chat, WhatsApp, email, or telephone.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className='pt-2 flex flex-col sm:flex-row items-center gap-4'>
                      <Button
                        onClick={() => setIsInquiryModalOpen(true)}
                        variant='primary'
                        size='lg'
                        className='w-full sm:w-auto !bg-amber-600 hover:!bg-amber-700 !text-white font-bold text-base px-8 py-3.5 shadow-md flex items-center justify-center cursor-pointer'
                      >
                        <MessageSquare className='w-5 h-5 mr-2' />
                        Inquire About Openings / Waitlist
                      </Button>

                      {shouldShowManage && (
                        <Button
                          to={`/manage/centers/${trip.diving_center_id}/trips/${trip.octo_slot_id}`}
                          variant='secondary'
                          size='lg'
                          className='w-full sm:w-auto flex items-center justify-center'
                        >
                          <ClipboardList className='w-4 h-4 mr-2 text-blue-600' />
                          View Manifest & Operations
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className='bg-white border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100'>
                      <div>
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-2'>
                          <Sparkles className='w-3.5 h-3.5 mr-1 text-emerald-600' /> Instant Online
                          Booking
                        </span>
                        <h4 className='text-2xl font-black text-gray-900'>
                          Reserve Your Seat Online
                        </h4>
                        <p className='text-sm text-gray-500 mt-1'>
                          Guaranteed spot confirmation with digital check-in and automated dockside
                          roster.
                        </p>
                      </div>

                      <div className='text-left sm:text-right bg-emerald-50/60 sm:bg-transparent p-4 sm:p-0 rounded-xl'>
                        <span className='text-xs text-gray-500 font-medium block'>
                          Starting From
                        </span>
                        <span className='text-2xl sm:text-3xl font-black text-gray-900'>
                          {trip.base_price
                            ? trip.base_price.toFixed(2)
                            : trip.trip_price || '60.00'}{' '}
                          {trip.trip_currency || 'EUR'}
                        </span>
                        <span className='text-xs text-emerald-700 font-semibold block mt-0.5'>
                          {trip.seats_available !== undefined && trip.seats_available !== null
                            ? `${trip.seats_available} spots remaining`
                            : 'Seats available'}
                        </span>
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600'>
                      <div className='flex items-start space-x-3'>
                        <CheckCircle className='w-5 h-5 text-emerald-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Equipment Options</strong>
                          <span>
                            {trip.different_rental_price === false
                              ? 'Full equipment rental is included in the trip price at no extra charge.'
                              : 'Bring your own dive gear or rent full equipment from the center.'}
                          </span>
                        </div>
                      </div>
                      <div className='flex items-start space-x-3'>
                        <ShieldCheck className='w-5 h-5 text-emerald-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Paperwork Online</strong>
                          <span>
                            Pre-fill encrypted medical questionnaires and sign legal waivers.
                          </span>
                        </div>
                      </div>
                      <div className='flex items-start space-x-3'>
                        <Ticket className='w-5 h-5 text-emerald-600 shrink-0 mt-0.5' />
                        <div>
                          <strong className='text-gray-900 block'>Pay on Arrival</strong>
                          <span>Reserve now without prepayment and settle at the dive center.</span>
                        </div>
                      </div>
                    </div>

                    <div className='pt-2 flex flex-col sm:flex-row items-center gap-4'>
                      <Button
                        to={`/book/${trip.octo_slot_id}`}
                        variant='primary'
                        size='lg'
                        className='w-full sm:w-auto !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-base px-8 py-3.5 shadow-md flex items-center justify-center'
                      >
                        <Sparkles className='w-5 h-5 mr-2' />
                        Proceed to Booking Wizard
                      </Button>

                      {shouldShowManage && (
                        <Button
                          to={`/manage/centers/${trip.diving_center_id}/trips/${trip.octo_slot_id}`}
                          variant='secondary'
                          size='lg'
                          className='w-full sm:w-auto flex items-center justify-center'
                        >
                          <ClipboardList className='w-4 h-4 mr-2 text-blue-600' />
                          View Manifest & Operations
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

              <div className='bg-blue-50 border border-blue-200 rounded-lg p-6'>
                <div className='text-center'>
                  <h4 className='text-lg font-medium text-blue-900 mb-2'>
                    {isFullyBooked
                      ? 'Inquire Directly with the Diving Center'
                      : trip.is_bookable
                        ? 'Questions Before Booking?'
                        : 'Ready to Book?'}
                  </h4>
                  <p className='text-blue-700 mb-4'>
                    {isFullyBooked
                      ? 'Check for unlisted reserved spots, private boat options, or ask to be notified if someone cancels.'
                      : trip.is_bookable
                        ? 'You can contact the diving center directly for custom requests, questions, or private boat charters.'
                        : 'Contact the diving center directly to book this trip and get more information.'}
                  </p>
                  {divingCenter ? (
                    <div className='flex flex-wrap items-center justify-center gap-3'>
                      {divingCenter.phone && (
                        <a
                          href={`https://wa.me/${(divingCenter.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hi ${divingCenter.name}! I noticed online spots are full on Divemap for "${generateTripName(trip)}"${trip.trip_date ? ` on ${formatDate(trip.trip_date)}` : ''}. Do you have any reserved boat spots available or a cancellation waitlist?`
                          )}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center space-x-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold'
                        >
                          <WhatsAppIcon className='w-4 h-4' color='ffffff' />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {divingCenter.phone && (
                        <a
                          href={`tel:${divingCenter.phone}`}
                          className='inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold'
                        >
                          <Phone className='w-4 h-4' />
                          <span>Call {divingCenter.name}</span>
                        </a>
                      )}
                      {divingCenter.email && (
                        <a
                          href={`mailto:${divingCenter.email}?subject=Booking Inquiry: ${generateTripName(trip)}`}
                          className='inline-flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold'
                        >
                          <Mail className='w-4 h-4' />
                          <span>Email Inquiry</span>
                        </a>
                      )}
                      {divingCenter.website && (
                        <a
                          href={divingCenter.website}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center space-x-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold'
                        >
                          <Globe className='w-4 h-4' />
                          <span>Visit Website</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className='text-blue-600'>
                      Please contact the diving center for booking information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Related Trips Section */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4'>Related Trips</h3>
        <p className='text-gray-600 mb-4'>
          Discover more diving adventures from this center or similar destinations.
        </p>
        <Button onClick={() => navigate('/dive-trips')} variant='primary' size='lg'>
          Browse All Trips
        </Button>
      </div>

      {/* Edit Trip Modal */}
      {trip && (
        <TripFormModal
          isOpen={isEditTripModalOpen}
          onClose={() => setIsEditTripModalOpen(false)}
          onSubmit={data => handleUpdateTrip(trip.id, data)}
          trip={trip}
          divingCenterId={trip.diving_center_id}
          isSubmitting={updateTripMutation.isLoading}
          diveSites={diveSites}
          divingCenters={divingCenters}
          additionalDiveSites={additionalDiveSites}
        />
      )}

      {/* Waitlist / Spots Inquiry Modal */}
      {trip && (
        <TripWaitlistInquiryModal
          isOpen={isInquiryModalOpen}
          onClose={() => setIsInquiryModalOpen(false)}
          trip={trip}
          divingCenter={divingCenter}
        />
      )}
    </div>
  );
};
export default TripDetail;
