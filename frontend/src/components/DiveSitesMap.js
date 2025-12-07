import L, { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import { Info } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useLocation } from 'react-router-dom';

import api from '../api';
import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { renderTextWithLinks } from '../utils/textHelpers';
import {
  getSuitabilityColor,
  getSuitabilityLabel,
  formatWindSpeed,
  formatWindDirection,
} from '../utils/windSuitabilityHelpers';

import WindDataError from './WindDataError';
import WindDateTimePicker from './WindDateTimePicker';
import WindOverlay from './WindOverlay';
import WindOverlayLegend from './WindOverlayLegend';
import WindOverlayToggle from './WindOverlayToggle';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to track zoom changes
const MapZoomTracker = ({ onZoomChange, onClusteringChange }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const onZoom = () => {
      const zoom = map.getZoom();
      onZoomChange(zoom);
      // Enable clustering at zoom <= 12, disable at zoom >= 13
      const shouldUseClustering = zoom <= 12;
      onClusteringChange(shouldUseClustering);
    };
    map.on('zoomend', onZoom);
    onZoom(); // Call immediately to set initial zoom
    return () => map.off('zoomend', onZoom);
  }, [map, onZoomChange, onClusteringChange]);
  return null;
};

// Helper component to fit map to bounds
const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
  return null;
};

// Helper component to track map bounds and metadata for wind overlay
const MapMetadataTracker = ({ onMetadataChange }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;

    const updateMetadata = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();

      onMetadataChange({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        center: {
          lat: center.lat,
          lng: center.lng,
        },
        zoom,
      });
    };

    // Update on move and zoom
    map.on('moveend', updateMetadata);
    map.on('zoomend', updateMetadata);
    updateMetadata(); // Initial update

    return () => {
      map.off('moveend', updateMetadata);
      map.off('zoomend', updateMetadata);
    };
  }, [map, onMetadataChange]);

  return null;
};

// Helper component to manage marker clustering
const MarkerClusterGroup = ({
  markers,
  createIcon,
  onClusterClick,
  recommendationsMap,
  showSuitability,
}) => {
  const map = useMap();
  const clusterGroupRef = useRef();

  useEffect(() => {
    if (!map) return;

    // Create cluster group
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50, // Same as OpenLayers distance
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: cluster => {
        const childCount = cluster.getChildCount();
        const size = Math.min(childCount * 3 + 10, 25); // Same sizing as OpenLayers

        return L.divIcon({
          html: `<div style="
            background-color: #dc2626;
            color: white;
            border: 2px solid white;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
          ">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    // Add markers to cluster group
    markers.forEach(marker => {
      // Get suitability for this dive site if available
      const recommendation = showSuitability ? recommendationsMap[marker.id] : null;
      const suitability = recommendation?.suitability || null;

      const leafletMarker = L.marker(marker.position, {
        icon: createIcon(suitability),
        markerData: marker, // Store marker data for cluster popup
      });

      // Build wind conditions section if recommendation is available
      const windConditionsSection = recommendation
        ? (() => {
            const rec = recommendation;
            const suitability = rec.suitability || 'unknown';
            const suitabilityColor = getSuitabilityColor(suitability);
            const suitabilityLabel = getSuitabilityLabel(suitability);
            // Wind data is directly on the recommendation object, not nested in wind_data
            const windSpeed = rec.wind_speed || 0;
            const windDirection = rec.wind_direction || 0;
            const windGusts = rec.wind_gusts;

            const speedFormatted = formatWindSpeed(windSpeed);
            const directionFormatted = formatWindDirection(windDirection);

            return `
              <div class="border-t border-gray-200 pt-2 mt-2">
                <h4 class="font-semibold text-sm mb-2">Wind Conditions</h4>
                <div class="space-y-1.5">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-1 text-xs font-medium rounded-full" style="background-color: ${suitabilityColor}20; color: ${suitabilityColor}; border: 1px solid ${suitabilityColor}40;">
                      ${suitabilityLabel}
                    </span>
                  </div>
                  <div class="text-xs text-gray-600 space-y-0.5">
                    <div><strong>Speed:</strong> ${speedFormatted.ms} m/s (${speedFormatted.knots} knots)</div>
                    <div><strong>Direction:</strong> ${directionFormatted.full}</div>
                    ${windGusts ? `<div><strong>Gusts:</strong> ${formatWindSpeed(windGusts).ms} m/s (${formatWindSpeed(windGusts).knots} knots)</div>` : ''}
                  </div>
                  ${rec.reasoning ? `<div class="text-xs text-gray-700 mt-1 italic">${rec.reasoning}</div>` : ''}
                  ${suitability === 'unknown' ? `<div class="text-xs text-amber-600 mt-1 font-medium">⚠️ Warning: Shore direction unknown - cannot determine direction-based suitability</div>` : ''}
                </div>
              </div>
            `;
          })()
        : '';

      // Add popup
      leafletMarker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-gray-900 mb-1">${marker.name}</h3>
          ${marker.description ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${marker.description}</p>` : ''}
          <div class="flex items-center justify-between mb-2">
            <span class="px-2 py-1 text-xs font-medium rounded-full             ${getDifficultyColorClasses(marker.difficulty_code)}">
              ${marker.difficulty_label || getDifficultyLabel(marker.difficulty_code)}
            </span>
            ${
              marker.average_rating
                ? `
              <div class="flex items-center">
                <span class="text-sm text-gray-700">${marker.average_rating.toFixed(1)}</span>
              </div>
            `
                : ''
            }
          </div>
          ${windConditionsSection}
          <a href="/dive-sites/${marker.id}" class="block w-full text-center px-3 py-2 bg-blue-600 text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm mt-2" style="color: white !important;">
            View Details
          </a>
        </div>
      `);

      clusterGroup.addLayer(leafletMarker);
    });

    // Add cluster group to map
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Handle cluster click
    clusterGroup.on('clusterclick', e => {
      if (onClusterClick) {
        onClusterClick();
      }

      // Generate cluster popup
      const cluster = e.layer;
      const childMarkers = cluster.getAllChildMarkers();
      const childCount = childMarkers.length;

      // Create cluster popup content
      const clusterPopupContent = `
        <div class="p-2">
          <h3 class="font-semibold text-gray-900 mb-2">${childCount} Dive Sites</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${childMarkers
              .map(marker => {
                const markerData = marker.options.markerData || {};
                return `
                <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900">${markerData.name || 'Unnamed Site'}</h4>
                    ${markerData.description ? `<p class="text-xs text-gray-600 line-clamp-1">${markerData.description}</p>` : ''}
                  </div>
                  <div class="flex items-center space-x-2">
                    ${
                      markerData.difficulty_code
                        ? `
                      <span class="px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(markerData.difficulty_code)}">
                        ${markerData.difficulty_label || getDifficultyLabel(markerData.difficulty_code)}
                      </span>
                    `
                        : ''
                    }
                    <a href="/dive-sites/${markerData.id}" class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" style="color: white !important;">
                      View
                    </a>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;

      // Create and show cluster popup
      const clusterPopup = L.popup()
        .setLatLng(cluster.getLatLng())
        .setContent(clusterPopupContent)
        .openOn(map);
    });

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, markers, createIcon, onClusterClick]);

  return null;
};

const DiveSitesMap = ({ diveSites, onViewportChange }) => {
  const location = useLocation();
  const [currentZoom, setCurrentZoom] = useState(10);
  const [maxZoom] = useState(18);
  const [useClustering, setUseClustering] = useState(true);
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [windOverlayEnabled, setWindOverlayEnabled] = useState(false);
  const [windDateTime, setWindDateTime] = useState(null); // null = current time, ISO string = specific datetime
  const [mapMetadata, setMapMetadata] = useState(null);
  const [debouncedBounds, setDebouncedBounds] = useState(null);
  const [showWindLegend, setShowWindLegend] = useState(false); // Show legend (can be toggled)

  // Create custom dive site icon with optional suitability border
  const createDiveSiteIcon = (suitability = null) => {
    const size = 24;
    const borderWidth = suitability ? 4 : 0; // 4px colored border for suitability - increased for better visibility
    const borderColor = suitability ? getSuitabilityColor(suitability) : null;

    // Create SVG scuba flag (diver down flag) - red rectangle with white diagonal stripe
    // Add colored border if suitability is available
    // Use a white outline around the colored border for better visibility
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${
          borderColor
            ? `
          <!-- White outline for better contrast -->
          <rect x="0" y="0" width="24" height="24" fill="white" stroke="white" stroke-width="${borderWidth + 1}"/>
          <!-- Colored border -->
          <rect x="0.5" y="0.5" width="23" height="23" fill="${borderColor}" stroke="${borderColor}" stroke-width="${borderWidth}" stroke-opacity="1"/>
        `
            : ''
        }
        <!-- Red rectangle background -->
        <rect x="${borderColor ? borderWidth + 0.5 : 2}" y="${borderColor ? borderWidth + 0.5 : 2}" width="${borderColor ? 24 - (borderWidth + 0.5) * 2 : 20}" height="${borderColor ? 24 - (borderWidth + 0.5) * 2 : 20}" fill="#dc2626" stroke="white" stroke-width="1"/>
        <!-- White diagonal stripe from top-left to bottom-right -->
        <path d="M${borderColor ? borderWidth + 0.5 : 2} ${borderColor ? borderWidth + 0.5 : 2} L${borderColor ? 24 - (borderWidth + 0.5) : 22} ${borderColor ? 24 - (borderWidth + 0.5) : 22}" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <!-- Optional: Add small white dots for bubbles -->
        <circle cx="${borderColor ? 6 + borderWidth + 0.5 : 6}" cy="${borderColor ? 6 + borderWidth + 0.5 : 6}" r="1" fill="white"/>
        <circle cx="${borderColor ? 18 - (borderWidth + 0.5) : 18}" cy="${borderColor ? 18 - (borderWidth + 0.5) : 18}" r="1" fill="white"/>
      </svg>
    `;

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return new Icon({
      iconUrl: dataUrl,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  // Process dive sites data
  const processedDiveSites = useMemo(() => {
    if (!diveSites || !Array.isArray(diveSites)) return [];

    return diveSites
      .filter(
        site => site && typeof site.latitude === 'number' && typeof site.longitude === 'number'
      )
      .map(site => ({
        ...site,
        position: [site.latitude, site.longitude],
      }));
  }, [diveSites]);

  // Calculate map bounds
  const mapBounds = useMemo(() => {
    if (processedDiveSites.length === 0) return null;

    const lats = processedDiveSites.map(site => site.position[0]);
    const lngs = processedDiveSites.map(site => site.position[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [processedDiveSites]);

  // Calculate map center
  const calculatedCenter = useMemo(() => {
    if (processedDiveSites.length === 0) return [0, 0];

    const lats = processedDiveSites.map(site => site.position[0]);
    const lngs = processedDiveSites.map(site => site.position[1]);

    const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const avgLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;

    return [avgLat, avgLng];
  }, [processedDiveSites]);

  // Handle zoom changes
  const handleZoomChange = zoom => {
    setCurrentZoom(zoom);
  };

  // Handle clustering changes
  const handleClusteringChange = shouldUseClustering => {
    setUseClustering(shouldUseClustering);
  };

  // Handle cluster clicks
  const handleClusterClick = () => {
    // Leaflet automatically handles cluster expansion
    // This is just for any additional custom behavior if needed
  };

  // Handle map viewport changes
  const handleViewportChange = () => {
    // Intentionally no-op to avoid render loops with parent state
  };

  // Debounce bounds changes for wind data fetching
  useEffect(() => {
    if (!mapMetadata?.bounds) return;

    const timer = setTimeout(() => {
      setDebouncedBounds(mapMetadata.bounds);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [mapMetadata?.bounds]);

  // Fetch wind data when overlay is enabled and zoom >= 12
  const shouldFetchWindData =
    windOverlayEnabled && mapMetadata?.zoom >= 12 && mapMetadata?.zoom <= 18 && debouncedBounds;
  const queryClient = useQueryClient();

  const {
    data: windData,
    isLoading: isLoadingWind,
    isFetching: isFetchingWind,
    error: windDataError,
    isError: isWindDataError,
    refetch: refetchWindData,
  } = useQuery(
    // OPTIMIZATION #4: Round bounds in query key to match backend cache granularity (0.1°)
    // This reduces unnecessary refetches when bounds change slightly but stay in same cache cell
    [
      'wind-data',
      debouncedBounds
        ? {
            // Round bounds to 0.1° to match backend cache key generation
            north: Math.round(debouncedBounds.north * 10) / 10,
            south: Math.round(debouncedBounds.south * 10) / 10,
            east: Math.round(debouncedBounds.east * 10) / 10,
            west: Math.round(debouncedBounds.west * 10) / 10,
          }
        : null,
      mapMetadata?.zoom,
      windDateTime,
    ],
    async () => {
      if (!debouncedBounds) return null;

      // Add small margin to bounds to ensure arrows appear within viewport, not at edges
      // Margin is approximately 2.5% of the bounds range (reduced from 5% for better coverage)
      const latMargin = (debouncedBounds.north - debouncedBounds.south) * 0.025;
      const lonMargin = (debouncedBounds.east - debouncedBounds.west) * 0.025;

      const params = {
        north: debouncedBounds.north + latMargin,
        south: debouncedBounds.south - latMargin,
        east: debouncedBounds.east + lonMargin,
        west: debouncedBounds.west - lonMargin,
        zoom_level: Math.round(mapMetadata.zoom),
      };

      // Add datetime_str if specified (null means current time, so don't include it)
      if (windDateTime) {
        params.datetime_str = windDateTime;
      }

      const response = await api.get('/api/v1/weather/wind', { params });

      return response.data;
    },
    {
      enabled: shouldFetchWindData,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 15 * 60 * 1000, // 15 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      keepPreviousData: true,
      // Prefetch nearby hours when data is successfully fetched
      onSuccess: data => {
        if (!windDateTime || !debouncedBounds) return;

        // Prefetch next 12 hours (4 steps of 3-hour increments) in the background
        // This ensures smooth playback without loading indicators
        const currentDate = new Date(windDateTime);
        const prefetchHours = [3, 6, 9, 12]; // Hours ahead to prefetch

        prefetchHours.forEach(hoursAhead => {
          const futureDate = new Date(currentDate);
          futureDate.setHours(futureDate.getHours() + hoursAhead);

          // Don't prefetch beyond 2 days from now
          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + 2);
          if (futureDate > maxDate) return;

          const futureDateTimeStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}T${String(futureDate.getHours()).padStart(2, '0')}:00:00`;

          // Prefetch in background (silently, without showing loading indicators)
          queryClient.prefetchQuery(
            [
              'wind-data',
              debouncedBounds
                ? {
                    north: Math.round(debouncedBounds.north * 10) / 10,
                    south: Math.round(debouncedBounds.south * 10) / 10,
                    east: Math.round(debouncedBounds.east * 10) / 10,
                    west: Math.round(debouncedBounds.west * 10) / 10,
                  }
                : null,
              mapMetadata?.zoom,
              futureDateTimeStr,
            ],
            async () => {
              const latMargin = (debouncedBounds.north - debouncedBounds.south) * 0.025;
              const lonMargin = (debouncedBounds.east - debouncedBounds.west) * 0.025;

              const params = {
                north: debouncedBounds.north + latMargin,
                south: debouncedBounds.south - latMargin,
                east: debouncedBounds.east + lonMargin,
                west: debouncedBounds.west - lonMargin,
                zoom_level: Math.round(mapMetadata.zoom),
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
    }
  );

  // Fetch wind recommendations when overlay is enabled and zoom >= 12
  const shouldFetchRecommendations =
    windOverlayEnabled && mapMetadata?.zoom >= 12 && mapMetadata?.zoom <= 18 && debouncedBounds;

  const { data: windRecommendations } = useQuery(
    ['wind-recommendations', debouncedBounds, windDateTime],
    async () => {
      if (!debouncedBounds) return null;

      const params = {
        north: debouncedBounds.north,
        south: debouncedBounds.south,
        east: debouncedBounds.east,
        west: debouncedBounds.west,
        include_unknown: true, // Include sites without shore_direction
      };

      // Add datetime_str if specified (null means current time, so don't include it)
      if (windDateTime) {
        params.datetime_str = windDateTime;
      }

      const response = await api.get('/api/v1/dive-sites/wind-recommendations', { params });
      return response.data;
    },
    {
      enabled: shouldFetchRecommendations,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 15 * 60 * 1000, // 15 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      keepPreviousData: true,
    }
  );

  // Create a map of dive site ID to recommendation for quick lookup
  const recommendationsMap = useMemo(() => {
    if (!windRecommendations?.recommendations) return {};
    const map = {};
    windRecommendations.recommendations.forEach(rec => {
      map[rec.dive_site_id] = rec;
    });
    return map;
  }, [windRecommendations]);

  return (
    <div className='w-full h-96 sm:h-[500px] lg:h-[600px] rounded-lg overflow-hidden shadow-md relative'>
      <MapContainer
        center={calculatedCenter}
        zoom={currentZoom}
        maxZoom={maxZoom}
        className='w-full h-full'
        style={{ zIndex: 1 }}
        whenReady={() => {
          setMapCenter(calculatedCenter);
          handleViewportChange();
        }}
      >
        <TileLayer attribution='' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        <MapZoomTracker
          onZoomChange={handleZoomChange}
          onClusteringChange={handleClusteringChange}
        />
        <MapMetadataTracker onMetadataChange={setMapMetadata} />
        {mapBounds && <FitBounds bounds={mapBounds} />}

        {/* Use clustering when enabled, individual markers when disabled */}
        {useClustering ? (
          <MarkerClusterGroup
            markers={processedDiveSites}
            createIcon={createDiveSiteIcon}
            onClusterClick={handleClusterClick}
            recommendationsMap={recommendationsMap}
            showSuitability={
              windOverlayEnabled &&
              mapMetadata?.zoom >= 12 &&
              mapMetadata?.zoom <= 18 &&
              Object.keys(recommendationsMap).length > 0
            }
          />
        ) : (
          processedDiveSites.map(site => {
            // Get suitability for this dive site if available
            const showSuitability =
              windOverlayEnabled &&
              mapMetadata?.zoom >= 12 &&
              mapMetadata?.zoom <= 18 &&
              Object.keys(recommendationsMap).length > 0;
            const recommendation = showSuitability ? recommendationsMap[site.id] : null;
            const suitability = recommendation?.suitability || null;

            return (
              <Marker key={site.id} position={site.position} icon={createDiveSiteIcon(suitability)}>
                <Popup>
                  <div className='p-2'>
                    <h3 className='font-semibold text-gray-900 mb-1'>
                      {site.name || `Dive Site #${site.id}`}
                    </h3>
                    {site.description && (
                      <p className='text-sm text-gray-600 mb-2 line-clamp-2'>
                        {renderTextWithLinks(site.description)}
                      </p>
                    )}
                    {(site.difficulty_code || site.average_rating) && (
                      <div className='flex items-center justify-between mb-2'>
                        {site.difficulty_code && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(site.difficulty_code)}`}
                          >
                            {site.difficulty_label || getDifficultyLabel(site.difficulty_code)}
                          </span>
                        )}
                        {site.average_rating && (
                          <div className='flex items-center'>
                            <span className='text-sm text-gray-700'>
                              {site.average_rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {recommendation && (
                      <div className='border-t border-gray-200 pt-2 mt-2'>
                        <h4 className='font-semibold text-sm mb-2'>Wind Conditions</h4>
                        <div className='space-y-1.5'>
                          <div className='flex items-center gap-2'>
                            <span
                              className='px-2 py-1 text-xs font-medium rounded-full'
                              style={{
                                backgroundColor: `${getSuitabilityColor(recommendation.suitability || 'unknown')}20`,
                                color: getSuitabilityColor(recommendation.suitability || 'unknown'),
                                border: `1px solid ${getSuitabilityColor(recommendation.suitability || 'unknown')}40`,
                              }}
                            >
                              {getSuitabilityLabel(recommendation.suitability || 'unknown')}
                            </span>
                          </div>
                          <div className='text-xs text-gray-600 space-y-0.5'>
                            {recommendation.wind_data?.wind_speed && (
                              <div>
                                <strong>Speed:</strong>{' '}
                                {formatWindSpeed(recommendation.wind_data.wind_speed).ms} m/s (
                                {formatWindSpeed(recommendation.wind_data.wind_speed).knots} knots)
                              </div>
                            )}
                            {recommendation.wind_data?.wind_direction !== undefined && (
                              <div>
                                <strong>Direction:</strong>{' '}
                                {formatWindDirection(recommendation.wind_data.wind_direction).full}
                              </div>
                            )}
                            {recommendation.wind_data?.wind_gusts && (
                              <div>
                                <strong>Gusts:</strong>{' '}
                                {formatWindSpeed(recommendation.wind_data.wind_gusts).ms} m/s (
                                {formatWindSpeed(recommendation.wind_data.wind_gusts).knots} knots)
                              </div>
                            )}
                          </div>
                          {recommendation.reasoning && (
                            <div className='text-xs text-gray-700 mt-1 italic'>
                              {recommendation.reasoning}
                            </div>
                          )}
                          {(recommendation.suitability || 'unknown') === 'unknown' && (
                            <div className='text-xs text-amber-600 mt-1 font-medium'>
                              ⚠️ Warning: Shore direction unknown - cannot determine direction-based
                              suitability
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <Link
                      to={`/dive-sites/${site.id}`}
                      state={{ from: window.location.pathname + window.location.search }}
                      className='block w-full text-center px-3 py-2 bg-blue-600 text-white !text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm mt-2'
                    >
                      View Details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}

        {/* Wind Overlay - only show when enabled and zoom >= 12 */}
        {windOverlayEnabled && mapMetadata?.zoom >= 12 && mapMetadata?.zoom <= 18 && windData && (
          <WindOverlay
            windData={windData}
            isWindOverlayEnabled={windOverlayEnabled}
            maxArrows={100}
          />
        )}
      </MapContainer>

      {/* Wind loading indicator - show when fetching wind data (initial load or refetch) */}
      {/* OPTIMIZATION: Only show loading if data is not in cache AND is currently fetching */}
      {windOverlayEnabled &&
        currentZoom >= 12 &&
        (isLoadingWind || (isFetchingWind && !windData)) && (
          <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white/95 text-gray-800 px-4 py-3 rounded-lg shadow-lg border border-gray-300 flex items-center gap-3'>
            <div className='animate-spin'>
              <svg
                className='w-5 h-5 text-blue-600'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
            </div>
            <span className='text-sm font-medium'>Loading wind data...</span>
          </div>
        )}

      {/* Wind data error indicator */}
      {windOverlayEnabled && currentZoom >= 12 && isWindDataError && windDataError && (
        <WindDataError
          error={windDataError}
          onRetry={() => refetchWindData()}
          isUsingCachedData={!!windData && windData.points && windData.points.length > 0}
        />
      )}

      {/* Info overlays */}
      <div className='absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        {processedDiveSites.length} dive sites loaded
      </div>

      <div className='absolute top-2 left-12 bg-white/90 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-medium z-10 shadow-sm border border-gray-200'>
        Zoom: {currentZoom.toFixed(1)}
      </div>

      {/* Wind Overlay Toggle Button */}
      <div className='absolute top-2 right-2 bg-white rounded-lg shadow-lg p-3 z-10 min-w-[320px] max-w-[400px]'>
        <WindOverlayToggle
          isOverlayEnabled={windOverlayEnabled}
          onToggle={setWindOverlayEnabled}
          zoomLevel={currentZoom}
          isLoading={isLoadingWind || isFetchingWind}
        />
      </div>

      {/* Button to show wind legend - positioned below zoom info (since DiveSitesMap doesn't have Map Info button) */}
      {windOverlayEnabled && currentZoom >= 12 && !showWindLegend && (
        <button
          onClick={() => setShowWindLegend(true)}
          className='absolute left-2 top-20 sm:left-4 sm:top-24 z-40 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded shadow-sm border border-gray-200 transition-colors flex items-center gap-1'
          title='Show wind overlay legend'
          aria-label='Show wind overlay legend'
        >
          <Info className='w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-gray-600' />
          Legend
        </button>
      )}

      {/* Wind DateTime Picker - floating on top of map (hidden when legend is open on mobile) */}
      {windOverlayEnabled && currentZoom >= 12 && !showWindLegend && (
        <WindDateTimePicker
          value={windDateTime}
          onChange={setWindDateTime}
          disabled={!windOverlayEnabled}
          isFetchingWind={isFetchingWind}
        />
      )}

      {/* Wind Overlay Legend - full screen on mobile (below navbar), positioned overlay on desktop */}
      {windOverlayEnabled && currentZoom >= 12 && showWindLegend && (
        <>
          {/* Backdrop for mobile - click to close */}
          <div
            className='fixed top-16 left-0 right-0 bottom-0 bg-black/20 sm:hidden z-[9998]'
            onClick={() => setShowWindLegend(false)}
            aria-hidden='true'
          />
          <div
            className='fixed top-16 left-0 right-0 bottom-0 sm:absolute sm:inset-auto sm:left-4 sm:top-[6.5rem] sm:bottom-auto sm:right-auto'
            style={{ zIndex: 99999, position: 'fixed' }}
          >
            <WindOverlayLegend onClose={() => setShowWindLegend(false)} />
          </div>
        </>
      )}
    </div>
  );
};

DiveSitesMap.propTypes = {
  diveSites: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      difficulty_code: PropTypes.string,
      description: PropTypes.string,
      average_rating: PropTypes.number,
    })
  ).isRequired,
  onViewportChange: PropTypes.func,
};

// Prop-types for helper components
MapZoomTracker.propTypes = {
  onZoomChange: PropTypes.func.isRequired,
  onClusteringChange: PropTypes.func.isRequired,
};

FitBounds.propTypes = {
  bounds: PropTypes.array.isRequired,
};

MapMetadataTracker.propTypes = {
  onMetadataChange: PropTypes.func.isRequired,
};

MarkerClusterGroup.propTypes = {
  markers: PropTypes.array.isRequired,
  createIcon: PropTypes.func.isRequired,
  onClusterClick: PropTypes.func,
};

export default DiveSitesMap;
