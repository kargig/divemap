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
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import { Link } from 'react-router-dom';

const DiveSitesMap = ({ diveSites, viewport, onViewportChange }) => {
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

  // Update map when dive sites change
  useEffect(() => {
    if (!mapInstance.current || !diveSites) return;

    // Remove existing vector layer
    const layers = mapInstance.current.getLayers();
    const existingVectorLayer = layers.getArray().find(layer => layer instanceof VectorLayer);
    if (existingVectorLayer) {
      mapInstance.current.removeLayer(existingVectorLayer);
    }

    // Create features from dive sites
    const features = diveSites.map(site => {
      const lon = parseFloat(site.longitude);
      const lat = parseFloat(site.latitude);
      
      if (isNaN(lon) || isNaN(lat)) {
        console.error('Invalid coordinates for site:', site.name, site.longitude, site.latitude);
        return null;
      }
      
      const feature = new Feature({
        geometry: new Point(fromLonLat([lon, lat])),
        site: site
      });
      return feature;
    }).filter(feature => feature !== null);

    // Create vector layer
    const vectorSource = new VectorSource({
      features: features
    });

    const newVectorLayer = new VectorLayer({
      source: vectorSource,
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

    mapInstance.current.addLayer(newVectorLayer);

    // Fit view to show all features
    if (features.length > 0) {
      const extent = vectorSource.getExtent();
      mapInstance.current.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        duration: 1000
      });
    }
  }, [diveSites]);

  // Handle feature clicks
  useEffect(() => {
    if (!mapInstance.current) return;

    const handleClick = (event) => {
      
      const feature = mapInstance.current.forEachFeatureAtPixel(event.pixel, (feature) => feature);
      
      if (feature) {
        const site = feature.get('site');
        setPopupInfo(site);
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
  }, [diveSites]);

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

  return (
    <div className="h-[36rem] w-full rounded-lg overflow-hidden shadow-md relative">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs">
        {diveSites?.length || 0} dive sites loaded
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
            <h3 className="font-semibold text-gray-900 mb-1">{popupInfo.name}</h3>
            {popupInfo.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {popupInfo.description}
              </p>
            )}
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
                    {popupInfo.average_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <Link
              to={`/dive-sites/${popupInfo.id}`}
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

export default DiveSitesMap; 