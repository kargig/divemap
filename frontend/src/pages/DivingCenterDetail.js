import {
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Edit,
  Award,
  Crown,
  AlertCircle,
  X,
  ArrowLeft,
  ExternalLink,
  Navigation,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';

import api, { claimDivingCenterOwnership, getParsedTrips } from '../api';
import MaskedEmail from '../components/MaskedEmail';
import RateLimitError from '../components/RateLimitError';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { useSetting } from '../hooks/useSettings';
import { handleRateLimitError } from '../utils/rateLimitHandler';

// Helper function to safely extract error message
const getErrorMessage = error => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const DivingCenterDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showOwnershipClaim, setShowOwnershipClaim] = useState(false);
  const [ownershipReason, setOwnershipReason] = useState('');
  const [tripsDateRange, setTripsDateRange] = useState(() => {
    // Start with current date, going back 3 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    return { startDate, endDate };
  });

  // Fetch diving center details
  const {
    data: center,
    isLoading,
    error,
  } = useQuery(
    ['diving-center', id],
    () => api.get(`/api/v1/diving-centers/${id}`).then(response => response.data),
    {
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'diving center details', () => window.location.reload());
  }, [error]);

  // Set dynamic page title
  const pageTitle = center
    ? `Divemap - Diving Centers - ${center.name}`
    : 'Divemap - Diving Center Details';

  usePageTitle(pageTitle, !isLoading);

  // Check if user has edit privileges
  const canEdit =
    user &&
    center &&
    (user.is_admin ||
      user.is_moderator ||
      (center.owner_username === user.username && center.ownership_status === 'approved'));

  // Fetch center organizations
  const { data: organizations = [], isLoading: orgLoading } = useQuery(
    ['diving-center-organizations', id],
    () => api.get(`/api/v1/diving-centers/${id}/organizations`).then(res => res.data),
    {
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Fetch reviews disabled setting
  const { data: reviewsDisabledSetting } = useSetting('disable_diving_center_reviews');
  // Calculate if reviews are enabled (setting value false = enabled)
  const reviewsEnabled = reviewsDisabledSetting?.value === false;

  // Set initial rating to user's previous rating if available
  useEffect(() => {
    if (center) {
      if (center.user_rating) {
        setRating(center.user_rating);
      } else {
        setRating(0); // Reset to 0 if user hasn't rated this diving center
      }
    }
  }, [center]);

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery(
    ['diving-center-comments', id],
    () => api.get(`/api/v1/diving-centers/${id}/comments`),
    {
      select: response => response.data,
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Helper to format date
  const formatDate = date => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Helper to format date for API (YYYY-MM-DD)
  const formatDateForAPI = date => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Helper to format date range for display
  const formatDateRange = () => {
    const start = formatDate(tripsDateRange.startDate);
    const end = formatDate(tripsDateRange.endDate);
    return `${start} - ${end}`;
  };

  // Navigate trips date ranges (3 months at a time)
  const navigateTripsRange = direction => {
    setTripsDateRange(prev => {
      const newStartDate = new Date(prev.startDate);
      const newEndDate = new Date(prev.endDate);

      if (direction === 'next') {
        // Move forward 3 months
        newStartDate.setMonth(newStartDate.getMonth() + 3);
        newEndDate.setMonth(newEndDate.getMonth() + 3);
      } else {
        // Move backward 3 months
        newStartDate.setMonth(newStartDate.getMonth() - 3);
        newEndDate.setMonth(newEndDate.getMonth() - 3);
      }

      return { startDate: newStartDate, endDate: newEndDate };
    });
  };

  // Fetch dive trips for this diving center within the date range
  const { data: trips, isLoading: tripsLoading } = useQuery(
    ['diving-center-trips', id, tripsDateRange.startDate, tripsDateRange.endDate],
    () =>
      getParsedTrips({
        diving_center_id: parseInt(id),
        start_date: formatDateForAPI(tripsDateRange.startDate),
        end_date: formatDateForAPI(tripsDateRange.endDate),
        limit: 100,
        sort_by: 'trip_date',
        sort_order: 'desc',
      }),
    {
      enabled: !!id,
      retry: 2,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

  // Rating mutation
  const rateMutation = useMutation(
    ({ score }) => api.post(`/api/v1/diving-centers/${id}/rate`, { score }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center', id]);
        toast.success('Rating submitted successfully!');
        setRating(0);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to submit rating');
      },
    }
  );

  // Comment mutations
  const createCommentMutation = useMutation(
    commentText => api.post(`/api/v1/diving-centers/${id}/comments`, { comment_text: commentText }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        setNewComment('');
        toast.success('Comment added successfully!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to add comment');
      },
    }
  );

  const updateCommentMutation = useMutation(
    ({ commentId, commentText }) =>
      api.put(`/api/v1/diving-centers/${id}/comments/${commentId}`, { comment_text: commentText }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        setEditingComment(null);
        setEditCommentText('');
        toast.success('Comment updated successfully!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to update comment');
      },
    }
  );

  const deleteCommentMutation = useMutation(
    commentId => api.delete(`/api/v1/diving-centers/${id}/comments/${commentId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        toast.success('Comment deleted successfully!');
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to delete comment');
      },
    }
  );

  // Ownership claim mutation
  const ownershipClaimMutation = useMutation(reason => claimDivingCenterOwnership(id, { reason }), {
    onSuccess: () => {
      queryClient.invalidateQueries(['diving-center', id]);
      setShowOwnershipClaim(false);
      setOwnershipReason('');
      toast.success('Ownership claim submitted successfully! Waiting for admin approval.');
    },
    onError: error => {
      toast.error(error.response?.data?.detail || 'Failed to submit ownership claim');
    },
  });

  const handleRating = score => {
    setRating(score);
    rateMutation.mutate({ score });
  };

  const handleSubmitComment = e => {
    e.preventDefault();
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = comment => {
    setEditingComment(comment.id);
    setEditCommentText(comment.comment_text);
  };

  const handleUpdateComment = () => {
    updateCommentMutation.mutate({
      commentId: editingComment,
      commentText: editCommentText,
    });
  };

  const handleDeleteComment = commentId => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const handleOwnershipClaim = e => {
    e.preventDefault();
    if (!ownershipReason.trim()) {
      toast.error('Please provide a reason for your ownership claim');
      return;
    }
    ownershipClaimMutation.mutate(ownershipReason);
  };

  const renderStars = (rating, interactive = false) => {
    return (
      <div className='flex space-x-1'>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
          <button
            key={star}
            onClick={() => interactive && handleRating(star)}
            className={`${
              interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''
            }`}
            disabled={!interactive}
          >
            <Star
              className={`h-5 w-5 ${
                star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='animate-pulse'>
              <div className='h-8 bg-gray-200 rounded w-1/4 mb-4'></div>
              <div className='space-y-3'>
                <div className='h-4 bg-gray-200 rounded'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                <div className='h-4 bg-gray-200 rounded w-4/6'></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    if (error.isRateLimited) {
      return (
        <div className='min-h-screen bg-gray-50 py-8'>
          <div className='max-w-4xl mx-auto px-4'>
            <div className='bg-white rounded-lg shadow-md p-6'>
              <RateLimitError
                retryAfter={error.retryAfter}
                onRetry={() => {
                  // Refetch the query when user clicks retry
                  window.location.reload();
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
            <p className='text-gray-600'>Failed to load diving center: {getErrorMessage(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render the main content if center is not loaded, if there's an error, or if center data is invalid
  if (!center || error || !center.name) {
    return (
      <div className='min-h-screen bg-gray-50 py-8'>
        <div className='max-w-4xl mx-auto px-4'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            {error ? (
              <div>
                <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
                <p className='text-gray-600'>
                  Failed to load diving center: {getErrorMessage(error)}
                </p>
              </div>
            ) : (
              <div className='animate-pulse'>
                <div className='h-8 bg-gray-200 rounded w-1/4 mb-4'></div>
                <div className='space-y-3'>
                  <div className='h-4 bg-gray-200 rounded'></div>
                  <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                  <div className='h-4 bg-gray-200 rounded w-4/6'></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-4xl mx-auto px-4'>
        {/* Header */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <div className='flex justify-between items-start mb-4'>
            <div className='flex items-center gap-3 sm:gap-4'>
              <button
                onClick={() => {
                  const from = location.state?.from;
                  if (from) {
                    navigate(from);
                  } else {
                    navigate('/diving-centers');
                  }
                }}
                className='text-gray-600 hover:text-gray-800 p-1'
              >
                <ArrowLeft size={20} className='sm:w-6 sm:h-6' />
              </button>
              <div className='min-w-0 flex-1'>
                <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                  {center?.name || 'Loading...'}
                </h1>
              </div>
            </div>
            <div className='flex items-center space-x-4'>
              {canEdit && (
                <button
                  onClick={() => navigate(`/diving-centers/${id}/edit`)}
                  className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                >
                  <Edit className='w-4 h-4 mr-2' />
                  Edit
                </button>
              )}
              {center?.average_rating && (
                <div className='text-right'>
                  <div className='flex items-center space-x-2 mb-2'>
                    <span className='text-2xl font-bold text-gray-900'>
                      {center.average_rating.toFixed(1)}/10
                    </span>
                  </div>
                  <p className='text-sm text-gray-600'>
                    {center.total_ratings} rating{center.total_ratings !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>
          {center?.description && (
            <div className='mb-4'>
              <p className='text-gray-600'>{center.description}</p>
            </div>
          )}

          {/* Contact Information */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
            {center?.email && (
              <div className='flex items-center text-gray-600'>
                <Mail className='h-5 w-5 mr-3 flex-shrink-0 text-gray-500' />
                <div className='flex items-center gap-2 min-w-0'>
                  <MaskedEmail
                    email={center.email}
                    className='text-blue-600 hover:text-blue-700 hover:underline transition-colors font-medium cursor-pointer'
                  />
                  <span className='text-xs text-gray-400'>Click to reveal</span>
                </div>
              </div>
            )}
            {center?.phone && (
              <div className='flex items-center text-gray-600'>
                <Phone className='h-5 w-5 mr-3 flex-shrink-0 text-gray-500' />
                <a
                  href={`tel:${center.phone}`}
                  className='text-blue-600 hover:text-blue-700 hover:underline transition-colors font-medium inline-flex items-center gap-1'
                >
                  {center.phone}
                  <Phone className='h-3 w-3' />
                </a>
              </div>
            )}
            {center?.website && (
              <div className='flex items-center text-gray-600'>
                <Globe className='h-5 w-5 mr-3 flex-shrink-0 text-gray-500' />
                <a
                  href={
                    center.website.startsWith('http') ? center.website : `https://${center.website}`
                  }
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:text-blue-700 hover:underline transition-colors font-medium inline-flex items-center gap-1'
                >
                  {center.website}
                  <ExternalLink className='h-3 w-3' />
                </a>
              </div>
            )}
            {center?.latitude && center?.longitude && (
              <div className='flex items-center text-gray-600'>
                <MapPin className='h-5 w-5 mr-3 flex-shrink-0 text-gray-500' />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:text-blue-700 hover:underline transition-colors font-medium inline-flex items-center gap-2'
                  title='Get directions from your current location'
                >
                  <span>
                    {center.latitude !== undefined && !isNaN(Number(center.latitude))
                      ? Number(center.latitude).toFixed(5)
                      : 'N/A'}
                    ,{' '}
                    {center.longitude !== undefined && !isNaN(Number(center.longitude))
                      ? Number(center.longitude).toFixed(5)
                      : 'N/A'}
                  </span>
                  <Navigation className='h-4 w-4' />
                </a>
              </div>
            )}
          </div>

          {/* Geographic Information */}
          {(center?.country || center?.region || center?.city) && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
              {center?.country && (
                <div className='flex items-center text-gray-600'>
                  <Globe className='h-5 w-5 mr-3' />
                  <div>
                    <span className='text-sm font-medium text-gray-700'>Country</span>
                    <p className='text-gray-900'>{center.country}</p>
                  </div>
                </div>
              )}
              {center?.region && (
                <div className='flex items-center text-gray-600'>
                  <MapPin className='h-5 w-5 mr-3' />
                  <div>
                    <span className='text-sm font-medium text-gray-700'>Region</span>
                    <p className='text-gray-900'>{center.region}</p>
                  </div>
                </div>
              )}
              {center?.city && (
                <div className='flex items-center text-gray-600'>
                  <MapPin className='h-5 w-5 mr-3' />
                  <div>
                    <span className='text-sm font-medium text-gray-700'>City</span>
                    <p className='text-gray-900'>{center.city}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ownership Status */}
          {center?.ownership_status && (
            <div className='border-t pt-4 mb-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <Crown className='h-5 w-5 text-yellow-600' />
                  <span className='text-sm font-medium text-gray-700'>Ownership Status:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      center.ownership_status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : center.ownership_status === 'claimed'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {center.ownership_status === 'approved'
                      ? 'Approved Owner'
                      : center.ownership_status === 'claimed'
                        ? 'Claim Pending'
                        : 'Unclaimed'}
                  </span>
                </div>
                {user && center.ownership_status === 'unclaimed' && (
                  <button
                    onClick={() => setShowOwnershipClaim(true)}
                    className='px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center space-x-2'
                  >
                    <Crown className='h-4 w-4' />
                    <span>Claim Ownership</span>
                  </button>
                )}
              </div>
              {center.owner_username && (
                <p className='text-sm text-gray-600 mt-2'>Owner: {center.owner_username}</p>
              )}
            </div>
          )}

          {/* Diving Organizations */}
          {orgLoading ? (
            <div className='border-t pt-4'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                <Award className='h-5 w-5 mr-2' />
                Associated Diving Organizations
              </h3>
              <div className='animate-pulse'>
                <div className='h-8 bg-gray-200 rounded w-1/4'></div>
              </div>
            </div>
          ) : (
            organizations &&
            organizations.length > 0 && (
              <div className='border-t pt-4'>
                <h3 className='text-lg font-semibold text-gray-900 mb-3 flex items-center'>
                  <Award className='h-5 w-5 mr-2' />
                  Associated Diving Organizations
                </h3>
                <div className='flex flex-wrap gap-2'>
                  {organizations
                    .filter(org => org && org.diving_organization)
                    .map(org => (
                      <div
                        key={org.id}
                        className={`flex items-center px-3 py-2 rounded-lg border ${
                          org.is_primary
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className='font-medium'>
                          {org.diving_organization?.acronym || 'Unknown Organization'}
                        </span>
                        {org.is_primary && (
                          <span className='ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full'>
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )
          )}

          {/* Rating Section */}
          {user && reviewsEnabled && (
            <div className='border-t pt-4'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Rate this diving center</h3>
              <div className='flex items-center space-x-2'>
                <span className='text-sm text-gray-600'>Your rating:</span>
                {renderStars(rating, true)}
              </div>
            </div>
          )}
        </div>

        {/* Dive Trips Section */}
        {tripsLoading ? (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <div className='animate-pulse'>
              <div className='h-6 bg-gray-200 rounded w-1/4 mb-4'></div>
              <div className='space-y-3'>
                <div className='h-20 bg-gray-200 rounded'></div>
                <div className='h-20 bg-gray-200 rounded'></div>
              </div>
            </div>
          </div>
        ) : trips && trips.length > 0 ? (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-2xl font-bold text-gray-900 flex items-center'>
                <Calendar className='h-6 w-6 mr-2' />
                Dive Trips
              </h2>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => navigateTripsRange('prev')}
                  className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors'
                  title='Previous 3 months'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <span className='text-sm text-gray-600 px-2'>{formatDateRange()}</span>
                <button
                  onClick={() => navigateTripsRange('next')}
                  disabled={tripsDateRange.endDate >= new Date()}
                  className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Next 3 months'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              </div>
            </div>
            <div className='space-y-4'>
              {trips.map(trip => (
                <div
                  key={trip.id}
                  className='border rounded-lg p-4 hover:bg-gray-50 transition-colors'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center space-x-3 mb-2'>
                        <h3 className='text-lg font-semibold text-gray-900'>
                          {formatDate(trip.trip_date)}
                        </h3>
                        {trip.trip_time && (
                          <span className='text-sm text-gray-600'>
                            {new Date(`2000-01-01T${trip.trip_time}`).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        {trip.trip_price && (
                          <span className='text-sm font-medium text-blue-600'>
                            {trip.trip_price} {trip.trip_currency}
                          </span>
                        )}
                      </div>
                      {trip.dives && trip.dives.length > 0 && (
                        <div className='text-sm text-gray-600 mb-2'>
                          {trip.dives.length} dive{trip.dives.length !== 1 ? 's' : ''}:{' '}
                          {trip.dives
                            .map(dive => dive.dive_site_name || `Dive ${dive.dive_number}`)
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                      {trip.trip_description && (
                        <p className='text-sm text-gray-700 line-clamp-2'>
                          {trip.trip_description}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/dive-trips/${trip.id}`}
                      className='ml-4 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors'
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-2xl font-bold text-gray-900 flex items-center'>
                <Calendar className='h-6 w-6 mr-2' />
                Dive Trips
              </h2>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => navigateTripsRange('prev')}
                  className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors'
                  title='Previous 3 months'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <span className='text-sm text-gray-600 px-2'>{formatDateRange()}</span>
                <button
                  onClick={() => navigateTripsRange('next')}
                  disabled={tripsDateRange.endDate >= new Date()}
                  className='p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Next 3 months'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              </div>
            </div>
            <p className='text-gray-500 text-center py-4'>
              No dive trips found for this date range
            </p>
          </div>
        )}

        {/* Comments Section */}
        {reviewsEnabled && (
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>Comments</h2>

            {/* Add Comment Form */}
            {user && (
              <form onSubmit={handleSubmitComment} className='mb-6'>
                <div className='mb-4'>
                  <label
                    htmlFor='new-comment'
                    className='block text-sm font-medium text-gray-700 mb-2'
                  >
                    Add a comment
                  </label>
                  <textarea
                    id='new-comment'
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                    rows='3'
                    placeholder='Share your experience with this diving center...'
                    required
                  />
                </div>
                <button
                  type='submit'
                  disabled={createCommentMutation.isLoading}
                  className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50'
                >
                  {createCommentMutation.isLoading ? 'Posting...' : 'Post Comment'}
                </button>
              </form>
            )}

            {/* Comments List */}
            {commentsLoading ? (
              <div className='flex justify-center py-4'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
              </div>
            ) : comments?.length > 0 ? (
              <div className='space-y-4'>
                {comments.map(comment => (
                  <div key={comment.id} className='border-b border-gray-200 pb-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <div>
                        <div className='flex items-center space-x-2'>
                          <Link
                            to={`/user/${comment.username}`}
                            className='font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors'
                          >
                            {comment.username}
                          </Link>
                          {(comment.user_diving_certification || comment.user_number_of_dives) && (
                            <div className='flex items-center space-x-2 text-xs'>
                              {comment.user_diving_certification && (
                                <span className='bg-blue-100 text-blue-800 px-2 py-1 rounded'>
                                  {comment.user_diving_certification}
                                </span>
                              )}
                              {comment.user_number_of_dives > 0 && (
                                <span className='bg-green-100 text-green-800 px-2 py-1 rounded'>
                                  {comment.user_number_of_dives} dives
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className='text-sm text-gray-500 ml-2'>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {user && (user.id === comment.user_id || user.is_admin) && (
                        <div className='flex space-x-2'>
                          <button
                            onClick={() => handleEditComment(comment)}
                            className='text-sm text-blue-600 hover:text-blue-800'
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className='text-sm text-red-600 hover:text-red-800'
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {editingComment === comment.id ? (
                      <div className='mt-2'>
                        <textarea
                          value={editCommentText}
                          onChange={e => setEditCommentText(e.target.value)}
                          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                          rows='3'
                        />
                        <div className='mt-2 space-x-2'>
                          <button
                            onClick={handleUpdateComment}
                            disabled={updateCommentMutation.isLoading}
                            className='bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50'
                          >
                            {updateCommentMutation.isLoading ? 'Updating...' : 'Update'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingComment(null);
                              setEditCommentText('');
                            }}
                            className='bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600'
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className='text-gray-700'>{comment.comment_text}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 text-center py-4'>
                No comments yet. Be the first to share your experience!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ownership Claim Modal */}
      {showOwnershipClaim && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>Claim Ownership</h3>
              <button
                onClick={() => setShowOwnershipClaim(false)}
                className='text-gray-500 hover:text-gray-700'
              >
                <X className='h-5 w-5' />
              </button>
            </div>
            <form onSubmit={handleOwnershipClaim}>
              <div className='mb-4'>
                <label
                  htmlFor='ownership-reason'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Reason for Claim *
                </label>
                <textarea
                  id='ownership-reason'
                  value={ownershipReason}
                  onChange={e => setOwnershipReason(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  rows='4'
                  placeholder='Please explain how to verify that you are the owner of this diving center. Provide email/telephone contact details if necessary...'
                  required
                />
              </div>
              <div className='flex items-center space-x-2 mb-4'>
                <AlertCircle className='h-5 w-5 text-yellow-600' />
                <p className='text-sm text-gray-600'>
                  Your claim will be reviewed by administrators. You&apos;ll be notified once a
                  decision is made.
                </p>
              </div>
              <div className='flex justify-end space-x-3'>
                <button
                  type='button'
                  onClick={() => setShowOwnershipClaim(false)}
                  className='px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={ownershipClaimMutation.isLoading}
                  className='px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
                >
                  {ownershipClaimMutation.isLoading ? (
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                  ) : (
                    <Crown className='h-4 w-4' />
                  )}
                  <span>Submit Claim</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivingCenterDetail;
