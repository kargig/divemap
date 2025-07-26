import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Circle as CircleStyle, Fill, Stroke, Icon } from 'ol/style';
import { Link } from 'react-router-dom';

const DiveMap = ({ diveSites = [], divingCenters = [], viewport, onViewportChange }) => {
  const mapRef = useRef();
  const mapInstance = useRef();
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupPosition, setPopupPosition] = useState(null);

  useEffect(() => {
    if (!mapRef.current) return;

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
          center: fromLonLat([0, 0]),
          zoom: 2
        })
      });

      mapInstance.current = map;

    } catch (error) {
      console.error('Error creating map:', error);
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
    const diveSiteFeatures = diveSites.map(site => {
      const lon = parseFloat(site.longitude);
      const lat = parseFloat(site.latitude);
      
      if (isNaN(lon) || isNaN(lat)) {
        console.error('Invalid coordinates for dive site:', site.name, site.longitude, site.latitude);
        return null;
      }
      
      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        type: 'dive_site',
        data: site
      });
      return feature;
    }).filter(feature => feature !== null);

    // Create diving center features
    const divingCenterFeatures = divingCenters.map(center => {
      const lon = parseFloat(center.longitude);
      const lat = parseFloat(center.latitude);
      
      if (isNaN(lon) || isNaN(lat)) {
        console.error('Invalid coordinates for diving center:', center.name, center.longitude, center.latitude);
        return null;
      }
      
      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        type: 'diving_center',
        data: center
      });
      return feature;
    }).filter(feature => feature !== null);

    // Create dive sites layer
    if (diveSiteFeatures.length > 0) {
      const diveSiteSource = new VectorSource({
        features: diveSiteFeatures
      });

      const diveSiteLayer = new VectorLayer({
        source: diveSiteSource,
        style: new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({
              color: 'blue'
            }),
            stroke: new Stroke({
              color: 'white',
              width: 2
            })
          })
        })
      });

      mapInstance.current.addLayer(diveSiteLayer);
    }

    // Create diving centers layer
    if (divingCenterFeatures.length > 0) {
      const divingCenterSource = new VectorSource({
        features: divingCenterFeatures
      });

      const divingCenterLayer = new VectorLayer({
        source: divingCenterSource,
        style: new Style({
          image: new CircleStyle({
            radius: 10,
            fill: new Fill({
              color: 'red'
            }),
            stroke: new Stroke({
              color: 'white',
              width: 2
            })
          })
        })
      });

      mapInstance.current.addLayer(divingCenterLayer);
    }

    // Fit view to show all features
    const allFeatures = [...diveSiteFeatures, ...divingCenterFeatures];
    if (allFeatures.length > 0) {
      const extent = new VectorSource({ features: allFeatures }).getExtent();
      mapInstance.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    }
  }, [diveSites, divingCenters]);

  // Handle feature clicks
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = (event) => {
      
      const feature = mapInstance.current.forEachFeatureAtPixel(event.pixel, (feature) => feature);
      
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
    const handleClickOutside = (event) => {
      // Use a small timeout to avoid immediate clearing when popup is being set
      setTimeout(() => {
        if (popupInfo && !event.target.closest('.map-popup') && 
            !event.target.closest('.ol-viewport') && 
            !event.target.closest('.ol-map')) {
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
    <div className="h-[36rem] w-full rounded-lg overflow-hidden shadow-md relative">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs">
        {totalItems} items loaded ({diveSites?.length || 0} dive sites, {divingCenters?.length || 0} diving centers)
      </div>
      
      {/* Legend */}
      <div className="absolute top-2 right-2 bg-white bg-opacity-90 px-3 py-2 rounded text-xs">
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Dive Sites</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Diving Centers</span>
        </div>
      </div>
      
      {popupInfo && popupPosition && (
        <div 
          className="map-popup absolute bg-white rounded-lg shadow-lg p-4 max-w-xs z-50"
          style={{ 
            left: (popupPosition.x + 10) + 'px', 
            top: (popupPosition.y - 10) + 'px',
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{popupInfo.name}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                popupInfo.type === 'dive_site' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}>
                {popupInfo.type === 'dive_site' ? 'Dive Site' : 'Diving Center'}
              </span>
            </div>
            
            {popupInfo.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {popupInfo.description}
              </p>
            )}
            
            {popupInfo.type === 'dive_site' && (
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  popupInfo.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                  popupInfo.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                  popupInfo.difficulty_level === 'advanced' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {popupInfo.difficulty_level}
                </span>
                {popupInfo.average_rating && (
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700">
                      {popupInfo.average_rating.toFixed(1)} ⭐
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {popupInfo.type === 'diving_center' && popupInfo.average_rating && (
              <div className="flex items-center justify-end mb-2">
                <span className="text-sm text-gray-700">
                  {popupInfo.average_rating.toFixed(1)} ⭐
                </span>
              </div>
            )}
            
            <Link
              to={popupInfo.type === 'dive_site' ? `/dive-sites/${popupInfo.id}` : `/diving-centers/${popupInfo.id}`}
              className="block w-full text-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              View Details
            </Link>
            <button 
              onClick={() => {
                setPopupInfo(null);
                setPopupPosition(null);
              }}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              ✖
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiveMap; 