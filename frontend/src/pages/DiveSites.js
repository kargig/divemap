import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { Map, Star, Search, Filter, List, Globe } from 'lucide-react';
import DiveSitesMap from '../components/DiveSitesMap';
import api from '../api';

const DiveSites = () => {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [viewport, setViewport] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2
  });
  
  const [searchParams, setSearchParams] = useState({
    name: '',
    difficulty_level: '',
    min_rating: '',
    max_rating: '',
  });

  const { data: diveSites, isLoading, error } = useQuery(
    ['dive-sites', searchParams],
    () => {
      const filteredParams = Object.fromEntries(
        Object.entries(searchParams).filter(([_, v]) => v !== '')
      );
      return api.get('/api/v1/dive-sites', { params: filteredParams });
    },
    {
      select: (response) => response.data,
      keepPreviousData: true,
    }
  );

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setSearchParams({
      name: '',
      difficulty_level: '',
      min_rating: '',
      max_rating: '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Error loading dive sites. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Dive Sites</h1>
        <p className="text-gray-600">Discover amazing dive sites around the world</p>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Sites
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="name"
                placeholder="Search by name..."
                value={searchParams.name}
                onChange={handleSearchChange}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              name="difficulty_level"
              value={searchParams.difficulty_level}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rating
            </label>
            <input
              type="number"
              name="min_rating"
              min="1"
              max="10"
              placeholder="Min rating"
              value={searchParams.min_rating}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Rating
            </label>
            <input
              type="number"
              name="max_rating"
              min="1"
              max="10"
              placeholder="Max rating"
              value={searchParams.max_rating}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={clearFilters}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
        
        {/* View Mode Toggle */}
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4 inline mr-2" />
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Globe className="h-4 w-4 inline mr-2" />
              Map View
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {viewMode === 'map' ? (
        <div className="mb-8">
          <DiveSitesMap 
            diveSites={diveSites}
            viewport={viewport}
            onViewportChange={setViewport}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {diveSites?.map((site) => (
            <div key={site.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">{site.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    site.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                    site.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    site.difficulty_level === 'advanced' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {site.difficulty_level}
                  </span>
                </div>

                {site.description && (
                  <p className="text-gray-600 mb-4 line-clamp-3">{site.description}</p>
                )}

                {site.average_rating && (
                  <div className="flex items-center mb-4">
                    <span className="text-sm font-semibold text-gray-700">
                      {site.average_rating.toFixed(1)}/10 ({site.total_ratings} reviews)
                    </span>
                  </div>
                )}

                {site.latitude && site.longitude && (
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <Map className="h-4 w-4 mr-1" />
                    <span>{site.latitude}, {site.longitude}</span>
                  </div>
                )}

                <Link
                  to={`/dive-sites/${site.id}`}
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {diveSites?.length === 0 && (
        <div className="text-center py-12">
          <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No dive sites found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default DiveSites; 