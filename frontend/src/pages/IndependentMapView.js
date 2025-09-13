import {
  Map,
  Filter,
  Search,
  Layers,
  Settings,
  Maximize2,
  Minimize2,
  X,
  MapPin,
  Loader2,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

import LeafletMapView from '../components/LeafletMapView';
import MapLayersPanel from '../components/MapLayersPanel';
import MobileMapControls from '../components/MobileMapControls';
import UnifiedMapFilters from '../components/UnifiedMapFilters';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { useViewportData } from '../hooks/useViewportData';

const IndependentMapView = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isMobile, isTablet } = useResponsive();

  // Viewport state for map
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2,
    bounds: null,
  });

  // Geolocation state
  const [geolocationStatus, setGeolocationStatus] = useState('idle'); // 'idle', 'requesting', 'granted', 'denied', 'error'
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState('dive-sites'); // 'dive-sites', 'diving-centers', 'dives'
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
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
    difficulty_level: '',
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

  // Get initial entity type from URL
  useEffect(() => {
    const entityType = searchParams.get('type') || 'dive-sites';
    // Ensure we only allow valid entity types
    const validTypes = ['dive-sites', 'diving-centers', 'dives'];
    if (validTypes.includes(entityType)) {
      setSelectedEntityType(entityType);
    } else {
      setSelectedEntityType('dive-sites');
    }
  }, [searchParams]);

  // Request user location on component mount or entity type change
  useEffect(() => {
    if (navigator.geolocation) {
      // Reset geolocation state when component mounts or entity type changes
      setLocationPermissionAsked(false);
      setGeolocationStatus('idle');
      setUserLocation(null);

      // Small delay to ensure state is reset before requesting location
      const timer = setTimeout(() => {
        setLocationPermissionAsked(true);
        requestUserLocation();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [selectedEntityType]); // Trigger on entity type change

  // Request user location function
  const requestUserLocation = () => {
    setGeolocationStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
        setGeolocationStatus('granted');

        // Update viewport to user location with zoom level 10
        setViewport({
          longitude,
          latitude,
          zoom: 10,
          bounds: null,
        });
      },
      error => {
        setGeolocationStatus('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  // Fetch data based on viewport and filters using the viewport data hook
  const {
    data: mapData,
    isLoading,
    error,
    performanceMetrics: hookPerformanceMetrics,
  } = useViewportData(viewport, filters, selectedEntityType);

  // Update performance metrics when data changes
  useEffect(() => {
    if (hookPerformanceMetrics) {
      setPerformanceMetrics(hookPerformanceMetrics);
    }
  }, [hookPerformanceMetrics]);

  // Handle viewport changes
  const handleViewportChange = newViewport => {
    setViewport(newViewport);
  };

  // Handle filter changes
  const handleFilterChange = newFilters => {
    setFilters(newFilters);
  };

  // Handle entity type change
  const handleEntityTypeChange = entityType => {
    // Ensure we only allow valid entity types
    const validTypes = ['dive-sites', 'diving-centers', 'dives'];
    if (validTypes.includes(entityType)) {
      setSelectedEntityType(entityType);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('type', entityType);
      setSearchParams(newSearchParams);
    }
  };

  // Handle layer change
  const handleLayerChange = layer => {
    setSelectedLayer(layer);
    setShowLayers(false);
  };

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
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='text-red-500 text-xl mb-4'>Error loading map data</div>
          <button
            onClick={() => window.location.reload()}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div
        className={`bg-white border-b border-gray-200 shadow-sm ${isFullscreen ? 'z-[9999]' : ''}`}
      >
        <div className='px-4 py-3'>
          <div className='flex items-center justify-between'>
            {/* Left side - Navigation and title */}
            <div className='flex items-center space-x-4'>
              <button
                onClick={() => navigate(-1)}
                className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
              >
                <Map className='w-5 h-5' />
              </button>
              <div>
                <h1 className='text-xl font-semibold text-gray-900'>Interactive Map</h1>
                <p className='text-sm text-gray-600'>Explore dive sites, centers, and dives</p>
              </div>
            </div>

            {/* Right side - Controls */}
            <div className='flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1 sm:gap-0 max-w-full overflow-hidden'>
              {/* Performance indicator - Hidden on mobile */}
              {performanceMetrics.dataPoints > 0 && (
                <div className='hidden sm:flex items-center space-x-2 text-xs text-gray-500'>
                  <span>{performanceMetrics.dataPoints} points</span>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                </div>
              )}

              {/* Entity type selector - Responsive sizing */}
              <select
                value={selectedEntityType}
                onChange={e => handleEntityTypeChange(e.target.value)}
                className='px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0 flex-shrink-0 max-w-[120px] sm:max-w-none'
              >
                <option value='dive-sites'>Dive Sites</option>
                <option value='diving-centers'>Diving Centers</option>
                <option value='dives'>Dives</option>
              </select>

              {/* Filter button - Smaller on mobile */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
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
              >
                <Layers className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
              </button>

              {/* Geolocation button - Smaller on mobile */}
              <button
                onClick={requestUserLocation}
                disabled={geolocationStatus === 'requesting'}
                className={`p-1 xs:p-1.5 sm:p-2 rounded-lg transition-colors ${
                  geolocationStatus === 'granted'
                    ? 'bg-green-100 text-green-600'
                    : geolocationStatus === 'denied'
                      ? 'bg-red-100 text-red-600'
                      : 'hover:bg-gray-100 text-gray-600'
                } ${geolocationStatus === 'requesting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  geolocationStatus === 'granted'
                    ? 'Location found - Click to refresh'
                    : geolocationStatus === 'denied'
                      ? 'Location denied - Click to try again'
                      : 'Find my location'
                }
              >
                {geolocationStatus === 'requesting' ? (
                  <Loader2 className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5 animate-spin' />
                ) : (
                  <MapPin className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />
                )}
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
                {isFullscreen ? <X className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' /> : <Maximize2 className='w-3 h-3 xs:w-4 xs:h-4 sm:w-5 sm:h-5' />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Geolocation status message */}
      {geolocationStatus !== 'idle' && (
        <div className='bg-blue-50 border-b border-blue-200 px-4 py-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              {geolocationStatus === 'requesting' && (
                <>
                  <Loader2 className='w-4 h-4 animate-spin text-blue-600' />
                  <span className='text-sm text-blue-800'>Finding your location...</span>
                </>
              )}
              {geolocationStatus === 'granted' && (
                <>
                  <MapPin className='w-4 h-4 text-green-600' />
                  <span className='text-sm text-green-800'>
                    Location found! Map centered on your area.
                  </span>
                </>
              )}
              {geolocationStatus === 'denied' && (
                <>
                  <MapPin className='w-4 h-4 text-red-600' />
                  <span className='text-sm text-red-800'>
                    Location access denied. Using default view.
                  </span>
                </>
              )}
            </div>
            {geolocationStatus === 'denied' && (
              <button
                onClick={requestUserLocation}
                className='text-sm text-blue-600 hover:text-blue-800 underline'
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`h-[calc(100vh-80px)] ${isMobile ? 'relative' : 'flex'}`}>
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
            />
          </div>
        )}

        {/* Map area */}
        <div className={`${isMobile ? 'w-full h-full' : 'flex-1'} relative`}>
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
          />

          {/* Layers panel */}
          <MapLayersPanel
            isOpen={showLayers}
            onClose={() => setShowLayers(false)}
            selectedLayer={selectedLayer}
            onLayerChange={handleLayerChange}
          />

          {/* Mobile controls overlay */}
          {isMobile && (
            <MobileMapControls
              onToggleFilters={() => setShowFilters(!showFilters)}
              onToggleLayers={() => setShowLayers(!showLayers)}
              showFilters={showFilters}
              showLayers={showLayers}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default IndependentMapView;
