import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Map, Star, Anchor, Eye, EyeOff } from 'lucide-react';
import { useQuery } from 'react-query';
import DiveMap from '../components/DiveMap';
import api from '../api';

const Home = () => {
  // State for map toggles
  const [showDiveSites, setShowDiveSites] = useState(true);
  const [showDivingCenters, setShowDivingCenters] = useState(true);

  // Fetch dive sites and diving centers for the map
  const { data: diveSites } = useQuery(
    ['dive-sites'],
    () => api.get('/api/v1/dive-sites'),
    {
      select: (response) => response.data,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const { data: divingCenters } = useQuery(
    ['diving-centers'],
    () => api.get('/api/v1/diving-centers'),
    {
      select: (response) => response.data,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Filter data based on toggle states
  const filteredDiveSites = showDiveSites ? (diveSites || []) : [];
  const filteredDivingCenters = showDivingCenters ? (divingCenters || []) : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Discover Amazing
          <span className="text-blue-600"> Dive Sites</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Explore the world's best scuba diving locations, read reviews from fellow divers, 
          and find diving centers for your next underwater adventure.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/dive-sites"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            Explore Dive Sites
          </Link>
          <Link
            to="/register"
            className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold"
          >
            Join the Community
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 py-12">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <Map className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Discover Sites</h3>
          <p className="text-gray-600">
            Browse through our comprehensive database of dive sites with detailed information, 
            difficulty levels, and access instructions.
          </p>
        </div>
        
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <Star className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Rate & Review</h3>
          <p className="text-gray-600">
            Share your experiences by rating dive sites and leaving detailed reviews 
            to help other divers make informed decisions.
          </p>
        </div>
        
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <Anchor className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Find Centers</h3>
          <p className="text-gray-600">
            Connect with professional diving centers, view their services, 
            and get in touch for your next diving adventure.
          </p>
        </div>
      </div>

      {/* Interactive Map Section */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Explore Dive Sites & Centers
        </h2>
        <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
          Discover amazing dive sites and professional diving centers around the world. 
          Click on any marker to learn more about the location.
        </p>
        
        {/* Map Controls */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDiveSites(!showDiveSites)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  showDiveSites 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showDiveSites ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Dive Sites ({diveSites?.length || 0})
                </span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDivingCenters(!showDivingCenters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  showDivingCenters 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showDivingCenters ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Diving Centers ({divingCenters?.length || 0})
                </span>
              </button>
            </div>
          </div>
        </div>
        
        <DiveMap diveSites={filteredDiveSites} divingCenters={filteredDivingCenters} />
      </div>

      {/* Stats Section */}
      <div className="bg-blue-600 text-white py-12 rounded-lg mb-12">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold mb-2">{diveSites?.length || 0}</div>
            <div className="text-blue-200">Dive Sites</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">1000+</div>
            <div className="text-blue-200">Reviews</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">{divingCenters?.length || 0}</div>
            <div className="text-blue-200">Diving Centers</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Start Your Diving Journey?
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Join our community of passionate divers and start exploring amazing underwater worlds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/register"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            Get Started
          </Link>
          <Link
            to="/dive-sites"
            className="px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold"
          >
            Browse Sites
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 