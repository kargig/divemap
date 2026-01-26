import { ArrowLeft, Upload as UploadIcon, FileEdit } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import { getDiveSites, getDiveSite } from '../api';
import NewsletterUpload from '../components/NewsletterUpload';
import TripFormModal from '../components/TripFormModal';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getDivingCenters } from '../services/divingCenters';
import { createParsedTrip } from '../services/newsletters';
import { extractErrorMessage } from '../utils/apiErrors';

const CreateTrip = () => {
  usePageTitle('Divemap - Create Dive Trip');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL, default to 'newsletter'
  const activeTab = searchParams.get('tab') || 'newsletter';

  // Handle tab change
  const handleTabChange = tab => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (tab === 'newsletter') {
      newSearchParams.delete('tab');
    } else {
      newSearchParams.set('tab', tab);
    }
    setSearchParams(newSearchParams);
  };

  // State for additional dive sites
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);

  // Fetch dive sites and diving centers
  const { data: diveSites = [] } = useQuery('dive-sites', () => getDiveSites({ page_size: 100 }), {
    refetchInterval: 30000,
  });

  const { data: allDivingCenters = [] } = useQuery(
    'diving-centers',
    () => getDivingCenters({ page_size: 100 }),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch user's owned diving centers
  const { data: ownedCenters = [] } = useQuery(
    ['user-owned-centers', user?.id],
    async () => {
      if (!user || user.is_admin || user.is_moderator) return [];
      // Fetch all diving centers and filter by owner
      const centers = await getDivingCenters({ page_size: 1000 });
      // Filter centers where the user is the approved owner (check both owner_id and owner_username)
      // Only 'approved' status means the user is truly an owner
      return centers.filter(
        center =>
          (center.owner_id === user.id || center.owner_username === user.username) &&
          center.ownership_status === 'approved'
      );
    },
    {
      enabled: !!user && !user.is_admin && !user.is_moderator,
      refetchInterval: 30000,
    }
  );

  // Filter diving centers based on user role
  const divingCenters = (() => {
    if (!user) return [];
    if (user.is_admin || user.is_moderator) {
      // Admins and moderators can see all diving centers
      return allDivingCenters;
    }
    // Owners can only see their own diving centers
    return ownedCenters;
  })();

  // Check if user has permission - owner must have at least one approved center
  const hasOwnedCenters = ownedCenters.length > 0 || user?.is_admin || user?.is_moderator;

  // Check if user has permission to create trips
  const canCreateTrips = user && (user.is_admin || user.is_moderator || hasOwnedCenters);

  // Function to get dive site by ID if not in the list
  const getDiveSiteById = async siteId => {
    if (!siteId) return;
    try {
      const site = await getDiveSite(siteId);
      return site;
    } catch (error) {
      console.error('Error fetching dive site by ID:', error);
    }
    return null;
  };

  // Create trip mutation
  const createTripMutation = useMutation(createParsedTrip, {
    onSuccess: data => {
      queryClient.invalidateQueries('parsedTrips');
      toast.success('Dive trip created successfully!');
      // Navigate back or to the trip detail page
      const from = location.state?.from;
      if (from) {
        navigate(from);
      } else {
        navigate('/dive-trips');
      }
    },
    onError: error => {
      const errorMessage = extractErrorMessage(error) || 'Failed to create dive trip';
      toast.error(errorMessage);
    },
  });

  const handleCreateTrip = async tripData => {
    try {
      // If user is owner (not admin/moderator), ensure they can only create trips for their centers
      if (user && !user.is_admin && !user.is_moderator) {
        if (ownedCenters.length > 0) {
          const ownedIds = ownedCenters.map(dc => dc.id);
          if (tripData.diving_center_id && !ownedIds.includes(tripData.diving_center_id)) {
            toast.error('You can only create trips for your own diving centers');
            return;
          }
          // If no diving center selected, default to first owned center
          if (!tripData.diving_center_id && ownedIds.length > 0) {
            tripData.diving_center_id = ownedIds[0];
          }
        } else {
          toast.error('You must own at least one approved diving center to create trips');
          return;
        }
      }

      await createTripMutation.mutateAsync(tripData);
    } catch (error) {
      // Error is handled by onError callback
      console.error('Error creating trip:', error);
    }
  };

  // Function to load dive site if needed (for additionalDiveSites)
  const loadDiveSiteIfNeeded = async siteId => {
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

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  // Check access - redirect if user doesn't have permission
  if (!user) {
    return (
      <div className='max-w-6xl mx-auto py-8'>
        <div className='bg-white rounded-lg shadow-md p-6 text-center'>
          <h2 className='text-xl font-semibold text-gray-900 mb-4'>Access Denied</h2>
          <p className='text-gray-600 mb-4'>You must be logged in to create dive trips.</p>
          <button
            onClick={() => navigate('/login')}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!canCreateTrips) {
    return (
      <div className='max-w-6xl mx-auto py-8'>
        <div className='bg-white rounded-lg shadow-md p-6 text-center'>
          <h2 className='text-xl font-semibold text-gray-900 mb-4'>Access Denied</h2>
          <p className='text-gray-600 mb-4'>
            You must be an admin, moderator, or own an approved diving center to create dive trips.
          </p>
          <button
            onClick={() => navigate('/dive-trips')}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Back to Trips
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto py-8'>
      {/* Back Button */}
      <button
        onClick={() => {
          const from = location.state?.from;
          if (from) {
            navigate(from);
          } else {
            navigate('/dive-trips');
          }
        }}
        className='flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors'
      >
        <ArrowLeft className='w-4 h-4' />
        <span>Back to Trips</span>
      </button>

      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Create Dive Trip</h1>
        <p className='text-gray-600 mt-2'>Upload newsletter or create a dive trip manually</p>
      </div>

      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-md mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>
            <button
              onClick={() => handleTabChange('newsletter')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'newsletter'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UploadIcon className='w-4 h-4' />
              <span>Upload/Paste Newsletter</span>
            </button>
            <button
              onClick={() => handleTabChange('form')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === 'form'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileEdit className='w-4 h-4' />
              <span>Create Trip Form</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'newsletter' && (
        <NewsletterUpload
          divingCenters={divingCenters}
          onSuccess={() => {
            // Optionally navigate or show success message
            queryClient.invalidateQueries('parsedTrips');
          }}
        />
      )}

      {activeTab === 'form' && (
        <TripFormModal
          trip={null}
          onSubmit={handleCreateTrip}
          onCancel={() => {
            const from = location.state?.from;
            if (from) {
              navigate(from);
            } else {
              navigate('/dive-trips');
            }
          }}
          title='Create New Dive Trip'
          diveSites={diveSites}
          divingCenters={divingCenters}
          additionalDiveSites={additionalDiveSites}
          isModal={false}
        />
      )}
    </div>
  );
};

export default CreateTrip;
