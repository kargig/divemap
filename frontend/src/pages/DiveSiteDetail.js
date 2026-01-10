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
  Pencil,
  Navigation,
  ExternalLink,
  Lock,
  Globe,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';

import api, { extractErrorMessage } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import DiveSiteRoutes from '../components/DiveSiteRoutes';
import Lightbox from '../components/Lightbox/Lightbox';
import ReactImage from '../components/Lightbox/ReactImage';
import MaskedEmail from '../components/MaskedEmail';
import MiniMap from '../components/MiniMap';
import RateLimitError from '../components/RateLimitError';
import SEO from '../components/SEO';
import ShareButton from '../components/ShareButton';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

import NotFound from './NotFound';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

const DiveSiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [showNearbySites, setShowNearbySites] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState('photos');
  const [activeContentTab, setActiveContentTab] = useState('description');
  const [convertedFlickrUrls, setConvertedFlickrUrls] = useState(new Map());

  // Handle route drawing button click with authentication check
  const handleDrawRouteClick = () => {
    if (!user) {
      toast.error('Please log in to draw routes');
      navigate('/login');
      return;
    }
    navigate(`/dive-sites/${id}/dive-route`);
  };

  // Route creation mutation
  const createRouteMutation = useMutation(
    routeData =>
      api.post(`/api/v1/dive-sites/${id}/routes`, {
        ...routeData,
        dive_site_id: parseInt(id),
      }),
    {
      onSuccess: () => {
        toast.success('Route created successfully!');
        queryClient.invalidateQueries(['dive-site', id]);
        queryClient.invalidateQueries(['dive-site-routes', id]);
      },
      onError: error => {
        console.error('Error creating route:', error);
        toast.error(getErrorMessage(error));
      },
    }
  );

  const toggleNearbySites = () => {
    setShowNearbySites(!showNearbySites);
  };

  const {
    data: diveSite,
    isLoading,
    error,
  } = useQuery(['dive-site', id], () => api.get(`/api/v1/dive-sites/${id}`), {
    select: response => response.data,
    retry: (failureCount, error) => {
      if (error.response?.status === 404) return false;
      return failureCount < 3;
    },
    onSuccess: _data => {},
    onError: _error => {
      // Error handled by error state
    },
  });

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive site details', () => window.location.reload());
  }, [error]);

  const { data: comments } = useQuery(
    ['dive-site-comments', id],
    () => api.get(`/api/v1/dive-sites/${id}/comments`),
    {
      select: response => response.data,
      enabled: !!id && !!diveSite,
    }
  );

  const { data: media } = useQuery(
    ['dive-site-media', id],
    () => api.get(`/api/v1/dive-sites/${id}/media`),
    {
      select: response => response.data,
      enabled: !!id && !!diveSite,
    }
  );

  const { data: divingCenters } = useQuery(
    ['dive-site-diving-centers', id],
    () => api.get(`/api/v1/dive-sites/${id}/diving-centers`),
    {
      select: response => response.data,
      enabled: !!id && !!diveSite,
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

  // All media is public (is_public column removed from database)
  const publicMedia = media || [];

  // Public media categories
  const publicVideos = publicMedia.filter(item => isVideoUrl(item.url));
  const publicPhotos = publicMedia.filter(item => !isVideoUrl(item.url));

  // Convert Flickr URLs to direct image URLs
  useEffect(() => {
    const convertFlickrUrls = async () => {
      if (!media) return;

      // Get all photos
      const allPhotos = media.filter(item => !isVideoUrl(item.url));
      const flickrPhotos = allPhotos.filter(item => isFlickrUrl(item.url));

      if (flickrPhotos.length === 0) return;

      const newConvertedUrls = new Map(convertedFlickrUrls);
      let hasUpdates = false;

      for (const photo of flickrPhotos) {
        // Skip if already converted
        if (newConvertedUrls.has(photo.url)) continue;

        try {
          const directUrl = await convertFlickrUrlToDirectImage(photo.url);
          if (directUrl !== photo.url) {
            newConvertedUrls.set(photo.url, directUrl);
            hasUpdates = true;
          }
        } catch (error) {
          console.warn('Failed to convert Flickr URL:', photo.url, error);
        }
      }

      if (hasUpdates) {
        setConvertedFlickrUrls(newConvertedUrls);
      }
    };

    convertFlickrUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  // Helper to get the URL (converted if Flickr, original otherwise)
  const getImageUrl = url => {
    return convertedFlickrUrls.get(url) || url;
  };

  // For backward compatibility, keep these for the main tabs
  const videos = publicVideos;
  const photos = publicPhotos;

  const photoSlides = photos.map(item => ({
    src: getImageUrl(item.url),
    width: 1920,
    height: 1080,
    alt: item.description || 'Dive site photo',
    description: item.description || '',
  }));

  // Set initial content tab based on available content or URL param
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');

    if (diveSite && media) {
      if (tabParam === 'media' && media.length > 0) {
        setActiveContentTab('media');
      } else if (diveSite.description) {
        setActiveContentTab('description');
      } else if (media && media.length > 0) {
        setActiveContentTab('media');
      }
    }
  }, [diveSite, media, location.search]);

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
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

    if (error.response?.status === 404) {
      return <NotFound />;
    }

    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Error loading dive site. Please try again.</p>
        <p className='text-sm text-gray-500 mt-2'>Error: {getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!diveSite) {
    return <NotFound />;
  }

  const getMetaDescription = () => {
    if (!diveSite) return '';

    const parts = [
      `${diveSite.name} is a ${
        diveSite.difficulty_label || getDifficultyLabel(diveSite.difficulty_code)
      } dive site in ${diveSite.country}.`,
    ];

    if (diveSite.max_depth) {
      parts.push(`Max depth: ${diveSite.max_depth}m.`);
    }

    if (diveSite.total_ratings > 0) {
      parts.push(`Read ${diveSite.total_ratings} reviews and see photos.`);
    } else {
      parts.push('Be the first to share your experience and photos!');
    }

    return parts.join(' ');
  };

  const getSchema = () => {
    if (!diveSite) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': ['Place', 'BodyOfWater', 'TouristAttraction'],
      name: diveSite.name,
      description: diveSite.description,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: diveSite.latitude,
        longitude: diveSite.longitude,
      },
      address: {
        '@type': 'PostalAddress',
        addressCountry: diveSite.country,
        addressRegion: diveSite.region,
      },
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
            name: 'Dive Sites',
            item: `${window.location.origin}/dive-sites`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: diveSite.country,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: diveSite.name,
            item: window.location.href,
          },
        ],
      },
    };

    if (diveSite.total_ratings > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: diveSite.average_rating,
        reviewCount: diveSite.total_ratings,
        bestRating: '10',
        worstRating: '1',
      };
    }

    return schema;
  };

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {diveSite && (
        <SEO
          title={`Divemap - ${diveSite.name} - ${diveSite.region || ''} ${diveSite.country || ''}`}
          description={getMetaDescription()}
          type='place'
          image={photos.length > 0 ? getImageUrl(photos[0].url) : undefined}
          imageAlt={
            photos.length > 0 ? photos[0].description || `Dive site ${diveSite.name}` : undefined
          }
          siteName='Divemap'
          location={{ lat: diveSite.latitude, lon: diveSite.longitude }}
          schema={getSchema()}
        />
      )}
      {/* Breadcrumbs */}
      {diveSite && (
        <Breadcrumbs
          items={[
            { label: 'Dive Sites', to: '/dive-sites' },
            ...(diveSite.country
              ? [
                  {
                    label: diveSite.country,
                    to: `/dive-sites?country=${encodeURIComponent(diveSite.country)}`,
                  },
                ]
              : []),
            ...(diveSite.region
              ? [
                  {
                    label: diveSite.region,
                    to: `/dive-sites?country=${encodeURIComponent(diveSite.country || '')}&region=${encodeURIComponent(diveSite.region)}`,
                  },
                ]
              : []),
            { label: diveSite.name },
          ]}
        />
      )}
      {/* Header */}
      <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4'>
          <div className='flex items-center gap-3 sm:gap-4'>
            <button
              onClick={() => {
                const from = location.state?.from;
                if (from) {
                  navigate(from);
                } else {
                  navigate('/dive-sites');
                }
              }}
              className='text-gray-600 hover:text-gray-800 p-1'
            >
              <ArrowLeft size={20} className='sm:w-6 sm:h-6' />
            </button>
            <div className='min-w-0 flex-1'>
              <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words'>
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
            {/* Share button - available to all users */}
            {diveSite && (
              <ShareButton
                entityType='dive-site'
                entityData={diveSite}
                className='inline-flex items-center'
              />
            )}
            {(() => {
              const isOwner = user?.id === diveSite?.created_by;
              const isAdmin = user?.is_admin;
              const isModerator = user?.is_moderator;
              const shouldShowEdit = isOwner || isAdmin || isModerator;

              return (
                shouldShowEdit && (
                  <RouterLink
                    to={`/dive-sites/${id}/edit`}
                    className='inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    <Edit className='h-4 w-4 mr-1' />
                    Edit
                  </RouterLink>
                )
              );
            })()}
          </div>
        </div>
        <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'>
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${getDifficultyColorClasses(diveSite.difficulty_code)}`}
            >
              {diveSite.difficulty_label || getDifficultyLabel(diveSite.difficulty_code)}
            </span>

            {/* Tags - In header area with difficulty (both mobile and desktop) */}
            {diveSite.tags && diveSite.tags.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {diveSite.tags.map(tag => (
                  <span
                    key={tag.id}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getTagColor(tag.name)}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Aliases */}
            {diveSite.aliases && diveSite.aliases.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {diveSite.aliases.map(alias => (
                  <span
                    key={alias.id}
                    className='px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800'
                  >
                    {alias.alias}
                  </span>
                ))}
              </div>
            )}
          </div>

          {diveSite.average_rating && (
            <div className='flex items-center'>
              <span className='text-lg font-semibold text-gray-700'>
                {diveSite.average_rating.toFixed(1)}/10 ({diveSite.total_ratings} reviews)
              </span>
            </div>
          )}
        </div>

        {/* Site Information - Mobile View: In header area */}
        <div className='lg:hidden mt-3 pt-3 border-t border-gray-200'>
          <div className='space-y-2 text-sm'>
            <div>
              <span className='font-medium text-gray-700'>Difficulty:</span>
              <span className='ml-2 capitalize'>
                {diveSite.difficulty_label ||
                  getDifficultyLabel(diveSite.difficulty_code) ||
                  'Unspecified'}
              </span>
            </div>
            {diveSite.max_depth && (
              <div>
                <span className='font-medium text-gray-700'>Maximum Depth:</span>
                <span className='ml-2'>{diveSite.max_depth} meters</span>
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
      </div>

      {/* Navigation Bar */}
      {/* Removed empty navigation bar - no longer needed */}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Description & Media Gallery with Tabs */}
          {(diveSite.description || (media && media.length > 0)) && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              {/* Main Tab Navigation */}
              <div className='border-b border-gray-200 mb-4'>
                <nav className='flex space-x-8'>
                  {diveSite.description && (
                    <button
                      onClick={() =>
                        setSearchParams(prev => {
                          prev.set('tab', 'description');
                          return prev;
                        })
                      }
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeContentTab === 'description'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Description
                    </button>
                  )}
                  {media && media.length > 0 && (
                    <button
                      onClick={() =>
                        setSearchParams(prev => {
                          prev.set('tab', 'media');
                          return prev;
                        })
                      }
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeContentTab === 'media'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Photos & Videos
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab Content */}
              {activeContentTab === 'description' && diveSite.description && (
                <div>
                  <p className='text-gray-700 text-sm sm:text-base'>
                    {renderTextWithLinks(diveSite.description)}
                  </p>
                </div>
              )}

              {activeContentTab === 'media' && media && media.length > 0 && (
                <div>
                  {/* Media Tab Navigation */}
                  <div className='border-b border-gray-200 mb-4'>
                    <nav className='flex space-x-8'>
                      {photos.length > 0 && (
                        <button
                          onClick={() => setActiveMediaTab('photos')}
                          className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeMediaTab === 'photos'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          Photos ({photos.length})
                        </button>
                      )}
                      {videos.length > 0 && (
                        <button
                          onClick={() => setActiveMediaTab('videos')}
                          className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                            activeMediaTab === 'videos'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <Video className='w-4 h-4' />
                          <span>Videos ({videos.length})</span>
                        </button>
                      )}
                    </nav>
                  </div>

                  {/* Media Tab Content */}
                  {activeMediaTab === 'photos' && photos.length > 0 && (
                    <div>
                      <Lightbox
                        open={false}
                        close={() => {}}
                        slides={photoSlides}
                        plugins={[Captions, Slideshow, Fullscreen, Thumbnails]}
                        render={{ slide: ReactImage, thumbnail: ReactImage }}
                        thumbnails={{ position: 'bottom' }}
                      />
                    </div>
                  )}

                  {activeMediaTab === 'videos' && videos.length > 0 && (
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                      {videos.map(item => (
                        <div
                          key={`video-${item.dive_id ? `dive-${item.dive_id}-` : 'site-'}${item.id}`}
                          className='border rounded-lg overflow-hidden'
                        >
                          <div className='relative'>
                            <YouTubePreview
                              url={item.url}
                              description={item.description}
                              className='w-full'
                              openInNewTab={true}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                  {/* Get Directions Button with Coordinates */}
                  <div className='mb-3 sm:mb-4'>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${diveSite.latitude},${diveSite.longitude}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors shadow-sm hover:shadow-md'
                      title='Get driving directions from Google Maps'
                    >
                      <Navigation className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
                      <span>
                        Get Directions to:{' '}
                        <span className='font-mono'>
                          {diveSite.latitude !== undefined && !isNaN(Number(diveSite.latitude))
                            ? Number(diveSite.latitude).toFixed(5)
                            : 'N/A'}
                          ,{' '}
                          {diveSite.longitude !== undefined && !isNaN(Number(diveSite.longitude))
                            ? Number(diveSite.longitude).toFixed(5)
                            : 'N/A'}
                        </span>
                      </span>
                      <ExternalLink className='h-3 w-3 sm:h-3 sm:w-3 opacity-80' />
                    </a>
                  </div>

                  <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3'>
                    <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
                      <button
                        onClick={handleDrawRouteClick}
                        className={`flex items-center justify-center px-3 py-1 text-white text-sm rounded-md transition-colors w-full sm:w-auto ${
                          user ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'
                        }`}
                      >
                        <Pencil className='w-4 h-4 mr-1' />
                        {user ? 'Draw Route' : 'Draw Route (Login Required)'}
                      </button>
                      <button
                        onClick={() => navigate(`/dive-sites/${id}/map`)}
                        className='flex items-center justify-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors w-full sm:w-auto'
                      >
                        <Link className='w-4 h-4 mr-1' />
                        Full Map View
                      </button>
                    </div>
                  </div>
                  <MiniMap
                    latitude={diveSite.latitude}
                    longitude={diveSite.longitude}
                    name={diveSite.name}
                    onMaximize={() => setIsMapMaximized(true)}
                    showMaximizeButton={false}
                    isMaximized={isMapMaximized}
                    onClose={() => setIsMapMaximized(false)}
                  />
                </>
              )}
            </div>
          ) : null}

          {/* Available Routes */}
          <DiveSiteRoutes diveSiteId={id} />

          {/* Nearby Dive Sites - Mobile View Only */}
          {nearbyDiveSites && nearbyDiveSites.length > 0 && (
            <div className='lg:hidden bg-white p-4 sm:p-6 rounded-lg shadow-md'>
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
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
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
                              hour12: false, // Use 24-hour format
                            })}
                          </span>
                        )}
                      </div>

                      {dive.user_username && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>By:</span>
                          <RouterLink
                            to={`/users/${dive.user_username}`}
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

                      {dive.difficulty_code && (
                        <div className='flex flex-col sm:flex-row sm:items-center gap-1'>
                          <span className='font-medium'>Level:</span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(dive.difficulty_code)}`}
                          >
                            {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
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
                            className={`px-2 py-1 text-xs rounded-full ${getTagColor(tag.name)}`}
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

          {/* Access Instructions - Mobile View Only */}
          {diveSite.access_instructions && (
            <div className='lg:hidden bg-white p-4 sm:p-6 rounded-lg shadow-md'>
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

          {/* Marine Life */}
          {diveSite.marine_life && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Marine Life
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>{diveSite.marine_life}</p>
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
                        to={`/users/${comment.username}`}
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
                  <p className='text-gray-700 text-sm sm:text-base'>
                    {renderTextWithLinks(comment.comment_text, { isUGC: true, shorten: false })}
                  </p>
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

              {/* Improved Rating Display */}
              <div className='mb-4'>
                <div className='flex items-center justify-center space-x-1 mb-3'>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setRating(star)}
                      onMouseLeave={() => setRating(rating)}
                      className={`p-1 transition-colors duration-200 ${
                        star <= rating ? 'text-yellow-400' : 'text-gray-300'
                      } hover:text-yellow-400 hover:scale-110 transform`}
                      title={`Rate ${star}/10`}
                    >
                      <Star className='h-5 w-5 fill-current' />
                    </button>
                  ))}
                </div>

                {/* Rating Text */}
                <div className='text-center'>
                  <div className='text-2xl font-bold text-gray-900 mb-1'>
                    {rating > 0 ? `${rating}/10` : 'Click to rate'}
                  </div>
                  <div className='text-sm text-gray-600'>
                    {diveSite?.user_rating ? (
                      <>
                        Your previous rating:{' '}
                        <span className='font-semibold'>{diveSite.user_rating}/10</span>
                      </>
                    ) : rating > 0 ? (
                      <span className='text-blue-600 font-medium'>Ready to submit</span>
                    ) : (
                      'Hover over stars to preview'
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleRatingSubmit}
                disabled={rating === 0 || rateMutation.isLoading}
                className='w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'
              >
                {rateMutation.isLoading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          )}

          {/* Site Info - Desktop View Only */}
          <div className='hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow-md'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>Site Information</h3>
            <div className='space-y-3 text-sm'>
              <div>
                <span className='font-medium text-gray-700'>Difficulty:</span>
                <span className='ml-2 capitalize'>
                  {diveSite.difficulty_label ||
                    getDifficultyLabel(diveSite.difficulty_code) ||
                    'Unspecified'}
                </span>
              </div>
              {diveSite.max_depth && (
                <div>
                  <span className='font-medium text-gray-700'>Maximum Depth:</span>
                  <span className='ml-2'>{diveSite.max_depth} meters</span>
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

          {/* Access Instructions - Desktop View Only */}
          {diveSite.access_instructions && (
            <div className='hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Access Instructions</h3>
              <p className='text-gray-700 text-sm'>{diveSite.access_instructions}</p>
            </div>
          )}

          {/* Nearby Dive Sites - Desktop View Only */}
          {nearbyDiveSites && nearbyDiveSites.length > 0 && (
            <div className='hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Nearby Dive Sites</h3>
              <div className='space-y-2'>
                {nearbyDiveSites.slice(0, 6).map(site => (
                  <button
                    key={site.id}
                    onClick={() => navigate(`/dive-sites/${site.id}`)}
                    className='flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full'
                  >
                    <MapPin className='w-4 h-4 mr-2 flex-shrink-0 text-blue-600' />
                    <div className='min-w-0 flex-1'>
                      <div className='font-medium text-gray-900 text-sm truncate'>{site.name}</div>
                      <div className='text-xs text-gray-500'>{site.distance_km} km away</div>
                    </div>
                  </button>
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
