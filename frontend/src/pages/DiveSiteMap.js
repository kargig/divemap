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
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import api from '../api';

const DiveSiteMap = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef();
  const mapInstance = useRef();
  const [selectedSite, setSelectedSite] = useState(null);

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
          zoom: 2
        })
      });

      mapInstance.current = map;

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

      const vectorSource = new VectorSource({
        features: features
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: (feature) => {
          const isMain = feature.get('isMain');
          return new Style({
            image: new CircleStyle({
              radius: isMain ? 12 : 8,
              fill: new Fill({
                color: isMain ? '#f59371' : '#2563ea'
              }),
              stroke: new Stroke({
                color: 'white',
                width: 2
              })
            })
          });
        }
      });

      map.addLayer(vectorLayer);

      // Add click handler
      map.on('click', (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => {
          return feature;
        });

        if (feature) {
          const site = feature.get('site');
          setSelectedSite(site);
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
        <div className="absolute top-20 left-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">{selectedSite.name}</h3>
            <button
              onClick={() => setSelectedSite(null)}
              className="text-gray-500 hover:text-gray-700"
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