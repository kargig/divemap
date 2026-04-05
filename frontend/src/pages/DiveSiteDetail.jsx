import { Collapse } from 'antd';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Star,
  MapPin,
  MessageCircle,
  Video,
  Link,
  ChevronDown,
  ChevronUp,
  Navigation,
  ExternalLink,
  Lock,
  Globe,
  TrendingUp,
  RotateCcw,
  Clock,
  Info,
  CloudSun,
  Route,
} from 'lucide-react';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import Download from 'yet-another-react-lightbox/plugins/download';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';

import api from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import CommunityVerdict from '../components/CommunityVerdict';
import DiveSiteRoutes from '../components/DiveSiteRoutes';
import DiveSiteSidebar from '../components/DiveSiteSidebar';
import Lightbox from '../components/Lightbox/Lightbox';
import ReactImage from '../components/Lightbox/ReactImage';
import WeatherConditionsCard from '../components/MarineConditionsCard';
import MaskedEmail from '../components/MaskedEmail';
import RateLimitError from '../components/RateLimitError';
import SEO from '../components/SEO';
import ShareButton from '../components/ShareButton';
import StickyRateBar from '../components/StickyRateBar';
import Button from '../components/ui/Button';
import ShellRating from '../components/ui/ShellRating';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import useFlickrImages from '../hooks/useFlickrImages';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

import NotFound from './NotFound';
import UnprocessableEntity from './UnprocessableEntity';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

const MiniMap = lazy(() => import('../components/MiniMap'));

const DiveSiteDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState('photos');
  const [activeContentTab, setActiveContentTab] = useState('description');
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [autoOpenVideoId, setAutoOpenVideoId] = useState(null);

  // Collapse states for lazy loading
  const [isMarineExpanded, setIsMarineExpanded] = useState(false);
  const [isNearbyExpanded, setIsNearbyExpanded] = useState(false);
  const [isTopDivesExpanded, setIsTopDivesExpanded] = useState(false);
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(false);

  // Helper to check if URL is video
  const isVideoUrl = useCallback(url => {
    if (!url) return false;
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('vimeo.com') ||
      url.includes('.mp4')
    );
  }, []);

  const {
    data: diveSite,
    isLoading,
    error,
  } = useQuery(['dive-site', id], () => api.get(`/api/v1/dive-sites/${id}`), {
    select: response => response.data,
    retry: (failureCount, error) => {
      if (error.response?.status === 404 || error.response?.status === 422) return false;
      return failureCount < 3;
    },
    onSuccess: _data => {},
    onError: _error => {
      // Error handled by error state
    },
  });

  // Media data
  const { data: media } = useQuery(
    ['dive-site-media', id],
    () => api.get(`/api/v1/dive-sites/${id}/media`),
    {
      select: response => response.data,
      enabled: !!id && !!diveSite,
    }
  );

  // Use hook to convert Flickr URLs
  const { data: convertedFlickrUrls = new Map() } = useFlickrImages(media, isVideoUrl);

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

  // Redirect to canonical URL with slug
  useEffect(() => {
    if (diveSite && diveSite.name) {
      const expectedSlug = slugify(diveSite.name);
      if (!slug || slug !== expectedSlug) {
        navigate(`/dive-sites/${id}/${expectedSlug}${location.search}`, { replace: true });
      }
    }
  }, [diveSite, id, slug, navigate, location.search]);

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

  const { data: divingCenters } = useQuery(
    ['dive-site-diving-centers', id],
    () => api.get(`/api/v1/dive-sites/${id}/diving-centers`),
    {
      select: response => response.data,
      enabled: !!id && !!diveSite,
    }
  );

  // Derived media categories
  const publicVideos = (media || []).filter(item => isVideoUrl(item.url));
  const publicPhotos = (media || []).filter(item => !isVideoUrl(item.url));

  const { data: nearbyDiveSites, isLoading: isNearbyLoading } = useQuery(
    ['dive-site-nearby', id],
    () => api.get(`/api/v1/dive-sites/${id}/nearby?limit=10`),
    {
      select: response => response.data,
      enabled: isNearbyExpanded && !!diveSite && !!diveSite.latitude && !!diveSite.longitude,
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

  const { data: windData, isLoading: isWindLoading } = useQuery(
    ['wind-data-site', id],
    () =>
      api.get('/api/v1/weather/wind', {
        params: {
          latitude: diveSite.latitude,
          longitude: diveSite.longitude,
          wind_speed_unit: 'ms',
        },
      }),
    {
      select: response => response.data,
      enabled: isMarineExpanded && !!diveSite && !!diveSite.latitude && !!diveSite.longitude,
      staleTime: 1000 * 60 * 15, // 15 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: false, // Don't retry weather errors aggressively
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
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
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

  const handleCommentSubmit = e => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    commentMutation.mutate(comment);
  };

  // All media is public (is_public column removed from database)
  const publicMedia = media || [];

  // Helper to get the URL (converted if Flickr, original otherwise)
  const getImageUrl = url => {
    return convertedFlickrUrls.get(url) || url;
  };

  // For backward compatibility, keep these for the main tabs
  const videos = publicVideos;
  const photos = publicPhotos;

  const photoSlides = photos.map(item => ({
    src: getImageUrl(item.medium_url || item.url),
    thumbnail: getImageUrl(item.thumbnail_url || item.medium_url || item.url),
    width: 1920,
    height: 1080,
    alt: decodeHtmlEntities(item.description) || 'Dive site photo',
    description: decodeHtmlEntities(item.description) || '',
    // Store original URL for potential future use (e.g. download)
    // Use explicit download_url if available (signed for attachment), otherwise fallback to viewing URL
    download: getImageUrl(item.download_url || item.url),
  }));

  // Auto-select media tab based on availability
  useEffect(() => {
    if (media && media.length > 0) {
      if (publicPhotos.length === 0 && publicVideos.length > 0) {
        setActiveMediaTab('videos');
      } else if (publicPhotos.length > 0 && publicVideos.length === 0) {
        setActiveMediaTab('photos');
      }
    }
  }, [media, publicPhotos.length, publicVideos.length]);

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

  // Handle deep linking to specific media
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mediaId = searchParams.get('mediaId');
    const source = searchParams.get('source'); // 'site_media' or 'dive_media'
    const type = searchParams.get('type');
    const autoPlay = searchParams.get('autoPlay') === 'true';

    // Ensure media data is loaded and we are on the media tab
    if (media && media.length > 0 && mediaId && activeContentTab === 'media') {
      if (type === 'photo') {
        // ... (existing photo logic)
        // ...
      } else if (type === 'video') {
        // Find video item to construct ID
        const video = videos.find(v => {
          const isDiveMedia = !!v.dive_id;
          const vSource = isDiveMedia ? 'dive_media' : 'site_media';
          if (source) {
            return String(v.id) === String(mediaId) && vSource === source;
          }
          return String(v.id) === String(mediaId);
        });

        if (video) {
          setActiveMediaTab('videos');
          if (autoPlay) {
            setAutoOpenVideoId(`${video.dive_id ? `dive-${video.dive_id}-` : 'site-'}${video.id}`);
          }
          // Scroll to video
          setTimeout(() => {
            const elementId = `video-${video.dive_id ? `dive-${video.dive_id}-` : 'site-'}${video.id}`;
            const element = document.getElementById(elementId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500); // Delay to ensure tab content is rendered
        }
      }
    }
  }, [media, activeContentTab, location.search, photos, videos]);

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

    if (error.response?.status === 422) {
      return <UnprocessableEntity />;
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

    const itemListElement = [
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
    ];

    let currentPosition = 3;

    if (diveSite.country) {
      itemListElement.push({
        '@type': 'ListItem',
        position: currentPosition++,
        name: diveSite.country,
        item: `${window.location.origin}/dive-sites?country=${encodeURIComponent(diveSite.country)}`,
      });
    }

    if (diveSite.region) {
      itemListElement.push({
        '@type': 'ListItem',
        position: currentPosition++,
        name: diveSite.region,
        item: `${window.location.origin}/dive-sites?country=${encodeURIComponent(
          diveSite.country || ''
        )}&region=${encodeURIComponent(diveSite.region)}`,
      });
    }

    itemListElement.push({
      '@type': 'ListItem',
      position: currentPosition,
      name: diveSite.name,
      item: window.location.href,
    });

    const schema = {
      '@context': 'https://schema.org',
      '@type': ['Place', 'BodyOfWater', 'TouristAttraction'],
      name: diveSite.name,
      description: decodeHtmlEntities(diveSite.description),
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
        itemListElement: itemListElement,
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

  const handleQuickRate = score => {
    rateMutation.mutate({ score });
    setRating(score);
  };

  const renderTopDivesList = () => (
    <>
      <div className='space-y-3'>
        {topDives.map(dive => (
          <div
            key={dive.id}
            className='border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors bg-gray-50/30'
          >
            <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1.5 mb-2'>
              <RouterLink
                to={`/dives/${dive.id}/${slugify(`${dive.name || dive.dive_site?.name || diveSite?.name || 'dive'}-${dive.dive_date}-dive-${dive.id}`)}`}
                className='font-bold text-blue-600 hover:text-blue-800 hover:underline text-sm sm:text-base leading-tight'
              >
                {dive.name || dive.dive_site?.name || 'Unnamed Dive'}
              </RouterLink>
              {dive.user_rating && (
                <div className='flex items-center bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 shrink-0'>
                  <Star className='h-3 w-3 text-yellow-500 mr-1 fill-current' />
                  <span className='text-[11px] font-bold text-yellow-700'>
                    {dive.user_rating}/10
                  </span>
                </div>
              )}
            </div>

            <div className='text-[11px] sm:text-sm text-gray-500 space-y-1.5 mb-2'>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <div className='flex items-center gap-1'>
                  <span className='font-semibold text-gray-400 uppercase text-[9px]'>Date:</span>
                  <span className='text-gray-700'>
                    {new Date(dive.dive_date).toLocaleDateString()}
                  </span>
                </div>

                {dive.user_username && (
                  <div className='flex items-center gap-1'>
                    <span className='font-semibold text-gray-400 uppercase text-[9px]'>By:</span>
                    <RouterLink
                      to={`/users/${dive.user_username}`}
                      className='text-blue-500 hover:text-blue-700 font-medium'
                    >
                      {dive.user_username}
                    </RouterLink>
                  </div>
                )}
              </div>

              <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5'>
                {dive.max_depth && (
                  <div className='flex items-center gap-1'>
                    <TrendingUp className='w-3 h-3 text-gray-300' />
                    <span className='text-gray-700 font-medium'>{dive.max_depth}m</span>
                  </div>
                )}

                {dive.duration && (
                  <div className='flex items-center gap-1'>
                    <Clock className='w-3 h-3 text-gray-300' />
                    <span className='text-gray-700 font-medium'>{dive.duration}min</span>
                  </div>
                )}

                {dive.difficulty_code && (
                  <div className='flex items-center gap-1'>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${getDifficultyColorClasses(dive.difficulty_code)}`}
                    >
                      {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {dive.dive_information && (
              <p className='text-[13px] text-gray-600 line-clamp-2 leading-relaxed border-t border-gray-100 pt-2'>
                {decodeHtmlEntities(dive.dive_information)}
              </p>
            )}

            {dive.tags && dive.tags.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-2'>
                {dive.tags.map(tag => (
                  <span
                    key={tag.id}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${getTagColor(tag.name)}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className='mt-3 sm:mt-4 text-center'>
        <RouterLink
          to={`/dives?dive_site_id=${id}`}
          className='inline-block px-3 py-1.5 text-blue-600 hover:text-blue-800 transition-colors text-xs sm:text-sm font-medium rounded-md'
        >
          View All Dives at This Site →
        </RouterLink>
      </div>
    </>
  );

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-2.5 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
      {diveSite && (
        <StickyRateBar
          diveSite={diveSite}
          onRate={handleQuickRate}
          isSubmitting={rateMutation.isLoading}
        />
      )}
      {diveSite && (
        <SEO
          title={`Divemap - ${diveSite.name} - ${diveSite.region || ''} ${diveSite.country || ''}`}
          description={getMetaDescription()}
          type='place'
          image={photos.length > 0 ? getImageUrl(photos[0].url) : undefined}
          imageAlt={
            photos.length > 0
              ? decodeHtmlEntities(photos[0].description) || `Dive site ${diveSite.name}`
              : undefined
          }
          siteName='Divemap'
          location={{ lat: diveSite.latitude, lon: diveSite.longitude }}
          schema={getSchema()}
        />
      )}
      {/* Top Bar: Breadcrumbs and Actions */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4'>
        {diveSite && (
          <div className='flex-1 min-w-0'>
            <Breadcrumbs
              items={[
                { label: 'Sites', to: '/dive-sites' },
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
          </div>
        )}

        {/* Action Buttons (Share, Edit) */}
        <div className='flex gap-2 flex-wrap sm:justify-end'>
          {diveSite && !diveSite.deleted_at && (
            <ShareButton
              entityType='dive-site'
              entityData={diveSite}
              className='inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm'
            />
          )}
          {(() => {
            const isOwner = user?.id === diveSite?.created_by;
            const isAdmin = user?.is_admin;
            const isModerator = user?.is_moderator;
            const shouldShowEdit = !!user; // Let any logged in user suggest edits
            const shouldShowDelete = (isOwner || isAdmin) && !diveSite?.deleted_at;
            const shouldShowRestore = isAdmin && diveSite?.deleted_at;

            const handleDelete = async () => {
              if (
                window.confirm(
                  `Are you sure you want to archive the dive site "${diveSite.name}"?\n\nDives linked to this site will be preserved, but the site itself will be hidden from others (Soft Delete).`
                )
              ) {
                try {
                  await api.delete(`/api/v1/dive-sites/${id}`);
                  queryClient.invalidateQueries(['dive-site', id]);
                  toast.success('Dive site archived successfully');
                  navigate('/dive-sites');
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }
            };

            const handleRestore = async () => {
              if (
                window.confirm(
                  `Are you sure you want to restore the archived dive site "${diveSite.name}"?\n\nIt will become visible to the public again.`
                )
              ) {
                try {
                  await api.post(`/api/v1/dive-sites/${id}/restore`);
                  queryClient.invalidateQueries(['dive-site', id]);
                  toast.success('Dive site restored successfully');
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }
            };

            return (
              <>
                {shouldShowEdit && (
                  <Button
                    to={`/dive-sites/${id}/edit`}
                    variant='primary'
                    icon={<Edit className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    className='px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm'
                  >
                    Edit
                  </Button>
                )}
                {shouldShowDelete && (
                  <button
                    onClick={handleDelete}
                    className='inline-flex items-center px-3 py-1.5 border border-red-300 text-xs sm:text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm transition-colors'
                    title='Archive dive site'
                  >
                    <Trash2 className='h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5' />
                    Archive
                  </button>
                )}
                {shouldShowRestore && (
                  <button
                    onClick={handleRestore}
                    className='inline-flex items-center px-3 py-1.5 border border-yellow-400 text-xs sm:text-sm font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 shadow-sm transition-colors'
                    title='Restore dive site'
                  >
                    <RotateCcw className='h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5' />
                    Restore
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Header */}
      <div
        id='overview'
        className='bg-white p-2.5 sm:p-6 rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 scroll-mt-20'
      >
        <div className='flex flex-col lg:flex-row gap-2 sm:gap-6'>
          {/* Left Column: Title & Metadata */}
          <div className='flex-1'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-4'>
              <div className='flex items-center gap-1.5 sm:gap-4 w-full'>
                <button
                  onClick={() => {
                    const from = location.state?.from;
                    if (from) {
                      navigate(from);
                    } else {
                      navigate('/dive-sites');
                    }
                  }}
                  className='text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0'
                >
                  <ArrowLeft className='w-4 h-4 sm:w-6 sm:h-6' />
                </button>
                <div className='min-w-0 flex-1'>
                  <h1 className='text-[17px] sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words leading-tight'>
                    {diveSite.name}
                    {diveSite.deleted_at && (
                      <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-800 align-middle uppercase tracking-tighter'>
                        ARCHIVED
                      </span>
                    )}
                  </h1>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className='grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-x-3 gap-y-3 sm:gap-8 pl-1 sm:pl-0'>
              {/* Rating (Mobile Only) */}
              <div className='flex flex-col lg:hidden'>
                <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                  Rating
                </span>
                <div className='flex items-center gap-1 mt-0.5'>
                  <img
                    src='/arts/divemap_shell.png'
                    alt='Rating'
                    className='w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain opacity-80'
                  />
                  <span className='text-xs sm:text-sm font-bold text-gray-900 leading-none'>
                    {diveSite.average_rating ? Number(diveSite.average_rating).toFixed(1) : '-'}
                  </span>
                  <span className='text-[10px] text-gray-400 font-medium ml-0.5 leading-none'>
                    ({diveSite.total_ratings || 0})
                  </span>
                </div>
              </div>

              {/* Difficulty */}
              <div className='flex flex-col'>
                <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                  Difficulty
                </span>
                <div className='flex items-center mt-0.5'>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${getDifficultyColorClasses(diveSite.difficulty_code)}`}
                  >
                    {diveSite.difficulty_label || getDifficultyLabel(diveSite.difficulty_code)}
                  </span>
                </div>
              </div>

              {/* Max Depth */}
              {diveSite.max_depth && (
                <div className='flex flex-col'>
                  <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                    Max Depth
                  </span>
                  <div className='flex items-center gap-1'>
                    <TrendingUp className='w-3.5 h-3.5 text-gray-400' />
                    <span className='text-xs sm:text-sm font-bold text-gray-900'>
                      {diveSite.max_depth}
                      <span className='text-[10px] font-normal text-gray-400 ml-0.5'>m</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Added Date */}
              <div className='flex flex-col'>
                <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                  Added
                </span>
                <span className='text-xs sm:text-sm font-medium text-gray-900'>
                  {new Date(diveSite.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Tags */}
              {diveSite.tags && diveSite.tags.length > 0 && (
                <div className='flex flex-col col-span-2'>
                  <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                    Tags
                  </span>
                  <div className='flex flex-wrap gap-1.5 mt-0.5'>
                    {diveSite.tags.map(tag => (
                      <span
                        key={tag.id}
                        className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getTagColor(tag.name)}`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Aliases */}
              {diveSite.aliases && diveSite.aliases.length > 0 && (
                <div className='flex flex-col col-span-2 sm:col-span-1'>
                  <span className='text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'>
                    Also Known As
                  </span>
                  <div className='flex flex-wrap gap-1.5 mt-0.5'>
                    {diveSite.aliases.map(alias => (
                      <span
                        key={alias.id}
                        className='px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100'
                      >
                        {alias.alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Community Verdict (Desktop Only) */}
          <div className='hidden lg:block lg:w-auto lg:border-l lg:border-gray-100 lg:pl-6 lg:ml-2'>
            <CommunityVerdict
              diveSite={diveSite}
              onRate={handleQuickRate}
              isSubmitting={rateMutation.isLoading}
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Tabs Navigation */}
      <div className='lg:hidden -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 mb-4 overflow-x-auto hide-scrollbar sticky top-0 bg-gray-50/90 backdrop-blur-sm z-40 py-2 border-b border-gray-200/50'>
        <nav
          className='flex justify-between items-center w-full gap-1 px-1'
          aria-label='Mobile Sections'
        >
          <a
            href='#overview'
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Overview'
          >
            <Info className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Info
            </span>
          </a>
          <a
            href='#location'
            onClick={() => setIsNearbyExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Location'
          >
            <MapPin className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Map
            </span>
          </a>
          <a
            href='#weather'
            onClick={() => setIsMarineExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Weather Conditions'
          >
            <CloudSun className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Weather
            </span>
          </a>
          <a
            href='#routes'
            onClick={() => setIsRoutesExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Available Routes'
          >
            <Route className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Routes
            </span>
          </a>
          <a
            href='#dives'
            onClick={() => setIsTopDivesExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Top Dives'
          >
            <TrendingUp className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Dives
            </span>
          </a>
          <a
            href='#comments'
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Comments'
          >
            <MessageCircle className='w-3.5 h-3.5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[7px] font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Comments
            </span>
          </a>
        </nav>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-4 sm:space-y-6'>
          {/* Description & Media Gallery with Tabs */}
          {(diveSite.description || (media && media.length > 0)) && (
            <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              {/* Main Tab Navigation */}
              <div className='border-b border-gray-200 mb-3 sm:mb-4'>
                <nav className='flex space-x-4 sm:space-x-8'>
                  {diveSite.description && (
                    <button
                      onClick={() =>
                        setSearchParams(prev => {
                          prev.set('tab', 'description');
                          return prev;
                        })
                      }
                      className={`py-1.5 sm:py-2 px-0.5 sm:px-1 border-b-2 font-bold text-[10px] sm:text-sm uppercase tracking-wider ${
                        activeContentTab === 'description'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
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
                      className={`py-1.5 sm:py-2 px-0.5 sm:px-1 border-b-2 font-bold text-[10px] sm:text-sm uppercase tracking-wider ${
                        activeContentTab === 'media'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
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
                  <p className='text-gray-700 text-[13px] sm:text-base leading-relaxed'>
                    {renderTextWithLinks(decodeHtmlEntities(diveSite.description))}
                  </p>
                </div>
              )}

              {activeContentTab === 'media' && media && media.length > 0 && (
                <div>
                  {/* Media Tab Navigation */}
                  <div className='border-b border-gray-200 mb-3 sm:mb-4'>
                    <nav className='flex space-x-4 sm:space-x-8'>
                      {photos.length > 0 && (
                        <button
                          onClick={() => setActiveMediaTab('photos')}
                          className={`py-1.5 sm:py-2 px-0.5 sm:px-1 border-b-2 font-bold text-[10px] sm:text-sm uppercase tracking-wider ${
                            activeMediaTab === 'photos'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          Photos ({photos.length})
                        </button>
                      )}
                      {videos.length > 0 && (
                        <button
                          onClick={() => setActiveMediaTab('videos')}
                          className={`py-1.5 sm:py-2 px-0.5 sm:px-1 border-b-2 font-bold text-[10px] sm:text-sm uppercase tracking-wider flex items-center space-x-1.5 ${
                            activeMediaTab === 'videos'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Video className='w-3 h-3 sm:w-3.5 sm:h-3.5' />
                          <span>Videos ({videos.length})</span>
                        </button>
                      )}
                    </nav>
                  </div>

                  {/* Media Tab Content */}
                  {activeMediaTab === 'photos' && photos.length > 0 && (
                    <div>
                      <Lightbox
                        open={isLightboxOpen}
                        close={() => setIsLightboxOpen(false)}
                        index={lightboxIndex}
                        on={{ view: ({ index }) => setLightboxIndex(index) }}
                        slides={photoSlides}
                        plugins={[Captions, Download, Slideshow, Fullscreen, Thumbnails]}
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
                          id={`video-${item.dive_id ? `dive-${item.dive_id}-` : 'site-'}${item.id}`}
                          className='border rounded-lg overflow-hidden'
                        >
                          <div className='relative'>
                            <YouTubePreview
                              url={item.url}
                              description={decodeHtmlEntities(item.description)}
                              className='w-full'
                              openInNewTab={false}
                              autoOpen={
                                autoOpenVideoId ===
                                `${item.dive_id ? `dive-${item.dive_id}-` : 'site-'}${item.id}`
                              }
                              autoPlay={
                                autoOpenVideoId ===
                                `${item.dive_id ? `dive-${item.dive_id}-` : 'site-'}${item.id}`
                              }
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
            <div
              id='location'
              className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100 scroll-mt-16'
            >
              <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4'>
                Location
              </h2>
              {diveSite.address && (
                <div className='mb-3 flex items-start gap-2'>
                  <MapPin className='w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0' />
                  <span className='text-xs sm:text-sm text-gray-600'>{diveSite.address}</span>
                </div>
              )}
              {diveSite.latitude && diveSite.longitude && (
                <>
                  {/* Location Actions: Directions and Full Map */}
                  <div className='flex flex-row gap-2 mb-3 w-full'>
                    <Button
                      to={`https://www.google.com/maps/dir/?api=1&destination=${diveSite.latitude},${diveSite.longitude}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      variant='primary'
                      className='flex-[1.8] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm'
                      title='Get driving directions from Google Maps'
                      icon={<Navigation className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    >
                      <span className='whitespace-nowrap'>Get Directions</span>
                    </Button>

                    <Button
                      onClick={() => navigate(`/dive-sites/${id}/map`)}
                      variant='white'
                      className='flex-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md shadow-sm'
                      icon={<Link className='w-3.5 h-3.5 sm:h-4 sm:w-4' />}
                    >
                      <span className='whitespace-nowrap'>Full Map</span>
                    </Button>
                  </div>

                  <Suspense
                    fallback={
                      <div className='h-48 sm:h-64 bg-gray-50 flex items-center justify-center rounded border border-gray-200'>
                        Loading Map...
                      </div>
                    }
                  >
                    <MiniMap
                      latitude={diveSite.latitude}
                      longitude={diveSite.longitude}
                      name={diveSite.name}
                      onMaximize={() => setIsMapMaximized(true)}
                      showMaximizeButton={false}
                      isMaximized={isMapMaximized}
                      onClose={() => setIsMapMaximized(false)}
                    />
                  </Suspense>
                </>
              )}
            </div>
          ) : null}

          {/* Weather Conditions - Mobile Only (Desktop is in Sidebar) */}
          <div
            id='weather'
            className='lg:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-16'
          >
            <Collapse
              ghost
              activeKey={isMarineExpanded ? ['weather-mobile'] : []}
              onChange={keys => setIsMarineExpanded(keys.includes('weather-mobile'))}
              items={[
                {
                  key: 'weather-mobile',
                  label: (
                    <span className='text-base sm:text-xl font-bold text-gray-900'>
                      Weather Conditions
                    </span>
                  ),
                  children: (
                    <div className='-m-3 sm:-m-6 mt-0'>
                      <WeatherConditionsCard windData={windData} loading={isWindLoading} />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Available Routes */}
          <div id='routes' className='scroll-mt-16'>
            {/* Desktop View */}
            <div className='hidden lg:block'>
              <DiveSiteRoutes diveSiteId={id} />
            </div>

            {/* Mobile View */}
            <div className='lg:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
              <Collapse
                ghost
                activeKey={isRoutesExpanded ? ['routes-mobile'] : []}
                onChange={keys => setIsRoutesExpanded(keys.includes('routes-mobile'))}
                items={[
                  {
                    key: 'routes-mobile',
                    label: (
                      <span className='text-base sm:text-xl font-bold text-gray-900'>
                        Available Routes
                      </span>
                    ),
                    children: (
                      <div className='-mt-4 -mb-2 -mx-2'>
                        <DiveSiteRoutes diveSiteId={id} isMobileCollapsed={true} />
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {/* Nearby Dive Sites - Mobile View Only */}
          {diveSite.latitude && diveSite.longitude && (
            <div
              id='nearby'
              className='lg:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-16'
            >
              <Collapse
                ghost
                activeKey={isNearbyExpanded ? ['nearby'] : []}
                onChange={keys => {
                  setIsNearbyExpanded(keys.includes('nearby'));
                }}
                items={[
                  {
                    key: 'nearby',
                    label: (
                      <span className='text-base sm:text-lg font-bold text-gray-900'>
                        Nearby Dive Sites
                      </span>
                    ),
                    children: (
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                        {isNearbyLoading ? (
                          <div className='text-center py-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider'>
                            Loading nearby sites...
                          </div>
                        ) : nearbyDiveSites && nearbyDiveSites.length > 0 ? (
                          nearbyDiveSites.slice(0, 6).map(site => (
                            <button
                              key={site.id}
                              onClick={() =>
                                navigate(`/dive-sites/${site.id}/${slugify(site.name)}`)
                              }
                              className='flex items-center p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left w-full shadow-sm'
                            >
                              <MapPin className='w-3.5 h-3.5 mr-2 flex-shrink-0 text-blue-500' />
                              <div className='min-w-0 flex-1'>
                                <div className='font-bold text-gray-900 text-xs truncate leading-tight'>
                                  {site.name}
                                </div>
                                <div className='text-[10px] text-gray-400 font-medium'>
                                  {site.distance_km} km away
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='text-center py-4 text-xs text-gray-500 italic'>
                            No nearby dive sites found.
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* Top Dives */}
          {topDives && topDives.length > 0 && (
            <>
              {/* Desktop View */}
              <div className='hidden lg:block bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100 scroll-mt-16'>
                <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4'>
                  Top Dives
                </h2>
                {renderTopDivesList()}
              </div>

              {/* Mobile View */}
              <div
                id='dives'
                className='lg:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden scroll-mt-16'
              >
                <Collapse
                  ghost
                  activeKey={isTopDivesExpanded ? ['top-dives-mobile'] : []}
                  onChange={keys => setIsTopDivesExpanded(keys.includes('top-dives-mobile'))}
                  items={[
                    {
                      key: 'top-dives-mobile',
                      label: (
                        <span className='text-base sm:text-xl font-bold text-gray-900'>
                          Top Dives
                        </span>
                      ),
                      children: <div className='-mt-2'>{renderTopDivesList()}</div>,
                    },
                  ]}
                />
              </div>
            </>
          )}

          {/* Access Instructions - Mobile View Only */}
          {diveSite.access_instructions && (
            <div className='lg:hidden bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4'>
                Access Instructions
              </h2>
              <p className='text-gray-700 text-xs sm:text-base leading-relaxed'>
                {decodeHtmlEntities(diveSite.access_instructions)}
              </p>
            </div>
          )}

          {/* Safety Information */}
          {diveSite.safety_information && (
            <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4'>
                Safety Information
              </h2>
              <p className='text-gray-700 text-xs sm:text-base leading-relaxed'>
                {decodeHtmlEntities(diveSite.safety_information)}
              </p>
            </div>
          )}

          {/* Marine Life */}
          {diveSite.marine_life && (
            <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4'>
                Marine Life
              </h2>
              <p className='text-gray-700 text-xs sm:text-base leading-relaxed'>
                {decodeHtmlEntities(diveSite.marine_life)}
              </p>
            </div>
          )}

          {/* Comments */}
          <div
            id='comments'
            className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100 scroll-mt-16'
          >
            <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2'>
              <h2 className='text-base sm:text-xl font-bold text-gray-900'>Comments</h2>
              {user && (
                <button
                  onClick={() => setShowCommentForm(!showCommentForm)}
                  className='flex items-center justify-center px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors w-full sm:w-auto text-xs sm:text-sm font-medium'
                >
                  <MessageCircle className='h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5' />
                  Add Comment
                </button>
              )}
            </div>

            {showCommentForm && user && (
              <form onSubmit={handleCommentSubmit} className='mb-6'>
                <label
                  htmlFor='comment-textarea'
                  className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'
                >
                  Your Comment
                </label>
                <textarea
                  id='comment-textarea'
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder='Share your experience...'
                  className='w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all'
                  rows='3'
                />
                <div className='flex justify-end mt-2'>
                  <button
                    type='submit'
                    disabled={commentMutation.isLoading}
                    className='px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm font-medium shadow-sm transition-colors'
                  >
                    {commentMutation.isLoading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}

            <div className='space-y-4'>
              {comments?.map(comment => (
                <div
                  key={comment.id}
                  className='border-b border-gray-100 pb-4 last:border-0 last:pb-0'
                >
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-1.5'>
                      <RouterLink
                        to={`/users/${comment.username}`}
                        className='font-bold text-blue-600 hover:text-blue-800 hover:underline text-xs sm:text-sm'
                      >
                        {comment.username}
                      </RouterLink>
                      {(comment.user_diving_certification || comment.user_number_of_dives) && (
                        <div className='flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500'>
                          {comment.user_diving_certification && (
                            <span className='bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 font-medium'>
                              {comment.user_diving_certification}
                            </span>
                          )}
                          {comment.user_number_of_dives > 0 && (
                            <span className='bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100 font-medium'>
                              {comment.user_number_of_dives} dives
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className='text-[10px] sm:text-xs text-gray-400'>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className='text-gray-700 text-[13px] sm:text-base leading-relaxed'>
                    {renderTextWithLinks(comment.comment_text, { isUGC: true, shorten: false })}
                  </p>
                </div>
              ))}

              {comments?.length === 0 && (
                <p className='text-gray-500 text-center py-4 text-xs sm:text-sm italic bg-gray-50/50 rounded-lg'>
                  No comments yet. Be the first to share your experience!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <DiveSiteSidebar
          diveSite={diveSite}
          windData={windData}
          isWindLoading={isWindLoading}
          setIsMarineExpanded={setIsMarineExpanded}
          divingCenters={divingCenters}
          nearbyDiveSites={nearbyDiveSites}
          isNearbyLoading={isNearbyLoading}
          setIsNearbyExpanded={setIsNearbyExpanded}
        />
      </div>
    </div>
  );
};

export default DiveSiteDetail;
