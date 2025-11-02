import {
  Upload,
  FileText,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  Users,
  Euro,
  AlertCircle,
  Edit,
  Eye,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';

import {
  uploadNewsletter,
  parseNewsletterText,
  getParsedTrips,
  deleteParsedTrip,
  getNewsletters,
  getNewsletter,
  updateNewsletter,
  deleteNewsletter,
  deleteNewsletters,
  extractErrorMessage,
  reparseNewsletter,
  createParsedTrip,
  updateParsedTrip,
  getDiveSites,
  getDivingCenters,
  getDiveSite,
} from '../api';
import TripFormModal from '../components/TripFormModal';
import usePageTitle from '../hooks/usePageTitle';

const AdminNewsletters = () => {
  // Set page title
  usePageTitle('Divemap - Admin - Newsletters');
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active tab from URL, default to 'create'
  const activeTab = searchParams.get('tab') || 'create';

  // Handle tab change
  const handleTabChange = tab => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (tab === 'create') {
      newSearchParams.set('tab', 'create');
    } else if (tab === 'list') {
      newSearchParams.set('tab', 'list');
    } else {
      newSearchParams.delete('tab');
    }
    setSearchParams(newSearchParams);
  };

  const [selectedFile, setSelectedFile] = useState(null);
  const [useOpenai, setUseOpenai] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newsletterText, setNewsletterText] = useState('');
  const [selectedDivingCenterId, setSelectedDivingCenterId] = useState('');
  const [useOpenaiText, setUseOpenaiText] = useState(true);
  const [isParsingText, setIsParsingText] = useState(false);
  const [selectedNewsletters, setSelectedNewsletters] = useState(new Set());
  const [editingNewsletter, setEditingNewsletter] = useState(null);
  const [viewingNewsletter, setViewingNewsletter] = useState(null);
  const [viewingNewsletterTrips, setViewingNewsletterTrips] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [reparsingNewsletter, setReparsingNewsletter] = useState(null);
  const queryClient = useQueryClient();

  // Query for newsletters
  const {
    data: newsletters,
    isLoading: newslettersLoading,
    error: newslettersError,
  } = useQuery('newsletters', () => getNewsletters(), {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query for parsed trips
  const {
    data: trips,
    isLoading: tripsLoading,
    error: tripsError,
  } = useQuery('parsedTrips', () => getParsedTrips(), {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query for dive sites (for dropdown)
  const { data: diveSites = [] } = useQuery('dive-sites', () => getDiveSites({ page_size: 100 }), {
    refetchInterval: 30000, // Refetch every 30 seconds
  });

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

  // State to store additional dive sites that are not in the main list
  const [additionalDiveSites, setAdditionalDiveSites] = useState([]);
  const [selectedNewsletterFilter, setSelectedNewsletterFilter] = useState(null);

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

  // Query for diving centers (for dropdown)
  const { data: divingCenters = [] } = useQuery(
    'diving-centers',
    () => getDivingCenters({ page_size: 100 }),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Upload mutation
  const uploadMutation = useMutation(uploadNewsletter, {
    onSuccess: data => {
      toast.success(`Newsletter uploaded successfully! ${data.trips_created} trips created.`);
      setSelectedFile(null);
      queryClient.invalidateQueries('parsedTrips');
      queryClient.invalidateQueries('newsletters');
    },
    onError: error => {
      toast.error(`Upload failed: ${extractErrorMessage(error)}`);
    },
  });

  // Parse text mutation
  const parseTextMutation = useMutation(
    ({ content, divingCenterId, useOpenai }) =>
      parseNewsletterText(content, divingCenterId || null, useOpenai),
    {
      onSuccess: data => {
        toast.success(`Newsletter text parsed successfully! ${data.trips_created} trips created.`);
        setNewsletterText('');
        setSelectedDivingCenterId('');
        queryClient.invalidateQueries('parsedTrips');
        queryClient.invalidateQueries('newsletters');
      },
      onError: error => {
        toast.error(`Parse failed: ${extractErrorMessage(error)}`);
      },
    }
  );

  // Re-parse newsletter mutation
  const reparseMutation = useMutation(
    ({ newsletterId, useOpenai }) => reparseNewsletter(newsletterId, useOpenai),
    {
      onSuccess: data => {
        toast.success(data.message);
        setReparsingNewsletter(null);
        queryClient.invalidateQueries('parsedTrips');
        queryClient.invalidateQueries('newsletters');
      },
      onError: error => {
        toast.error(`Re-parse failed: ${extractErrorMessage(error)}`);
        setReparsingNewsletter(null);
      },
    }
  );

  // Delete trip mutation
  const deleteTripMutation = useMutation(deleteParsedTrip, {
    onSuccess: () => {
      toast.success('Trip deleted successfully');
      queryClient.invalidateQueries('parsedTrips');
    },
    onError: error => {
      toast.error(`Delete failed: ${extractErrorMessage(error)}`);
    },
  });

  // Create trip mutation
  const createTripMutation = useMutation(createParsedTrip, {
    onSuccess: () => {
      toast.success('Trip created successfully');
      setCreatingTrip(false);
      queryClient.invalidateQueries('parsedTrips');
    },
    onError: error => {
      toast.error(`Create failed: ${extractErrorMessage(error)}`);
    },
  });

  // Update trip mutation
  const updateTripMutation = useMutation(({ tripId, data }) => updateParsedTrip(tripId, data), {
    onSuccess: () => {
      toast.success('Trip updated successfully');
      setEditingTrip(null);
      queryClient.invalidateQueries('parsedTrips');
    },
    onError: error => {
      toast.error(`Update failed: ${extractErrorMessage(error)}`);
    },
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation(deleteNewsletter, {
    onSuccess: () => {
      toast.success('Newsletter deleted successfully');
      queryClient.invalidateQueries('newsletters');
      queryClient.invalidateQueries('parsedTrips');
    },
    onError: error => {
      toast.error(`Delete failed: ${extractErrorMessage(error)}`);
    },
  });

  // Mass delete newsletters mutation
  const massDeleteNewslettersMutation = useMutation(deleteNewsletters, {
    onSuccess: data => {
      toast.success(data.message);
      setSelectedNewsletters(new Set());
      queryClient.invalidateQueries('newsletters');
      queryClient.invalidateQueries('parsedTrips');
    },
    onError: error => {
      toast.error(`Mass delete failed: ${extractErrorMessage(error)}`);
    },
  });

  // Update newsletter mutation
  const updateNewsletterMutation = useMutation(
    ({ newsletterId, data }) => updateNewsletter(newsletterId, data),
    {
      onSuccess: () => {
        toast.success('Newsletter updated successfully');
        setEditingNewsletter(null);
        queryClient.invalidateQueries('newsletters');
      },
      onError: error => {
        toast.error(`Update failed: ${extractErrorMessage(error)}`);
      },
    }
  );

  const handleFileChange = event => {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
      setSelectedFile(file);
    } else {
      toast.error('Please select a valid .txt file');
      event.target.value = null;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(selectedFile, useOpenai);
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseText = async () => {
    if (!newsletterText || !newsletterText.trim()) {
      toast.error('Please enter newsletter content to parse');
      return;
    }

    setIsParsingText(true);
    try {
      await parseTextMutation.mutateAsync({
        content: newsletterText,
        divingCenterId: selectedDivingCenterId ? parseInt(selectedDivingCenterId) : null,
        useOpenai: useOpenaiText,
      });
    } finally {
      setIsParsingText(false);
    }
  };

  const handleReparseNewsletter = async newsletterId => {
    if (
      window.confirm(
        'Are you sure you want to re-parse this newsletter? This will delete existing trips and create new ones.'
      )
    ) {
      setReparsingNewsletter(newsletterId);
      try {
        await reparseMutation.mutateAsync({ newsletterId, useOpenai });
      } catch (error) {
        // Error is handled in the mutation
      }
    }
  };

  const handleDeleteTrip = tripId => {
    if (window.confirm('Are you sure you want to delete this trip?')) {
      deleteTripMutation.mutate(tripId);
    }
  };

  const handleCreateTrip = async tripData => {
    try {
      await createTripMutation.mutateAsync(tripData);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleUpdateTrip = async (tripId, tripData) => {
    try {
      await updateTripMutation.mutateAsync({ tripId, data: tripData });
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleDeleteNewsletter = newsletterId => {
    if (
      window.confirm(
        'Are you sure you want to delete this newsletter and all its associated trips?'
      )
    ) {
      deleteNewsletterMutation.mutate(newsletterId);
    }
  };

  const handleMassDeleteNewsletters = () => {
    if (selectedNewsletters.size === 0) {
      toast.error('Please select newsletters to delete');
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedNewsletters.size} newsletters and all their associated trips?`
      )
    ) {
      massDeleteNewslettersMutation.mutate(Array.from(selectedNewsletters));
    }
  };

  const handleSelectAllNewsletters = () => {
    if (newsletters && selectedNewsletters.size === newsletters.length) {
      setSelectedNewsletters(new Set());
    } else {
      setSelectedNewsletters(new Set(newsletters?.map(n => n.id) || []));
    }
  };

  const handleSelectNewsletter = newsletterId => {
    const newSelected = new Set(selectedNewsletters);
    if (newSelected.has(newsletterId)) {
      newSelected.delete(newsletterId);
    } else {
      newSelected.add(newsletterId);
    }
    setSelectedNewsletters(newSelected);
  };

  const handleEditNewsletter = newsletter => {
    setEditingNewsletter(newsletter);
  };

  const handleViewNewsletter = async newsletterId => {
    try {
      const newsletter = await getNewsletter(newsletterId);
      setViewingNewsletter(newsletter);
    } catch (error) {
      toast.error(`Failed to load newsletter: ${extractErrorMessage(error)}`);
    }
  };

  const handleViewNewsletterTrips = newsletterId => {
    setViewingNewsletterTrips(newsletterId);
  };

  const handleUpdateNewsletter = async (newsletterId, content) => {
    await updateNewsletterMutation.mutateAsync({ newsletterId, data: { content } });
  };

  const handleEditTrip = trip => {
    // Ensure the dive site is available in the dropdown
    if (trip.dive_site_id) {
      ensureDiveSiteAvailable(trip.dive_site_id);
    }
    setEditingTrip(trip);
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatTime = timeString => {
    if (!timeString) return 'N/A';
    return timeString.substring(0, 5); // Extract HH:MM from HH:MM:SS
  };

  const formatCurrency = (price, currency = 'EUR') => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  // Function to determine the display status based on trip date
  const getDisplayStatus = trip => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    const tripDate = new Date(trip.trip_date);
    tripDate.setHours(0, 0, 0, 0);

    // If the trip date is in the past and status is 'scheduled', show 'completed'
    if (tripDate < today && trip.trip_status === 'scheduled') {
      return 'completed';
    }

    return trip.trip_status;
  };

  return (
    <div className='max-w-6xl mx-auto p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Newsletter Management</h1>
        <p className='text-gray-600 mt-2'>Upload and manage dive trip newsletters</p>
      </div>

      {/* Tab Navigation */}
      <div className='bg-white rounded-lg shadow-md mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8 px-6'>
            <button
              onClick={() => handleTabChange('create')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Newsletter
            </button>
            <button
              onClick={() => handleTabChange('list')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              List Newsletters
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <div className='space-y-6'>
          {/* Upload Section */}
          <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>Upload Newsletter</h2>

            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='newsletter-file'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Newsletter File (.txt only)
                </label>
                <div className='flex items-center space-x-4'>
                  <input
                    id='newsletter-file'
                    type='file'
                    accept='.txt'
                    onChange={handleFileChange}
                    className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                  />
                  {selectedFile && (
                    <div className='flex items-center text-sm text-gray-600'>
                      <FileText className='h-4 w-4 mr-2' />
                      {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='useOpenai'
                  checked={useOpenai}
                  onChange={e => setUseOpenai(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <label htmlFor='useOpenai' className='text-sm text-gray-700'>
                  Use OpenAI for parsing (recommended)
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Upload className='h-4 w-4 mr-2' />
                {isUploading ? 'Uploading...' : 'Upload Newsletter'}
              </button>
            </div>
          </div>

          {/* Parse Text Section */}
          <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
            <h2 className='text-xl font-semibold text-gray-900 mb-4'>Parse Newsletter Text</h2>

            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='diving-center-select'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Diving Center (Optional)
                </label>
                <select
                  id='diving-center-select'
                  value={selectedDivingCenterId}
                  onChange={e => setSelectedDivingCenterId(e.target.value)}
                  className='w-full p-2 border border-gray-300 rounded-md text-sm'
                >
                  <option value=''>Select diving center (optional)</option>
                  {divingCenters.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
                <p className='text-xs text-gray-500 mt-1'>
                  Select the diving center organizing this trip. If not selected, the system will
                  try to extract it from the text.
                </p>
              </div>

              <div>
                <label
                  htmlFor='newsletter-text'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Newsletter Content
                </label>
                <textarea
                  id='newsletter-text'
                  value={newsletterText}
                  onChange={e => setNewsletterText(e.target.value)}
                  placeholder='Paste newsletter content here...'
                  className='w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                />
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='useOpenaiText'
                  checked={useOpenaiText}
                  onChange={e => setUseOpenaiText(e.target.checked)}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <label htmlFor='useOpenaiText' className='text-sm text-gray-700'>
                  Use OpenAI for parsing (recommended)
                </label>
              </div>

              <button
                onClick={handleParseText}
                disabled={!newsletterText || !newsletterText.trim() || isParsingText}
                className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <FileText className='h-4 w-4 mr-2' />
                {isParsingText ? 'Parsing...' : 'Parse Newsletter Text'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <div className='space-y-6'>
          {/* Newsletters Section */}
          <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-semibold text-gray-900'>Newsletters</h2>
              {selectedNewsletters.size > 0 && (
                <button
                  onClick={handleMassDeleteNewsletters}
                  className='flex items-center px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm'
                >
                  <Trash2 className='h-4 w-4 mr-1' />
                  Delete Selected ({selectedNewsletters.size})
                </button>
              )}
            </div>

            {newslettersLoading && (
              <div className='text-center py-8'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                <p className='text-gray-600 mt-2'>Loading newsletters...</p>
              </div>
            )}

            {newslettersError && (
              <div className='text-center py-8'>
                <AlertCircle className='h-8 w-8 text-red-500 mx-auto mb-2' />
                <p className='text-red-600'>Error loading newsletters</p>
              </div>
            )}

            {newsletters && newsletters.length === 0 && (
              <div className='text-center py-8'>
                <FileText className='h-8 w-8 text-gray-400 mx-auto mb-2' />
                <p className='text-gray-600'>No newsletters found</p>
              </div>
            )}

            {newsletters && newsletters.length > 0 && (
              <div className='space-y-4'>
                {/* Select All */}
                <div className='flex items-center space-x-2 p-2 bg-gray-50 rounded'>
                  <input
                    type='checkbox'
                    checked={selectedNewsletters.size === newsletters.length}
                    onChange={handleSelectAllNewsletters}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                  <span className='text-sm text-gray-700'>Select All</span>
                </div>

                {newsletters.map(newsletter => {
                  // Get trips for this newsletter
                  const newsletterTrips =
                    trips?.filter(trip => trip.source_newsletter_id === newsletter.id) || [];

                  // Extract unique diving center names
                  const divingCenterNames = [
                    ...new Set(
                      newsletterTrips.map(trip => trip.diving_center_name).filter(name => name)
                    ),
                  ];

                  // Extract and sort trip dates
                  const tripDates = newsletterTrips
                    .map(trip => trip.trip_date)
                    .filter(date => date)
                    .sort((a, b) => new Date(a) - new Date(b))
                    .map(date => formatDate(date));

                  return (
                    <div key={newsletter.id} className='border rounded-lg p-4 hover:bg-gray-50'>
                      <div className='flex items-center space-x-4'>
                        <input
                          type='checkbox'
                          checked={selectedNewsletters.has(newsletter.id)}
                          onChange={() => handleSelectNewsletter(newsletter.id)}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        />

                        <div className='flex-1'>
                          <div className='flex items-center justify-between'>
                            <div>
                              <h3 className='text-lg font-semibold text-gray-900'>
                                Newsletter #{newsletter.id}
                              </h3>
                              <p className='text-sm text-gray-600'>
                                Received: {formatDate(newsletter.received_at)}
                              </p>
                              <p className='text-sm text-gray-600'>
                                Trips extracted: {newsletter.trips_count}
                              </p>
                              {divingCenterNames.length > 0 && (
                                <p className='text-sm text-gray-700 font-medium mt-1'>
                                  Diving Center: {divingCenterNames.join(', ')}
                                </p>
                              )}
                              {tripDates.length > 0 && (
                                <p className='text-sm text-gray-600 mt-1'>
                                  Trip dates:{' '}
                                  {tripDates.length <= 3
                                    ? tripDates.join(', ')
                                    : `${tripDates.slice(0, 3).join(', ')} and ${tripDates.length - 3} more`}
                                </p>
                              )}
                            </div>

                            <div className='flex items-center space-x-2'>
                              <button
                                onClick={() => handleReparseNewsletter(newsletter.id)}
                                disabled={reparsingNewsletter === newsletter.id}
                                className='p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded disabled:opacity-50'
                                title='Re-parse newsletter'
                              >
                                <RefreshCw
                                  className={`h-4 w-4 ${reparsingNewsletter === newsletter.id ? 'animate-spin' : ''}`}
                                />
                              </button>

                              <button
                                onClick={() => handleViewNewsletter(newsletter.id)}
                                className='p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded'
                                title='View raw newsletter text'
                              >
                                <Eye className='h-4 w-4' />
                              </button>

                              <button
                                onClick={() => handleEditNewsletter(newsletter)}
                                className='p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded'
                                title='Edit newsletter text'
                              >
                                <Edit className='h-4 w-4' />
                              </button>

                              <button
                                onClick={() => handleViewNewsletterTrips(newsletter.id)}
                                className='p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded'
                                title='View parsed dive trip information'
                              >
                                <FileText className='h-4 w-4' />
                              </button>

                              <button
                                onClick={() => handleDeleteNewsletter(newsletter.id)}
                                className='p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded'
                                title='Delete newsletter + associated dive trips'
                              >
                                <Trash2 className='h-4 w-4' />
                              </button>
                            </div>
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
      )}

      {/* View Newsletter Trips Modal */}
      {viewingNewsletterTrips && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>
                Parsed Dive Trips - Newsletter #{viewingNewsletterTrips}
              </h3>
              <button
                onClick={() => setViewingNewsletterTrips(null)}
                className='text-gray-500 hover:text-gray-700'
              >
                ×
              </button>
            </div>

            {tripsLoading && (
              <div className='text-center py-8'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                <p className='text-gray-600 mt-2'>Loading trips...</p>
              </div>
            )}

            {tripsError && (
              <div className='text-center py-8'>
                <AlertCircle className='h-8 w-8 text-red-500 mx-auto mb-2' />
                <p className='text-red-600'>Error loading trips</p>
              </div>
            )}

            {(() => {
              const newsletterTrips =
                trips?.filter(trip => trip.source_newsletter_id === viewingNewsletterTrips) || [];

              if (newsletterTrips.length === 0) {
                return (
                  <div className='text-center py-8'>
                    <FileText className='h-8 w-8 text-gray-400 mx-auto mb-2' />
                    <p className='text-gray-600'>No trips found for this newsletter</p>
                  </div>
                );
              }

              return (
                <div className='space-y-4'>
                  <div className='flex justify-between items-center mb-4'>
                    <p className='text-sm text-gray-600'>
                      Found {newsletterTrips.length} trip{newsletterTrips.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => setCreatingTrip(true)}
                      className='flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm'
                    >
                      <Plus className='h-4 w-4 mr-1' />
                      Add Trip
                    </button>
                  </div>

                  {newsletterTrips.map(trip => (
                    <div key={trip.id} className='border rounded-lg p-4 hover:bg-gray-50'>
                      <div className='flex justify-between items-start'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-4 mb-2'>
                            <h4 className='text-lg font-semibold text-gray-900'>
                              {trip.diving_center_name || 'Unknown Center'}
                            </h4>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                getDisplayStatus(trip) === 'scheduled'
                                  ? 'bg-green-100 text-green-800'
                                  : getDisplayStatus(trip) === 'confirmed'
                                    ? 'bg-blue-100 text-blue-800'
                                    : getDisplayStatus(trip) === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : getDisplayStatus(trip) === 'completed'
                                        ? 'bg-gray-100 text-gray-800'
                                        : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {getDisplayStatus(trip)}
                            </span>
                          </div>

                          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600'>
                            <div className='flex items-center'>
                              <Calendar className='h-4 w-4 mr-2' />
                              <span>{formatDate(trip.trip_date)}</span>
                            </div>

                            <div className='flex items-center'>
                              <Clock className='h-4 w-4 mr-2' />
                              <span>{formatTime(trip.trip_time)}</span>
                            </div>

                            {trip.trip_duration && (
                              <div className='flex items-center'>
                                <Clock className='h-4 w-4 mr-2' />
                                <span>{trip.trip_duration} min</span>
                              </div>
                            )}

                            {trip.trip_price && (
                              <div className='flex items-center'>
                                <Euro className='h-4 w-4 mr-2' />
                                <span>{formatCurrency(trip.trip_price, trip.trip_currency)}</span>
                              </div>
                            )}

                            {trip.group_size_limit && (
                              <div className='flex items-center'>
                                <Users className='h-4 w-4 mr-2' />
                                <span>Max {trip.group_size_limit} people</span>
                              </div>
                            )}
                          </div>

                          {/* Display multiple dives */}
                          {trip.dives && trip.dives.length > 0 && (
                            <div className='mt-3'>
                              <h5 className='text-sm font-medium text-gray-700 mb-2'>Dives:</h5>
                              <div className='space-y-2'>
                                {trip.dives.map((dive, _index) => (
                                  <div
                                    key={dive.id}
                                    className='flex items-center space-x-3 p-2 bg-blue-50 rounded'
                                  >
                                    <div className='flex items-center'>
                                      <MapPin className='h-4 w-4 mr-2 text-blue-600' />
                                      <span className='text-sm font-medium text-gray-700'>
                                        Dive {dive.dive_number}:
                                      </span>
                                    </div>
                                    <div className='flex-1'>
                                      <span className='text-sm text-gray-600'>
                                        {dive.dive_site_name || 'No dive site specified'}
                                      </span>
                                      {dive.dive_time && (
                                        <span className='text-sm text-gray-500 ml-2'>
                                          at {formatTime(dive.dive_time)}
                                        </span>
                                      )}
                                      {dive.dive_duration && (
                                        <span className='text-sm text-gray-500 ml-2'>
                                          ({dive.dive_duration} min)
                                        </span>
                                      )}
                                    </div>
                                    {dive.dive_description && (
                                      <div className='text-xs text-gray-500 mt-1'>
                                        {dive.dive_description}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Fallback for old single dive site display */}
                          {(!trip.dives || trip.dives.length === 0) && trip.dive_site_name && (
                            <div className='flex items-center mt-2'>
                              <MapPin className='h-4 w-4 mr-2' />
                              <span className='text-sm text-gray-600'>{trip.dive_site_name}</span>
                            </div>
                          )}

                          {trip.trip_description && (
                            <p className='text-gray-700 mt-2'>{trip.trip_description}</p>
                          )}

                          {trip.special_requirements && (
                            <div className='mt-2 p-2 bg-yellow-50 rounded'>
                              <p className='text-sm text-yellow-800'>{trip.special_requirements}</p>
                            </div>
                          )}
                        </div>

                        <div className='flex items-center space-x-2 ml-4'>
                          <button
                            onClick={() => handleEditTrip(trip)}
                            className='p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded'
                            title='Edit trip'
                          >
                            <Edit className='h-4 w-4' />
                          </button>

                          <button
                            onClick={() => handleDeleteTrip(trip.id)}
                            className='p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded'
                            title='Delete trip'
                          >
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      </div>

                      <div className='mt-2 text-xs text-gray-500'>
                        <span>Extracted: {new Date(trip.extracted_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals - Outside tab content */}
      {editingNewsletter && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>Edit Newsletter #{editingNewsletter.id}</h3>
              <button
                onClick={() => setEditingNewsletter(null)}
                className='text-gray-500 hover:text-gray-700'
              >
                ✕
              </button>
            </div>

            <textarea
              value={editingNewsletter.content}
              onChange={e =>
                setEditingNewsletter({ ...editingNewsletter, content: e.target.value })
              }
              className='w-full h-64 p-2 border rounded-md font-mono text-sm'
              placeholder='Newsletter content...'
            />

            <div className='flex justify-end space-x-2 mt-4'>
              <button
                onClick={() => setEditingNewsletter(null)}
                className='px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleUpdateNewsletter(editingNewsletter.id, editingNewsletter.content)
                }
                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Newsletter Modal */}
      {viewingNewsletter && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-semibold'>Newsletter #{viewingNewsletter.id}</h3>
              <button
                onClick={() => setViewingNewsletter(null)}
                className='text-gray-500 hover:text-gray-700'
              >
                ✕
              </button>
            </div>

            <div className='mb-4 text-sm text-gray-600'>
              <p>Received: {formatDate(viewingNewsletter.received_at)}</p>
              <p>Trips extracted: {viewingNewsletter.trips_count}</p>
            </div>

            <pre className='w-full p-4 bg-gray-50 rounded-md font-mono text-sm overflow-x-auto'>
              {viewingNewsletter.content}
            </pre>

            <div className='flex justify-end mt-4'>
              <button
                onClick={() => setViewingNewsletter(null)}
                className='px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Trip Modal */}
      {creatingTrip && (
        <TripFormModal
          trip={null}
          onSubmit={handleCreateTrip}
          onCancel={() => setCreatingTrip(false)}
          title='Create New Dive Trip'
          diveSites={diveSites}
          divingCenters={divingCenters}
          additionalDiveSites={additionalDiveSites}
          isModal={true}
        />
      )}

      {/* Edit Trip Modal */}
      {editingTrip && (
        <TripFormModal
          trip={editingTrip}
          onSubmit={tripData => handleUpdateTrip(editingTrip.id, tripData)}
          onCancel={() => setEditingTrip(null)}
          title='Edit Dive Trip'
          diveSites={diveSites}
          divingCenters={divingCenters}
          additionalDiveSites={additionalDiveSites}
          isModal={true}
        />
      )}
    </div>
  );
};

export default AdminNewsletters;
