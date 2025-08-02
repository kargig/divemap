import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const DiveMap = () => {
  const navigate = useNavigate();
  const mapRef = useRef();
  const mapInstance = useRef();
  const [selectedDive, setSelectedDive] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [popupPosition, setPopupPosition] = useState({ top: 20, left: 16 });
  const [useClustering, setUseClustering] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    user_id: '',
    dive_site_id: '',
    difficulty_level: '',
    suit_type: '',
    min_depth: '',
    max_depth: '',
    min_visibility: '',
    max_visibility: '',
    min_rating: '',
    max_rating: '',
    start_date: '',
    end_date: ''
  });

  // Fetch dives data
  const { data: dives, isLoading } = useQuery(
    ['admin-dives', filters],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return api.get(`/api/v1/dives/admin/dives?${params.toString()}`);
    },
    {
      select: (response) => response.data,
    }
  );

  // Fetch dive sites for filter dropdown
  const { data: diveSites } = useQuery(
    ['dive-sites'],
    () => api.get('/api/v1/dive-sites/'),
    {
      select: (response) => response.data,
    }
  );

  // Fetch users for filter dropdown
  const { data: users } = useQuery(
    ['admin-users'],
    () => api.get('/api/v1/users/admin/users'),
    {
      select: (response) => response.data,
    }
  );

  // Create custom dive icon
  const createDiveIcon = (isPrivate = false) => {
    const size = 24;
    
    // Create SVG dive icon - blue circle with white anchor symbol
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Circle background -->
        <circle cx="12" cy="12" r="10" fill="${isPrivate ? '#dc2626' : '#2563eb'}" stroke="white" stroke-width="1"/>
        <!-- Anchor symbol -->
        <path d="M12 4 L12 8 M8 8 L16 8 M8 8 L10 12 M14 8 L12 12 M12 12 L12 16 M10 16 L14 16" 
              stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Optional: Add small dots for bubbles -->
        <circle cx="8" cy="6" r="1" fill="white"/>
        <circle cx="16" cy="6" r="1" fill="white"/>
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
      // Single feature - show individual dive icon
      const dive = features[0].get('dive');
      const isPrivate = dive.is_private;
      return new Style({
        image: createDiveIcon(isPrivate)
      });
    } else {
      // Multiple features - show cluster circle
      return new Style({
        image: new Circle({
          radius: Math.min(size * 3 + 10, 25),
          fill: new Fill({
            color: '#2563eb'
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

  // Calculate optimal popup position based on click coordinates
  const calculatePopupPosition = (clickX, clickY, mapWidth, mapHeight) => {
    const popupWidth = 320;
    const popupHeight = 200;
    const margin = 16;
    
    let left = clickX + margin;
    let top = clickY + margin;
    
    if (left + popupWidth > mapWidth - margin) {
      left = clickX - popupWidth - margin;
    }
    
    if (top + popupHeight > mapHeight - margin) {
      top = clickY - popupHeight - margin;
    }
    
    if (left < margin) {
      left = margin;
    }
    
    if (top < margin) {
      top = margin;
    }
    
    return { top, left };
  };

  useEffect(() => {
    if (!mapRef.current || !dives) return;

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
          center: fromLonLat([0, 0]), // Will be updated based on data
          zoom: 10
        })
      });

      mapInstance.current = map;

      // Set up zoom level tracking
      setCurrentZoom(map.getView().getZoom());
      
      // Listen for zoom changes
      map.getView().on('change:resolution', () => {
        const newZoom = map.getView().getZoom();
        setCurrentZoom(newZoom);
        const newClusteringState = newZoom <= 11;
        setUseClustering(newClusteringState);
      });

      // Create features for dives with dive site coordinates
      const features = [];
      const coordinates = [];

      dives.forEach(dive => {
        if (dive.dive_site && dive.dive_site.latitude && dive.dive_site.longitude) {
          const feature = new Feature({
            geometry: new Point(fromLonLat([dive.dive_site.longitude, dive.dive_site.latitude])),
            dive: dive
          });
          features.push(feature);
          coordinates.push([dive.dive_site.longitude, dive.dive_site.latitude]);
        }
      });

      // Update map center if we have coordinates
      if (coordinates.length > 0) {
        const centerLon = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
        const centerLat = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
        map.getView().setCenter(fromLonLat([centerLon, centerLat]));
      }

      // Create source with clustering
      const currentZoom = map.getView().getZoom();
      const shouldUseClustering = currentZoom <= 11;
      const clusterDistance = shouldUseClustering ? 50 : 0;
      setUseClustering(shouldUseClustering);

      const source = new ClusterSource({
        distance: clusterDistance,
        source: new VectorSource({
          features: features
        })
      });

      const vectorLayer = new VectorLayer({
        source: source,
        style: createClusterStyle
      });

      map.addLayer(vectorLayer);

      // Add click handler
      map.on('click', (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => {
          return feature;
        });

        if (feature) {
          const features = feature.get('features');
          
          if (features && features.length === 1) {
            // Single dive
            const dive = features[0].get('dive');
            setSelectedDive(dive);
          } else if (features && features.length > 1) {
            // Cluster - zoom in to show individual dives
            try {
              const extent = source.getClusterExtent(feature);
              if (extent && extent.getWidth && extent.getWidth() > 0 && extent.getHeight && extent.getHeight() > 0) {
                map.getView().fit(extent, {
                  duration: 500,
                  padding: [50, 50, 50, 50]
                });
              } else {
                const view = map.getView();
                const currentZoom = view.getZoom();
                view.animate({
                  zoom: currentZoom + 1,
                  duration: 500
                });
              }
            } catch (error) {
              console.warn('Error fitting cluster extent:', error);
              const view = map.getView();
              const currentZoom = view.getZoom();
              view.animate({
                zoom: currentZoom + 1,
                duration: 500
              });
            }
            return;
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
          setSelectedDive(null);
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
  }, [dives]);

  // Update clustering distance when zoom changes
  useEffect(() => {
    if (!mapInstance.current || !dives) return;

    const layers = mapInstance.current.getLayers();
    const existingVectorLayer = layers.getArray().find(layer => layer instanceof VectorLayer);
    if (!existingVectorLayer) return;

    const currentSource = existingVectorLayer.getSource();
    if (!(currentSource instanceof ClusterSource)) return;

    const currentZoom = mapInstance.current.getView().getZoom();
    const shouldUseClustering = currentZoom <= 11;
    const newDistance = shouldUseClustering ? 50 : 0;
    
    if (currentSource.getDistance() !== newDistance) {
      currentSource.setDistance(newDistance);
      setUseClustering(shouldUseClustering);
      currentSource.refresh();
    }
  }, [currentZoom, dives]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      dive_site_id: '',
      difficulty_level: '',
      suit_type: '',
      min_depth: '',
      max_depth: '',
      min_visibility: '',
      max_visibility: '',
      min_rating: '',
      max_rating: '',
      start_date: '',
      end_date: ''
    });
  };

  if (isLoading || !dives) {
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
            onClick={() => navigate('/admin/dives')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Dive Map View</h1>
            <p className="text-sm text-gray-600">
              {dives.length} dives displayed
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-md transition-colors ${
              showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">Zoom: {currentZoom.toFixed(1)}</span>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                {users?.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dive Site</label>
              <select
                value={filters.dive_site_id}
                onChange={(e) => handleFilterChange('dive_site_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Dive Sites</option>
                {diveSites?.map(site => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={filters.difficulty_level}
                onChange={(e) => handleFilterChange('difficulty_level', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Difficulties</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suit Type</label>
              <select
                value={filters.suit_type}
                onChange={(e) => handleFilterChange('suit_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suit Types</option>
                <option value="wet_suit">Wet Suit</option>
                <option value="dry_suit">Dry Suit</option>
                <option value="shortie">Shortie</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="h-full">
        <div
          ref={mapRef}
          className="w-full h-full"
        />
      </div>

      {/* Popup for selected dive */}
      {selectedDive && (
        <div 
          className="absolute bg-white rounded-lg shadow-lg p-4 max-w-sm z-10 border border-gray-200"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
            maxWidth: '320px'
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">{selectedDive.name}</h3>
            <button
              onClick={() => setSelectedDive(null)}
              className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              <span className="font-medium">User:</span> {selectedDive.user_username}
            </p>
            {selectedDive.dive_site && (
              <p className="text-gray-600">
                <span className="font-medium">Dive Site:</span> {selectedDive.dive_site.name}
              </p>
            )}
            <p className="text-gray-600">
              <span className="font-medium">Date:</span> {selectedDive.dive_date}
            </p>
            {selectedDive.max_depth && (
              <p className="text-gray-600">
                <span className="font-medium">Max Depth:</span> {selectedDive.max_depth}m
              </p>
            )}
            {selectedDive.user_rating && (
              <p className="text-gray-600">
                <span className="font-medium">Rating:</span> {selectedDive.user_rating}/10
              </p>
            )}
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              selectedDive.is_private 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              {selectedDive.is_private ? 'Private' : 'Public'}
            </span>
          </div>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => navigate(`/dives/${selectedDive.id}`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              View Details
            </button>
            <button
              onClick={() => navigate(`/dives/${selectedDive.id}/edit`)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default DiveMap; 