import { Collapse } from 'antd';
import confetti from 'canvas-confetti';
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
  Navigation,
  ExternalLink,
  Lock,
  Globe,
  TrendingUp,
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
import Download from 'yet-another-react-lightbox/plugins/download';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';

import api, { extractErrorMessage } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import CommunityVerdict from '../components/CommunityVerdict';
import DiveSiteRoutes from '../components/DiveSiteRoutes';
import Lightbox from '../components/Lightbox/Lightbox';
import ReactImage from '../components/Lightbox/ReactImage';
import WeatherConditionsCard from '../components/MarineConditionsCard';
import MaskedEmail from '../components/MaskedEmail';
import MiniMap from '../components/MiniMap';
import RateLimitError from '../components/RateLimitError';
import SEO from '../components/SEO';
import ShareButton from '../components/ShareButton';
import StickyRateBar from '../components/StickyRateBar';
import Button from '../components/ui/Button';
import ShellRating from '../components/ui/ShellRating';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify } from '../utils/slugify';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';

import NotFound from './NotFound';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

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
  const [convertedFlickrUrls, setConvertedFlickrUrls] = useState(new Map());
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [autoOpenVideoId, setAutoOpenVideoId] = useState(null);

  // Collapse states for lazy loading
  const [isMarineExpanded, setIsMarineExpanded] = useState(false);
  const [isNearbyExpanded, setIsNearbyExpanded] = useState(false);

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
      if (photos.length === 0 && videos.length > 0) {
        setActiveMediaTab('videos');
      } else if (photos.length > 0 && videos.length === 0) {
        setActiveMediaTab('photos');
      }
    }
  }, [media, photos.length, videos.length]);

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

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
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
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4'>
        {diveSite && (
          <div className='flex-1'>
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
          </div>
        )}

        {/* Action Buttons (Share, Edit) */}
        <div className='flex gap-2 flex-wrap sm:justify-end'>
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
                <Button
                  to={`/dive-sites/${id}/edit`}
                  variant='primary'
                  icon={<Edit className='h-4 w-4' />}
                >
                  Edit
                </Button>
              )
            );
          })()}
        </div>
      </div>

      {/* Header */}
      <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6'>
        <div className='flex flex-col lg:flex-row gap-6'>
          {/* Left Column: Title & Metadata */}
          <div className='flex-1'>
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
            </div>

            {/* Metadata Grid */}
            <div className='grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-x-4 gap-y-6 sm:gap-8'>
              {/* Difficulty */}
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Difficulty
                </span>
                <div className='flex items-center mt-0.5'>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColorClasses(diveSite.difficulty_code)}`}
                  >
                    {diveSite.difficulty_label || getDifficultyLabel(diveSite.difficulty_code)}
                  </span>
                </div>
              </div>

              {/* Max Depth */}
              {diveSite.max_depth && (
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Max Depth
                  </span>
                  <div className='flex items-center gap-1.5'>
                    <TrendingUp className='w-4 h-4 text-gray-400' />
                    <span className='text-sm font-bold text-gray-900'>
                      {diveSite.max_depth}
                      <span className='text-xs font-normal text-gray-400 ml-0.5'>m</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Added Date */}
              <div className='flex flex-col'>
                <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                  Added
                </span>
                <span className='text-sm font-medium text-gray-900'>
                  {new Date(diveSite.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Tags */}
              {diveSite.tags && diveSite.tags.length > 0 && (
                <div className='flex flex-col'>
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Tags
                  </span>
                  <div className='flex flex-wrap gap-2 mt-0.5'>
                    {diveSite.tags.map(tag => (
                      <span
                        key={tag.id}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag.name)}`}
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
                  <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                    Also Known As
                  </span>
                  <div className='flex flex-wrap gap-2 mt-0.5'>
                    {diveSite.aliases.map(alias => (
                      <span
                        key={alias.id}
                        className='px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-600'
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
          <div className='hidden lg:block border-l border-gray-100 pl-8 ml-4'>
            <CommunityVerdict
              diveSite={diveSite}
              onRate={handleQuickRate}
              isSubmitting={rateMutation.isLoading}
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      {/* Removed empty navigation bar - no longer needed */}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Community Verdict - Mobile Only */}
          {diveSite && (
            <div className='lg:hidden'>
              <CommunityVerdict
                diveSite={diveSite}
                onRate={handleQuickRate}
                isSubmitting={rateMutation.isLoading}
              />
            </div>
          )}

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
                    {renderTextWithLinks(decodeHtmlEntities(diveSite.description))}
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
                  {/* Location Actions: Directions and Full Map */}
                  <div className='flex flex-row gap-2 mb-4 w-full'>
                    <Button
                      to={`https://www.google.com/maps/dir/?api=1&destination=${diveSite.latitude},${diveSite.longitude}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      variant='primary'
                      className='flex-[1.6]'
                      title='Get driving directions from Google Maps'
                      icon={<Navigation className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                    >
                      <span className='whitespace-nowrap text-[11px] sm:text-sm'>
                        Get Driving Directions
                      </span>
                      <ExternalLink className='h-3 w-3 opacity-80 hidden sm:inline-block ml-1.5' />
                    </Button>

                    <Button
                      onClick={() => navigate(`/dive-sites/${id}/map`)}
                      variant='white'
                      className='flex-1'
                      icon={<Link className='w-3.5 h-3.5 sm:w-4 sm:h-4' />}
                    >
                      <span className='whitespace-nowrap text-[11px] sm:text-sm'>Full Map</span>
                    </Button>
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
          {diveSite.latitude && diveSite.longitude && (
            <div className='lg:hidden bg-white rounded-lg shadow-md overflow-hidden'>
              <Collapse
                ghost
                onChange={keys => {
                  // If we open it (keys.length > 0), set expanded to true.
                  // If we close it, we can keep it expanded (to cache data) or set false.
                  // Let's set it to true if opened, and keep it true?
                  // Actually, if I toggle, keys array changes.
                  // If I set `setIsNearbyExpanded(keys.length > 0)`, it will disable query when closed.
                  // That's fine, React Query keeps cache.
                  // But if I want to "Close by default and queries ... only be sent once the user opens them", disabling when closed is also fine (or keeping enabled).
                  // Simplest is to sync state.
                  setIsNearbyExpanded(keys.includes('nearby'));
                }}
                items={[
                  {
                    key: 'nearby',
                    label: (
                      <span className='text-lg font-semibold text-gray-900'>Nearby Dive Sites</span>
                    ),
                    children: (
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        {isNearbyLoading ? (
                          <div className='text-center py-4 text-gray-500'>
                            Loading nearby sites...
                          </div>
                        ) : nearbyDiveSites && nearbyDiveSites.length > 0 ? (
                          nearbyDiveSites.slice(0, 6).map(site => (
                            <button
                              key={site.id}
                              onClick={() =>
                                navigate(`/dive-sites/${site.id}/${slugify(site.name)}`)
                              }
                              className='flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full'
                            >
                              <MapPin className='w-4 h-4 mr-2 flex-shrink-0 text-blue-600' />
                              <div className='min-w-0 flex-1'>
                                <div className='font-medium text-gray-900 truncate'>
                                  {site.name}
                                </div>
                                <div className='text-xs text-gray-500'>
                                  {site.distance_km} km away
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='text-center py-4 text-gray-500'>
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
                        to={`/dives/${dive.id}/${slugify(`${dive.name || dive.dive_site?.name || diveSite?.name || 'dive'}-${dive.dive_date}-dive-${dive.id}`)}`}
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
                        {decodeHtmlEntities(dive.dive_information)}
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
              <p className='text-gray-700 text-sm sm:text-base'>
                {decodeHtmlEntities(diveSite.access_instructions)}
              </p>
            </div>
          )}

          {/* Safety Information */}
          {diveSite.safety_information && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Safety Information
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>
                {decodeHtmlEntities(diveSite.safety_information)}
              </p>
            </div>
          )}

          {/* Marine Life */}
          {diveSite.marine_life && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h2 className='text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4'>
                Marine Life
              </h2>
              <p className='text-gray-700 text-sm sm:text-base'>
                {decodeHtmlEntities(diveSite.marine_life)}
              </p>
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
          {/* Weather Conditions - Collapsible */}
          <div className='bg-white rounded-lg shadow-md overflow-hidden'>
            <Collapse
              ghost
              onChange={keys => setIsMarineExpanded(keys.includes('weather'))}
              items={[
                {
                  key: 'weather',
                  label: (
                    <span className='text-lg font-semibold text-gray-900'>
                      Current Weather Conditions
                    </span>
                  ),
                  children: (
                    <div className='-m-4'>
                      {/* Negative margin to counteract Collapse padding */}
                      <WeatherConditionsCard windData={windData} loading={isWindLoading} />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Site Info - Desktop View Only - REMOVED (Consolidated to Header) */}

          {/* Access Instructions - Desktop View Only */}
          {diveSite.access_instructions && (
            <div className='hidden lg:block bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Access Instructions</h3>
              <p className='text-gray-700 text-sm'>
                {decodeHtmlEntities(diveSite.access_instructions)}
              </p>
            </div>
          )}

          {/* Associated Diving Centers - Moved to Sidebar */}
          {divingCenters && divingCenters.length > 0 && (
            <div className='bg-white p-4 sm:p-6 rounded-lg shadow-md'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>Diving Centers</h3>
              <div className='space-y-4'>
                {divingCenters.map(center => (
                  <div key={center.id} className='border rounded-lg p-3'>
                    <div className='flex flex-col gap-1 mb-2'>
                      <h4 className='font-medium text-gray-900 text-sm'>{center.name}</h4>
                      {center.dive_cost && (
                        <span className='text-green-600 font-medium text-xs'>
                          {formatCost(center.dive_cost, center.currency || DEFAULT_CURRENCY)}
                        </span>
                      )}
                    </div>
                    {center.description && (
                      <p className='text-gray-600 text-xs mb-2 line-clamp-2'>
                        {decodeHtmlEntities(center.description)}
                      </p>
                    )}
                    <div className='flex flex-wrap gap-2 text-xs'>
                      {center.email && (
                        <a
                          href={`mailto:${center.email}`}
                          className='flex items-center text-blue-600 hover:text-blue-700'
                          title='Email'
                        >
                          <Link className='h-3 w-3 mr-1' />
                          Email
                        </a>
                      )}
                      {center.phone && (
                        <a
                          href={`tel:${center.phone}`}
                          className='flex items-center text-blue-600 hover:text-blue-700'
                          title='Phone'
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
                          title='Website'
                        >
                          <Link className='h-3 w-3 mr-1' />
                          Web
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Dive Sites - Desktop View Only */}
          {diveSite.latitude && diveSite.longitude && (
            <div className='hidden lg:block bg-white rounded-lg shadow-md overflow-hidden'>
              <Collapse
                ghost
                onChange={keys => setIsNearbyExpanded(keys.includes('nearby-desktop'))}
                items={[
                  {
                    key: 'nearby-desktop',
                    label: (
                      <span className='text-lg font-semibold text-gray-900'>Nearby Dive Sites</span>
                    ),
                    children: (
                      <div className='space-y-2'>
                        {isNearbyLoading ? (
                          <div className='text-center py-4 text-gray-500'>
                            Loading nearby sites...
                          </div>
                        ) : nearbyDiveSites && nearbyDiveSites.length > 0 ? (
                          nearbyDiveSites.slice(0, 6).map(site => (
                            <button
                              key={site.id}
                              onClick={() =>
                                navigate(`/dive-sites/${site.id}/${slugify(site.name)}`)
                              }
                              className='flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left w-full'
                            >
                              <MapPin className='w-4 h-4 mr-2 flex-shrink-0 text-blue-600' />
                              <div className='min-w-0 flex-1'>
                                <div className='font-medium text-gray-900 text-sm truncate'>
                                  {site.name}
                                </div>
                                <div className='text-xs text-gray-500'>
                                  {site.distance_km} km away
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='text-center py-4 text-gray-500'>
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
        </div>
      </div>
    </div>
  );
};

export default DiveSiteDetail;
