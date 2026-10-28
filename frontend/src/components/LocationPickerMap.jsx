import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Maximize2, Search, Loader2, MapPin, X, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import api from '../api';
import { createUserTargetPinIcon, createNearbySiteIcon } from '../utils/mapPins';

import MapLayersPanel from './MapLayersPanel';
import Modal from './ui/Modal';

// Fix Leaflet default marker assets in bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Distinct pin based on sticker #16 for the user's draggable target dive site
const USER_PIN_ICON = createUserTargetPinIcon();

// Distinct Amber dive flag pin for existing nearby dive sites
const NEARBY_SITE_ICON = createNearbySiteIcon();

const SATELLITE_LAYER = {
  id: 'satellite',
  name: 'Satellite',
  description: 'Satellite imagery view',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
};

// Map controller for programmatic center/zoom updates and size invalidation
const MapController = ({ targetView, isMaximized }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !targetView?.center) return;
    const currentZoom = map.getZoom ? map.getZoom() : 14;
    map.setView(targetView.center, targetView.zoom ?? currentZoom, { animate: false });
  }, [map, targetView]);

  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize?.();
    }, 100);
    return () => clearTimeout(timer);
  }, [map, isMaximized]);

  return null;
};

// Event listener for map clicks and zoom level changes
const MapEventsHandler = ({ onMapClick, zoomRef }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    },
    zoomend(e) {
      if (zoomRef) {
        zoomRef.current = e.target.getZoom();
      }
    },
  });
  return null;
};

const LocationPickerMap = ({
  latitude,
  longitude,
  onChange,
  height = 'h-64 sm:h-80',
  country = '',
  region = '',
  initialSearchQuery = '',
  autoSearchOnMount = false,
  onSelectNearbySite,
  onLocationResolved,
  showSearch = true,
  showNearbyAlert = true,
  className = '',
}) => {
  const [selectedLayer, setSelectedLayer] = useState(SATELLITE_LAYER);
  const [showLayers, setShowLayers] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const hasAutoSearchedRef = useRef(false);

  // Proximity check state
  const [nearbySites, setNearbySites] = useState([]);
  const [isCheckingProximity, setIsCheckingProximity] = useState(false);
  const proximityTimeoutRef = useRef(null);
  const reverseGeocodeTimeoutRef = useRef(null);
  const isInternalUpdateRef = useRef(false);

  // Parse coords
  const parsedLat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const parsedLng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  const hasValidCoords =
    typeof parsedLat === 'number' &&
    !isNaN(parsedLat) &&
    typeof parsedLng === 'number' &&
    !isNaN(parsedLng);

  // Default center if no coordinates
  const defaultCenter = hasValidCoords ? [parsedLat, parsedLng] : [37.9838, 23.7275]; // Athens default
  const defaultZoom = hasValidCoords ? 13 : country ? 6 : 4;

  const [targetView, setTargetView] = useState({
    center: defaultCenter,
    zoom: defaultZoom,
    id: 0,
  });
  const zoomRef = useRef(defaultZoom);

  // Update search input if initialSearchQuery changes and search input is empty
  useEffect(() => {
    if (initialSearchQuery && !searchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery, searchQuery]);

  // Sync center when coordinates change from external input (e.g. typing or initial load)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    if (hasValidCoords) {
      setTargetView({
        center: [parsedLat, parsedLng],
        zoom: zoomRef.current < 12 ? 14 : undefined,
        id: Date.now(),
      });
    }
  }, [parsedLat, parsedLng, hasValidCoords]);

  // Proximity check (1km) with 400ms debounce
  useEffect(() => {
    if (!hasValidCoords || !showNearbyAlert) {
      setNearbySites([]);
      return;
    }

    if (proximityTimeoutRef.current) {
      clearTimeout(proximityTimeoutRef.current);
    }

    proximityTimeoutRef.current = setTimeout(async () => {
      setIsCheckingProximity(true);
      try {
        const res = await api.get('/api/v1/dive-sites/check-proximity', {
          params: {
            lat: parsedLat,
            lng: parsedLng,
            radius_m: 1000,
          },
        });
        setNearbySites(res.data || []);
      } catch (err) {
        console.error('Failed to check proximity for dive sites:', err);
        setNearbySites([]);
      } finally {
        setIsCheckingProximity(false);
      }
    }, 400);

    return () => {
      if (proximityTimeoutRef.current) {
        clearTimeout(proximityTimeoutRef.current);
      }
    };
  }, [parsedLat, parsedLng, hasValidCoords, showNearbyAlert]);

  // Auto reverse-geocode coordinates (500ms debounce) to auto-fill Country and Region
  useEffect(() => {
    if (!hasValidCoords || !onLocationResolved) return;

    if (reverseGeocodeTimeoutRef.current) {
      clearTimeout(reverseGeocodeTimeoutRef.current);
    }

    reverseGeocodeTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/v1/dive-sites/reverse-geocode', {
          params: { latitude: parsedLat, longitude: parsedLng },
        });
        if (res.data && (res.data.country || res.data.region)) {
          onLocationResolved({
            country: res.data.country || '',
            region: res.data.region || '',
            city: res.data.city || '',
          });
        }
      } catch (err) {
        console.warn('Auto reverse-geocoding failed:', err);
      }
    }, 500);

    return () => {
      if (reverseGeocodeTimeoutRef.current) {
        clearTimeout(reverseGeocodeTimeoutRef.current);
      }
    };
  }, [parsedLat, parsedLng, hasValidCoords, onLocationResolved]);

  // Handle map click
  const handleMapClick = useCallback(
    latlng => {
      setShowSearchDropdown(false);
      if (onChange) {
        isInternalUpdateRef.current = true;
        const lat = parseFloat(latlng.lat.toFixed(6));
        const lng = parseFloat(latlng.lng.toFixed(6));
        onChange({ lat, lng });
        const currentZoom = zoomRef.current;
        setTargetView({
          center: [lat, lng],
          zoom: currentZoom < 12 ? 14 : undefined,
          id: Date.now(),
        });
      }
    },
    [onChange]
  );

  // Handle marker drag
  const handleMarkerDragEnd = useCallback(
    e => {
      const marker = e.target;
      if (marker && onChange) {
        isInternalUpdateRef.current = true;
        const position = marker.getLatLng();
        const lat = parseFloat(position.lat.toFixed(6));
        const lng = parseFloat(position.lng.toFixed(6));
        onChange({ lat, lng });
        setTargetView({
          center: [lat, lng],
          id: Date.now(),
        });
      }
    },
    [onChange]
  );

  // Handle selecting a geocoded search result
  const handleSelectSearchResult = useCallback(
    item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        const isCountryOrRegion = item.addresstype === 'country' || item.type === 'administrative';
        const targetZoom = isCountryOrRegion ? 6 : 14;
        setTargetView({
          center: [lat, lon],
          zoom: targetZoom,
          id: Date.now(),
        });
        setShowSearchDropdown(false);
        setSearchQuery(item.display_name.split(',')[0]);
        if (onChange) {
          onChange({
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lon.toFixed(6)),
          });
        }
        if (onLocationResolved && (item.country || item.region)) {
          onLocationResolved({
            country: item.country || '',
            region: item.region || '',
          });
        }
      }
    },
    [onChange, onLocationResolved]
  );

  // Geocoding place search via backend (which handles 3-tier fallback: Geoapify -> Photon -> Nominatim)
  const executeSearch = useCallback(
    async (rawQuery, isAuto = false) => {
      const query = (rawQuery || '').trim();
      if (!query) return;

      setIsSearching(true);
      try {
        const res = await api.get('/api/v1/dive-sites/search-places', {
          params: {
            q: query,
            latitude: hasValidCoords ? parsedLat : undefined,
            longitude: hasValidCoords ? parsedLng : undefined,
            limit: 5,
          },
        });

        const items = Array.isArray(res.data)
          ? res.data.map(d => ({
              display_name: d.display_name,
              name: d.name,
              lat: d.latitude,
              lon: d.longitude,
              country: d.country,
              region: d.region,
              type: d.type,
            }))
          : [];

        if (items.length === 0) {
          setSearchResults([]);
          setShowSearchDropdown(false);
          if (!isAuto) {
            toast.error(`No locations found for "${query}".`);
          }
        } else if (items.length === 1) {
          setSearchResults(items);
          handleSelectSearchResult(items[0]);
          if (isAuto) {
            toast.success(
              `Found location for "${items[0].name}" from map search. Adjust pin if needed.`
            );
          } else {
            toast.success(`Found and centered on: ${items[0].name}`);
          }
        } else {
          setSearchResults(items);
          if (!isAuto) {
            setShowSearchDropdown(true);
          }
        }
      } catch (err) {
        console.error('Place search failed:', err);
        setSearchResults([]);
        if (!isAuto) {
          toast.error('Place search failed. Please try again or click the map directly.');
        }
      } finally {
        setIsSearching(false);
      }
    },
    [hasValidCoords, parsedLat, parsedLng, handleSelectSearchResult]
  );

  const handleSearch = e => {
    if (e) e.preventDefault();
    executeSearch(searchQuery, false);
  };

  // Auto search on mount if requested and no coordinates are preset
  useEffect(() => {
    if (autoSearchOnMount && initialSearchQuery && !hasAutoSearchedRef.current && !hasValidCoords) {
      hasAutoSearchedRef.current = true;
      executeSearch(initialSearchQuery, true);
    }
  }, [autoSearchOnMount, initialSearchQuery, hasValidCoords, executeSearch]);

  const renderMapContent = (isModal = false) => (
    <div
      className={`relative w-full ${isModal ? 'h-[75vh]' : height} rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700`}
    >
      {/* Top Floating Controls */}
      <div className='absolute top-2 right-2 z-[1000] flex items-center gap-1.5'>
        <button
          type='button'
          onClick={() => setShowLayers(prev => !prev)}
          className='flex items-center gap-1 px-2.5 py-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-md shadow-sm border border-gray-200 dark:border-slate-700 text-xs font-semibold backdrop-blur-sm transition-colors'
          aria-label='Layers'
          title='Switch basemap layers'
        >
          <Layers className='w-3.5 h-3.5 text-blue-600 dark:text-blue-400' />
          <span>Layers</span>
        </button>

        {!isModal && (
          <button
            type='button'
            onClick={() => setIsMaximized(true)}
            className='p-1.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-md shadow-sm border border-gray-200 dark:border-slate-700 text-xs backdrop-blur-sm transition-colors'
            aria-label='Maximize Map'
            title='Expand map'
          >
            <Maximize2 className='w-3.5 h-3.5' />
          </button>
        )}
      </div>

      {/* Coordinate Pill Overlay */}
      {hasValidCoords && (
        <div className='absolute top-2 left-2 z-[1000] bg-slate-900/80 backdrop-blur-sm text-cyan-300 px-2 py-1 rounded-md text-xs font-mono border border-cyan-500/30 flex items-center gap-1'>
          <MapPin className='w-3 h-3 text-cyan-400' />
          <span>
            {parsedLat.toFixed(6)}, {parsedLng.toFixed(6)}
          </span>
        </div>
      )}

      {/* Instruction Badge */}
      <div className='absolute bottom-2 left-2 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-gray-600 dark:text-slate-300 px-2 py-1 rounded text-[11px] shadow-sm border border-gray-200 dark:border-slate-700 pointer-events-none'>
        Click map or drag pin to choose dive location
      </div>

      {/* MapLayersPanel */}
      <MapLayersPanel
        isOpen={showLayers}
        onClose={() => setShowLayers(false)}
        selectedLayer={selectedLayer}
        onLayerChange={layer => {
          setSelectedLayer(layer);
          setShowLayers(false);
        }}
      />

      {/* Leaflet MapContainer */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className='w-full h-full'
        style={{ zIndex: 1 }}
      >
        <TileLayer attribution={selectedLayer?.attribution || ''} url={selectedLayer?.url} />
        <MapController targetView={targetView} isMaximized={isModal} />
        <MapEventsHandler onMapClick={handleMapClick} zoomRef={zoomRef} />
        {hasValidCoords && (
          <Marker
            position={[parsedLat, parsedLng]}
            draggable={true}
            icon={USER_PIN_ICON}
            eventHandlers={{
              dragend: handleMarkerDragEnd,
            }}
          >
            <Tooltip direction='top' offset={[0, -48]} permanent={false}>
              <span className='font-semibold text-xs text-blue-700'>
                New Site Pin (Drag to move)
              </span>
            </Tooltip>
          </Marker>
        )}
        {nearbySites.map(site => {
          if (!site.latitude || !site.longitude) return null;
          return (
            <Marker
              key={site.id}
              position={[site.latitude, site.longitude]}
              icon={NEARBY_SITE_ICON}
            >
              <Tooltip direction='top' offset={[0, -37]} permanent={false}>
                <span className='font-semibold text-xs text-amber-800 dark:text-amber-300'>
                  {site.name}
                </span>
                {site.distance_m != null && (
                  <span className='text-[10px] text-gray-500 ml-1'>
                    ({Math.round(site.distance_m)}m away)
                  </span>
                )}
              </Tooltip>
              <Popup>
                <div className='p-1 max-w-[200px]'>
                  <p className='font-bold text-xs text-gray-900 dark:text-slate-100'>{site.name}</p>
                  {site.distance_m != null && (
                    <p className='text-[11px] text-amber-600 dark:text-amber-400 font-medium'>
                      {Math.round(site.distance_m)}m from your pin
                    </p>
                  )}
                  {site.description && (
                    <p className='text-[10px] text-gray-600 dark:text-slate-300 line-clamp-2 mt-1'>
                      {site.description}
                    </p>
                  )}
                  {onSelectNearbySite && (
                    <button
                      type='button'
                      onClick={() => onSelectNearbySite(site)}
                      className='mt-2 w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold'
                    >
                      Use this site instead
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Place Search Bar */}
      {showSearch && (
        <div className='relative'>
          <div
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e);
              }
            }}
            className='flex gap-1.5'
          >
            <div className='relative flex-1'>
              <input
                type='text'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                placeholder='Search island, bay, town, or reef...'
                className='w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              <Search className='absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400' />
            </div>
            <button
              type='button'
              onClick={handleSearch}
              disabled={isSearching}
              className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50'
            >
              {isSearching ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : 'Find'}
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className='absolute left-0 right-0 top-full mt-1 z-[2000] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto'>
              <div className='flex justify-between items-center px-2.5 py-1 text-[11px] text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-700'>
                <span>Places found</span>
                <button
                  type='button'
                  onClick={() => setShowSearchDropdown(false)}
                  className='hover:text-gray-700 dark:hover:text-slate-200'
                >
                  <X className='w-3 h-3' />
                </button>
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type='button'
                  onClick={() => handleSelectSearchResult(item)}
                  className='w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700/50 last:border-b-0 text-gray-800 dark:text-slate-200 flex items-center justify-between'
                >
                  <span className='truncate pr-2'>{item.display_name}</span>
                  <span className='text-[10px] text-blue-600 dark:text-blue-400 font-semibold shrink-0'>
                    Fly &rarr;
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Map */}
      {renderMapContent(false)}

      {/* Proximity Warning / Suggestion Banner */}
      {showNearbyAlert && nearbySites.length > 0 && (
        <div className='bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md p-3 text-sm'>
          <div className='flex items-start gap-2'>
            <AlertCircle className='w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5' />
            <div className='flex-1'>
              <div className='font-semibold text-blue-900 dark:text-blue-200 text-xs sm:text-sm'>
                Dive site already exists nearby (within 1km)
              </div>
              <p className='text-xs text-blue-700 dark:text-blue-300 mt-0.5 mb-2'>
                Did you dive at an existing site with a slightly different name?
              </p>

              <div className='space-y-1.5'>
                {nearbySites.slice(0, 3).map(site => (
                  <div
                    key={site.id}
                    className='flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-slate-800 rounded border border-blue-100 dark:border-slate-700'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='font-medium text-xs text-gray-900 dark:text-slate-100 truncate'>
                        {site.name}
                      </div>
                      <div className='text-[11px] text-gray-500 dark:text-slate-400'>
                        {site.country && `${site.country} • `}
                        {Math.round(site.distance_m)}m away
                      </div>
                    </div>
                    {onSelectNearbySite ? (
                      <button
                        type='button'
                        onClick={() => onSelectNearbySite(site)}
                        className='px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shrink-0 transition-colors'
                      >
                        Use This Site
                      </button>
                    ) : (
                      <a
                        href={`/dive-sites/${site.id}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded text-xs font-semibold shrink-0 transition-colors'
                      >
                        View Site &rarr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maximized Modal */}
      {isMaximized && (
        <Modal
          isOpen={true}
          onClose={() => setIsMaximized(false)}
          title='Select Dive Site Location'
          className='w-full max-w-4xl p-0 overflow-hidden'
        >
          <div className='p-3 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs'>
            <span>Click map to place or adjust pin</span>
            <button
              type='button'
              onClick={() => setIsMaximized(false)}
              className='px-3 py-1 bg-blue-600 text-white rounded font-medium'
            >
              Done
            </button>
          </div>
          {renderMapContent(true)}
        </Modal>
      )}
    </div>
  );
};

LocationPickerMap.propTypes = {
  latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  height: PropTypes.string,
  country: PropTypes.string,
  region: PropTypes.string,
  initialSearchQuery: PropTypes.string,
  autoSearchOnMount: PropTypes.bool,
  onSelectNearbySite: PropTypes.func,
  showSearch: PropTypes.bool,
  showNearbyAlert: PropTypes.bool,
  className: PropTypes.string,
};

export default LocationPickerMap;
