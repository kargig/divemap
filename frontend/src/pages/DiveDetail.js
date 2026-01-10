import L from 'leaflet';
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
  Activity,
  Route,
  User,
  X,
  Image,
  Video,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
  Link as RouterLink,
} from 'react-router-dom';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';

import api, {
  getDive,
  getDiveMedia,
  deleteDive,
  deleteDiveMedia,
  removeBuddy,
  uploadDiveProfile,
  extractErrorMessage,
} from '../api';
import AdvancedDiveProfileChart from '../components/AdvancedDiveProfileChart';
import Breadcrumbs from '../components/Breadcrumbs';
import DiveProfileModal from '../components/DiveProfileModal';
import GasTanksDisplay from '../components/GasTanksDisplay';
import Lightbox from '../components/Lightbox/Lightbox';
import ReactImage from '../components/Lightbox/ReactImage';
import RateLimitError from '../components/RateLimitError';
import SEO from '../components/SEO';
import ShareButton from '../components/ShareButton';
import Modal from '../components/ui/Modal';
import YouTubePreview from '../components/YouTubePreview';
import { useAuth } from '../contexts/AuthContext';
import { getRouteTypeColor } from '../utils/colorPalette';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { convertFlickrUrlToDirectImage, isFlickrUrl } from '../utils/flickrHelpers';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { handleRateLimitError } from '../utils/rateLimitHandler';
import { calculateRouteBearings, formatBearing } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';

import NotFound from './NotFound';

// Custom zoom control component for dive detail page
const ZoomControl = ({ currentZoom }) => {
  return (
    <div className='absolute top-2 left-12 bg-white rounded px-2 py-1 text-xs font-medium z-10 shadow-sm border border-gray-200'>
      Zoom: {currentZoom.toFixed(1)}
    </div>
  );
};

// Custom zoom tracking component for dive detail page
const ZoomTracker = ({ onZoomChange }) => {
  const map = useMap();

  useEffect(() => {
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
    };

    map.on('zoomend', handleZoomEnd);

    // Set initial zoom
    onZoomChange(map.getZoom());

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map, onZoomChange]);

  return null;
};

// Custom route layer component for dive detail page
const MapViewUpdater = ({ viewport }) => {
  const map = useMap();

  useEffect(() => {
    if (viewport && viewport.center && viewport.zoom) {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [map, viewport?.center, viewport?.zoom]);

  return null;
};

const DiveRouteLayer = ({ route, diveSiteId, diveSite }) => {
  const map = useMap();
  const routeLayerRef = useRef(null);
  const diveSiteMarkerRef = useRef(null);
  const bearingMarkersRef = useRef([]);
  const hasRenderedRef = useRef(false);
  const lastRouteIdRef = useRef(null);

  // Function to update bearing markers visibility based on zoom
  const updateBearingMarkersVisibility = useCallback(() => {
    const currentZoom = map.getZoom();
    const shouldShow = currentZoom >= 16 && currentZoom <= 18;

    bearingMarkersRef.current.forEach(marker => {
      if (shouldShow) {
        if (!map.hasLayer(marker)) {
          map.addLayer(marker);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }, [map]);

  useEffect(() => {
    if (!route?.route_data) {
      return;
    }

    // Check if this is the same route as before
    const isSameRoute = lastRouteIdRef.current === route?.id;

    // Prevent duplicate rendering for the same route
    if (hasRenderedRef.current && routeLayerRef.current && isSameRoute) {
      // Still update bearing visibility on zoom even if route hasn't changed
      updateBearingMarkersVisibility();
      return;
    }

    // Clear existing layers and bearing markers
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }
    if (diveSiteMarkerRef.current) {
      map.removeLayer(diveSiteMarkerRef.current);
    }
    bearingMarkersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    bearingMarkersRef.current = [];

    // Add dive site marker
    if (diveSite && diveSite.latitude && diveSite.longitude) {
      const diveSiteMarker = L.marker([diveSite.latitude, diveSite.longitude], {
        icon: L.divIcon({
          className: 'dive-site-marker',
          html: '<div style="background-color: #dc2626; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      });

      diveSiteMarker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-800 mb-1">${diveSite.name}</h3>
          <p class="text-sm text-gray-600">Dive Site</p>
        </div>
      `);

      map.addLayer(diveSiteMarker);
      diveSiteMarkerRef.current = diveSiteMarker;
    }

    // Add route layer
    const routeLayer = L.geoJSON(route.route_data, {
      style: feature => {
        // Determine color based on route type and segment type
        let routeColor;
        if (feature.properties?.color) {
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          routeColor = getRouteTypeColor(route.route_type);
        }

        return {
          color: routeColor,
          weight: 6, // Increased weight for better visibility
          opacity: 0.9,
          fillOpacity: 0.3,
        };
      },
      pointToLayer: (feature, latlng) => {
        let routeColor;
        if (feature.properties?.color) {
          routeColor = feature.properties.color;
        } else if (feature.properties?.segmentType) {
          routeColor = getRouteTypeColor(feature.properties.segmentType);
        } else {
          routeColor = getRouteTypeColor(route.route_type);
        }

        return L.circleMarker(latlng, {
          radius: 8, // Increased radius for better visibility
          fillColor: routeColor,
          color: routeColor,
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.7,
        });
      },
    });

    // Add popup to route
    const decodedDescription = route.description
      ? decodeHtmlEntities(route.description)
      : 'No description';
    routeLayer.bindPopup(`
      <div class="p-2">
        <h3 class="font-semibold text-gray-800 mb-1">${route.name}</h3>
        <p class="text-sm text-gray-600 mb-2">${decodedDescription}</p>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="px-2 py-1 bg-gray-100 rounded">${route.route_type}</span>
          <span>by ${route.creator_username || 'Unknown'}</span>
        </div>
      </div>
    `);

    map.addLayer(routeLayer);
    routeLayerRef.current = routeLayer;

    // Calculate bearings and create markers (but don't add to map yet)
    const bearings = calculateRouteBearings(route.route_data);
    bearings.forEach(({ position, bearing }) => {
      const bearingLabel = formatBearing(bearing, true);

      // Create a custom icon with bearing text
      const bearingIcon = L.divIcon({
        className: 'bearing-label',
        html: `
          <div style="
            background-color: rgba(255, 255, 255, 0.9);
            border: 2px solid #2563eb;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            color: #1e40af;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
          ">
            ${bearingLabel}
          </div>
        `,
        iconSize: [60, 20],
        iconAnchor: [30, 10],
      });

      const bearingMarker = L.marker(position, {
        icon: bearingIcon,
        interactive: false,
        zIndexOffset: 500,
      });

      // Store marker but don't add to map yet
      bearingMarkersRef.current.push(bearingMarker);
    });

    // Update visibility based on initial zoom
    updateBearingMarkersVisibility();

    // Mark as rendered and track route ID
    hasRenderedRef.current = true;
    lastRouteIdRef.current = route?.id;

    // Listen for zoom changes
    map.on('zoomend', updateBearingMarkersVisibility);

    return () => {
      map.off('zoomend', updateBearingMarkersVisibility);

      // Only cleanup if we're not about to re-render with the same route
      const isSameRoute = lastRouteIdRef.current === route?.id;

      if (routeLayerRef.current && !isSameRoute) {
        map.removeLayer(routeLayerRef.current);
      }

      if (diveSiteMarkerRef.current && !isSameRoute) {
        map.removeLayer(diveSiteMarkerRef.current);
      }

      if (!isSameRoute) {
        bearingMarkersRef.current.forEach(marker => {
          map.removeLayer(marker);
        });
        bearingMarkersRef.current = [];
      }
    };
  }, [map, route?.id, route?.route_data, diveSite?.id, updateBearingMarkersVisibility]);

  return null;
};

const DiveDetail = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'profile') return 'profile';
    if (tabParam === 'photos') return 'photos';
    if (tabParam === 'route') return 'route';
    return 'details';
  });
  const [activeMediaTab, setActiveMediaTab] = useState('photos');
  const [hasDeco, setHasDeco] = useState(false);
  const [convertedFlickrUrls, setConvertedFlickrUrls] = useState(new Map());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [routeMapViewport, setRouteMapViewport] = useState({
    center: [38.1158243, 23.2146529], // Default to Psatha dive site coordinates
    zoom: 15,
  });
  const [currentZoom, setCurrentZoom] = useState(15);
  const fileInputRef = useRef(null);

  // Handle profile upload
  const handleUploadProfile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml') && !file.name.toLowerCase().endsWith('.uddf')) {
      toast.error('Please select a valid XML/UDDF dive profile file');
      return;
    }

    const toastId = toast.loading('Uploading dive profile...');
    try {
      await uploadDiveProfile(id, file);
      toast.success('Dive profile uploaded successfully', { id: toastId });
      queryClient.invalidateQueries(['dive-profile', id]);
      // Also invalidate dive query to update metadata if needed
      queryClient.invalidateQueries(['dive', id]);
    } catch (error) {
      console.error('Failed to upload profile:', error);
      toast.error(extractErrorMessage(error, 'Failed to upload profile'), { id: toastId });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle map viewport changes
  const handleMapViewportChange = viewport => {
    // Viewport change handler (no debug logging)
  };

  // Handle tab change and update URL
  const handleTabChange = tab => {
    setActiveTab(tab);
    const newSearchParams = new URLSearchParams(searchParams);
    if (tab === 'profile') {
      newSearchParams.set('tab', 'profile');
    } else if (tab === 'photos') {
      newSearchParams.set('tab', 'photos');
    } else if (tab === 'route') {
      newSearchParams.set('tab', 'route');
    } else {
      newSearchParams.delete('tab');
    }
    setSearchParams(newSearchParams);
  };

  // Handle profile modal
  const handleOpenProfileModal = () => {
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
  };

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
      retry: (failureCount, error) => {
        if (error.response?.status === 404) return false;
        return failureCount < 3;
      },
    }
  );

  // Redirect to canonical URL with slug
  useEffect(() => {
    if (dive) {
      const name = dive.name || dive.dive_site?.name || 'unnamed-dive-site';
      const expectedSlug = slugify(name);
      if (!slug || slug !== expectedSlug) {
        navigate(`/dives/${id}/${expectedSlug}${location.search}`, { replace: true });
      }
    }
  }, [dive, id, slug, navigate, location.search]);

  // Fetch dive media separately (not included in main dive response)
  const { data: diveMedia = [] } = useQuery(['dive-media', id], () => getDiveMedia(id), {
    enabled: !!id && !!dive,
  });

  // Check if dive has deco tag (case-insensitive)
  useEffect(() => {
    if (dive?.tags) {
      const hasDecoTag = dive.tags.some(
        tag => tag.name && tag.name.toLowerCase().trim() === 'deco'
      );
      setHasDeco(hasDecoTag);
    }
  }, [dive?.tags]);

  // Prepare route data for map visualization
  useEffect(() => {
    // Only run when dive data is fully loaded
    if (dive?.id && dive?.dive_site) {
      // Always set center to dive site coordinates as fallback
      let center = [parseFloat(dive.dive_site.latitude), parseFloat(dive.dive_site.longitude)];

      // Validate dive site coordinates
      if (isNaN(center[0]) || isNaN(center[1])) {
        center = [37.8372191, 23.696668]; // Default to Psatha coordinates
      }

      // If route data is available, calculate center from route coordinates
      if (dive?.selected_route?.route_data) {
        if (dive.selected_route.route_data.type === 'FeatureCollection') {
          const features = dive.selected_route.route_data.features;
          if (features && features.length > 0) {
            // Calculate center from all features
            let allCoords = [];
            features.forEach(feature => {
              if (feature.geometry?.coordinates) {
                const coords = feature.geometry.coordinates;
                if (feature.geometry.type === 'Polygon') {
                  // For Polygon: coordinates is [[[lng, lat], [lng, lat], ...]]
                  // Flatten the outer ring (first array)
                  if (coords[0] && Array.isArray(coords[0])) {
                    allCoords = allCoords.concat(coords[0]);
                  }
                } else if (feature.geometry.type === 'LineString') {
                  // For LineString: coordinates is [[lng, lat], [lng, lat], ...]
                  allCoords = allCoords.concat(coords);
                } else if (feature.geometry.type === 'Point') {
                  // For Point: coordinates is [lng, lat]
                  allCoords.push(coords);
                }
              }
            });
            if (allCoords.length > 0) {
              const lats = allCoords.map(coord => coord[1]);
              const lngs = allCoords.map(coord => coord[0]);
              const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
              const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

              // Validate coordinates are not NaN
              if (!isNaN(avgLat) && !isNaN(avgLng)) {
                center = [avgLat, avgLng]; // [lat, lng] format for Leaflet
              }
            }
          }
        }
      }

      const newViewport = {
        center,
        zoom: 15, // Default zoom level for route visualization
      };

      setRouteMapViewport(newViewport);
    }
  }, [dive?.id, dive?.dive_site?.id, dive?.selected_route?.id]); // More specific dependencies

  // Fetch dive profile data
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery(
    ['dive-profile', id],
    () => {
      return api.get(`/api/v1/dives/${id}/profile`).then(res => res.data);
    },
    {
      enabled: !!id && (activeTab === 'profile' || activeTab === 'details'),
      retry: false, // Don't retry on 404
    }
  );

  // Show toast notifications for rate limiting errors
  useEffect(() => {
    handleRateLimitError(error, 'dive details', () => window.location.reload());
  }, [error]);

  const getMetaDescription = () => {
    if (!dive) return '';

    const parts = [
      `Dive log by ${dive.user_username || 'a user'}`,
      `at ${dive.name || dive.dive_site?.name || 'an unnamed site'}`,
      `on ${formatDate(dive.dive_date)}.`,
    ];

    if (dive.max_depth) {
      parts.push(`Max depth: ${dive.max_depth}m.`);
    }

    if (dive.duration) {
      parts.push(`Duration: ${dive.duration} min.`);
    }

    if (dive.dive_information) {
      parts.push(
        dive.dive_information.substring(0, 100) + (dive.dive_information.length > 100 ? '...' : '')
      );
    }

    return parts.join(' ');
  };

  const getSchema = () => {
    if (!dive) return null;

    const schema = {
      '@context': 'https://schema.org',
      '@type': ['Review', 'CreativeWork'],
      name: `Dive at ${dive.name || dive.dive_site?.name}`,
      description: dive.dive_information,
      author: {
        '@type': 'Person',
        name: dive.user_username || 'Unknown',
      },
      datePublished: dive.dive_date,
      itemReviewed: {
        '@type': 'Place',
        name: dive.dive_site?.name || dive.name || 'Dive Site',
        geo:
          dive.dive_site?.latitude && dive.dive_site?.longitude
            ? {
                '@type': 'GeoCoordinates',
                latitude: dive.dive_site.latitude,
                longitude: dive.dive_site.longitude,
              }
            : undefined,
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
            name: 'Public Dives',
            item: `${window.location.origin}/dives`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `Dive at ${dive.name || dive.dive_site?.name}`,
            item: window.location.href,
          },
        ],
      },
    };

    if (dive.user_rating) {
      schema.reviewRating = {
        '@type': 'Rating',
        ratingValue: dive.user_rating,
        bestRating: '10',
        worstRating: '1',
      };
    }

    return schema;
  };

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

  // Remove buddy mutation
  const removeBuddyMutation = useMutation(({ diveId, userId }) => removeBuddy(diveId, userId), {
    onSuccess: () => {
      toast.success('Removed from dive buddies');
      queryClient.invalidateQueries(['dive', id]);
    },
    onError: error => {
      const errorMessage = error.response?.data?.detail || 'Failed to remove buddy';
      toast.error(errorMessage);
    },
  });

  const handleRemoveSelf = () => {
    if (window.confirm('Remove yourself from this dive?')) {
      removeBuddyMutation.mutate({ diveId: id, userId: user?.id });
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
      hour12: false, // Use 24-hour format
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

  // Helper function to check if URL is a video
  const isVideoUrl = url => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const lowerUrl = url.toLowerCase();
    return (
      videoExtensions.some(ext => lowerUrl.includes(ext)) ||
      lowerUrl.includes('youtube.com') ||
      lowerUrl.includes('youtu.be') ||
      lowerUrl.includes('vimeo.com')
    );
  };

  // Filter media by type (photos vs videos)
  const allPhotos = diveMedia
    ? diveMedia.filter(item => item.media_type === 'photo' && !isVideoUrl(item.url))
    : [];

  const allVideos = diveMedia
    ? diveMedia.filter(item => item.media_type === 'video' || isVideoUrl(item.url))
    : [];

  // All media is public (is_public column removed from database)
  const publicPhotos = allPhotos;
  const publicVideos = allVideos;

  // Convert Flickr URLs to direct image URLs
  useEffect(() => {
    const convertFlickrUrls = async () => {
      if (!diveMedia) return;

      // Get all photos
      const allPhotosForFlickr = diveMedia.filter(
        item => item.media_type === 'photo' && !isVideoUrl(item.url)
      );
      const flickrPhotos = allPhotosForFlickr.filter(item => isFlickrUrl(item.url));

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
  }, [diveMedia]);

  // Helper to get the URL (converted if Flickr, original otherwise)
  const getImageUrl = url => {
    return convertedFlickrUrls.get(url) || url;
  };

  // Create slides for lightbox
  const publicPhotoSlides = publicPhotos.map(item => ({
    src: getImageUrl(item.url),
    width: 1920,
    height: 1080,
    alt: item.description || 'Dive photo',
    description: item.description || '',
  }));

  // Reset activeMediaTab when switching to photos tab
  useEffect(() => {
    if (activeTab === 'photos') {
      // Default to photos tab when switching to photos tab
      setActiveMediaTab('photos');
    }
  }, [activeTab]);

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

    if (error.response?.status === 404) {
      return <NotFound />;
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
    return <NotFound />;
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      {dive && (
        <SEO
          title={`Dive Log - ${dive.name || dive.dive_site?.name || 'Unnamed Site'} - ${formatDate(dive.dive_date)}`}
          description={getMetaDescription()}
          type='article'
          image={publicPhotoSlides.length > 0 ? publicPhotoSlides[0].src : undefined}
          imageAlt={publicPhotoSlides.length > 0 ? publicPhotoSlides[0].alt : undefined}
          siteName='Divemap'
          author={dive.user_username}
          publishedTime={dive.created_at}
          schema={getSchema()}
        />
      )}
      {/* Breadcrumbs */}
      {dive && (
        <Breadcrumbs
          items={[
            { label: 'Public Dives', to: '/dives' },
            { label: `Dive at ${dive.name || dive.dive_site?.name || 'Unnamed Site'}` },
          ]}
        />
      )}
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4'>
        <div className='flex items-center gap-3 sm:gap-4'>
          <button
            onClick={() => {
              const from = location.state?.from;
              if (from) {
                navigate(from);
              } else {
                navigate('/dives');
              }
            }}
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
            {/* Privacy Status and Created By */}
            <div className='flex items-center gap-2 mt-1 flex-wrap'>
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
              {dive.user_username && (
                <div className='flex items-center gap-1 text-sm text-gray-600'>
                  <span className='leading-tight mt-1'>Created by:</span>
                  <RouterLink
                    to={`/users/${dive.user_username}`}
                    className='font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center'
                  >
                    <span className='leading-tight mt-1'>{dive.user_username}</span>
                  </RouterLink>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='flex gap-2 flex-wrap'>
          {/* Share button - available to all users for public dives */}
          {dive && !dive.is_private && (
            <ShareButton entityType='dive' entityData={dive} className='inline-flex items-center' />
          )}
          {/* Share button for private dives - only for owner */}
          {dive && dive.is_private && (user?.id === dive?.user_id || user?.is_admin) && (
            <ShareButton entityType='dive' entityData={dive} className='inline-flex items-center' />
          )}
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

      {/* Tab Navigation */}
      <div className='mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='-mb-px flex space-x-8'>
            <button
              onClick={() => handleTabChange('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className='flex items-center'>
                <Activity className='h-4 w-4 mr-2' />
                Details
              </div>
            </button>
            <button
              onClick={() => handleTabChange('profile')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className='flex items-center'>
                <Activity className='h-4 w-4 mr-2' />
                Profile
              </div>
            </button>
            {(allPhotos.length > 0 || allVideos.length > 0) && (
              <button
                onClick={() => handleTabChange('photos')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'photos'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className='flex items-center'>
                  <Image className='h-4 w-4 mr-2' />
                  Photos & Videos ({allPhotos.length + allVideos.length})
                </div>
              </button>
            )}
            {dive.selected_route && (
              <button
                onClick={() => handleTabChange('route')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'route'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className='flex items-center'>
                  <Route className='h-4 w-4 mr-2' />
                  Route
                </div>
              </button>
            )}
          </nav>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Main Content */}
        <div className='lg:col-span-2 space-y-6'>
          {activeTab === 'details' && (
            <>
              {/* Basic Information */}
              <div className='bg-white rounded-lg shadow p-6'>
                <div className='flex items-center gap-2 mb-4'>
                  <h2 className='text-xl font-semibold'>Dive Information</h2>
                  {hasDeco && <span className='text-red-500 font-medium'>Deco dive</span>}
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='flex items-center gap-2'>
                    <Calendar size={15} className='text-gray-500' />
                    <span className='text-sm text-gray-600'>Date:</span>
                    <span className='font-medium'>{formatDate(dive.dive_date)}</span>
                  </div>

                  {dive.dive_time && (
                    <div className='flex items-center gap-2'>
                      <Clock size={15} className='text-gray-500' />
                      <span className='text-sm text-gray-600'>Time:</span>
                      <span className='font-medium'>{formatTime(dive.dive_time)}</span>
                    </div>
                  )}

                  {dive.duration && (
                    <div className='flex items-center gap-2'>
                      <Clock size={15} className='text-gray-500' />
                      <span className='text-sm text-gray-600'>Duration:</span>
                      <span className='font-medium'>{dive.duration} minutes</span>
                    </div>
                  )}

                  {dive.max_depth && (
                    <div className='flex items-center gap-2'>
                      <Thermometer size={15} className='text-gray-500' />
                      <span className='text-sm text-gray-600'>Max Depth:</span>
                      <span className='font-medium'>{dive.max_depth}m</span>
                    </div>
                  )}

                  {dive.average_depth && (
                    <div className='flex items-center gap-2'>
                      <Thermometer size={15} className='text-gray-500' />
                      <span className='text-sm text-gray-600'>Avg Depth:</span>
                      <span className='font-medium'>{dive.average_depth}m</span>
                    </div>
                  )}

                  {dive.visibility_rating && (
                    <div className='flex items-center gap-2'>
                      <Eye size={15} className='text-gray-500' />
                      <span className='text-sm text-gray-600'>Visibility:</span>
                      <span className='font-medium'>{dive.visibility_rating}/10</span>
                    </div>
                  )}

                  {dive.user_rating && (
                    <div className='flex items-center gap-2'>
                      <Star size={15} className='text-yellow-500' />
                      <span className='text-sm text-gray-600'>Your Rating:</span>
                      <span className='font-medium'>{dive.user_rating}/10</span>
                    </div>
                  )}
                </div>

                {dive.difficulty_code && (
                  <div className='mt-4'>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColorClasses(dive.difficulty_code)}`}
                    >
                      {dive.difficulty_label || getDifficultyLabel(dive.difficulty_code)}
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

                {/* Tags */}
                {dive.tags && dive.tags.length > 0 && (
                  <div className='mt-2'>
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

                {/* Buddies */}
                <div className='mt-4'>
                  <h3 className='text-sm font-medium text-gray-700 mb-2'>Dive Buddies</h3>
                  {dive.buddies && dive.buddies.length > 0 ? (
                    <div className='space-y-2'>
                      <div className='flex flex-wrap gap-2'>
                        {dive.buddies.map(buddy => (
                          <div
                            key={buddy.id}
                            className='flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg'
                          >
                            {buddy.avatar_url ? (
                              <img
                                src={buddy.avatar_url}
                                alt={buddy.username}
                                className='w-8 h-8 rounded-full object-cover'
                              />
                            ) : (
                              <div className='w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center'>
                                <User size={16} className='text-blue-600' />
                              </div>
                            )}
                            <div className='flex-1 min-w-0'>
                              <RouterLink
                                to={`/users/${buddy.username}`}
                                className='text-sm font-medium text-blue-700 hover:text-blue-900'
                              >
                                {buddy.username}
                              </RouterLink>
                              {buddy.name && (
                                <div className='text-xs text-gray-600'>{buddy.name}</div>
                              )}
                            </div>
                            {/* Show "Remove me" button if current user is a buddy (not the owner) */}
                            {user && user.id === buddy.id && dive.user_id !== user.id && (
                              <button
                                onClick={handleRemoveSelf}
                                className='ml-2 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded'
                                title='Remove yourself from this dive'
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className='text-sm text-gray-500'>No buddies assigned to this dive</p>
                  )}
                </div>

                {dive.gas_bottles_used && (
                  <div className='mt-4'>
                    <h3 className='text-sm font-medium text-gray-700 mb-1'>Gas Bottles Used</h3>
                    <GasTanksDisplay
                      gasData={dive.gas_bottles_used}
                      averageDepth={dive.average_depth}
                      duration={dive.duration}
                      profileData={profileData}
                    />
                  </div>
                )}

                {dive.dive_information && (
                  <div className='mt-4'>
                    <h3 className='text-sm font-medium text-gray-700 mb-1'>Dive Description</h3>
                    <p className='text-gray-600 whitespace-pre-wrap'>{dive.dive_information}</p>
                  </div>
                )}
              </div>

              {/* Media Gallery - Exclude photos and videos (shown in Photos & Videos tab) */}
              {dive.media &&
                dive.media.filter(
                  m => m.media_type !== 'photo' && m.media_type !== 'video' && !isVideoUrl(m.url)
                ).length > 0 && (
                  <div className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold mb-4'>Media</h2>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                      {dive.media
                        .filter(
                          m =>
                            m.media_type !== 'photo' &&
                            m.media_type !== 'video' &&
                            !isVideoUrl(m.url)
                        )
                        .map(media => (
                          <div key={media.id} className='relative group'>
                            <div className='aspect-square bg-gray-100 rounded-lg overflow-hidden'>
                              {media.media_type === 'video' && (
                                <video
                                  src={media.url}
                                  controls
                                  className='w-full h-full object-cover'
                                />
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
            </>
          )}

          {activeTab === 'profile' && (
            <div className='bg-white rounded-lg shadow p-6'>
              <div className='flex items-center gap-2 mb-4'>
                <h2 className='text-xl font-semibold'>Dive Profile</h2>
                {hasDeco && <span className='text-red-500 font-medium'>Deco dive</span>}
              </div>

              <AdvancedDiveProfileChart
                profileData={profileData}
                isLoading={profileLoading}
                error={profileError ? extractErrorMessage(profileError) : null}
                showTemperature={true}
                screenSize='desktop'
                onDecoStatusChange={profileHasDeco => {
                  // If profile data is available, use it; otherwise keep tag-based detection
                  if (profileHasDeco !== undefined) {
                    setHasDeco(profileHasDeco);
                  }
                }}
                onMaximize={handleOpenProfileModal}
                onUpload={
                  user && (user.id === dive.user_id || user.is_admin) ? handleUploadProfile : null
                }
              />
              <input
                type='file'
                ref={fileInputRef}
                onChange={handleFileChange}
                accept='.xml,.uddf'
                className='hidden'
              />
            </div>
          )}

          {activeTab === 'photos' && (allPhotos.length > 0 || allVideos.length > 0) && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>Photos & Videos</h2>

              {/* Media Tab Navigation */}
              <div className='border-b border-gray-200 mb-4'>
                <nav className='flex space-x-8'>
                  {publicPhotos.length > 0 && (
                    <button
                      onClick={() => setActiveMediaTab('photos')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeMediaTab === 'photos'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Photos ({publicPhotos.length})
                    </button>
                  )}
                  {publicVideos.length > 0 && (
                    <button
                      onClick={() => setActiveMediaTab('videos')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeMediaTab === 'videos'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Video className='w-4 h-4' />
                      <span>Videos ({publicVideos.length})</span>
                    </button>
                  )}
                </nav>
              </div>

              {/* Public Photos */}
              {activeMediaTab === 'photos' && publicPhotos.length > 0 && (
                <div>
                  <Lightbox
                    open={false}
                    close={() => {}}
                    slides={publicPhotoSlides}
                    plugins={[Captions, Slideshow, Fullscreen, Thumbnails]}
                    render={{ slide: ReactImage, thumbnail: ReactImage }}
                    thumbnails={{ position: 'bottom' }}
                  />
                </div>
              )}

              {/* Public Videos */}
              {activeMediaTab === 'videos' && publicVideos.length > 0 && (
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                  {publicVideos.map(item => (
                    <div
                      key={`video-${item.dive_id ? `dive-${item.dive_id}-` : ''}${item.id}`}
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

          {activeTab === 'route' && dive.selected_route && (
            <div className='bg-white rounded-lg shadow p-6'>
              <div className='flex items-center gap-2 mb-4'>
                <Route className='h-5 w-5 text-blue-600' />
                <h2 className='text-xl font-semibold'>Dive Route</h2>
              </div>

              <div className='space-y-4'>
                {/* Route Information */}
                <div className='border-b border-gray-200 pb-4'>
                  <div className='flex items-start gap-3'>
                    <div
                      className='w-4 h-4 rounded-full mt-1 flex-shrink-0'
                      style={{ backgroundColor: getRouteTypeColor(dive.selected_route.route_type) }}
                    />
                    <div className='flex-1'>
                      <h3 className='text-lg font-medium text-gray-900'>
                        {dive.selected_route.name}
                      </h3>
                      <div className='flex items-center gap-2 mt-1'>
                        <span className='px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full'>
                          {dive.selected_route.route_type}
                        </span>
                        <span className='text-sm text-gray-500'>
                          Created by {dive.selected_route.creator_username}
                        </span>
                      </div>
                      {dive.selected_route.description && (
                        <p className='text-gray-600 mt-2'>
                          {decodeHtmlEntities(dive.selected_route.description)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Route Map */}
                <div className='bg-gray-50 rounded-lg p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <h4 className='text-sm font-medium text-gray-700'>Route Map</h4>
                    {/* Route Legend - Horizontal */}
                    {dive.selected_route.route_data && (
                      <div className='flex items-center gap-4 text-xs'>
                        <div className='flex items-center gap-1'>
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: getRouteTypeColor('scuba') }}
                          ></div>
                          <span className='text-gray-700'>Scuba Route</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: getRouteTypeColor('swim') }}
                          ></div>
                          <span className='text-gray-700'>Swim Route</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: getRouteTypeColor('walk') }}
                          ></div>
                          <span className='text-gray-700'>Walk Route</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className='h-64 rounded border overflow-hidden relative'>
                    {dive.selected_route.route_data ? (
                      <>
                        <MapContainer
                          center={routeMapViewport.center}
                          zoom={routeMapViewport.zoom}
                          style={{ height: '100%', width: '100%' }}
                          zoomControl={true}
                          whenReady={() => {
                            // Map is ready
                          }}
                        >
                          <TileLayer
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <MapViewUpdater viewport={routeMapViewport} />
                          <DiveRouteLayer
                            route={dive.selected_route}
                            diveSiteId={dive.dive_site_id}
                            diveSite={dive.dive_site}
                          />
                          <ZoomTracker onZoomChange={setCurrentZoom} />
                        </MapContainer>
                        <ZoomControl currentZoom={currentZoom} />
                      </>
                    ) : (
                      <div className='h-full bg-gray-200 flex items-center justify-center'>
                        <div className='text-center text-gray-500'>
                          <MapPin className='h-8 w-8 mx-auto mb-2' />
                          <p className='text-sm'>No route data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Actions */}
                <div className='flex gap-2 pt-4 border-t border-gray-200'>
                  <button
                    onClick={() =>
                      navigate(`/dive-sites/${dive.dive_site_id}/route/${dive.selected_route.id}`)
                    }
                    className='px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700'
                  >
                    View Full Route
                  </button>
                </div>
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
                  <MapPin size={15} className='text-gray-500' />
                  <span className='font-medium'>{dive.dive_site.name}</span>
                </div>
                {dive.dive_site.description && (
                  <p className='text-sm text-gray-600'>
                    {renderTextWithLinks(dive.dive_site.description)}
                  </p>
                )}
                <RouterLink
                  to={`/dive-sites/${dive.dive_site.id}/${slugify(dive.dive_site.name)}`}
                  state={{ from: window.location.pathname + window.location.search }}
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
                  <MapPin size={15} className='text-gray-500' />
                  <span className='font-medium'>{dive.diving_center.name}</span>
                </div>
                {dive.diving_center.description && (
                  <p className='text-sm text-gray-600'>
                    {renderTextWithLinks(dive.diving_center.description)}
                  </p>
                )}
                <RouterLink
                  to={`/diving-centers/${dive.diving_center.id}`}
                  state={{ from: window.location.pathname + window.location.search }}
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
      <Modal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        title={selectedMedia?.title || 'Dive Media'}
        className='max-w-4xl max-h-full p-4'
        overlayClassName='bg-opacity-75'
      >
        <div className='flex flex-col items-center'>
          {selectedMedia?.media_type === 'photo' && (
            <img
              src={selectedMedia.url}
              alt={selectedMedia.description || 'Dive photo'}
              className='max-w-full max-h-[70vh] object-contain'
            />
          )}
          {selectedMedia?.media_type === 'video' && (
            <video src={selectedMedia.url} controls className='max-w-full max-h-[70vh]' />
          )}
          {selectedMedia?.description && (
            <p className='mt-4 text-gray-600 text-center w-full'>{selectedMedia.description}</p>
          )}
        </div>
      </Modal>

      {/* Dive Profile Modal */}
      <DiveProfileModal
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        profileData={profileData}
        isLoading={profileLoading}
        error={profileError?.response?.data?.detail || profileError?.message}
        showTemperature={true}
        screenSize='desktop'
        onDecoStatusChange={profileHasDeco => {
          // If profile data is available, use it; otherwise keep tag-based detection
          if (profileHasDeco !== undefined) {
            setHasDeco(profileHasDeco);
          }
        }}
      />
    </div>
  );
};

export default DiveDetail;
