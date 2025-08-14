import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import Cluster from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef, useCallback } from 'react';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

const TripMap = ({
  trips = [],
  filters = {},
  onTripSelect = null,
  height = '600px',
  clustering = true,
  divingCenters = [],
  diveSites = [],
  onMappedTripsCountChange = null,
  statusToggles = {},
}) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [maxZoom, setMaxZoom] = useState(19);

  // Create custom trip icon with status indication
  const createTripIcon = trip => {
    try {
      if (!trip) {
        console.warn('createTripIcon called with null/undefined trip');
        // Return a default gray icon
        const svg = `
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="13" fill="gray" stroke="white" stroke-width="2"/>
            <circle cx="14" cy="10" r="3" fill="white"/>
            <path d="M10 18 Q14 22 18 18" stroke="white" stroke-width="2" fill="none"/>
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
      }

      const size = 28;

      // Base color based on trip status
      let baseColor = '#3b82f6'; // blue for scheduled
      if (trip.trip_status === 'confirmed')
        baseColor = '#10b981'; // green
      else if (trip.trip_status === 'cancelled')
        baseColor = '#ef4444'; // red
      else if (trip.trip_status === 'completed') baseColor = '#6b7280'; // gray

      // Create SVG trip icon (diver with flag)
      const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Background circle -->
          <circle cx="14" cy="14" r="13" fill="${baseColor}" stroke="white" stroke-width="2"/>
          <!-- Diver silhouette -->
          <circle cx="14" cy="10" r="3" fill="white"/>
          <path d="M10 18 Q14 22 18 18" stroke="white" stroke-width="2" fill="none"/>
          <!-- Flag -->
          <rect x="18" y="8" width="6" height="4" fill="white" rx="1"/>
          <line x1="18" y1="8" x2="18" y2="12" stroke="white" stroke-width="1"/>
          <!-- Price indicator -->
          <circle cx="22" cy="6" r="4" fill="#fbbf24" stroke="white" stroke-width="1"/>
          <text x="22" y="8" text-anchor="middle" fill="white" font-size="6" font-weight="bold">€</text>
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
    } catch (error) {
      console.error('Error creating trip icon:', error);
      // Return a default gray icon as fallback
      const svg = `
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" fill="gray" stroke="white" stroke-width="2"/>
          <circle cx="14" cy="10" r="3" fill="white"/>
          <path d="M10 18 Q14 22 18 18" stroke="white" stroke-width="2" fill="none"/>
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
    }
  };

  // Create cluster style for grouped trips
  const createClusterStyle = useCallback(feature => {
    try {
      const features = feature.get('features');
      if (!features || !Array.isArray(features)) {
        console.warn('Cluster feature has no features array:', feature);
        return new Style(); // Return empty style as fallback
      }

      const size = features.length;
      const radius = Math.min(size * 3 + 8, 20);

      return new Style({
        image: new CircleStyle({
          radius: radius,
          fill: new Fill({
            color: '#3b82f6',
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2,
          }),
        }),
        text: new Text({
          text: size.toString(),
          fill: new Fill({
            color: 'white',
          }),
          font: 'bold 12px Arial',
        }),
      });
    } catch (error) {
      console.error('Error creating cluster style:', error);
      return new Style(); // Return empty style as fallback
    }
  }, []);

  // Create individual dive style
  const createDiveStyle = useCallback((dive, trip) => {
    try {
      if (!dive || !trip) {
        console.warn('createDiveStyle called with null/undefined dive or trip');
        return new Style(); // Return empty style as fallback
      }

      // Use the getDisplayStatus logic to determine actual status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(trip.trip_date);
      tripDate.setHours(0, 0, 0, 0);

      // If the trip date is in the past and status is 'scheduled', show 'completed'
      let actualStatus = trip.trip_status || 'scheduled';
      if (tripDate < today && actualStatus === 'scheduled') {
        actualStatus = 'completed';
      }

      const baseColor =
        actualStatus === 'confirmed'
          ? '#10b981'
          : actualStatus === 'cancelled'
            ? '#ef4444'
            : actualStatus === 'completed'
              ? '#6b7280'
              : '#3b82f6';

      const style = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: baseColor }),
          stroke: new Stroke({ color: 'white', width: 2 }),
        }),
      });

      return style;
    } catch (error) {
      console.error('Error creating dive style:', error);
      return new Style(); // Return empty style as fallback
    }
  }, []);

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

  // Update map when trips data changes
  useEffect(() => {
    if (!mapInstance.current || !trips) {
      return;
    }

    // Validate trips data
    if (!Array.isArray(trips)) {
      console.warn('Trips is not an array:', trips);
      return;
    }

    // Remove existing vector layers
    const layers = mapInstance.current.getLayers();
    const existingVectorLayers = layers.getArray().filter(layer => layer instanceof VectorLayer);
    existingVectorLayers.forEach(layer => mapInstance.current.removeLayer(layer));

    // Filter trips based on current filters and status toggles
    const filteredTrips = trips.filter(trip => {
      // Status toggle filtering - use the same logic as getDisplayStatus
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tripDate = new Date(trip.trip_date);
      tripDate.setHours(0, 0, 0, 0);

      // If the trip date is in the past and status is 'scheduled', show 'completed'
      let actualStatus = trip.trip_status || 'scheduled';
      if (tripDate < today && actualStatus === 'scheduled') {
        actualStatus = 'completed';
      }

      if (!statusToggles[actualStatus]) {
        return false;
      }

      // Date filtering
      if (filters.start_date && new Date(trip.trip_date) < new Date(filters.start_date)) {
        return false;
      }
      if (filters.end_date && new Date(trip.trip_date) > new Date(filters.end_date)) {
        return false;
      }

      // Price filtering
      if (filters.min_price && trip.trip_price < parseFloat(filters.min_price)) {
        return false;
      }
      if (filters.max_price && trip.trip_price > parseFloat(filters.max_price)) {
        return false;
      }

      // Status filtering
      if (filters.trip_status && trip.trip_status !== filters.trip_status) {
        return false;
      }

      // Difficulty filtering
      if (filters.difficulty_level && trip.difficulty_level !== filters.difficulty_level) {
        return false;
      }

      // Diving center filtering
      if (filters.diving_center_id && trip.diving_center_id !== filters.diving_center_id) {
        return false;
      }

      // Dive site filtering
      if (filters.dive_site_id) {
        const hasDiveSite =
          trip.dives?.some(dive => dive.dive_site_id === filters.dive_site_id) ||
          trip.dive_site_id === filters.dive_site_id;
        if (!hasDiveSite) return false;
      }

      return true;
    });

    // Create individual dive features, grouped by coordinates
    const diveFeatures = [];
    let validDivesCount = 0;

    // Group dives by coordinates to handle multiple dives at same site
    const coordinateGroups = {}; // key: "lat,lon", value: array of dive data

    filteredTrips.forEach(trip => {
      try {
        // Create a feature for each dive in the trip
        if (trip.dives && trip.dives.length > 0) {
          trip.dives.forEach((dive, diveIndex) => {
            let latitude, longitude;
            let diveSiteName = null;
            let divingCenterName = null;

            // Priority 1: Look up dive site coordinates from diveSites array
            if (dive.dive_site_id && Array.isArray(diveSites) && diveSites.length > 0) {
              const diveSite = diveSites.find(ds => ds.id === dive.dive_site_id);
              if (diveSite && diveSite.latitude && diveSite.longitude) {
                latitude = parseFloat(diveSite.latitude);
                longitude = parseFloat(diveSite.longitude);
                diveSiteName = diveSite.name;
              }
            }

            // Priority 2: Look up diving center coordinates from divingCenters array
            if (
              (!latitude || !longitude) &&
              trip.diving_center_id &&
              Array.isArray(divingCenters) &&
              divingCenters.length > 0
            ) {
              const divingCenter = divingCenters.find(dc => dc.id === trip.diving_center_id);
              if (divingCenter && divingCenter.latitude && divingCenter.longitude) {
                latitude = parseFloat(divingCenter.latitude);
                longitude = parseFloat(divingCenter.longitude);
                divingCenterName = divingCenter.name;
              }
            }

            // Skip dives without coordinates
            if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
              return;
            }

            // Validate coordinates are within reasonable bounds
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
              return;
            }

            // Group dives by coordinates
            const coordKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
            if (!coordinateGroups[coordKey]) {
              coordinateGroups[coordKey] = [];
            }

            const diveData = {
              ...dive,
              trip_id: trip.id,
              trip_name: generateTripName(trip),
              trip_date: trip.trip_date,
              trip_time: trip.trip_time,
              trip_status: trip.trip_status,
              trip_price: trip.trip_price,
              trip_currency: trip.trip_currency,
              trip_duration: trip.trip_duration,
              difficulty_level: trip.difficulty_level,
              diving_center_id: trip.diving_center_id,
              diving_center_name: divingCenterName,
              dive_site_name: diveSiteName,
              coordinates: [longitude, latitude],
            };

            coordinateGroups[coordKey].push(diveData);
          });
        } else {
          // If no dives array, only create a feature if we have actual coordinates
          // Don't create features just for diving center coordinates as fallback
        }
      } catch (error) {
        console.error('Error processing trip for features:', trip.id, error);
      }
    });

    // Create features from grouped dives
    const coordKeys = Object.keys(coordinateGroups);
    for (let i = 0; i < coordKeys.length; i++) {
      const coordKey = coordKeys[i];
      const divesAtSite = coordinateGroups[coordKey];

      try {
        const [lat, lon] = coordKey.split(',').map(Number);
        const firstDive = divesAtSite[0];

        // Create a single feature for this dive site
        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          type: divesAtSite.length > 1 ? 'dive_site' : 'dive',
          data: {
            ...firstDive,
            dives_at_site: divesAtSite,
            dive_count: divesAtSite.length,
            dive_site_name: firstDive.dive_site_name,
            coordinates: [lon, lat],
          },
          coordinates: [lon, lat],
        });

        // Set a unique ID for the feature
        feature.setId(`site-${lat.toFixed(6)}-${lon.toFixed(6)}`);

        diveFeatures.push(feature);
        validDivesCount += divesAtSite.length;
      } catch (error) {
        console.error('Error creating feature for dive site:', coordKey, error);
      }
    }

    // Notify parent component of the actual number of dives displayed on map
    if (onMappedTripsCountChange) {
      onMappedTripsCountChange(diveFeatures.length);
    }

    // Create dives layer
    if (diveFeatures && diveFeatures.length > 0) {
      try {
        // Create source with or without clustering
        const diveSource = clustering
          ? new Cluster({
              distance: 50,
              source: new VectorSource({
                features: diveFeatures,
              }),
            })
          : new VectorSource({
              features: diveFeatures,
            });

        const diveLayer = new VectorLayer({
          source: diveSource,
          style: clustering
            ? createClusterStyle
            : feature => {
                try {
                  const data = feature.get('data');
                  const type = feature.get('type');

                  let style;
                  if (type === 'dive') {
                    // For dive features, we need both dive and trip data
                    const trip = filteredTrips.find(t => t.id === data.trip_id);
                    style = createDiveStyle(data, trip);
                  } else {
                    // For trip features (fallback)
                    style = createDiveStyle(data, data);
                  }

                  return style;
                } catch (error) {
                  console.error('Error applying style to feature:', error);
                  return new Style(); // Return empty style as fallback
                }
              },
        });

        if (mapInstance.current && typeof mapInstance.current.addLayer === 'function') {
          mapInstance.current.addLayer(diveLayer);
        } else {
          console.error('Map instance is not valid or addLayer method not available');
        }

        // Fit view to show all features
        const extent = diveSource.getExtent();
        if (
          extent &&
          extent[0] !== Infinity &&
          extent[1] !== Infinity &&
          extent[2] !== -Infinity &&
          extent[3] !== -Infinity
        ) {
          const view = mapInstance.current.getView();
          const maxZoom = view.getMaxZoom();
          const targetZoom = Math.max(maxZoom - 5, 2);

          mapInstance.current.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000,
            maxZoom: targetZoom,
          });
        }
      } catch (error) {
        console.error('Error creating trip layer:', error);
      }
    }
  }, [
    trips,
    filters,
    clustering,
    createClusterStyle,
    createDiveStyle,
    divingCenters,
    diveSites,
    statusToggles,
  ]);

  // Handle feature clicks
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = event => {
      const feature = mapInstance.current.forEachFeatureAtPixel(event.pixel, feature => feature);

      if (feature) {
        const data = feature.get('data');
        const type = feature.get('type');

        if (type === 'dive' || type === 'trip' || type === 'dive_site') {
          setPopupInfo({ ...data, type });
          setPopupPosition({ x: event.pixel[0], y: event.pixel[1] });

          // Don't call onTripSelect immediately - let user decide via popup button
        }

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
  }, [trips]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
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

  const totalTrips = trips?.length || 0;
  const filteredTrips =
    trips?.filter(trip => {
      // Apply same filtering logic as in the map
      if (filters.start_date && new Date(trip.trip_date) < new Date(filters.start_date))
        return false;
      if (filters.end_date && new Date(trip.trip_date) > new Date(filters.end_date)) return false;
      if (filters.min_price && trip.trip_price < parseFloat(filters.min_price)) return false;
      if (filters.max_price && trip.trip_price > parseFloat(filters.max_price)) return false;
      if (filters.trip_status && trip.trip_status !== filters.trip_status) return false;
      if (filters.difficulty_level && trip.difficulty_level !== filters.difficulty_level)
        return false;
      if (filters.diving_center_id && trip.diving_center_id !== filters.diving_center_id)
        return false;
      if (filters.dive_site_id) {
        const hasDiveSite =
          trip.dives?.some(dive => dive.dive_site_id === filters.dive_site_id) ||
          trip.dive_site_id === filters.dive_site_id;
        if (!hasDiveSite) return false;
      }
      return true;
    }).length || 0;

  return (
    <div className={`w-full rounded-lg overflow-hidden shadow-md relative`} style={{ height }}>
      <div ref={mapRef} className='w-full h-full' />

      {/* Map Info Overlay */}
      <div className='absolute bottom-2 left-2 bg-white bg-opacity-90 px-3 py-2 rounded text-xs'>
        {filteredTrips} of {totalTrips} trips shown
      </div>

      {/* Zoom Level Indicator */}
      <div className='absolute top-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        Zoom: {currentZoom.toFixed(1)} / Max: {maxZoom}
      </div>

      {/* Legend */}
      <div className='absolute bottom-2 right-2 bg-white bg-opacity-90 px-3 py-2 rounded text-xs'>
        <div className='flex items-center space-x-2 mb-1'>
          <div className='w-3 h-3 bg-blue-500 rounded-full'></div>
          <span>Scheduled</span>
        </div>
        <div className='flex items-center space-x-2 mb-1'>
          <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          <span>Confirmed</span>
        </div>
        <div className='flex items-center space-x-2 mb-1'>
          <div className='w-3 h-3 bg-red-500 rounded-full'></div>
          <span>Cancelled</span>
        </div>
        <div className='flex items-center space-x-2'>
          <div className='w-3 h-3 bg-gray-500 rounded-full'></div>
          <span>Completed</span>
        </div>
      </div>

      {/* Trip/Dive/Dive Site Popup */}
      {popupInfo &&
        popupPosition &&
        (popupInfo.type === 'trip' ||
          popupInfo.type === 'dive' ||
          popupInfo.type === 'dive_site') &&
        (() => {
          // Calculate popup dimensions and position to keep within map boundaries
          const popupWidth = 320;
          const popupHeight = 300; // Approximate height
          const mapRect = mapRef.current?.getBoundingClientRect();

          let left = popupPosition.x;
          let top = popupPosition.y - 20;
          let transform = 'translate(-50%, -100%)';

          if (mapRect) {
            // Keep popup within left/right boundaries
            if (left - popupWidth / 2 < 0) {
              left = popupWidth / 2;
              transform = 'translate(-50%, -100%)';
            } else if (left + popupWidth / 2 > mapRect.width) {
              left = mapRect.width - popupWidth / 2;
              transform = 'translate(-50%, -100%)';
            }

            // Keep popup within top/bottom boundaries
            if (top - popupHeight < 0) {
              top = popupPosition.y + 20;
              transform = 'translate(-50%, 0%)';
            }
          }

          return (
            <div
              className='map-popup absolute bg-white rounded-lg shadow-lg p-4 max-w-sm z-50'
              style={{
                left: `${left}px`,
                top: `${top}px`,
                transform,
                maxWidth: `${popupWidth}px`,
              }}
            >
              <div className='p-3'>
                {/* Header with Trip Name and Status */}
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='font-semibold text-gray-900 text-base'>
                    {popupInfo.type === 'dive_site'
                      ? `${popupInfo.dive_site_name || 'Dive Site'} (${popupInfo.dive_count} dives)`
                      : popupInfo.type === 'dive'
                        ? `${popupInfo.dive_site_name || 'Dive Site'} - ${popupInfo.trip_name || 'Trip'}`
                        : generateTripName(popupInfo)}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                      popupInfo.trip_status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : popupInfo.trip_status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : popupInfo.trip_status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {popupInfo.trip_status || 'scheduled'}
                  </span>
                </div>

                {/* Trip Details */}
                <div className='space-y-2 mb-4'>
                  {/* Date and Time */}
                  {popupInfo.trip_date && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Date:</span>
                      <span>
                        {new Date(popupInfo.trip_date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}

                  {popupInfo.trip_time && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Time:</span>
                      <span>{popupInfo.trip_time}</span>
                    </div>
                  )}

                  {/* Diving Center */}
                  {popupInfo.diving_center_name && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Center:</span>
                      <span className='text-blue-600 font-medium'>
                        {popupInfo.diving_center_name}
                      </span>
                    </div>
                  )}

                  {/* Dive Site Information */}
                  {popupInfo.type === 'dive_site' ? (
                    <div className='text-sm text-gray-700'>
                      <span className='font-medium w-16 inline-block'>Site:</span>
                      <span className='text-blue-600 font-medium'>
                        {popupInfo.dive_site_name || 'Unknown Site'}
                      </span>
                      <div className='mt-2'>
                        <span className='font-medium text-xs text-gray-600'>
                          Dive Trips to this site:
                        </span>
                        <div className='ml-2 mt-1 space-y-1'>
                          {popupInfo.dives_at_site.slice(0, 5).map((dive, index) => (
                            <div
                              key={index}
                              className='text-gray-600 text-xs flex items-center justify-between'
                            >
                              <button
                                onClick={() => {
                                  if (onTripSelect) {
                                    onTripSelect({ id: dive.trip_id });
                                  }
                                }}
                                className='text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left'
                                title='Click to view trip details'
                              >
                                •{' '}
                                {dive.diving_center_name ||
                                  (Array.isArray(divingCenters)
                                    ? divingCenters.find(dc => dc.id === dive.diving_center_id)
                                        ?.name
                                    : null) ||
                                  `Center ${dive.diving_center_id}`}
                              </button>
                              <button
                                onClick={() => {
                                  if (onTripSelect) {
                                    onTripSelect({ id: dive.trip_id });
                                  }
                                }}
                                className='text-blue-600 hover:text-blue-800 hover:underline cursor-pointer'
                                title='Click to view trip details'
                              >
                                {new Date(dive.trip_date).toLocaleDateString('en-GB', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </button>
                            </div>
                          ))}
                          {popupInfo.dives_at_site.length > 5 && (
                            <div className='text-gray-500 text-xs'>
                              +{popupInfo.dives_at_site.length - 5} more trips
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : popupInfo.type === 'dive' ? (
                    <div className='text-sm text-gray-700'>
                      <span className='font-medium w-16 inline-block'>Site:</span>
                      <span className='text-blue-600 font-medium'>
                        {popupInfo.dive_site_name || 'Unknown Site'}
                      </span>
                    </div>
                  ) : (
                    /* Trip Dive Sites */
                    popupInfo.dives &&
                    popupInfo.dives.length > 0 && (
                      <div className='text-sm text-gray-700'>
                        <span className='font-medium w-16 inline-block'>Sites:</span>
                        <div className='ml-16 mt-1'>
                          {popupInfo.dives.slice(0, 3).map((dive, index) => {
                            // Look up dive site name from diveSites array
                            let diveSiteName = dive.dive_site_name;
                            if (!diveSiteName && dive.dive_site_id && Array.isArray(diveSites)) {
                              const diveSite = diveSites.find(ds => ds.id === dive.dive_site_id);
                              diveSiteName = diveSite?.name || `Site ${dive.dive_site_id}`;
                            }

                            return (
                              <div key={index} className='text-gray-600 text-xs'>
                                • {diveSiteName || `Dive ${index + 1}`}
                              </div>
                            );
                          })}
                          {popupInfo.dives.length > 3 && (
                            <div className='text-gray-500 text-xs'>
                              +{popupInfo.dives.length - 3} more sites
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}

                  {/* Price */}
                  {popupInfo.trip_price && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Price:</span>
                      <span className='text-green-600 font-semibold'>
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: popupInfo.trip_currency || 'EUR',
                        }).format(popupInfo.trip_price)}
                      </span>
                    </div>
                  )}

                  {/* Difficulty */}
                  {popupInfo.difficulty_level && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Level:</span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getDifficultyColorClasses(popupInfo.difficulty_level)}`}
                      >
                        {getDifficultyLabel(popupInfo.difficulty_level)}
                      </span>
                    </div>
                  )}

                  {/* Duration */}
                  {popupInfo.trip_duration && (
                    <div className='flex items-center text-sm text-gray-700'>
                      <span className='font-medium w-16'>Duration:</span>
                      <span>{popupInfo.trip_duration}</span>
                    </div>
                  )}
                </div>

                {/* Trip Actions */}
                <div className='flex space-x-2 pt-2 border-t border-gray-200'>
                  <button
                    onClick={() => {
                      if (popupInfo.type === 'dive_site') {
                        // For dive site features, navigate to dive site detail page
                        // We'll need to find the dive site ID from the first dive
                        const firstDive = popupInfo.dives_at_site?.[0];
                        if (firstDive?.dive_site_id) {
                          // Navigate to dive site detail page
                          window.location.href = `/dive-sites/${firstDive.dive_site_id}`;
                        } else {
                          // Fallback: navigate to dive sites list
                          window.location.href = '/dive-sites';
                        }
                      } else {
                        // For individual dive/trip features, use the existing onTripSelect
                        if (onTripSelect) {
                          const tripId = popupInfo.trip_id || popupInfo.id;
                          onTripSelect({ id: tripId });
                        }
                      }
                    }}
                    className='flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium'
                  >
                    {popupInfo.type === 'dive_site' ? 'View Dive Site' : 'View Details'}
                  </button>
                  <button
                    onClick={() => {
                      setPopupInfo(null);
                      setPopupPosition(null);
                    }}
                    className='px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors'
                    title='Close popup'
                  >
                    ✖
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

TripMap.propTypes = {
  trips: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      trip_name: PropTypes.string,
      trip_date: PropTypes.string.isRequired,
      trip_time: PropTypes.string,
      trip_price: PropTypes.number,
      trip_currency: PropTypes.string,
      trip_status: PropTypes.string,
      difficulty_level: PropTypes.string,
      trip_description: PropTypes.string,
      diving_center_name: PropTypes.string,
      diving_center_id: PropTypes.string,
      diving_center: PropTypes.object,
      dives: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          dive_site_id: PropTypes.string,
          dive_site_name: PropTypes.string,
          dive_site: PropTypes.object,
        })
      ),
      dive_site_id: PropTypes.string,
      dive_site_name: PropTypes.string,
    })
  ),
  filters: PropTypes.object,
  onTripSelect: PropTypes.func,
  height: PropTypes.string,
  clustering: PropTypes.bool,
  divingCenters: PropTypes.array,
  diveSites: PropTypes.array,
  onMappedTripsCountChange: PropTypes.func,
  statusToggles: PropTypes.object,
};

export default TripMap;
