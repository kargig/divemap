import { Calendar, Clock, Thermometer, Star } from 'lucide-react';
import { Feature } from 'ol';
import { Point } from 'ol/geom';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import ClusterSource from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Style, Icon, Text, Fill, Stroke, Circle } from 'ol/style';
import View from 'ol/View';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { getDifficultyLabel, getDifficultyColorClasses } from '../utils/difficultyHelpers';

const DivesMap = ({ dives = [], viewport, onViewportChange }) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const hasFittedRef = useRef(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(2);
  const [maxZoom, setMaxZoom] = useState(19);
  const [useClustering, setUseClustering] = useState(true);

  // Create custom dive site icon (same as DiveSitesMap)
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

  // Create cluster style function
  const createClusterStyle = feature => {
    const features = feature.get('features');
    const size = features.length;

    if (size === 1) {
      // Single feature - show individual dive site icon
      return new Style({
        image: createDiveSiteIcon(),
      });
    } else {
      // Multiple features - show cluster circle
      return new Style({
        image: new Circle({
          radius: Math.min(size * 3 + 10, 25),
          fill: new Fill({
            color: '#dc2626',
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
          font: 'bold 14px Arial',
        }),
      });
    }
  };

  // Calculate optimal popup position based on click coordinates
  const calculatePopupPosition = (clickX, clickY, mapWidth, mapHeight) => {
    const popupWidth = 280; // Approximate popup width
    const popupHeight = 180; // Approximate popup height
    const margin = 16;

    // Start with default position (above and centered on click)
    let left = clickX;
    let top = clickY - popupHeight - margin;

    // Check if popup would go off the left edge
    if (left < margin) {
      left = margin;
    }

    // Check if popup would go off the right edge
    if (left + popupWidth > mapWidth - margin) {
      left = mapWidth - popupWidth - margin;
    }

    // Check if popup would go off the top edge
    if (top < margin) {
      // Position popup below the click point instead
      top = clickY + margin;
    }

    // Check if popup would go off the bottom edge
    if (top + popupHeight > mapHeight - margin) {
      // Position popup above the click point
      top = clickY - popupHeight - margin;
    }

    // Additional edge case handling
    if (clickY < popupHeight + margin * 2) {
      // Click is very close to top, position popup below
      top = clickY + margin;
    }

    if (clickX < popupWidth / 2) {
      // Click is very close to left edge, position popup from left margin
      left = margin;
    }

    if (clickX > mapWidth - popupWidth / 2) {
      // Click is very close to right edge, position popup from right margin
      left = mapWidth - popupWidth - margin;
    }

    return { x: left, y: top };
  };

  // Function to fit map to show all dives
  const fitMapToDives = (features, source, divesData) => {
    if (!mapInstance.current || !features || features.length === 0) {
      return;
    }

    // Check if we have valid dives data
    if (!divesData || divesData.length === 0) {
      return;
    }

    // Reset the fitted flag when we have new features
    hasFittedRef.current = false;

    try {
      // Add a small delay to ensure source is properly initialized
      setTimeout(() => {
        try {
          const extent = source.getExtent();

          // Check if extent is valid (not empty) and has minimum size
          const minExtentSize = 100; // minimum pixels for extent to be considered valid
          let extentWidth = 0;
          let extentHeight = 0;

          try {
            if (extent && extent.getWidth && extent.getHeight) {
              extentWidth = extent.getWidth();
              extentHeight = extent.getHeight();
            } else if (extent && Array.isArray(extent)) {
              // Handle array format [minX, minY, maxX, maxY]
              extentWidth = extent[2] - extent[0];
              extentHeight = extent[3] - extent[1];
            }
          } catch (error) {
            // Error calculating extent dimensions
          }

          if (extent && extentWidth > minExtentSize && extentHeight > minExtentSize) {
            const view = mapInstance.current.getView();
            const maxZoom = view.getMaxZoom();

            // Calculate optimal zoom level based on number of features
            let targetZoom;
            if (features.length === 1) {
              // Single dive - zoom in closer
              targetZoom = Math.min(maxZoom - 2, 15);
            } else if (features.length <= 5) {
              // Few dives - zoom in moderately
              targetZoom = Math.min(maxZoom - 3, 12);
            } else if (features.length <= 20) {
              // Moderate number of dives
              targetZoom = Math.min(maxZoom - 4, 10);
            } else {
              // Many dives - show broader view
              targetZoom = Math.min(maxZoom - 5, 8);
            }

            // Ensure minimum zoom level
            targetZoom = Math.max(targetZoom, 2);

            // Only fit if we haven't already fitted for these features
            if (!hasFittedRef.current) {
              mapInstance.current.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 1000,
                maxZoom: targetZoom,
              });
              hasFittedRef.current = true;
            }
          } else {
            // Fallback: calculate center and zoom manually

            // Calculate center from original dives data (not transformed coordinates)
            let minLon = Infinity,
              maxLon = -Infinity,
              minLat = Infinity,
              maxLat = -Infinity;

            // Use the original dives data instead of transformed coordinates
            divesData.forEach(dive => {
              if (dive.dive_site && dive.dive_site.longitude && dive.dive_site.latitude) {
                const lon = parseFloat(dive.dive_site.longitude);
                const lat = parseFloat(dive.dive_site.latitude);

                if (!isNaN(lon) && !isNaN(lat)) {
                  minLon = Math.min(minLon, lon);
                  maxLon = Math.max(maxLon, lon);
                  minLat = Math.min(minLat, lat);
                  maxLat = Math.max(maxLat, lat);
                }
              }
            });

            // Check if we have valid coordinates
            if (
              minLon === Infinity ||
              maxLon === -Infinity ||
              minLat === Infinity ||
              maxLat === -Infinity
            ) {
              return;
            }

            const centerLon = (minLon + maxLon) / 2;
            const centerLat = (minLat + maxLat) / 2;

            // Calculate zoom based on the spread of coordinates
            const lonSpread = maxLon - minLon;
            const latSpread = maxLat - minLat;
            const maxSpread = Math.max(lonSpread, latSpread);

            let targetZoom;
            if (maxSpread < 0.001) {
              // Very close dives - zoom in more
              targetZoom = 15;
            } else if (maxSpread < 0.01) {
              // Close dives - moderate zoom
              targetZoom = 12;
            } else if (maxSpread < 0.1) {
              // Medium spread - standard zoom
              targetZoom = 10;
            } else {
              // Far spread - broader view
              targetZoom = 8;
            }

            const view = mapInstance.current.getView();
            view.setCenter(fromLonLat([centerLon, centerLat]));
            view.setZoom(targetZoom);
            hasFittedRef.current = true;
          }
        } catch (error) {
          // Error fitting extent
          // Fallback: calculate center and zoom manually

          try {
            // Calculate center from original dives data (not transformed coordinates)
            let minLon = Infinity,
              maxLon = -Infinity,
              minLat = Infinity,
              maxLat = -Infinity;

            // Use the original dives data instead of transformed coordinates
            divesData.forEach(dive => {
              if (dive.dive_site && dive.dive_site.longitude && dive.dive_site.latitude) {
                const lon = parseFloat(dive.dive_site.longitude);
                const lat = parseFloat(dive.dive_site.latitude);

                if (!isNaN(lon) && !isNaN(lat)) {
                  minLon = Math.min(minLon, lon);
                  maxLon = Math.max(maxLon, lon);
                  minLat = Math.min(minLat, lat);
                  maxLat = Math.max(maxLat, lat);
                }
              }
            });

            // Check if we have valid coordinates
            if (
              minLon === Infinity ||
              maxLon === -Infinity ||
              minLat === Infinity ||
              maxLat === -Infinity
            ) {
              return;
            }

            const centerLon = (minLon + maxLon) / 2;
            const centerLat = (minLat + maxLat) / 2;

            // Calculate zoom based on the spread of coordinates
            const lonSpread = maxLon - minLon;
            const latSpread = maxLat - minLat;
            const maxSpread = Math.max(lonSpread, latSpread);

            let targetZoom;
            if (maxSpread < 0.001) {
              // Very close dives - zoom in more
              targetZoom = 15;
            } else if (maxSpread < 0.01) {
              // Close dives - moderate zoom
              targetZoom = 12;
            } else if (maxSpread < 0.1) {
              // Medium spread - standard zoom
              targetZoom = 10;
            } else {
              // Far spread - broader view
              targetZoom = 8;
            }

            const view = mapInstance.current.getView();
            view.setCenter(fromLonLat([centerLon, centerLat]));
            view.setZoom(targetZoom);
            hasFittedRef.current = true;
          } catch (fallbackError) {
            // Error in fallback calculation
            // Final fallback: use a default view
            const view = mapInstance.current.getView();
            view.setCenter(fromLonLat([0, 0]));
            view.setZoom(2);
          }
        }
      }, 100); // Small delay to ensure source is ready
    } catch (error) {
      // Error in fitMapToDives
    }
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
          center: viewport
            ? fromLonLat([viewport.longitude, viewport.latitude])
            : fromLonLat([0, 0]),
          zoom: viewport ? viewport.zoom : 2,
        }),
      });

      mapInstance.current = map;

      // Set up zoom level tracking
      map.getView().setMaxZoom(18);
      setMaxZoom(18);
      setCurrentZoom(map.getView().getZoom());

      // Listen for zoom changes
      map.getView().on('change:resolution', () => {
        const newZoom = map.getView().getZoom();

        setCurrentZoom(newZoom);
        const newClusteringState = newZoom <= 11;

        setUseClustering(newClusteringState);
      });

      // Listen for viewport changes and notify parent
      map.getView().on('change:center', () => {
        if (onViewportChange) {
          const center = map.getView().getCenter();
          const zoom = map.getView().getZoom();
          onViewportChange({
            longitude: center[0],
            latitude: center[1],
            zoom: zoom,
          });
        }
      });

      map.getView().on('change:resolution', () => {
        if (onViewportChange) {
          const center = map.getView().getCenter();
          const zoom = map.getView().getZoom();
          onViewportChange({
            longitude: center[0],
            latitude: center[1],
            zoom: zoom,
          });
        }
      });
    } catch (error) {
      // Error creating map
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
    if (!mapInstance.current || !dives) {
      return;
    }

    // Remove existing vector layer
    const layers = mapInstance.current.getLayers();
    const existingVectorLayer = layers.getArray().find(layer => layer instanceof VectorLayer);
    if (existingVectorLayer) {
      mapInstance.current.removeLayer(existingVectorLayer);
    }

    // Create dive features
    const diveFeatures = dives
      .map(dive => {
        // Use dive site coordinates if available, otherwise skip
        if (!dive.dive_site?.longitude || !dive.dive_site?.latitude) {
          // Dive has no coordinates, skipping
          return null;
        }

        const lon = parseFloat(dive.dive_site.longitude);
        const lat = parseFloat(dive.dive_site.latitude);

        if (isNaN(lon) || isNaN(lat)) {
          // Invalid coordinates for dive, skipping
          return null;
        }

        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
          type: 'dive',
          data: dive,
        });
        return feature;
      })
      .filter(feature => feature !== null);

    if (diveFeatures.length === 0) {
      return;
    }

    // Always use ClusterSource but adjust distance based on zoom
    const currentZoom = mapInstance.current.getView().getZoom();
    const shouldUseClustering = currentZoom <= 11;
    const clusterDistance = shouldUseClustering ? 50 : 0; // 0 = no clustering
    setUseClustering(shouldUseClustering);

    // Always use ClusterSource with dynamic distance
    const source = new ClusterSource({
      distance: clusterDistance,
      source: new VectorSource({
        features: diveFeatures,
      }),
    });

    const newVectorLayer = new VectorLayer({
      source: source,
      style: createClusterStyle, // Always use cluster style, it handles single features
    });

    mapInstance.current.addLayer(newVectorLayer);

    // Fit view to show all features
    fitMapToDives(diveFeatures, source, dives);
  }, [dives]);

  // Update clustering distance when zoom changes
  useEffect(() => {
    if (!mapInstance.current || !dives) return;

    // Get current vector layer
    const layers = mapInstance.current.getLayers();
    const existingVectorLayer = layers.getArray().find(layer => layer instanceof VectorLayer);
    if (!existingVectorLayer) return;

    const currentSource = existingVectorLayer.getSource();
    if (!(currentSource instanceof ClusterSource)) return;

    // Get current zoom and determine new distance
    const currentZoom = mapInstance.current.getView().getZoom();
    const shouldUseClustering = currentZoom <= 11;
    const newDistance = shouldUseClustering ? 50 : 0;

    if (currentSource.getDistance() !== newDistance) {
      // Update the cluster distance
      currentSource.setDistance(newDistance);
      setUseClustering(shouldUseClustering);

      // Force a refresh of the source
      currentSource.refresh();
    }
  }, [currentZoom, dives]);

  // Handle feature clicks
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = event => {
      const feature = mapInstance.current.forEachFeatureAtPixel(event.pixel, feature => feature);

      if (feature) {
        // Always handle as cluster feature since we always use ClusterSource
        const features = feature.get('features');

        if (features && features.length === 1) {
          // Single dive
          const dive = features[0].get('data');

          setPopupInfo(dive);

          // Calculate optimal popup position
          const mapElement = mapRef.current;
          const mapRect = mapElement.getBoundingClientRect();
          const clickX = event.pixel[0];
          const clickY = event.pixel[1];

          const position = calculatePopupPosition(clickX, clickY, mapRect.width, mapRect.height);

          setPopupPosition(position);
        } else if (features && features.length > 1) {
          // Cluster - zoom in to show individual dives

          const clusterSource = mapInstance.current
            .getLayers()
            .getArray()
            .find(layer => layer instanceof VectorLayer)
            ?.getSource();

          if (clusterSource && clusterSource.getClusterExtent) {
            try {
              const extent = clusterSource.getClusterExtent(feature);
              // Check if extent is valid (not empty)
              if (
                extent &&
                extent.getWidth &&
                extent.getWidth() > 0 &&
                extent.getHeight &&
                extent.getHeight() > 0
              ) {
                mapInstance.current.getView().fit(extent, {
                  duration: 500,
                  padding: [50, 50, 50, 50],
                });
              } else {
                // Fallback: zoom in by one level
                const view = mapInstance.current.getView();
                const currentZoom = view.getZoom();
                view.animate({
                  zoom: currentZoom + 1,
                  duration: 500,
                });
              }
            } catch (error) {
              // Error fitting cluster extent
              // Fallback: zoom in by one level
              const view = mapInstance.current.getView();
              const currentZoom = view.getZoom();
              view.animate({
                zoom: currentZoom + 1,
                duration: 500,
              });
            }
          }
          return; // Don't show popup for clusters
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
  }, [dives, useClustering]);

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

  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // getDifficultyColor function is now replaced by getDifficultyColorClasses from difficultyHelpers

  return (
    <div className='h-[36rem] w-full rounded-lg overflow-hidden shadow-md relative'>
      <div ref={mapRef} className='w-full h-full' />
      <div className='absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        {dives?.length || 0} dives loaded
      </div>

      {/* Zoom Level Debug Indicator */}
      <div className='absolute top-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs'>
        Zoom: {currentZoom.toFixed(1)} / Max: {maxZoom}{' '}
        {useClustering ? '(Clustered)' : '(Individual)'}
      </div>

      {popupInfo && popupPosition && (
        <div
          className='map-popup absolute bg-white rounded-lg shadow-lg p-4 max-w-xs z-50 border border-gray-200'
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
          }}
        >
          <div className='p-2'>
            <div className='flex items-center justify-between mb-2'>
              <h3 className='font-semibold text-gray-900'>
                {popupInfo.name || popupInfo.dive_site?.name || 'Unnamed Dive'}
              </h3>
              <span className='px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800'>
                Dive
              </span>
            </div>

            <div className='space-y-2 mb-3'>
              <div className='flex items-center text-sm text-gray-600'>
                <Calendar className='h-4 w-4 mr-1' />
                <span>{formatDate(popupInfo.dive_date)}</span>
                {popupInfo.dive_time && (
                  <>
                    <Clock className='h-4 w-4 mr-1 ml-2' />
                    <span>{formatTime(popupInfo.dive_time)}</span>
                  </>
                )}
              </div>

              {popupInfo.difficulty_level && (
                <div className='flex items-center'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColorClasses(popupInfo.difficulty_level)}`}
                  >
                    {getDifficultyLabel(popupInfo.difficulty_level)}
                  </span>
                </div>
              )}

              <div className='flex items-center gap-4 text-sm text-gray-600'>
                {popupInfo.max_depth && (
                  <div className='flex items-center gap-1'>
                    <Thermometer size={14} />
                    <span>{popupInfo.max_depth}m max</span>
                  </div>
                )}
                {popupInfo.duration && (
                  <div className='flex items-center gap-1'>
                    <Clock size={14} />
                    <span>{popupInfo.duration}min</span>
                  </div>
                )}
                {popupInfo.user_rating && (
                  <div className='flex items-center gap-1'>
                    <Star size={14} className='text-yellow-500' />
                    <span>{popupInfo.user_rating}/10</span>
                  </div>
                )}
              </div>

              {popupInfo.dive_information && (
                <p className='text-sm text-gray-700 line-clamp-2'>{popupInfo.dive_information}</p>
              )}

              {popupInfo.tags && popupInfo.tags.length > 0 && (
                <div className='flex flex-wrap gap-1'>
                  {popupInfo.tags.map(tag => (
                    <span
                      key={tag.id}
                      className='px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full'
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Link
              to={`/dives/${popupInfo.id}`}
              className='block w-full text-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors'
            >
              View Details
            </Link>
            <button
              onClick={() => {
                setPopupInfo(null);
                setPopupPosition(null);
              }}
              className='absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl font-bold'
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DivesMap.propTypes = {
  dives: PropTypes.arrayOf(PropTypes.object),
  viewport: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
  }),
  onViewportChange: PropTypes.func,
};

export default DivesMap;
