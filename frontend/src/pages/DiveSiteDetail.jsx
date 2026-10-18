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
  Info,
  CloudSun,
  Route,
  User,
  Bookmark,
  Fish,
  Play,
  Plus,
  Footprints,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import Lightbox from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Download from 'yet-another-react-lightbox/plugins/download';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/counter.css';

import api from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import CommunityVerdict from '../components/CommunityVerdict';
import DiveSiteMediaPreview from '../components/DiveSiteMediaPreview';
import DiveSiteRoutes from '../components/DiveSiteRoutes';
import DiveSiteSidebar from '../components/DiveSiteSidebar';
import ReactImage from '../components/Lightbox/ReactImage';
import WeatherConditionsCard from '../components/MarineConditionsCard';
import MaskedEmail from '../components/MaskedEmail';
import RateLimitError from '../components/RateLimitError';
import SaveToListModal from '../components/SaveToListModal';
import SEO from '../components/SEO';
import ShareButton from '../components/ShareButton';
import StickyRateBar from '../components/StickyRateBar';
import Button from '../components/ui/Button';
import DepthIcon from '../components/ui/DepthIcon';
import DifficultyBadge from '../components/ui/DifficultyBadge';
import RichText from '../components/ui/RichText';
import StarfishRating from '../components/ui/StarfishRating';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import useFlickrImages from '../hooks/useFlickrImages';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatCost, DEFAULT_CURRENCY } from '../utils/currency';
import { formatDate } from '../utils/dateHelpers';
import { getDifficultyLabel } from '../utils/difficultyHelpers';
import { buildGeoHubPath } from '../utils/geoHubs';
import { decodeHtmlEntities, stripHtmlTags } from '../utils/htmlDecode';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { slugify, getDiveSiteSlug } from '../utils/slugify';
import { getTagColor } from '../utils/tagHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';
import {
  isYouTubeUrl,
  isVimeoUrl,
  extractYouTubeVideoId,
  extractVimeoVideoId,
  getYouTubeEmbedUrl,
  getVimeoEmbedUrl,
  getYouTubeThumbnailUrl,
} from '../utils/youtubeHelpers';

import NotFound from './NotFound';
import UnprocessableEntity from './UnprocessableEntity';

// Use extractErrorMessage from api.js
const getErrorMessage = error => extractErrorMessage(error, 'An error occurred');

const MiniMap = lazy(() => import('../components/MiniMap'));

const DiveSiteDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Collapse states for lazy loading
  const [isMarineExpanded, setIsMarineExpanded] = useState(false);
  const [isNearbyExpanded, setIsNearbyExpanded] = useState(false);
  const [isRoutesExpanded, setIsRoutesExpanded] = useState(false);

  // Helper to check if URL is video
  const isVideoUrl = useCallback(url => {
    if (!url) return false;
    return isYouTubeUrl(url) || isVimeoUrl(url) || url.includes('.mp4');
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
      const expectedSlug = getDiveSiteSlug(diveSite);
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

  const isOwner = user?.id === diveSite?.created_by;
  const isAdmin = user?.is_admin;
  const shouldShowEdit = !!user;
  const shouldShowDelete = (isOwner || isAdmin) && !diveSite?.deleted_at;
  const shouldShowRestore = isAdmin && diveSite?.deleted_at;

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to archive the dive site "${diveSite?.name}"?\n\nDives linked to this site will be preserved, but the site itself will be hidden from others (Soft Delete).`
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
        `Are you sure you want to restore the archived dive site "${diveSite?.name}"?\n\nIt will become visible to the public again.`
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

  // Stable featured media from the first 5 candidates (deterministic per site id)
  const featuredMedia = useMemo(() => {
    if (!media || media.length === 0) return null;
    const candidates = media.slice(0, 5);
    const seed = Number.parseInt(id, 10);
    const index = Number.isFinite(seed) ? Math.abs(seed) % candidates.length : 0;
    return candidates[index];
  }, [id, media]);

  const { data: nearbyDiveSites, isLoading: isNearbyLoading } = useQuery(
    ['dive-site-nearby', id],
    () => api.get(`/api/v1/dive-sites/${id}/nearby?limit=10`),
    {
      select: response => response.data,
      enabled: isNearbyExpanded && !!diveSite && !!diveSite.latitude && !!diveSite.longitude,
    }
  );

  const { data: recentDives } = useQuery(
    ['dive-site-dives', id],
    () => api.get(`/api/v1/dive-sites/${id}/dives?limit=5&sort_by=recent`),
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

  // Unified media slides for lightbox (both photos and videos)
  const mediaSlides = useMemo(() => {
    if (!media || media.length === 0) return [];

    return media.map(item => {
      const isVideo = isVideoUrl(item.url);
      const isYT = isYouTubeUrl(item.url);
      const isVimeo = isVimeoUrl(item.url);
      const ytId = isYT ? extractYouTubeVideoId(item.url) : null;
      const vimeoId = isVimeo ? extractVimeoVideoId(item.url) : null;
      const thumbUrl = isYT
        ? getYouTubeThumbnailUrl(ytId, 'hq')
        : getImageUrl(item.thumbnail_url || item.medium_url || item.url);

      if (isVideo) {
        // Muted autoplay so opening the lightbox (1 click) starts playback
        let embedUrl = null;
        if (isYT && ytId) {
          embedUrl = getYouTubeEmbedUrl(ytId, { autoplay: true });
        } else if (isVimeo && vimeoId) {
          embedUrl = getVimeoEmbedUrl(vimeoId, { autoplay: true });
        }

        return {
          type: 'video',
          isYouTube: isYT,
          isVimeo,
          embedUrl,
          // Native MP4 (and similar) playback must use the media URL, not the thumbnail
          videoUrl: !isYT && !isVimeo ? item.url : null,
          src: thumbUrl,
          thumbnail: thumbUrl,
          width: 1920,
          height: 1080,
          title: decodeHtmlEntities(item.description) || 'Dive site video',
          description: decodeHtmlEntities(item.description) || '',
          originalItem: item,
        };
      }

      return {
        type: 'image',
        src: getImageUrl(item.medium_url || item.url),
        thumbnail: thumbUrl,
        width: 1920,
        height: 1080,
        title: decodeHtmlEntities(item.description) || 'Dive site photo',
        description: decodeHtmlEntities(item.description) || '',
        download: getImageUrl(item.download_url || item.url),
        originalItem: item,
      };
    });
  }, [media, convertedFlickrUrls, isVideoUrl]);

  // Open lightbox if tab=media query param is present
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');

    if (tabParam === 'media' && mediaSlides.length > 0) {
      setIsLightboxOpen(true);
    }
  }, [location.search, mediaSlides.length]);

  // Handle deep linking to specific media
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mediaId = searchParams.get('mediaId');
    const source = searchParams.get('source'); // 'site_media' or 'dive_media'

    if (mediaSlides.length > 0 && mediaId) {
      const idx = mediaSlides.findIndex(s => {
        const item = s.originalItem;
        if (!item) return false;
        const isDiveMedia = !!item.dive_id;
        const sSource = isDiveMedia ? 'dive_media' : 'site_media';
        if (source) {
          return String(item.id) === String(mediaId) && sSource === source;
        }
        return String(item.id) === String(mediaId);
      });

      if (idx >= 0) {
        setLightboxIndex(idx);
        setIsLightboxOpen(true);
      }
    }
  }, [mediaSlides, location.search]);

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
      parts.push(`Max depth: ${Number(diveSite.max_depth)}m.`);
    }

    if (diveSite.total_ratings > 0) {
      if (diveSite.average_rating) {
        parts.push(`Rated ${Number(diveSite.average_rating).toFixed(1)}/5.`);
      }
      const reviewWord = diveSite.total_ratings === 1 ? 'review' : 'reviews';
      parts.push(`Read ${diveSite.total_ratings} ${reviewWord} and see photos.`);
    } else {
      parts.push('Be the first to share your experience and photos!');
    }

    if (diveSite.description) {
      const cleanDesc = decodeHtmlEntities(stripHtmlTags(diveSite.description)).trim();
      if (cleanDesc) {
        parts.push(cleanDesc.substring(0, 100) + (cleanDesc.length > 100 ? '...' : ''));
      }
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
        item: `${window.location.origin}${buildGeoHubPath(diveSite.country)}`,
      });
    }

    if (diveSite.region) {
      itemListElement.push({
        '@type': 'ListItem',
        position: currentPosition++,
        name: diveSite.region,
        item: `${window.location.origin}${buildGeoHubPath(diveSite.country, diveSite.region)}`,
      });
    }

    itemListElement.push({
      '@type': 'ListItem',
      position: currentPosition,
      name: diveSite.name,
      item: window.location.href,
    });

    return {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
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
  };

  const handleQuickRate = score => {
    rateMutation.mutate({ score });
    setRating(score);
  };

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8'>
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
                { label: 'Dive Sites', to: '/dive-sites' },
                ...(diveSite.country
                  ? [
                      {
                        label: diveSite.country,
                        to: buildGeoHubPath(diveSite.country),
                      },
                    ]
                  : []),
                ...(diveSite.region
                  ? [
                      {
                        label: diveSite.region,
                        to: buildGeoHubPath(diveSite.country, diveSite.region),
                      },
                    ]
                  : []),
                { label: diveSite.name },
              ]}
            />
          </div>
        )}
      </div>

      {/* Header */}
      <div
        id='overview'
        className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 mb-4 sm:mb-6 scroll-mt-20'
      >
        {/* Mobile-Only Top Navigation & Utility Row */}
        <div className='flex lg:hidden items-center justify-between mb-2.5'>
          <button
            onClick={() => {
              const from = location.state?.from;
              if (from) {
                navigate(from);
              } else {
                navigate('/dive-sites');
              }
            }}
            className='text-gray-500 hover:text-gray-800 p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 transition-colors'
            aria-label='Go back'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>

          <div className='flex items-center gap-2'>
            {diveSite && !diveSite.deleted_at && user && (
              <button
                type='button'
                onClick={() => setIsSaveOpen(true)}
                className='p-2 rounded-full border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all'
                aria-label='Save to List'
                title='Save to List'
              >
                <Bookmark className='w-4 h-4' />
              </button>
            )}
            {diveSite && !diveSite.deleted_at && (
              <ShareButton
                entityType='dive-site'
                entityData={diveSite}
                variant='icon-only'
                className='!p-2 !rounded-full !border !border-gray-200 !text-gray-600 hover:!text-blue-600 hover:!bg-blue-50 active:scale-95 transition-all'
              />
            )}
            {shouldShowEdit && (
              <RouterLink
                to={`/dive-sites/${id}/edit`}
                className='p-2 rounded-full border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-blue-50 active:scale-95 transition-all inline-flex items-center justify-center'
                aria-label='Edit dive site'
                title='Edit dive site'
              >
                <Edit className='w-4 h-4' />
              </RouterLink>
            )}
            {shouldShowDelete && (
              <button
                type='button'
                onClick={handleDelete}
                className='p-2 rounded-full border border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all'
                aria-label='Archive dive site'
                title='Archive dive site'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            )}
            {shouldShowRestore && (
              <button
                type='button'
                onClick={handleRestore}
                className='p-2 rounded-full border border-gray-200 text-gray-600 hover:text-amber-600 hover:bg-amber-50 active:scale-95 transition-all'
                aria-label='Restore dive site'
                title='Restore dive site'
              >
                <RotateCcw className='w-4 h-4' />
              </button>
            )}
          </div>
        </div>

        {/* Title Row (Full width on mobile, side-by-side with Community Verdict on desktop) */}
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4'>
          <div className='flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1'>
            {/* Desktop Back Button */}
            <button
              onClick={() => {
                const from = location.state?.from;
                if (from) {
                  navigate(from);
                } else {
                  navigate('/dive-sites');
                }
              }}
              className='hidden lg:flex text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors shrink-0 mt-1'
              aria-label='Go back'
            >
              <ArrowLeft className='w-4 h-4 sm:w-6 sm:h-6' />
            </button>
            <div className='min-w-0 flex-1'>
              <h1 className='text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 break-words leading-tight'>
                {diveSite.name}
                {diveSite.deleted_at && (
                  <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-800 align-middle uppercase tracking-tighter'>
                    ARCHIVED
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Community Verdict (Desktop Only, Aligned Top-Right with Title) */}
          <div className='hidden lg:flex items-center shrink-0 pl-4 border-l border-gray-100'>
            <CommunityVerdict
              diveSite={diveSite}
              onRate={handleQuickRate}
              isSubmitting={rateMutation.isLoading}
              compact={true}
            />
          </div>
        </div>

        {/* Divider */}
        <div className='my-3 sm:my-4 border-t border-gray-100' />

        {/* Sub-Header Strip */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          {/* Left: Rating (mobile), Tags & Aliases */}
          <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
            {/* Rating (Mobile Only) */}
            <div className='flex items-center gap-1 lg:hidden pr-1'>
              <img
                src='/arts/starfish-2.svg'
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

            {/* Tags */}
            {diveSite.tags && diveSite.tags.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5'>
                {diveSite.tags.map(tag => (
                  <span
                    key={tag.id}
                    className={`px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium ${getTagColor(tag.name)}`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Aliases */}
            {diveSite.aliases && diveSite.aliases.length > 0 && (
              <div className='flex flex-wrap items-center gap-1.5 text-xs text-gray-500'>
                <span className='text-[11px] text-gray-400 font-medium'>AKA:</span>
                {diveSite.aliases.map(alias => (
                  <span
                    key={alias.id}
                    className='px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-100'
                  >
                    {alias.alias}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Desktop-Only Actions Toolbar */}
          <div className='hidden lg:flex items-center gap-2 sm:gap-3 shrink-0'>
            {diveSite && !diveSite.deleted_at && user && (
              <Button
                onClick={() => setIsSaveOpen(true)}
                variant='secondary'
                size='sm'
                icon={<Bookmark className='h-4 w-4' />}
                className='font-semibold'
              >
                Save to List
              </Button>
            )}

            {diveSite && !diveSite.deleted_at && (
              <ShareButton
                entityType='dive-site'
                entityData={diveSite}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm border border-gray-200 hover:bg-gray-50 text-gray-700'
              />
            )}

            {shouldShowEdit && (
              <Button
                to={`/dive-sites/${id}/edit`}
                variant='ghost'
                size='sm'
                icon={<Edit className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
              >
                Edit
              </Button>
            )}

            {shouldShowDelete && (
              <Button
                onClick={handleDelete}
                variant='danger'
                size='sm'
                icon={<Trash2 className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                title='Archive dive site'
              >
                Archive
              </Button>
            )}

            {shouldShowRestore && (
              <Button
                onClick={handleRestore}
                variant='warning'
                size='sm'
                icon={<RotateCcw className='h-3.5 w-3.5 sm:h-4 sm:w-4' />}
                title='Restore dive site'
              >
                Restore
              </Button>
            )}
          </div>
        </div>

        {/* Mobile-Only Primary CTA: Log a Dive Here */}
        {diveSite && !diveSite.deleted_at && (
          <div className='mt-3.5 lg:hidden'>
            <Button
              to={`/dives/create?dive_site_id=${id}`}
              variant='primary'
              size='sm'
              icon={<Plus className='w-4 h-4' />}
              className='w-full justify-center font-bold text-xs shadow-sm py-2'
            >
              Log a Dive Here
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Horizontal Tabs Navigation */}
      <div className='lg:hidden -mx-2.5 px-2.5 sm:-mx-4 sm:px-4 mb-4 sticky top-0 bg-gray-50/90 backdrop-blur-sm z-40 py-2 border-b border-gray-200/50'>
        <nav className='grid grid-cols-3 gap-2 px-1' aria-label='Mobile Sections'>
          <a
            href='#overview'
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Overview'
          >
            <Info className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Info
            </span>
          </a>
          <a
            href='#location'
            onClick={() => setIsNearbyExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Location'
          >
            <MapPin className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Map
            </span>
          </a>
          <a
            href='#weather'
            onClick={() => setIsMarineExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Weather Conditions'
          >
            <CloudSun className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Weather
            </span>
          </a>
          <a
            href='#routes'
            onClick={() => setIsRoutesExpanded(true)}
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Available Routes'
          >
            <Route className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Routes
            </span>
          </a>
          <a
            href='#dives'
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Recent Dives'
          >
            <TrendingUp className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Dives
            </span>
          </a>
          <a
            href='#comments'
            className='flex flex-col items-center justify-center p-1.5 rounded-xl bg-white border border-gray-200 shadow-sm active:scale-95 transition-transform flex-1 min-w-0 group'
            title='Comments'
          >
            <MessageCircle className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover:text-blue-800' />
            <span className='text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-tight mt-0.5 truncate max-w-full'>
              Comments
            </span>
          </a>
        </nav>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-4 sm:space-y-6'>
          {/* Description, Access Instructions, Marine Life & Media Showcase */}
          {(diveSite.description ||
            diveSite.access_instructions ||
            diveSite.marine_life ||
            (media && media.length > 0)) && (
            <div className='bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              <div className='flex flex-col md:flex-row gap-5 sm:gap-6 items-start'>
                {/* Left Column: Description, Access Instructions & Marine Life */}
                <div className='flex-1 min-w-0 w-full'>
                  {diveSite.description && (
                    <div className='mb-4'>
                      <span className='block text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                        Description
                      </span>
                      <RichText
                        content={diveSite.description}
                        className='text-[13px] sm:text-base'
                      />
                    </div>
                  )}

                  {/* Access Instructions Callout */}
                  {diveSite.access_instructions && (
                    <div className='mt-3.5 p-3.5 sm:p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/90 dark:border-emerald-900/40'>
                      <div className='flex items-center gap-2 mb-1.5'>
                        <Footprints className='w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0' />
                        <h3 className='text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider'>
                          Access Instructions
                        </h3>
                      </div>
                      <RichText
                        content={diveSite.access_instructions}
                        className='text-xs sm:text-sm text-emerald-950 dark:text-emerald-100'
                      />
                    </div>
                  )}

                  {/* Marine Life Callout */}
                  {diveSite.marine_life && (
                    <div className='mt-3.5 p-3.5 sm:p-4 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-100/90 dark:border-cyan-900/40'>
                      <div className='flex items-center gap-2 mb-1.5'>
                        <Fish className='w-4 h-4 text-cyan-700 dark:text-cyan-400 shrink-0' />
                        <h3 className='text-xs sm:text-sm font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wider'>
                          Marine Life
                        </h3>
                      </div>
                      <RichText
                        content={diveSite.marine_life}
                        className='text-xs sm:text-sm text-cyan-950 dark:text-cyan-100'
                      />
                    </div>
                  )}
                </div>

                {/* Right Column: Featured Media Showcase */}
                {media && media.length > 0 && (
                  <DiveSiteMediaPreview
                    media={media}
                    featuredItem={featuredMedia}
                    photosCount={photos.length}
                    videosCount={videos.length}
                    getImageUrl={getImageUrl}
                    onOpenPhoto={photoItem => {
                      const idx = mediaSlides.findIndex(s => s.originalItem?.id === photoItem.id);
                      setLightboxIndex(idx >= 0 ? idx : 0);
                      setIsLightboxOpen(true);
                    }}
                    onOpenVideo={videoItem => {
                      const idx = mediaSlides.findIndex(s => s.originalItem?.id === videoItem.id);
                      setLightboxIndex(idx >= 0 ? idx : 0);
                      setIsLightboxOpen(true);
                    }}
                    onViewAll={() => {
                      setLightboxIndex(0);
                      setIsLightboxOpen(true);
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Fullscreen Lightbox for Photos & Videos */}
          {mediaSlides.length > 0 && (
            <Lightbox
              open={isLightboxOpen}
              close={() => setIsLightboxOpen(false)}
              index={lightboxIndex}
              on={{ view: ({ index }) => setLightboxIndex(index) }}
              slides={mediaSlides}
              plugins={[Captions, Download, Slideshow, Fullscreen, Thumbnails]}
              render={{
                slide: ({ slide, offset }) => {
                  if (slide.type === 'video') {
                    // YARL keeps neighbor slides mounted for swipe; only mount the
                    // player on the active slide so prior videos stop on navigate.
                    const isActive = offset === 0;
                    return (
                      <div className='flex items-center justify-center w-full h-full p-4 max-w-4xl max-h-[85vh] mx-auto'>
                        <div className='w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10'>
                          {isActive ? (
                            slide.isYouTube || slide.isVimeo ? (
                              <iframe
                                key={slide.embedUrl}
                                src={slide.embedUrl}
                                title={slide.title || 'Dive site video'}
                                className='w-full h-full'
                                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                allowFullScreen
                              />
                            ) : (
                              <video
                                key={slide.videoUrl || slide.embedUrl}
                                controls
                                autoPlay
                                muted
                                playsInline
                                className='w-full h-full'
                              >
                                <source src={slide.videoUrl || slide.embedUrl} type='video/mp4' />
                                Your browser does not support the video tag.
                              </video>
                            )
                          ) : (
                            <img
                              src={slide.thumbnail || slide.src}
                              alt={slide.title || 'Dive site video'}
                              className='w-full h-full object-cover'
                            />
                          )}
                        </div>
                      </div>
                    );
                  }
                  return undefined;
                },
                thumbnail: ({ slide }) => {
                  return (
                    <div className='relative w-full h-full overflow-hidden rounded'>
                      <img
                        src={slide.thumbnail || slide.src}
                        alt={slide.title || 'Thumbnail'}
                        className='w-full h-full object-cover'
                      />
                      {slide.type === 'video' && (
                        <div className='absolute inset-0 flex items-center justify-center bg-black/40'>
                          <div className='w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center'>
                            <Play className='w-2 h-2 ml-0.5 fill-current' />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                },
              }}
              thumbnails={{ position: 'bottom' }}
            />
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
                      variant='secondary'
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

          {/* Safety Information */}
          {diveSite.safety_information && (
            <div className='bg-white p-3 sm:p-6 rounded-xl shadow-sm border border-gray-100'>
              <h2 className='text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4'>
                Safety Information
              </h2>
              <RichText content={diveSite.safety_information} className='text-xs sm:text-base' />
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
                      {formatDate(comment.created_at)}
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
          recentDives={recentDives}
          nearbyDiveSites={nearbyDiveSites}
          isNearbyLoading={isNearbyLoading}
          isNearbyExpanded={isNearbyExpanded}
          setIsNearbyExpanded={setIsNearbyExpanded}
        />
      </div>

      {diveSite && (
        <SaveToListModal
          isOpen={isSaveOpen}
          onClose={() => setIsSaveOpen(false)}
          diveSiteId={diveSite.id}
          diveSiteName={diveSite.name}
        />
      )}
    </div>
  );
};

export default DiveSiteDetail;
