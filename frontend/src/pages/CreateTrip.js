import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { createParsedTrip, getDiveSites, getDivingCenters, getDiveSite } from '../api';
import TripFormModal from '../components/TripFormModal';
import usePageTitle from '../hooks/usePageTitle';

const CreateTrip = () => {
  usePageTitle('Divemap - Create Dive Trip');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // State for additional dive sites
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);

  // Fetch dive sites and diving centers
  const { data: diveSites = [] } = useQuery('dive-sites', () => getDiveSites({ page_size: 100 }), {
    refetchInterval: 30000,
  });

  const { data: divingCenters = [] } = useQuery(
    'diving-centers',
    () => getDivingCenters({ page_size: 100 }),
    {
      refetchInterval: 30000,
    }
  );

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
      const errorMessage =
        error.response?.data?.detail || error.message || 'Failed to create dive trip';
      toast.error(errorMessage);
    },
  });

  const handleCreateTrip = async tripData => {
    try {
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

      {/* Trip Form - Standalone */}
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
    </div>
  );
};

export default CreateTrip;

