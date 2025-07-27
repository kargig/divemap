import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ClusterSource from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Icon, Text, Fill, Stroke, Circle } from 'ol/style';
import api from '../api';

const DiveSiteMap = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef();
  const mapInstance = useRef();
  const [selectedSite, setSelectedSite] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [popupPosition, setPopupPosition] = useState({ top: 20, left: 16 });
  const [useClustering, setUseClustering] = useState(false);

  // Fetch current dive site
  const { data: diveSite, isLoading: isLoadingDiveSite } = useQuery(
    ['dive-site', id],
    () => api.get(`/api/v1/dive-sites/${id}`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Fetch nearby dive sites
  const { data: nearbyDiveSites, isLoading: isLoadingNearby } = useQuery(
    ['dive-site-nearby', id],
    () => api.get(`/api/v1/dive-sites/${id}/nearby`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Create custom dive site icon
  const createDiveSiteIcon = (isMain = false) => {
    const size = isMain ? 32 : 24;
    
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
    
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    
    return new Icon({
      src: dataUrl,
      scale: 1,
      anchor: [0.5, 0.5],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction'
    });
  };

  // Create cluster style function
  const createClusterStyle = (feature) => {
    const features = feature.get('features');
    const size = features.length;
    
    if (size === 1) {
      // Single feature - show individual dive site icon
      const site = features[0].get('site');
      const isMain = features[0].get('isMain');
      return new Style({
        image: createDiveSiteIcon(isMain)
      });
    } else {
      // Multiple features - show cluster circle
      return new Style({
        image: new Circle({
          radius: Math.min(size * 3 + 10, 25),
          fill: new Fill({
            color: '#dc2626'
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2
          })
        }),
        text: new Text({
          text: size.toString(),
          fill: new Fill({
            color: 'white'
          }),
          font: 'bold 14px Arial'
        })
      });
    }
  };

  // Create non-clustered style function
  const createNonClusteredStyle = (feature) => {
    const isMain = feature.get('isMain');
    return new Style({
      image: createDiveSiteIcon(isMain)
    });
  };

  // Calculate optimal popup position based on click coordinates
  const calculatePopupPosition = (clickX, clickY, mapWidth, mapHeight) => {
    const popupWidth = 320; // Approximate popup width
    const popupHeight = 200; // Approximate popup height
    const margin = 16;
    
    // Start with default position (below and to the right of click)
    let left = clickX + margin;
    let top = clickY + margin;
    
    // Check if popup would go off the right edge
    if (left + popupWidth > mapWidth - margin) {
      left = clickX - popupWidth - margin;
    }
    
    // Check if popup would go off the bottom edge
    if (top + popupHeight > mapHeight - margin) {
      top = clickY - popupHeight - margin;
    }
    
    // If popup would go off the left edge, try positioning to the right
    if (left < margin) {
      left = margin;
    }
    
    // If popup would go off the top edge, try positioning below
    if (top < margin) {
      top = margin;
    }
    
    // Additional check: if the popup is still too close to edges, adjust further
    // This handles cases where the click is very close to borders
    if (clickY < popupHeight + margin * 2) {
      // Click is very close to top, position popup below
      top = clickY + margin;
    }
    
    if (clickX < popupWidth / 2) {
      // Click is very close to left edge, center the popup
      left = margin;
    }
    
    if (clickX > mapWidth - popupWidth / 2) {
      // Click is very close to right edge, position popup to the left
      left = mapWidth - popupWidth - margin;
    }
    
    return { top, left };
  };

  useEffect(() => {
    if (!mapRef.current || !diveSite) return;

    try {
      // Create map
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          })
        ],
        view: new View({
          center: fromLonLat([diveSite.longitude, diveSite.latitude]),
          zoom: 13
        })
      });

      mapInstance.current = map;

      // Set up zoom level tracking
      setCurrentZoom(map.getView().getZoom());
      
      // Listen for zoom changes
      map.getView().on('change:resolution', () => {
        const newZoom = map.getView().getZoom();
        console.log(`Zoom changed to: ${newZoom}`);
        setCurrentZoom(newZoom);
        const newClusteringState = newZoom <= 11;
        console.log(`Setting clustering to: ${newClusteringState}`);
        setUseClustering(newClusteringState);
      });

      // Create features for all sites
      const features = [];

      // Main dive site (larger, different color)
      const mainFeature = new Feature({
        geometry: new Point(fromLonLat([diveSite.longitude, diveSite.latitude])),
        site: diveSite,
        isMain: true
      });
      features.push(mainFeature);

      // Nearby dive sites
      if (nearbyDiveSites) {
        nearbyDiveSites.forEach(site => {
          const feature = new Feature({
            geometry: new Point(fromLonLat([site.longitude, site.latitude])),
            site: site,
            isMain: false
          });
          features.push(feature);
        });
      }

      // Create source based on zoom level
      const currentZoom = map.getView().getZoom();
      const shouldUseClustering = currentZoom <= 11;
      const clusterDistance = shouldUseClustering ? 50 : 0; // 0 = no clustering
      console.log(`Initial zoom: ${currentZoom}, shouldUseClustering: ${shouldUseClustering}, distance: ${clusterDistance}`);
      setUseClustering(shouldUseClustering);

      // Always use ClusterSource with dynamic distance
      const source = new ClusterSource({
        distance: clusterDistance,
        source: new VectorSource({
          features: features
        })
      });

      const vectorLayer = new VectorLayer({
        source: source,
        style: createClusterStyle // Always use cluster style, it handles single features
      });

      map.addLayer(vectorLayer);

      // Add click handler
      map.on('click', (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => {
          return feature;
        });

        if (feature) {
          console.log('Feature clicked:', feature);
          console.log('Current useClustering:', useClustering);
          
          // Always handle as cluster feature since we always use ClusterSource
          const features = feature.get('features');
          console.log('Features in cluster:', features?.length);
          
          if (features && features.length === 1) {
            // Single dive site
            const site = features[0].get('site');
            console.log('Single site clicked:', site?.name);
            setSelectedSite(site);
          } else if (features && features.length > 1) {
            // Cluster - zoom in to show individual sites
            console.log('Cluster clicked, zooming in');
            try {
              const extent = source.getClusterExtent(feature);
              // Check if extent is valid (not empty)
              if (extent && extent.getWidth && extent.getWidth() > 0 && extent.getHeight && extent.getHeight() > 0) {
                map.getView().fit(extent, {
                  duration: 500,
                  padding: [50, 50, 50, 50]
                });
              } else {
                // Fallback: zoom in by one level
                const view = map.getView();
                const currentZoom = view.getZoom();
                view.animate({
                  zoom: currentZoom + 1,
                  duration: 500
                });
              }
            } catch (error) {
              console.warn('Error fitting cluster extent:', error);
              // Fallback: zoom in by one level
              const view = map.getView();
              const currentZoom = view.getZoom();
              view.animate({
                zoom: currentZoom + 1,
                duration: 500
              });
            }
            return; // Don't show popup for clusters
          }
          
          // Calculate optimal popup position
          const mapElement = mapRef.current;
          const mapRect = mapElement.getBoundingClientRect();
          const clickX = event.pixel[0];
          const clickY = event.pixel[1];
          
          const position = calculatePopupPosition(
            clickX, 
            clickY, 
            mapRect.width, 
            mapRect.height
          );
          
          setPopupPosition(position);
        } else {
          setSelectedSite(null);
        }
      });

    } catch (error) {
      console.error('Error creating map:', error);
    }

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
      }
    };
  }, [diveSite, nearbyDiveSites]);

  // Update clustering distance when zoom changes
  useEffect(() => {
    if (!mapInstance.current || !diveSite) return;

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
    
    console.log(`Updating cluster distance: ${currentSource.getDistance()} -> ${newDistance} (zoom: ${currentZoom})`);
    
    if (currentSource.getDistance() !== newDistance) {
      // Update the cluster distance
      currentSource.setDistance(newDistance);
      setUseClustering(shouldUseClustering);
      
      // Force a refresh of the source
      currentSource.refresh();
    }
  }, [currentZoom, diveSite, nearbyDiveSites]);

  if (isLoadingDiveSite || isLoadingNearby || !diveSite) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/dive-sites/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{diveSite?.name || 'Loading...'} - Full Map View</h1>
            <p className="text-sm text-gray-600">
              {diveSite?.latitude?.toFixed(4) || 'Loading...'}, {diveSite?.longitude?.toFixed(4) || 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Zoom: {currentZoom.toFixed(1)}</span>
        </div>
      </div>

      {/* Map */}
      <div className="h-full">
        <div
          ref={mapRef}
          className="w-full h-full"
        />
      </div>

      {/* Popup for selected site */}
      {selectedSite && (
        <div 
          className="absolute bg-white rounded-lg shadow-lg p-4 max-w-sm z-10 border border-gray-200"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            maxWidth: '320px'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">{selectedSite.name}</h3>
            <button
              onClick={() => setSelectedSite(null)}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {selectedSite?.latitude?.toFixed(4) || 'N/A'}, {selectedSite?.longitude?.toFixed(4) || 'N/A'}
          </p>
          {selectedSite?.distance_km && (
            <p className="text-sm text-gray-600 mb-3">
              Distance: {selectedSite.distance_km.toFixed(1)} km
            </p>
          )}
          <div className="flex space-x-2">
            <button
              onClick={() => navigate(`/dive-sites/${selectedSite.id}`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={() => navigate(`/dive-sites/${selectedSite.id}/map`)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 transition-colors"
            >
              Full Map
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default DiveSiteMap; 