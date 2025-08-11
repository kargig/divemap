import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';

const DiveMap = ({ diveSites = [], divingCenters = [], showTripInfo = false }) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [maxZoom, setMaxZoom] = useState(19);

  // Create custom dive site icon (scuba flag)
  const createDiveSiteIcon = () => {
    const size = 24;

    // Create SVG scuba flag (diver down flag) - red rectangle with white diagonal stripe
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Red rectangle background -->
        <rect x="2" y="2" width="20" height="20" fill="#dc2626" stroke="white" stroke-width="1"/>
        <!-- White diagonal stripe from top-left to bottom-right -->
        <path d="M2 2 L22 22" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <!-- Optional: Add small white dots for bubbles -->
        <circle cx="6" cy="6" r="1" fill="white"/>
        <circle cx="18" cy="18" r="1" fill="white"/>
      </svg>
    `;

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return new Icon({
      src: dataUrl,
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    });
  };

  // Create custom diving center icon (building)
  const createDivingCenterIcon = () => {
    const size = 24;

    // Create SVG building icon
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Building structure -->
        <rect x="4" y="8" width="16" height="14" fill="#1f2937" stroke="white" stroke-width="1"/>
        <!-- Roof -->
        <path d="M4 8 L12 2 L20 8" stroke="white" stroke-width="1" fill="none"/>
        <!-- Windows -->
        <rect x="6" y="10" width="3" height="3" fill="#3b82f6"/>
        <rect x="15" y="10" width="3" height="3" fill="#3b82f6"/>
        <rect x="6" y="15" width="3" height="3" fill="#3b82f6"/>
        <rect x="15" y="15" width="3" height="3" fill="#3b82f6"/>
        <!-- Door -->
        <rect x="10" y="18" width="4" height="4" fill="#3b82f6"/>
      </svg>
    `;

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return new Icon({
      src: dataUrl,
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    });
  };

  useEffect(() => {
    if (!mapRef.current) return;

    try {
      // Create map
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat([0, 0]),
          zoom: 2,
        }),
      });

      mapInstance.current = map;

      // Set up zoom level tracking
      map.getView().setMaxZoom(18);
      setMaxZoom(18);
      setCurrentZoom(map.getView().getZoom());

      // Listen for zoom changes
      map.getView().on('change:resolution', () => {
        setCurrentZoom(map.getView().getZoom());
      });
    } catch (error) {
      // Map creation error handled silently
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
      }
    };
  }, []);

  // Update map when data changes
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing vector layers
    const layers = mapInstance.current.getLayers();
    const existingVectorLayers = layers.getArray().filter(layer => layer instanceof VectorLayer);
    existingVectorLayers.forEach(layer => mapInstance.current.removeLayer(layer));

    // Create dive site features
    const diveSiteFeatures = diveSites
      .map(site => {
        const lon = parseFloat(site.longitude);
        const lat = parseFloat(site.latitude);

        if (isNaN(lon) || isNaN(lat)) {
          // Invalid coordinates for dive site, skipping
          return null;
        }

        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          type: 'dive_site',
          data: site,
        });
        return feature;
      })
      .filter(feature => feature !== null);

    // Create diving center features
    const divingCenterFeatures = divingCenters
      .map(center => {
        const lon = parseFloat(center.longitude);
        const lat = parseFloat(center.latitude);

        if (isNaN(lon) || isNaN(lat)) {
          // Invalid coordinates for diving center, skipping
          return null;
        }

        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          type: 'diving_center',
          data: center,
        });
        return feature;
      })
      .filter(feature => feature !== null);

    // Create dive sites layer
    if (diveSiteFeatures.length > 0) {
      const diveSiteSource = new VectorSource({
        features: diveSiteFeatures,
      });

      const diveSiteLayer = new VectorLayer({
        source: diveSiteSource,
        style: new Style({
          image: createDiveSiteIcon(),
        }),
      });

      mapInstance.current.addLayer(diveSiteLayer);
    }

    // Create diving centers layer
    if (divingCenterFeatures.length > 0) {
      const divingCenterSource = new VectorSource({
        features: divingCenterFeatures,
      });

      const divingCenterLayer = new VectorLayer({
        source: divingCenterSource,
        style: new Style({
          image: createDivingCenterIcon(),
        }),
      });

      mapInstance.current.addLayer(divingCenterLayer);
    }

    // Fit view to show all features
    const allFeatures = [...diveSiteFeatures, ...divingCenterFeatures];
    if (allFeatures.length > 0) {
      const extent = new VectorSource({ features: allFeatures }).getExtent();
      const view = mapInstance.current.getView();
      const maxZoom = view.getMaxZoom();
      const targetZoom = Math.max(maxZoom - 5, 2); // Keep zoom 5 levels before max, minimum 2

      mapInstance.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000,
        maxZoom: targetZoom,
      });
    }
  }, [diveSites, divingCenters]);

  // Handle feature clicks
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = event => {
      const feature = mapInstance.current.forEachFeatureAtPixel(event.pixel, feature => feature);

      if (feature) {
        const data = feature.get('data');
        const type = feature.get('type');
        setPopupInfo({ ...data, type });
        setPopupPosition({ x: event.pixel[0], y: event.pixel[1] });

        // Prevent event from bubbling up to document
        event.stopPropagation();
      } else {
        setPopupInfo(null);
        setPopupPosition(null);
      }
    };

    mapInstance.current.on('click', handleClick);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.un('click', handleClick);
      }
    };
  }, [diveSites, divingCenters]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      // Use a small timeout to avoid immediate clearing when popup is being set
      setTimeout(() => {
        if (
          popupInfo &&
          !event.target.closest('.map-popup') &&
          !event.target.closest('.ol-viewport') &&
          !event.target.closest('.ol-map')
        ) {
          setPopupInfo(null);
          setPopupPosition(null);
        }
      }, 10);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [popupInfo]);

  const totalItems = (diveSites?.length || 0) + (divingCenters?.length || 0);

  return (
    <div className='h-[36rem] w-full rounded-lg overflow-hidden shadow-md relative'>
      <div ref={mapRef} className='w-full h-full' />
      <div className='absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        {totalItems} items loaded ({diveSites?.length || 0} dive sites, {divingCenters?.length || 0}{' '}
        diving centers)
      </div>

      {/* Zoom Level Debug Indicator */}
      <div className='absolute top-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        Zoom: {currentZoom.toFixed(1)} / Max: {maxZoom}
      </div>

      {/* Legend */}
      <div className='absolute bottom-2 right-2 bg-white bg-opacity-90 px-3 py-2 rounded text-xs'>
        <div className='flex items-center space-x-2 mb-1'>
          <div className='w-3 h-3 bg-blue-500 rounded-full'></div>
          <span>Dive Sites</span>
        </div>
        <div className='flex items-center space-x-2'>
          <div className='w-3 h-3 bg-red-500 rounded-full'></div>
          <span>Diving Centers</span>
        </div>
      </div>

      {popupInfo && popupPosition && (
        <div
          className='map-popup absolute bg-white rounded-lg shadow-lg p-4 max-w-xs z-50'
          style={{
            left: `${popupPosition.x + 10}px`,
            top: `${popupPosition.y - 10}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className='p-2'>
            <div className='flex items-center justify-between mb-2'>
              <h3 className='font-semibold text-gray-900'>{popupInfo.name}</h3>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  popupInfo.type === 'dive_site'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {popupInfo.type === 'dive_site' ? 'Dive Site' : 'Diving Center'}
              </span>
            </div>

            {popupInfo.description && (
              <p className='text-sm text-gray-600 mb-2 line-clamp-2'>{popupInfo.description}</p>
            )}

            {popupInfo.type === 'dive_site' && (
              <div className='flex items-center justify-between mb-2'>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColorClasses(popupInfo.difficulty_level)}`}
                >
                  {getDifficultyLabel(popupInfo.difficulty_level)}
                </span>
                {popupInfo.average_rating && (
                  <div className='flex items-center'>
                    <span className='text-sm text-gray-700'>
                      {popupInfo.average_rating.toFixed(1)} ⭐
                    </span>
                  </div>
                )}
              </div>
            )}

            {popupInfo.type === 'diving_center' && popupInfo.average_rating && (
              <div className='flex items-center justify-end mb-2'>
                <span className='text-sm text-gray-700'>
                  {popupInfo.average_rating.toFixed(1)} ⭐
                </span>
              </div>
            )}

            {/* Trip Information */}
            {showTripInfo && popupInfo.trip_date && (
              <div className='border-t pt-2 mt-2'>
                <h4 className='font-medium text-gray-900 mb-1'>Upcoming Trip</h4>
                <div className='space-y-1 text-sm text-gray-600'>
                  <div className='flex items-center'>
                    <span className='font-medium'>Date:</span>
                    <span className='ml-2'>
                      {new Date(popupInfo.trip_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  {popupInfo.trip_time && (
                    <div className='flex items-center'>
                      <span className='font-medium'>Time:</span>
                      <span className='ml-2'>{popupInfo.trip_time.substring(0, 5)}</span>
                    </div>
                  )}
                  {popupInfo.trip_price && (
                    <div className='flex items-center'>
                      <span className='font-medium'>Price:</span>
                      <span className='ml-2'>
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: popupInfo.trip_currency || 'EUR',
                        }).format(popupInfo.trip_price)}
                      </span>
                    </div>
                  )}
                  {popupInfo.trip_status && (
                    <div className='flex items-center'>
                      <span className='font-medium'>Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          popupInfo.trip_status === 'scheduled'
                            ? 'bg-green-100 text-green-800'
                            : popupInfo.trip_status === 'confirmed'
                              ? 'bg-blue-100 text-blue-800'
                              : popupInfo.trip_status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : popupInfo.trip_status === 'completed'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {popupInfo.trip_status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link
              to={
                popupInfo.type === 'dive_site'
                  ? `/dive-sites/${popupInfo.id}`
                  : `/diving-centers/${popupInfo.id}`
              }
              className='block w-full text-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors'
            >
              View Details
            </Link>
            <button
              onClick={() => {
                setPopupInfo(null);
                setPopupPosition(null);
              }}
              className='absolute top-2 right-2 text-gray-400 hover:text-gray-600'
            >
              ✖
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DiveMap.propTypes = {
  diveSites: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      latitude: PropTypes.string.isRequired,
      longitude: PropTypes.string.isRequired,
      description: PropTypes.string,
      difficulty_level: PropTypes.string,
      average_rating: PropTypes.number,
      trip_date: PropTypes.string,
      trip_time: PropTypes.string,
      trip_price: PropTypes.number,
      trip_currency: PropTypes.string,
      trip_status: PropTypes.string,
    })
  ),
  divingCenters: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      latitude: PropTypes.string.isRequired,
      longitude: PropTypes.string.isRequired,
      description: PropTypes.string,
      average_rating: PropTypes.number,
    })
  ),
  showTripInfo: PropTypes.bool,
};

export default DiveMap;
