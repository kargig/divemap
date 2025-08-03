import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Phone, Mail, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get initial values from URL parameters
  const getInitialFilters = () => {
    return {
      name: searchParams.get('name') || '',
      min_rating: searchParams.get('min_rating') || '',
      max_rating: searchParams.get('max_rating') || '',
    };
  };

  const getInitialPagination = () => {
    return {
      page: parseInt(searchParams.get('page')) || 1,
      page_size: parseInt(searchParams.get('page_size')) || 25,
    };
  };

  const [filters, setFilters] = useState(getInitialFilters);
  const [pagination, setPagination] = useState(getInitialPagination);

  // Update URL when filters or pagination change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();
    
    // Add filters
    if (filters.name) newSearchParams.set('name', filters.name);
    if (filters.min_rating) newSearchParams.set('min_rating', filters.min_rating);
    if (filters.max_rating) newSearchParams.set('max_rating', filters.max_rating);
    
    // Add pagination
    newSearchParams.set('page', pagination.page.toString());
    newSearchParams.set('page_size', pagination.page_size.toString());
    
    // Update URL without triggering a page reload
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  }, [filters, pagination, navigate]);

  // Fetch diving centers with pagination
  const { data: divingCenters, isLoading, error } = useQuery(
    ['diving-centers', filters, pagination],
    () => {
      // Create URLSearchParams to properly handle parameters
      const params = new URLSearchParams();
      
      // Add filter parameters
      if (filters.name) params.append('name', filters.name);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (filters.max_rating) params.append('max_rating', filters.max_rating);
      
      // Add pagination parameters
      params.append('page', pagination.page.toString());
      params.append('page_size', pagination.page_size.toString());
      
      return api.get(`/api/v1/diving-centers/?${params.toString()}`);
    },
    {
      select: (response) => {
        // Store pagination info from headers
        const paginationInfo = {
          totalCount: parseInt(response.headers['x-total-count'] || '0'),
          totalPages: parseInt(response.headers['x-total-pages'] || '0'),
          currentPage: parseInt(response.headers['x-current-page'] || '1'),
          pageSize: parseInt(response.headers['x-page-size'] || '25'),
          hasNextPage: response.headers['x-has-next-page'] === 'true',
          hasPrevPage: response.headers['x-has-prev-page'] === 'true'
        };
        // Store pagination info in the query cache
        queryClient.setQueryData(['diving-centers-pagination', filters, pagination], paginationInfo);
        return response.data;
      },
      keepPreviousData: true,
    }
  );

  // Get pagination info from cached data
  const paginationInfo = queryClient.getQueryData(['diving-centers-pagination', filters, pagination]) || {
    totalCount: 0,
    totalPages: 0,
    currentPage: pagination.page,
    pageSize: pagination.page_size,
    hasNextPage: false,
    hasPrevPage: pagination.page > 1
  };

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
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when searching
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      min_rating: '',
      max_rating: '',
    });
    // Reset to first page when clearing filters
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const handlePageSizeChange = (newPageSize) => {
    setPagination(prev => ({
      page: 1, // Reset to first page when changing page size
      page_size: newPageSize,
    }));
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
        {paginationInfo.totalCount !== undefined && (
          <div className="mt-2 text-sm text-gray-500">
            Showing {paginationInfo.totalCount} diving centers from {paginationInfo.totalCount} total diving centers
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
              name="name"
              value={filters.name}
              onChange={handleSearchChange}
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
              name="min_rating"
              value={filters.min_rating}
              onChange={handleSearchChange}
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
              name="max_rating"
              value={filters.max_rating}
              onChange={handleSearchChange}
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

      {/* Pagination Controls */}
      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        {/* Page Size Selection */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Show:</label>
          <select
            value={pagination.page_size}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600">per page</span>
        </div>

        {/* Pagination Info */}
        {paginationInfo.totalCount !== undefined && (
          <div className="text-sm text-gray-600">
            Showing {((pagination.page - 1) * pagination.page_size) + 1} to{' '}
            {Math.min(pagination.page * pagination.page_size, paginationInfo.totalCount)} of {paginationInfo.totalCount} diving centers
          </div>
        )}

        {/* Pagination Navigation */}
        {paginationInfo.totalCount !== undefined && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {Math.ceil(paginationInfo.totalCount / pagination.page_size)}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(paginationInfo.totalCount / pagination.page_size)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

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