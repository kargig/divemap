import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Thermometer,
  Star,
  MapPin,
  Eye,
  EyeOff,
  Download,
  Link,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';

import { getDive, deleteDive, deleteDiveMedia } from '../api';
import RateLimitError from '../components/RateLimitError';
import { useAuth } from '../contexts/AuthContext';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';

const DiveDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState(null);

  // Fetch dive data
  const {
    data: dive,
    isLoading,
    error,
  } = useQuery(
    ['dive', id, user],
    () => {
      // Use main dives endpoint for both authenticated and unauthenticated users
      return getDive(id);
    },
    {
      enabled: !!id,
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive details', () => window.location.reload());
  }, [error]);

  // Delete dive mutation
  const deleteDiveMutation = useMutation(deleteDive, {
    onSuccess: () => {
      toast.success('Dive deleted successfully');
      queryClient.invalidateQueries(['dives']);
      navigate('/dives');
    },
    onError: error => {
      let errorMessage = 'Failed to delete dive';
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          // Handle validation errors array
          const firstError = error.response.data.detail[0];
          errorMessage = firstError.msg || 'Validation error';
        } else {
          // Handle simple string error
          errorMessage = error.response.data.detail;
        }
      }
      toast.error(errorMessage);
    },
  });

  // Delete media mutation
  const deleteMediaMutation = useMutation(
    ({ diveId, mediaId }) => deleteDiveMedia(diveId, mediaId),
    {
      onSuccess: () => {
        toast.success('Media deleted successfully');
        queryClient.invalidateQueries(['dive', id]);
      },
      onError: error => {
        let errorMessage = 'Failed to delete media';
        if (error.response?.data?.detail) {
          if (Array.isArray(error.response.data.detail)) {
            // Handle validation errors array
            const firstError = error.response.data.detail[0];
            errorMessage = firstError.msg || 'Validation error';
          } else {
            // Handle simple string error
            errorMessage = error.response.data.detail;
          }
        }
        toast.error(errorMessage);
      },
    }
  );

  const handleDelete = () => {
    if (
      window.confirm('Are you sure you want to delete this dive? This action cannot be undone.')
    ) {
      deleteDiveMutation.mutate(id);
    }
  };

  const handleDeleteMedia = mediaId => {
    if (window.confirm('Are you sure you want to delete this media?')) {
      deleteMediaMutation.mutate({ diveId: id, mediaId });
    }
  };

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // getDifficultyColor function is now replaced by getDifficultyColorClasses from difficultyHelpers

  const getSuitTypeColor = type => {
    const colors = {
      wet_suit: 'bg-blue-100 text-blue-800',
      dry_suit: 'bg-purple-100 text-purple-800',
      shortie: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className='text-center py-8'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
        <p className='mt-4 text-gray-600'>Loading dive details...</p>
      </div>
    );
  }

  if (error) {
    if (error.isRateLimited) {
      return (
        <div className='py-6'>
          <RateLimitError
            retryAfter={error.retryAfter}
            onRetry={() => {
              // Refetch the query when user clicks retry
              window.location.reload();
            }}
          />
        </div>
      );
    }

    let errorMessage = 'Unknown error occurred';
    if (error.response?.data?.detail) {
      if (Array.isArray(error.response.data.detail)) {
        // Handle validation errors array
        const firstError = error.response.data.detail[0];
        errorMessage = firstError.msg || 'Validation error';
      } else {
        // Handle simple string error
        errorMessage = error.response.data.detail;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return (
      <div className='text-center py-8'>
        <p className='text-red-600'>Error loading dive: {errorMessage}</p>
        <p className='text-sm text-gray-500 mt-2'>
          {error.response?.data?.detail || error.message || 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  if (!dive) {
    return (
      <div className='text-center py-8'>
        <p className='text-gray-600'>Dive not found</p>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-4 sm:px-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4'>
        <div className='flex items-center gap-3 sm:gap-4'>
          <button
            onClick={() => navigate('/dives')}
            className='text-gray-600 hover:text-gray-800 p-1'
          >
            <ArrowLeft size={20} className='sm:w-6 sm:h-6' />
          </button>
          <div className='min-w-0 flex-1'>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate'>
              {dive.name || dive.dive_site?.name || 'Unnamed Dive Site'}
            </h1>
            <p className='text-sm sm:text-base text-gray-600'>
              {formatDate(dive.dive_date)}
              {dive.dive_time && ` at ${formatTime(dive.dive_time)}`}
            </p>
            {/* Privacy Status */}
            <div className='flex items-center gap-2 mt-1'>
              {dive.is_private ? (
                <div className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
                  <EyeOff size={12} />
                  Private
                </div>
              ) : (
                <div className='flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium'>
                  <Eye size={12} />
                  Public
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='flex gap-2 flex-wrap'>
          {(user?.id === dive?.user_id || user?.is_admin) && (
            <>
              <RouterLink
                to={`/dives/${id}/edit`}
                className='inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              >
                <Edit className='h-4 w-4 mr-1' />
                Edit
              </RouterLink>
              <button
                onClick={handleDelete}
                disabled={deleteDiveMutation.isLoading}
                className='inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50'
              >
                <Trash2 className='h-4 w-4 mr-1' />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Basic Information */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>Dive Information</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='flex items-center gap-2'>
                <Calendar size={16} className='text-gray-500' />
                <span className='text-sm text-gray-600'>Date:</span>
                <span className='font-medium'>{formatDate(dive.dive_date)}</span>
              </div>

              {dive.dive_time && (
                <div className='flex items-center gap-2'>
                  <Clock size={16} className='text-gray-500' />
                  <span className='text-sm text-gray-600'>Time:</span>
                  <span className='font-medium'>{formatTime(dive.dive_time)}</span>
                </div>
              )}

              {dive.duration && (
                <div className='flex items-center gap-2'>
                  <Clock size={16} className='text-gray-500' />
                  <span className='text-sm text-gray-600'>Duration:</span>
                  <span className='font-medium'>{dive.duration} minutes</span>
                </div>
              )}

              {dive.max_depth && (
                <div className='flex items-center gap-2'>
                  <Thermometer size={16} className='text-gray-500' />
                  <span className='text-sm text-gray-600'>Max Depth:</span>
                  <span className='font-medium'>{dive.max_depth}m</span>
                </div>
              )}

              {dive.average_depth && (
                <div className='flex items-center gap-2'>
                  <Thermometer size={16} className='text-gray-500' />
                  <span className='text-sm text-gray-600'>Avg Depth:</span>
                  <span className='font-medium'>{dive.average_depth}m</span>
                </div>
              )}

              {dive.visibility_rating && (
                <div className='flex items-center gap-2'>
                  <Eye size={16} className='text-gray-500' />
                  <span className='text-sm text-gray-600'>Visibility:</span>
                  <span className='font-medium'>{dive.visibility_rating}/10</span>
                </div>
              )}

              {dive.user_rating && (
                <div className='flex items-center gap-2'>
                  <Star size={16} className='text-yellow-500' />
                  <span className='text-sm text-gray-600'>Your Rating:</span>
                  <span className='font-medium'>{dive.user_rating}/10</span>
                </div>
              )}
            </div>

            {dive.difficulty_level && (
              <div className='mt-4'>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColorClasses(dive.difficulty_level)}`}
                >
                  {getDifficultyLabel(dive.difficulty_level)}
                </span>
              </div>
            )}

            {dive.suit_type && (
              <div className='mt-2'>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getSuitTypeColor(dive.suit_type)}`}
                >
                  {dive.suit_type.replace('_', ' ')}
                </span>
              </div>
            )}

            {dive.gas_bottles_used && (
              <div className='mt-4'>
                <h3 className='text-sm font-medium text-gray-700 mb-1'>Gas Bottles Used</h3>
                <p className='text-gray-600'>{dive.gas_bottles_used}</p>
              </div>
            )}

            {dive.dive_information && (
              <div className='mt-4'>
                <h3 className='text-sm font-medium text-gray-700 mb-1'>Dive Description</h3>
                <p className='text-gray-600 whitespace-pre-wrap'>{dive.dive_information}</p>
              </div>
            )}
          </div>

          {/* Media Gallery */}
          {dive.media && dive.media.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>Media</h2>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {dive.media.map(media => (
                  <div key={media.id} className='relative group'>
                    <div className='aspect-square bg-gray-100 rounded-lg overflow-hidden'>
                      {media.media_type === 'photo' && (
                        <img
                          src={media.url}
                          alt={media.description || 'Dive photo'}
                          className='w-full h-full object-cover cursor-pointer'
                          onClick={() => setSelectedMedia(media)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedMedia(media);
                            }
                          }}
                          role='button'
                          tabIndex={0}
                        />
                      )}
                      {media.media_type === 'video' && (
                        <video src={media.url} controls className='w-full h-full object-cover' />
                      )}
                      {media.media_type === 'dive_plan' && (
                        <div className='w-full h-full flex items-center justify-center'>
                          <div className='text-center'>
                            <Download size={32} className='mx-auto text-gray-400 mb-2' />
                            <p className='text-sm text-gray-600'>Dive Plan</p>
                            <a
                              href={media.url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-600 hover:text-blue-800 text-sm'
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      )}
                      {media.media_type === 'external_link' && (
                        <div className='w-full h-full flex items-center justify-center'>
                          <div className='text-center'>
                            <Link size={32} className='mx-auto text-gray-400 mb-2' />
                            <p className='text-sm text-gray-600'>
                              {media.title || 'External Link'}
                            </p>
                            <a
                              href={media.url}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='text-blue-600 hover:text-blue-800 text-sm'
                            >
                              Visit Link
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() => handleDeleteMedia(media.id)}
                        className='bg-red-600 text-white p-1 rounded-full hover:bg-red-700'
                        title='Delete media'
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {media.description && (
                      <p className='text-xs text-gray-600 mt-1'>{media.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {dive.tags && dive.tags.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>Tags</h2>
              <div className='flex flex-wrap gap-2'>
                {dive.tags.map(tag => (
                  <span
                    key={tag.id}
                    className='px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full'
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Dive Site Information */}
          {dive.dive_site && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>Dive Site</h2>
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <MapPin size={16} className='text-gray-500' />
                  <span className='font-medium'>{dive.dive_site.name}</span>
                </div>
                {dive.dive_site.description && (
                  <p className='text-sm text-gray-600'>{dive.dive_site.description}</p>
                )}
                <RouterLink
                  to={`/dive-sites/${dive.dive_site.id}`}
                  className='text-blue-600 hover:text-blue-800 text-sm'
                >
                  View dive site details →
                </RouterLink>
              </div>
            </div>
          )}

          {/* Diving Center Information */}
          {dive.diving_center && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>Diving Center</h2>
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <MapPin size={16} className='text-gray-500' />
                  <span className='font-medium'>{dive.diving_center.name}</span>
                </div>
                {dive.diving_center.description && (
                  <p className='text-sm text-gray-600'>{dive.diving_center.description}</p>
                )}
                <RouterLink
                  to={`/diving-centers/${dive.diving_center.id}`}
                  className='text-blue-600 hover:text-blue-800 text-sm'
                >
                  View diving center details →
                </RouterLink>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>Statistics</h2>
            <div className='space-y-3'>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Total Dives</span>
                <span className='font-medium'>{dive.user?.number_of_dives || 0}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Dive Date</span>
                <span className='font-medium'>{formatDate(dive.dive_date)}</span>
              </div>
              {dive.created_at && (
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Logged</span>
                  <span className='font-medium'>{formatDate(dive.created_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Modal */}
      {selectedMedia && (
        <div className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50'>
          <div className='max-w-4xl max-h-full p-4'>
            <div className='bg-white rounded-lg p-4'>
              <div className='flex justify-between items-center mb-4'>
                <h3 className='text-lg font-semibold'>{selectedMedia.title || 'Dive Media'}</h3>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className='text-gray-500 hover:text-gray-700'
                >
                  <EyeOff size={24} />
                </button>
              </div>
              {selectedMedia.media_type === 'photo' && (
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.description || 'Dive photo'}
                  className='max-w-full max-h-96 object-contain'
                />
              )}
              {selectedMedia.media_type === 'video' && (
                <video src={selectedMedia.url} controls className='max-w-full max-h-96' />
              )}
              {selectedMedia.description && (
                <p className='mt-4 text-gray-600'>{selectedMedia.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiveDetail;
