import {
  Map,
  Filter,
  Layers,
  Maximize2,
  X,
  MapPin,
  Loader2,
  Share2,
  Copy,
  Check,
  RotateCcw,
  Wrench,
  Wind,
  Info,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGeolocated } from 'react-geolocated';
import { useQueryClient } from 'react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';

import api from '../api';
import ErrorPage from '../components/ErrorPage';
import LeafletMapView from '../components/LeafletMapView';
import MapLayersPanel from '../components/MapLayersPanel';
import UnifiedMapFilters from '../components/UnifiedMapFilters';
import WindDateTimePicker from '../components/WindDateTimePicker';
import WindOverlayToggle from '../components/WindOverlayToggle';
import usePageTitle from '../hooks/usePageTitle';
import { useResponsive } from '../hooks/useResponsive';
import { useViewportData } from '../hooks/useViewportData';

const IndependentMapView = () => {
  // Set page title
  usePageTitle('Divemap - Map View');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useResponsive();

  // Viewport state for map
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
    bounds: null,
  });

  // Track current zoom from map instance for accurate zoom level checks
  const [currentZoom, setCurrentZoom] = useState(2);

  // Geolocation using react-geolocated hook
  const { coords, isGeolocationAvailable, isGeolocationEnabled, positionError, getPosition } =
    useGeolocated({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000, // 5 minutes - use cached location if available
      },
      userDecisionTimeout: 5000, // Firefox-specific timeout
      suppressLocationOnMount: true, // Don't auto-request on mount
      onError: error => {
        // Geolocation error handled silently
      },
      onSuccess: position => {
        // Geolocation success handled silently
      },
    });

  // Geolocation requesting state
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [hasRequestedGeolocation, setHasRequestedGeolocation] = useState(false);
  const [showGeolocationNotification, setShowGeolocationNotification] = useState(true);

  // Derived geolocation status for UI
  const geolocationStatus = useMemo(() => {
    if (isRequestingLocation) return 'requesting';
    if (!isGeolocationAvailable) return 'error';
    if (!isGeolocationEnabled) return 'denied';
    if (positionError) return 'error';
    if (coords) return 'granted';
    return 'idle';
  }, [isRequestingLocation, isGeolocationAvailable, isGeolocationEnabled, positionError, coords]);

  // Handle geolocation request
  const handleGeolocationRequest = useCallback(() => {
    if (!isRequestingLocation) {
      setIsRequestingLocation(true);
      setHasRequestedGeolocation(true);
      getPosition();
    }
  }, [getPosition, isRequestingLocation]);

  // Reset requesting state when geolocation completes
  useEffect(() => {
    if (coords || positionError) {
      setIsRequestingLocation(false);
    }
  }, [coords, positionError]);

  // Auto-hide "location found" notification after 5 seconds
  useEffect(() => {
    if (geolocationStatus === 'granted') {
      setShowGeolocationNotification(true);
      const timer = setTimeout(() => {
        setShowGeolocationNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else if (geolocationStatus === 'denied' || geolocationStatus === 'error') {
      // Show warning notifications immediately
      setShowGeolocationNotification(true);
    } else {
      // Reset notification visibility for other states
      setShowGeolocationNotification(true);
    }
  }, [geolocationStatus]);

  // Handle dismissing notification
  const handleDismissNotification = useCallback(() => {
    setShowGeolocationNotification(false);
  }, []);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(!isMobile);
  const [selectedEntityType, setSelectedEntityType] = useState('dive-sites'); // 'dive-sites', 'diving-centers', 'dives', 'dive-trips'
  const [windOverlayEnabled, setWindOverlayEnabled] = useState(false);
  // Track if user has dismissed the wind feature promotion banner
  const [windBannerDismissed, setWindBannerDismissed] = useState(() => {
    // Check localStorage for previous dismissal
    const dismissed = localStorage.getItem('windBannerDismissed');
    return dismissed === 'true';
  });
  const [windDateTime, setWindDateTime] = useState(null); // null = current time, ISO string = specific datetime
  const [isWindLoading, setIsWindLoading] = useState(false);
  const [isWindFetching, setIsWindFetching] = useState(false);
  const [showWindSlider, setShowWindSlider] = useState(true);
  const [showWindLegend, setShowWindLegend] = useState(false); // Show slider by default when wind overlay is enabled
  const queryClient = useQueryClient();

  // Helper function to prefetch wind data for multiple hours ahead
  // This is called immediately when play is pressed to prefetch upcoming hours
  const prefetchWindHours = useCallback(
    startDateTime => {
      if (!startDateTime || !viewport.bounds || currentZoom < 12) return;

      // OPTIMIZATION: Only prefetch one hour per day (not every 3 hours)
      // The backend caches all 24 hours when fetching any hour, so we only need one request per day
      // Prefetch next 2 days (one request per day) - this will cache all 48 hours
      const currentDate = new Date(startDateTime);
      const prefetchDays = [1, 2]; // Days ahead to prefetch (one request per day)

      prefetchDays.forEach(daysAhead => {
        const futureDate = new Date(currentDate);
        futureDate.setDate(futureDate.getDate() + daysAhead);
        // Use noon (12:00) as the representative hour for each day - this will cache all 24 hours for that day
        futureDate.setHours(12, 0, 0, 0);

        // Don't prefetch beyond 2 days from now
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 2);
        if (futureDate > maxDate) return;

        const futureDateTimeStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T${String(futureDate.getHours()).padStart(2, '0')}:00:00`;

        // Calculate bounds with margin (matching LeafletMapView logic)
        const bounds = viewport.bounds;
        const latMargin = (bounds.north - bounds.south) * 0.025;
        const lonMargin = (bounds.east - bounds.west) * 0.025;

        // Prefetch in background (silently, without showing loading indicators)
        queryClient.prefetchQuery(
          [
            'wind-data',
            bounds
              ? {
                  north: Math.round(bounds.north * 10) / 10,
                  south: Math.round(bounds.south * 10) / 10,
                  east: Math.round(bounds.east * 10) / 10,
                  west: Math.round(bounds.west * 10) / 10,
                }
              : null,
            currentZoom,
            futureDateTimeStr,
          ],
          async () => {
            const params = {
              north: bounds.north + latMargin,
              south: bounds.south - latMargin,
              east: bounds.east + lonMargin,
              west: bounds.west - lonMargin,
              zoom_level: Math.round(currentZoom),
              datetime_str: futureDateTimeStr,
            };

            const response = await api.get('/api/v1/weather/wind', { params });
            return response.data;
          },
          {
            staleTime: 5 * 60 * 1000,
            cacheTime: 15 * 60 * 1000,
          }
        );
      });
    },
    [viewport.bounds, currentZoom, queryClient]
  );

  // Update mobile controls visibility based on screen size
  useEffect(() => {
    setShowMobileControls(!isMobile);
  }, [isMobile]);
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);

  // Share functionality state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState({
    id: 'street',
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    difficulty_code: '',
    exclude_unspecified_difficulty: false,
    wind_suitability: '',
    min_rating: '',
    max_rating: '',
    country: '',
    region: '',
    date_from: '',
    date_to: '',
    depth_min: '',
    depth_max: '',
    visibility_min: '',
    visibility_max: '',
    suit_type: '',
    tag_ids: [],
  });

  // Performance state
  const [performanceMetrics, setPerformanceMetrics] = useState({
    dataPoints: 0,
    loadTime: 0,
    memoryUsage: 0,
  });

  const parseViewportFromURL = useCallback(() => {
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const zoom = parseFloat(searchParams.get('zoom'));

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
      return {
        longitude: lng,
        latitude: lat,
        zoom: zoom,
        bounds: null,
      };
    }
    return null;
  }, [searchParams]);

  const parseFiltersFromURL = useCallback(() => {
    const urlFilters = {};
    const filterKeys = [
      'search',
      'difficulty_code',
      'exclude_unspecified_difficulty',
      'wind_suitability',
      'min_rating',
      'max_rating',
      'country',
      'region',
      'date_from',
      'date_to',
      'depth_min',
      'depth_max',
      'visibility_min',
      'visibility_max',
      'suit_type',
      'tag_ids',
      'diving_center_id',
      'trip_status',
      'min_price',
      'max_price',
      'start_date',
      'end_date',
    ];

    filterKeys.forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        if (key === 'tag_ids') {
          urlFilters[key] = value
            ? value
                .split(',')
                .map(id => parseInt(id))
                .filter(id => !isNaN(id))
            : [];
        } else {
          urlFilters[key] = value;
        }
      }
    });

    return urlFilters;
  }, [searchParams]);

  // Initialize state from URL on component mount
  useEffect(() => {
    // Parse entity type
    const entityType = searchParams.get('type') || 'dive-sites';
    const validTypes = ['dive-sites', 'diving-centers', 'dives', 'dive-trips'];
    if (validTypes.includes(entityType)) {
      setSelectedEntityType(entityType);
    } else {
      setSelectedEntityType('dive-sites');
    }

    // Parse viewport from URL
    const urlViewport = parseViewportFromURL();
    if (urlViewport) {
      setViewport(urlViewport);
    }

    // Parse filters from URL
    const urlFilters = parseFiltersFromURL();
    setFilters(prevFilters => ({ ...prevFilters, ...urlFilters }));
  }, [searchParams, parseViewportFromURL, parseFiltersFromURL]); // Only run on mount

  // Set default date range for dive-trips when entity type changes
  useEffect(() => {
    if (selectedEntityType === 'dive-trips') {
      setFilters(prevFilters => {
        // Only set default dates if they're not already set
        if (!prevFilters.start_date && !prevFilters.end_date) {
          const today = new Date();
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - 14); // 14 days ago
          const endDate = new Date(today);
          endDate.setFullYear(today.getFullYear() + 1); // 1 year ahead

          return {
            ...prevFilters,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
          };
        }
        return prevFilters;
      });
    } else {
      // Clear dive-trips specific filters when switching to other entity types
      setFilters(prevFilters => {
        const {
          start_date,
          end_date,
          diving_center_id,
          trip_status,
          min_price,
          max_price,
          ...otherFilters
        } = prevFilters;
        return otherFilters;
      });
    }
  }, [selectedEntityType]);

  // Request user location on component mount or entity type change
  // Auto-request geolocation if no URL viewport parameters exist
  useEffect(() => {
    const urlViewport = parseViewportFromURL();
    if (
      !urlViewport &&
      isGeolocationAvailable &&
      isGeolocationEnabled &&
      !hasRequestedGeolocation
    ) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        setIsRequestingLocation(true);
        setHasRequestedGeolocation(true);
        getPosition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    selectedEntityType,
    isGeolocationAvailable,
    isGeolocationEnabled,
    hasRequestedGeolocation,
    getPosition,
    parseViewportFromURL,
  ]);

  // Request user location function
  // Handle geolocation success
  useEffect(() => {
    if (coords) {
      // Only update viewport if no URL viewport parameters exist and we haven't already
      // centered on this location
      const urlViewport = parseViewportFromURL();
      if (!urlViewport) {
        // Check if we're already centered on this location to prevent flickering
        const currentLng = viewport.longitude;
        const currentLat = viewport.latitude;
        const lngDiff = Math.abs(currentLng - coords.longitude);
        const latDiff = Math.abs(currentLat - coords.latitude);

        // Only update if the difference is significant (more than 0.01 degrees)
        if (lngDiff > 0.01 || latDiff > 0.01) {
          setViewport({
            longitude: coords.longitude,
            latitude: coords.latitude,
            zoom: 10,
            bounds: null,
          });
        }
      }
    }
  }, [coords, viewport.longitude, viewport.latitude, parseViewportFromURL]);

  // Fetch data based on viewport and filters using the viewport data hook
  const {
    data: mapData,
    isLoading,
    error,
    refetch,
    performanceMetrics: hookPerformanceMetrics,
  } = useViewportData(viewport, filters, selectedEntityType, windDateTime);

  // Debug logging for windDateTime
  useEffect(() => {
    console.log('[IndependentMapView] windDateTime state:', windDateTime);
  }, [windDateTime]);

  // Update performance metrics when data changes
  useEffect(() => {
    if (hookPerformanceMetrics) {
      setPerformanceMetrics(hookPerformanceMetrics);
    }
  }, [hookPerformanceMetrics]);

  // Handle viewport changes
  const handleViewportChange = newViewport => {
    setViewport(newViewport);
    // Update current zoom for accurate checks
    if (newViewport?.zoom !== undefined) {
      setCurrentZoom(newViewport.zoom);
    }
  };

  // Update zoom from map instance when available
  useEffect(() => {
    if (mapInstance) {
      const updateZoom = () => {
        const zoom = mapInstance.getZoom();
        if (zoom !== undefined && !isNaN(zoom)) {
          setCurrentZoom(zoom);
        }
      };

      // Initial update
      updateZoom();

      // Listen to zoom changes
      mapInstance.on('zoomend', updateZoom);

      return () => {
        mapInstance.off('zoomend', updateZoom);
      };
    }
  }, [mapInstance]);

  // Handle filter changes
  const handleFilterChange = newFilters => {
    setFilters(newFilters);
  };

  // Handle entity type change
  const handleEntityTypeChange = entityType => {
    // Ensure we only allow valid entity types
    const validTypes = ['dive-sites', 'diving-centers', 'dives', 'dive-trips'];
    if (validTypes.includes(entityType)) {
      setSelectedEntityType(entityType);
    }
  };

  // Handle wind overlay toggle - show slider when enabling
  const handleWindOverlayToggle = enabled => {
    setWindOverlayEnabled(enabled);
    if (enabled) {
      // Show slider when enabling wind overlay
      setShowWindSlider(true);
    }
  };

  // Handle wind feature promotion - enable wind overlay and zoom to location
  const handleEnableWindFeature = () => {
    // Set entity type to dive-sites (required for wind overlay)
    setSelectedEntityType('dive-sites');

    // Enable wind overlay
    setWindOverlayEnabled(true);
    setShowWindSlider(true); // Show slider when enabling wind feature

    // Zoom to the specified location with appropriate zoom level (12+ for wind overlay)
    setViewport({
      longitude: 23.9643,
      latitude: 37.7135,
      zoom: 13, // Zoom level 13 to show wind overlay
      bounds: null,
    });
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) => {
      if (value === '' || value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
  };

  // Generate share URL with current state
  const generateShareUrl = useCallback(() => {
    const params = new URLSearchParams();

    // Add entity type
    params.set('type', selectedEntityType);

    // Get current map viewport from the map instance if available
    let currentLat = viewport.latitude;
    let currentLng = viewport.longitude;
    let shareZoom = viewport.zoom;

    if (mapInstance) {
      const center = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      currentLat = center.lat;
      currentLng = center.lng;
      shareZoom = zoom;
    }

    // Add viewport
    if (currentLat && currentLng) {
      params.set('lat', currentLat.toFixed(6));
      params.set('lng', currentLng.toFixed(6));
      params.set('zoom', shareZoom.toFixed(1));
    }

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'exclude_unspecified_difficulty' && value) {
        params.set('exclude_unspecified_difficulty', 'true');
      } else if (value && value !== '' && value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(','));
          }
        } else {
          params.set(key, value.toString());
        }
      }
    });

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [selectedEntityType, viewport, filters, mapInstance]);

  // Handle share button click
  const handleShareClick = () => {
    const url = generateShareUrl();
    setShareUrl(url);
    setShowShareModal(true);
    setCopySuccess(false);
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Silently handle copy failure
    }
  };

  // Handle layer change
  const handleLayerChange = layer => {
    setSelectedLayer(layer);
    setShowLayers(false);
  };

  // Handle reset zoom - restore to geolocation or auto-fitted bounds
  const handleResetZoom = () => {
    // If geolocation was granted, restore to user's location
    if (geolocationStatus === 'granted') {
      handleGeolocationRequest();
    } else {
      // Otherwise, trigger auto-fit to bounds by incrementing the reset trigger
      setResetTrigger(prev => prev + 1);
    }
  };

  // Automatic retry for 429 errors
  useEffect(() => {
    if (error?.isRateLimited && retryCount < 3) {
      const retryDelay = error?.retryAfter ? parseInt(error.retryAfter) * 1000 : 5000; // Default 5 seconds

      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        refetch();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [error, retryCount, refetch]);

  // Reset retry count when error is resolved
  useEffect(() => {
    if (!error) {
      setRetryCount(0);
    }
  }, [error]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (error) {
    return (
      <div className='h-screen flex items-center justify-center bg-gray-50 overflow-hidden'>
        <ErrorPage
          error={error}
          onRetry={() => refetch()}
          showBack={false}
          showHome={true}
          className='max-w-md mx-auto p-6'
        />
      </div>
    );
  }

  return (
    <div
      className={`${isFullscreen ? 'h-screen' : 'h-[calc(100vh-4rem)]'} bg-gray-50 overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
    >
      {/* Header */}
      <div
        className={`bg-white border-b border-gray-200 shadow-sm flex-shrink-0 ${isFullscreen ? 'z-[9999]' : ''}`}
      >
        <div className='px-2 py-2'>
          {/* Top row - Title and back button */}
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => navigate(-1)}
                className='p-1.5 hover:bg-gray-100 rounded-lg transition-colors'
              >
                <Map className='w-4 h-4' />
              </button>
              <h1 className='text-lg font-semibold text-gray-900'>Interactive Map</h1>
            </div>
            {/* Wrench button - Mobile controls toggle */}
            <button
              onClick={() => setShowMobileControls(!showMobileControls)}
              className={`p-2 rounded-lg border transition-colors ${
                showMobileControls
                  ? 'bg-blue-500 text-white border-blue-600'
                  : 'bg-gray-500 text-white border-gray-600 hover:bg-gray-600'
              }`}
              title='Toggle map controls'
            >
              <Wrench className='w-4 h-4' />
            </button>
          </div>

          {/* Bottom row - Description and dropdown */}
          <div className='flex items-center justify-between'>
            <p className='text-xs text-gray-600'>Explore dive sites, centers, and dives</p>
            {/* Entity type selector */}
            <select
              value={selectedEntityType}
              onChange={e => handleEntityTypeChange(e.target.value)}
              className='px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value='dives'>Dives</option>
              <option value='dive-sites'>Dive Sites</option>
              <option value='diving-centers'>Diving Centers</option>
              <option value='dive-trips'>Dive Trips</option>
            </select>
          </div>

          {/* Wind Feature Promotion Banner */}
          {!windOverlayEnabled && !windBannerDismissed && selectedEntityType === 'dive-sites' && (
            <div className='mt-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg shadow-sm'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex items-start gap-3 flex-1'>
                  <div className='flex-shrink-0 mt-0.5'>
                    <Wind className='w-5 h-5 text-blue-600' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <h3 className='text-sm font-semibold text-gray-900 mb-1'>
                      New: Real-Time Wind Conditions
                    </h3>
                    <p className='text-xs text-gray-700 mb-2'>
                      View live wind speed, direction, and forecasts on the map. Plan your dives
                      based on current and future weather conditions with interactive wind arrows
                      and dive site suitability indicators. View a location on Zoom level 12+ and
                      activate wind overlay to see the wind conditions.
                    </p>
                    <button
                      onClick={handleEnableWindFeature}
                      className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm'
                    >
                      <Wind className='w-4 h-4' />
                      Try Wind Overlay
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Permanently dismiss the banner
                    setWindBannerDismissed(true);
                    localStorage.setItem('windBannerDismissed', 'true');
                  }}
                  className='flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors'
                  aria-label='Dismiss'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Controls Section */}
          {showMobileControls && (
            <div className='mt-4 pt-4 border-t border-gray-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1 sm:gap-0 max-w-full overflow-hidden'>
                  {/* Performance indicator - Hidden on mobile */}
                  {performanceMetrics.dataPoints > 0 && (
                    <div className='hidden sm:flex items-center space-x-2 text-xs text-gray-500'>
                      <span>{performanceMetrics.dataPoints} points</span>
                      <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                    </div>
                  )}

                  {/* Filter button - Smaller on mobile */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                      showFilters
                        ? 'bg-blue-100 text-blue-600'
                        : hasActiveFilters()
                          ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                          : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title={hasActiveFilters() ? 'Filters are active' : 'Toggle filters'}
                  >
                    <Filter className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                  </button>

                  {/* Layers button - Smaller on mobile */}
                  <button
                    onClick={() => {
                      setShowLayers(!showLayers);
                    }}
                    className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                      showLayers ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title='Map layers'
                  >
                    <Layers className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                  </button>

                  {/* Wind Overlay Toggle - only show for dive sites */}
                  {selectedEntityType === 'dive-sites' && (
                    <>
                      <WindOverlayToggle
                        isOverlayEnabled={windOverlayEnabled}
                        onToggle={handleWindOverlayToggle}
                        zoomLevel={currentZoom}
                        isLoading={isWindLoading}
                        disabled={false}
                      />
                      {/* Wind DateTime Picker is now floating on top of map - handled separately below */}
                    </>
                  )}

                  {/* Geolocation button - Smaller on mobile */}
                  <button
                    onClick={handleGeolocationRequest}
                    disabled={geolocationStatus === 'requesting'}
                    className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                      geolocationStatus === 'granted'
                        ? 'bg-green-100 text-green-600'
                        : geolocationStatus === 'denied' || geolocationStatus === 'error'
                          ? 'bg-red-100 text-red-600'
                          : 'hover:bg-gray-100 text-gray-600'
                    } ${geolocationStatus === 'requesting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={
                      geolocationStatus === 'granted'
                        ? 'Location found - Click to refresh'
                        : geolocationStatus === 'denied'
                          ? 'Location denied - Click to try again'
                          : geolocationStatus === 'error'
                            ? 'Location failed/timed out - Click to try again'
                            : 'Find my location'
                    }
                  >
                    {geolocationStatus === 'requesting' ? (
                      <Loader2 className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 animate-spin' />
                    ) : (
                      <MapPin className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                    )}
                  </button>

                  {/* Reset zoom button - Smaller on mobile */}
                  <button
                    onClick={handleResetZoom}
                    className='p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-600'
                    title={
                      geolocationStatus === 'granted'
                        ? 'Reset to your location'
                        : 'Reset to show all points'
                    }
                  >
                    <RotateCcw className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                  </button>

                  {/* Share button - Smaller on mobile */}
                  <button
                    onClick={handleShareClick}
                    className='p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-600'
                    title='Share current map view'
                  >
                    <Share2 className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                  </button>

                  {/* Fullscreen button - Smaller on mobile */}
                  <button
                    onClick={toggleFullscreen}
                    className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                      isFullscreen
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <X className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                    ) : (
                      <Maximize2 className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geolocation status message */}
      {geolocationStatus !== 'idle' && showGeolocationNotification && (
        <div
          className={`${
            isMobile
              ? 'bg-blue-50 border-b border-blue-200 px-1.5 py-1'
              : 'bg-blue-50 border-b border-blue-200 px-4 py-2'
          }`}
        >
          <div className='flex items-center justify-between'>
            <div
              className={`flex items-center ${isMobile ? 'space-x-1.5' : 'space-x-2'} flex-1 min-w-0`}
            >
              {geolocationStatus === 'requesting' && (
                <>
                  <Loader2
                    className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} animate-spin text-blue-600 flex-shrink-0`}
                  />
                  <span
                    className={`${isMobile ? 'text-[10px] leading-tight' : 'text-sm'} text-blue-800`}
                  >
                    Finding your location...
                  </span>
                </>
              )}
              {geolocationStatus === 'granted' && (
                <>
                  <MapPin
                    className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} text-green-600 flex-shrink-0`}
                  />
                  <span
                    className={`${isMobile ? 'text-[10px] leading-tight' : 'text-sm'} text-green-800`}
                  >
                    Location found! Map centered on your area.
                  </span>
                </>
              )}
              {geolocationStatus === 'denied' && (
                <>
                  <MapPin
                    className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} text-red-600 flex-shrink-0`}
                  />
                  <span
                    className={`${isMobile ? 'text-[10px] leading-tight' : 'text-sm'} text-red-800`}
                  >
                    Location access denied. Using default view.
                  </span>
                </>
              )}
              {geolocationStatus === 'error' && (
                <>
                  <MapPin
                    className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} text-red-600 flex-shrink-0`}
                  />
                  <span
                    className={`${isMobile ? 'text-[10px] leading-tight' : 'text-sm'} text-red-800`}
                  >
                    Location error occurred. Using default view.
                  </span>
                </>
              )}
            </div>
            <div
              className={`flex items-center ${isMobile ? 'space-x-1' : 'space-x-2'} flex-shrink-0`}
            >
              {(geolocationStatus === 'denied' || geolocationStatus === 'error') && (
                <>
                  <button
                    onClick={handleGeolocationRequest}
                    className={`${isMobile ? 'text-[10px]' : 'text-sm'} text-blue-600 hover:text-blue-800 underline`}
                  >
                    Try again
                  </button>
                  <button
                    onClick={handleDismissNotification}
                    className={`${isMobile ? 'p-0' : 'p-0.5'} hover:bg-red-100 rounded transition-colors`}
                    aria-label='Dismiss notification'
                  >
                    <X className={`${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'} text-red-600`} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex ${isMobile ? 'relative' : 'flex-row'} min-h-0`}>
        {/* Filters sidebar */}
        {showFilters && (
          <div
            className={`bg-white border-r border-gray-200 overflow-y-auto ${
              isMobile ? 'fixed top-16 bottom-0 left-0 w-80 z-40' : 'w-80'
            }`}
          >
            <UnifiedMapFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              selectedEntityType={selectedEntityType}
              onClose={() => setShowFilters(false)}
              divingCenters={mapData?.diving_centers || []}
            />
          </div>
        )}

        {/* Map area */}
        <div
          className={`${isMobile ? 'w-full h-full' : 'flex-1 min-h-0'} relative overflow-hidden map-container`}
        >
          <LeafletMapView
            data={mapData}
            selectedEntityType={selectedEntityType}
            viewport={viewport}
            onViewportChange={handleViewportChange}
            popupInfo={popupInfo}
            setPopupInfo={setPopupInfo}
            popupPosition={popupPosition}
            setPopupPosition={setPopupPosition}
            isLoading={isLoading}
            error={error}
            selectedLayer={selectedLayer}
            onLayerChange={handleLayerChange}
            onMapInstance={setMapInstance}
            resetTrigger={resetTrigger}
            windOverlayEnabled={windOverlayEnabled}
            setWindOverlayEnabled={setWindOverlayEnabled}
            windDateTime={windDateTime}
            setWindDateTime={setWindDateTime}
            onWindFetchingChange={setIsWindFetching}
            showWindLegend={showWindLegend}
            setShowWindLegend={setShowWindLegend}
          />

          {/* Layers panel */}
          <MapLayersPanel
            isOpen={showLayers}
            onClose={() => setShowLayers(false)}
            selectedLayer={selectedLayer}
            onLayerChange={handleLayerChange}
          />

          {/* Wind DateTime Picker - floating on top of map (hidden when legend is open) */}
          {selectedEntityType === 'dive-sites' &&
            windOverlayEnabled &&
            currentZoom >= 12 &&
            showWindSlider &&
            !showWindLegend && (
              <div style={{ zIndex: 30 }}>
                <WindDateTimePicker
                  value={windDateTime}
                  onChange={setWindDateTime}
                  disabled={!windOverlayEnabled}
                  isFetchingWind={isWindFetching}
                  onClose={() => setShowWindSlider(false)}
                  onPrefetch={prefetchWindHours}
                />
              </div>
            )}

          {/* Button to re-open wind slider when it's hidden */}
          {selectedEntityType === 'dive-sites' &&
            windOverlayEnabled &&
            currentZoom >= 12 &&
            !showWindSlider && (
              <button
                onClick={() => setShowWindSlider(true)}
                className='absolute top-4 left-1/2 transform -translate-x-1/2 z-40 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors flex items-center gap-2'
                title='Show wind date/time slider'
              >
                <Wind className='w-3.5 h-3.5' />
                Show Time Slider
              </button>
            )}

          {/* Wind Overlay Legend is now handled in LeafletMapView component */}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>Share Map View</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className='text-gray-400 hover:text-gray-600'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='mb-4'>
              <p className='text-sm text-gray-600 mb-2'>
                Copy this URL to share the current map view with others:
              </p>
              <div className='flex items-center space-x-2'>
                <input
                  type='text'
                  value={shareUrl}
                  readOnly
                  className='flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50'
                />
                <button
                  onClick={handleCopyToClipboard}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    copySuccess
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <Check className='w-4 h-4 inline mr-1' />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className='w-4 h-4 inline mr-1' />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className='text-xs text-gray-500'>
              This URL includes your current view, filters, and entity type selection.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndependentMapView;
