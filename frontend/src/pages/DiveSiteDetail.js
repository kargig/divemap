import {
  ArrowLeft,
  Edit,
  Star,
  MapPin,
  MessageCircle,
  Video,
  Link,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';

import api from '../api';
import MiniMap from '../components/MiniMap';
import { useAuth } from '../contexts/AuthContext';
import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';

// Helper function to safely extract error message
const getErrorMessage = error => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const DiveSiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [showNearbySites, setShowNearbySites] = useState(false);

  // Check if user has edit privileges
  const canEdit = user && (user.is_admin || user.is_moderator);

  const toggleNearbySites = () => {
    setShowNearbySites(!showNearbySites);
  };

  const {
    data: diveSite,
    isLoading,
    error,
  } = useQuery(['dive-site', id], () => api.get(`/api/v1/dive-sites/${id}`), {
    select: response => response.data,
    onSuccess: _data => {},
    onError: _error => {
      // console.error('DiveSiteDetail: Error loading dive site:', error);
    },
  });

  const { data: comments } = useQuery(
    ['dive-site-comments', id],
    () => api.get(`/api/v1/dive-sites/${id}/comments`),
    {
      select: response => response.data,
    }
  );

  const { data: media } = useQuery(
    ['dive-site-media', id],
    () => api.get(`/api/v1/dive-sites/${id}/media`),
    {
      select: response => response.data,
    }
  );

  const { data: divingCenters } = useQuery(
    ['dive-site-diving-centers', id],
    () => api.get(`/api/v1/dive-sites/${id}/diving-centers`),
    {
      select: response => response.data,
    }
  );

  const { data: nearbyDiveSites } = useQuery(
    ['dive-site-nearby', id],
    () => api.get(`/api/v1/dive-sites/${id}/nearby?limit=10`),
    {
      select: response => response.data,
      enabled: !!diveSite && !!diveSite.latitude && !!diveSite.longitude,
    }
  );

  const { data: topDives } = useQuery(
    ['dive-site-dives', id],
    () => api.get(`/api/v1/dive-sites/${id}/dives?limit=10`),
    {
      select: response => response.data,
      enabled: !!diveSite,
    }
  );

  const rateMutation = useMutation(
    ({ score }) => {
      return api.post(`/api/v1/dive-sites/${id}/rate`, { score });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site', id]);
        toast.success('Rating submitted successfully!');
        setRating(0);
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  const commentMutation = useMutation(
    commentText =>
      api.post(`/api/v1/dive-sites/${id}/comments`, {
        comment_text: commentText,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-site-comments', id]);
        toast.success('Comment posted successfully!');
        setComment('');
        setShowCommentForm(false);
      },
      onError: error => {
        toast.error(getErrorMessage(error));
      },
    }
  );

  // Set initial rating to user's previous rating if available
  useEffect(() => {
    if (diveSite) {
      if (diveSite.user_rating) {
        setRating(diveSite.user_rating);
      } else {
        setRating(0); // Reset to 0 if user hasn't rated this dive site
      }
    }
  }, [diveSite]);

  const handleRatingSubmit = () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    rateMutation.mutate({ score: rating });
  };

  const handleCommentSubmit = e => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    commentMutation.mutate(comment);
  };

  const isVideoUrl = url => {
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('vimeo.com') ||
      url.includes('.mp4')
    );
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error) {
    // console.error('DiveSiteDetail: Error state:', error);
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Error loading dive site. Please try again.</p>
        <p className='text-sm text-gray-500 mt-2'>Error: {getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!diveSite) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-600'>Dive site not found.</p>
        <p className='text-sm text-gray-500 mt-2'>ID: {id}</p>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6'>
      {/* Header */}
      <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4'>
          <div className='flex items-center gap-3 sm:gap-4'>
            <button
              onClick={() => navigate('/dive-sites')}
              className='text-gray-600 hover:text-gray-800 p-1'
            >
              <ArrowLeft size={20} className='sm:w-6 sm:h-6' />
            </button>
            <div className='min-w-0 flex-1'>
              <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate'>
                {diveSite.name}
              </h1>
              {diveSite.country && diveSite.region && (
                <p className='text-sm sm:text-base text-gray-600'>
                  {diveSite.region}, {diveSite.country}
                </p>
              )}
            </div>
          </div>
          <div className='flex gap-2 flex-wrap'>
            {canEdit && (
              <RouterLink
                to={`/dive-sites/${id}/edit`}
                className='inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                <Edit className='h-4 w-4 mr-1' />
                Edit
              </RouterLink>
            )}
          </div>
        </div>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              diveSite.difficulty_level === 'beginner'
                ? 'bg-green-100 text-green-800'
                : diveSite.difficulty_level === 'intermediate'
                  ? 'bg-yellow-100 text-yellow-800'
                  : diveSite.difficulty_level === 'advanced'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
            }`}
          >
            {diveSite.difficulty_level}
          </span>
          {diveSite.average_rating && (
            <div className='flex items-center'>
              <span className='text-lg font-semibold text-gray-700'>
                {diveSite.average_rating.toFixed(1)}/10 ({diveSite.total_ratings} reviews)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Bar */}
      {/* Removed empty navigation bar - no longer needed */}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Description */}
          {diveSite.description && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Description
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.description}</p>
            </div>
          )}

          {/* Location */}
          {(diveSite.latitude && diveSite.longitude) || diveSite.address ? (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Location
              </h2>
              {diveSite.address && (
                <div className='mb-4'>
                  <span className='font-medium text-gray-700'>Address:</span>
                  <span className='ml-2 text-gray-700'>{diveSite.address}</span>
                </div>
              )}
              {diveSite.latitude && diveSite.longitude && (
                <>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3'>
                    <div className='flex items-center text-gray-700'>
                      <MapPin className='h-5 w-5 mr-2' />
                      <span className='text-sm sm:text-base'>
                        {diveSite.latitude}, {diveSite.longitude}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/dive-sites/${id}/map`)}
                      className='flex items-center justify-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors w-full sm:w-auto'
                    >
                      <Link className='w-4 h-4 mr-1' />
                      Full Map View
                    </button>
                  </div>
                  <MiniMap
                    latitude={diveSite.latitude}
                    longitude={diveSite.longitude}
                    name={diveSite.name}
                    onMaximize={() => setIsMapMaximized(true)}
                    isMaximized={isMapMaximized}
                    onClose={() => setIsMapMaximized(false)}
                  />
                </>
              )}
            </div>
          ) : null}

          {/* Nearby Dive Sites */}
          {nearbyDiveSites && nearbyDiveSites.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <div className='flex items-center justify-between mb-3 sm:mb-4'>
                <h2 className='text-lg sm:text-xl font-semibold text-gray-900'>
                  Nearby Dive Sites
                </h2>
                <button
                  onClick={toggleNearbySites}
                  className='flex items-center text-blue-600 hover:text-blue-700 md:hidden'
                >
                  {showNearbySites ? (
                    <>
                      <ChevronUp className='h-4 w-4 mr-1' />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className='h-4 w-4 mr-1' />
                      Show
                    </>
                  )}
                </button>
              </div>
              <div className={`${showNearbySites ? 'block' : 'hidden'} md:block`}>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                  {nearbyDiveSites.slice(0, 6).map(site => (
                    <button
                      key={site.id}
                      onClick={() => navigate(`/dive-sites/${site.id}`)}
                      className='flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full'
                    >
                      <MapPin className='w-4 h-4 mr-2 flex-shrink-0 text-blue-600' />
                      <div className='min-w-0 flex-1'>
                        <div className='font-medium text-gray-900 truncate'>{site.name}</div>
                        <div className='text-xs text-gray-500'>{site.distance_km} km away</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Dives */}
          {topDives && topDives.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Top Dives
              </h2>
              <div className='space-y-3'>
                {topDives.map(dive => (
                  <div
                    key={dive.id}
                    className='border rounded-lg p-3 hover:bg-gray-50 transition-colors'
                  >
                    <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2'>
                      <RouterLink
                        to={`/dives/${dive.id}`}
                        className='font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm sm:text-base'
                      >
                        {dive.name || dive.dive_site?.name || 'Unnamed Dive'}
                      </RouterLink>
                      {dive.user_rating && (
                        <div className='flex items-center'>
                          <Star className='h-4 w-4 text-yellow-500 mr-1' />
                          <span className='text-sm font-medium'>{dive.user_rating}/10</span>
                        </div>
                      )}
                    </div>

                    <div className='text-xs sm:text-sm text-gray-600 space-y-1'>
                      <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                        <span className='font-medium'>Date:</span>
                        <span>{new Date(dive.dive_date).toLocaleDateString()}</span>
                        {dive.dive_time && (
                          <span className='text-gray-500'>
                            at{' '}
                            {new Date(`2000-01-01T${dive.dive_time}`).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      {dive.user_username && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>By:</span>
                          <RouterLink
                            to={`/user/${dive.user_username}`}
                            className='text-blue-600 hover:text-blue-800 hover:underline'
                          >
                            {dive.user_username}
                          </RouterLink>
                        </div>
                      )}

                      {dive.max_depth && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>Max Depth:</span>
                          <span>{dive.max_depth}m</span>
                        </div>
                      )}

                      {dive.duration && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>Duration:</span>
                          <span>{dive.duration}min</span>
                        </div>
                      )}

                      {dive.difficulty_level && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>Level:</span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              dive.difficulty_level === 'beginner'
                                ? 'bg-green-100 text-green-800'
                                : dive.difficulty_level === 'intermediate'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : dive.difficulty_level === 'advanced'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {dive.difficulty_level}
                          </span>
                        </div>
                      )}
                    </div>

                    {dive.dive_information && (
                      <p className='text-sm text-gray-700 mt-2 line-clamp-2'>
                        {dive.dive_information}
                      </p>
                    )}

                    {dive.tags && dive.tags.length > 0 && (
                      <div className='flex flex-wrap gap-1 mt-2'>
                        {dive.tags.map(tag => (
                          <span
                            key={tag.id}
                            className='px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full'
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className='mt-4 text-center'>
                <RouterLink
                  to={`/dives?dive_site_id=${id}`}
                  className='text-blue-600 hover:text-blue-800 text-sm font-medium'
                >
                  View All Dives at This Site →
                </RouterLink>
              </div>
            </div>
          )}

          {/* Access Instructions */}
          {diveSite.access_instructions && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Access Instructions
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.access_instructions}</p>
            </div>
          )}

          {/* Safety Information */}
          {diveSite.safety_information && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Safety Information
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.safety_information}</p>
            </div>
          )}

          {/* Max Depth */}
          {diveSite.max_depth && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Maximum Depth
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.max_depth} meters</p>
            </div>
          )}

          {/* Alternative Names */}
          {diveSite.alternative_names && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Alternative Names
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.alternative_names}</p>
            </div>
          )}

          {/* Marine Life */}
          {diveSite.marine_life && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Marine Life
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.marine_life}</p>
            </div>
          )}

          {/* Media Gallery */}
          {media && media.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Photos & Videos
              </h2>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                {media.map(item => (
                  <div key={item.id} className='border rounded-lg overflow-hidden'>
                    {isVideoUrl(item.url) ? (
                      <div className='relative'>
                        <a
                          href={item.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='block relative group'
                        >
                          <div className='aspect-video bg-gray-200 flex items-center justify-center'>
                            <Video className='h-12 w-12 text-white bg-black bg-opacity-50 rounded-full p-2' />
                          </div>
                          <div className='absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200'></div>
                        </a>
                        {item.description && (
                          <div className='p-3'>
                            <p className='text-sm text-gray-600'>{item.description}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <a
                          href={item.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='block relative group'
                        >
                          <img
                            src={item.url}
                            alt={item.description || 'Dive site media'}
                            className='w-full h-32 sm:h-48 object-cover group-hover:opacity-80 transition-opacity duration-200'
                          />
                          <div className='absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200'></div>
                        </a>
                        {item.description && (
                          <div className='p-3'>
                            <p className='text-sm text-gray-600'>{item.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Associated Diving Centers */}
          {divingCenters && divingCenters.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Diving Centers
              </h2>
              <div className='space-y-4'>
                {divingCenters.map(center => (
                  <div key={center.id} className='border rounded-lg p-3 sm:p-4'>
                    <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2'>
                      <h3 className='font-semibold text-gray-900 text-sm sm:text-base'>
                        {center.name}
                      </h3>
                      {center.dive_cost && (
                        <span className='text-green-600 font-semibold text-sm sm:text-base'>
                          {formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)}
                        </span>
                      )}
                    </div>
                    {center.description && (
                      <p className='text-gray-600 text-xs sm:text-sm mb-2'>{center.description}</p>
                    )}
                    <div className='flex flex-wrap gap-2 text-xs sm:text-sm'>
                      {center.email && (
                        <a
                          href={`mailto:${center.email}`}
                          className='flex items-center text-blue-600 hover:text-blue-700'
                        >
                          <Link className='h-3 w-3 mr-1' />
                          Email
                        </a>
                      )}
                      {center.phone && (
                        <a
                          href={`tel:${center.phone}`}
                          className='flex items-center text-blue-600 hover:text-blue-700'
                        >
                          <Link className='h-3 w-3 mr-1' />
                          Phone
                        </a>
                      )}
                      {center.website && (
                        <a
                          href={center.website}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='flex items-center text-blue-600 hover:text-blue-700'
                        >
                          <Link className='h-3 w-3 mr-1' />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900'>Comments</h2>
              {user && (
                <button
                  onClick={() => setShowCommentForm(!showCommentForm)}
                  className='flex items-center justify-center px-3 py-1 text-blue-600 hover:text-blue-700 w-full sm:w-auto'
                >
                  <MessageCircle className='h-4 w-4 mr-1' />
                  Add Comment
                </button>
              )}
            </div>

            {showCommentForm && user && (
              <form onSubmit={handleCommentSubmit} className='mb-6'>
                <label
                  htmlFor='comment-textarea'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Your Comment
                </label>
                <textarea
                  id='comment-textarea'
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder='Share your experience...'
                  className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm'
                  rows='3'
                />
                <div className='flex justify-end mt-2'>
                  <button
                    type='submit'
                    disabled={commentMutation.isLoading}
                    className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm'
                  >
                    {commentMutation.isLoading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}

            <div className='space-y-4'>
              {comments?.map(comment => (
                <div key={comment.id} className='border-b border-gray-200 pb-4'>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
                      <RouterLink
                        to={`/user/${comment.username}`}
                        className='font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm'
                      >
                        {comment.username}
                      </RouterLink>
                      {(comment.user_diving_certification || comment.user_number_of_dives) && (
                        <div className='flex flex-wrap items-center gap-2 text-xs text-gray-500'>
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
                    <span className='text-xs sm:text-sm text-gray-500'>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className='text-gray-700 text-sm sm:text-base'>{comment.comment_text}</p>
                </div>
              ))}

              {comments?.length === 0 && (
                <p className='text-gray-500 text-center py-4 text-sm sm:text-base'>
                  No comments yet. Be the first to share your experience!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Rating Section */}
          {user && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Rate this site</h3>
              <div className='flex items-center space-x-2 mb-4 overflow-x-auto'>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-1 flex-shrink-0 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    <Star className='h-6 w-6 fill-current' />
                  </button>
                ))}
              </div>
              <div className='text-sm text-gray-600 mb-4'>
                {diveSite?.user_rating ? (
                  <>
                    Your previous rating:{' '}
                    <span className='font-bold'>{diveSite.user_rating}/10</span>
                  </>
                ) : rating > 0 ? (
                  `You rated this site ${rating}/10`
                ) : (
                  'Click to rate'
                )}
              </div>
              <button
                onClick={handleRatingSubmit}
                disabled={rating === 0 || rateMutation.isLoading}
                className='w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {rateMutation.isLoading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          )}

          {/* Site Info */}
          <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Site Information</h3>
            <div className='space-y-3 text-sm'>
              <div>
                <span className='font-medium text-gray-700'>Difficulty:</span>
                <span className='ml-2 capitalize'>{diveSite.difficulty_level}</span>
              </div>
              {diveSite.average_rating && (
                <div>
                  <span className='font-medium text-gray-700'>Average Rating:</span>
                  <span className='ml-2'>{diveSite.average_rating.toFixed(1)}/10</span>
                </div>
              )}
              <div>
                <span className='font-medium text-gray-700'>Total Reviews:</span>
                <span className='ml-2'>{diveSite.total_ratings}</span>
              </div>
              <div>
                <span className='font-medium text-gray-700'>Added:</span>
                <span className='ml-2'>{new Date(diveSite.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {diveSite.tags && diveSite.tags.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Tags</h3>
              <div className='flex flex-wrap gap-2'>
                {diveSite.tags.map(tag => (
                  <span
                    key={tag.id}
                    className='px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium'
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiveSiteDetail;
