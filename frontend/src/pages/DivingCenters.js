import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { Star, MapPin, Phone, Mail, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

// Helper function to safely extract error message
const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const DivingCenters = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useState({
    name: '',
    min_rating: '',
    max_rating: '',
    limit: 50,
    offset: 0
  });

  // Fetch total count
  const { data: totalCount } = useQuery(
    ['diving-centers-count', searchParams],
    () => {
      // Filter out empty parameters
      const filteredParams = Object.fromEntries(
        Object.entries(searchParams).filter(([key, value]) => {
          if (key === 'limit' || key === 'offset') return true;
          return value !== '' && value !== null && value !== undefined;
        })
      );
      return api.get('/api/v1/diving-centers/count', { params: filteredParams });
    },
    {
      select: (response) => response.data.total,
      keepPreviousData: true
    }
  );

  // Fetch diving centers
  const { data: divingCenters, isLoading, error } = useQuery(
    ['diving-centers', searchParams],
    () => {
      // Filter out empty parameters
      const filteredParams = Object.fromEntries(
        Object.entries(searchParams).filter(([key, value]) => {
          if (key === 'limit' || key === 'offset') return true;
          return value !== '' && value !== null && value !== undefined;
        })
      );
      return api.get('/api/v1/diving-centers/', { params: filteredParams });
    },
    {
      select: (response) => response.data,
      keepPreviousData: true
    }
  );

  // Rating mutation
  const rateMutation = useMutation(
    ({ centerId, score }) => api.post(`/api/v1/diving-centers/${centerId}/rate`, { score }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-centers']);
        toast.success('Rating submitted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to submit rating');
      }
    }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(prev => ({ ...prev, offset: 0 }));
  };

  const handleRating = (centerId, score) => {
    if (!user) {
      toast.error('Please log in to rate diving centers');
      return;
    }
    rateMutation.mutate({ centerId, score });
  };

  const renderStars = (rating, interactive = false, centerId = null) => {
    const stars = [];
    for (let i = 1; i <= 10; i++) {
      const isFilled = i <= rating;
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            isFilled ? 'text-yellow-400 fill-current' : 'text-gray-300'
          } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
          onClick={() => interactive && handleRating(centerId, i)}
        />
      );
    }
    return stars;
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
      <div className="text-center py-8">
        <p className="text-red-600">Error loading diving centers: {getErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Diving Centers</h1>
        <p className="text-gray-600">Discover and rate diving centers around the world</p>
        {totalCount !== undefined && (
          <div className="mt-2 text-sm text-gray-500">
            Showing {divingCenters?.length || 0} diving centers from {totalCount} total diving centers
          </div>
        )}
      </div>

      {/* Search and Filter Form */}
      <form onSubmit={handleSearch} className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by name
            </label>
            <input
              type="text"
              value={searchParams.name}
              onChange={(e) => setSearchParams(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter center name..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rating
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={searchParams.min_rating}
              onChange={(e) => setSearchParams(prev => ({ ...prev, min_rating: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Rating
            </label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={searchParams.max_rating}
              onChange={(e) => setSearchParams(prev => ({ ...prev, max_rating: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {divingCenters?.map((center) => (
          <div key={center.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  <Link 
                    to={`/diving-centers/${center.id}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {center.name}
                  </Link>
                </h3>
                {center.average_rating && (
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {center.average_rating.toFixed(1)}/10
                    </span>
                  </div>
                )}
              </div>

              {center.description && (
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {center.description}
                </p>
              )}

              {/* Contact Information */}
              <div className="space-y-2 mb-4">
                {center.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2" />
                    <a href={`mailto:${center.email}`} className="hover:text-blue-600">
                      {center.email}
                    </a>
                  </div>
                )}
                {center.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2" />
                    <a href={`tel:${center.phone}`} className="hover:text-blue-600">
                      {center.phone}
                    </a>
                  </div>
                )}
                {center.website && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Globe className="h-4 w-4 mr-2" />
                    <a 
                      href={center.website.startsWith('http') ? center.website : `https://${center.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      {center.website}
                    </a>
                  </div>
                )}
                {center.latitude && center.longitude && (
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>
                      {Number(center.latitude).toFixed(4)}, {Number(center.longitude).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Rating Section */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    {center.total_ratings} rating{center.total_ratings !== 1 ? 's' : ''}
                  </span>
                  {user && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500 mr-2">Rate:</span>
                      {renderStars(0, true, center.id)}
                    </div>
                  )}
                </div>
              </div>

              {/* View Details Button */}
              <div className="mt-4">
                <Link
                  to={`/diving-centers/${center.id}`}
                  className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {divingCenters?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No diving centers found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default DivingCenters; 