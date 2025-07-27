import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2, Plus, X } from 'lucide-react';
import { getCurrencyOptions, DEFAULT_CURRENCY, formatCost } from '../utils/currency';

// Helper function to safely extract error message
const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const EditDivingCenter = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    email: '',
    phone: '',
    website: '',
    latitude: '',
    longitude: ''
  });

  const [gearRental, setGearRental] = useState([]);
  const [newGearItem, setNewGearItem] = useState({
    item_name: '',
    cost: '',
    currency: DEFAULT_CURRENCY
  });

  const [isAddingGear, setIsAddingGear] = useState(false);

  // Check if user has edit privileges
  const canEdit = user && (user.is_admin || user.is_moderator);

  // Fetch diving center data
  const { data: divingCenter, isLoading, error } = useQuery(
    ['diving-center', id],
    () => api.get(`/api/v1/diving-centers/${id}`).then(res => res.data),
    {
      enabled: !!id && canEdit,
      onSuccess: (data) => {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          email: data.email || '',
          phone: data.phone || '',
          website: data.website || '',
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || ''
        });
      }
    }
  );

  // Fetch gear rental costs
  const { data: gearRentalData = [], isLoading: gearLoading, error: gearError } = useQuery(
    ['diving-center-gear', id],
    () => api.get(`/api/v1/diving-centers/${id}/gear-rental`).then(res => {
      console.log('Gear rental API response:', res);
      return res.data || [];
    }),
    {
      enabled: !!id && canEdit,
      onSuccess: (data) => {
        setGearRental(data);
      },
      onError: (error) => {
        console.error('Failed to fetch gear rental:', error);
        toast.error('Failed to load gear rental data');
      }
    }
  );

  // Update mutation
  const updateMutation = useMutation(
    (data) => api.put(`/api/v1/diving-centers/${id}`, data),
    {
      onSuccess: async () => {
        toast.success('Diving center updated successfully');
        // Invalidate and refetch the diving center data before navigation
        await queryClient.invalidateQueries(['diving-center', id]);
        await queryClient.invalidateQueries(['admin-diving-centers']);
        // Refetch the diving center data to ensure it's updated
        await queryClient.refetchQueries(['diving-center', id]);
        navigate(`/diving-centers/${id}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update diving center');
      }
    }
  );

  // Add gear rental mutation
  const addGearMutation = useMutation(
    (gearData) => api.post(`/api/v1/diving-centers/${id}/gear-rental`, gearData),
    {
      onSuccess: () => {
        toast.success('Gear rental added successfully');
        queryClient.invalidateQueries(['diving-center-gear', id]);
        setNewGearItem({ item_name: '', cost: '' });
        setIsAddingGear(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to add gear rental');
      }
    }
  );

  // Delete gear rental mutation
  const deleteGearMutation = useMutation(
    (gearId) => api.delete(`/api/v1/diving-centers/${id}/gear-rental/${gearId}`),
    {
      onSuccess: () => {
        toast.success('Gear rental deleted successfully');
        queryClient.invalidateQueries(['diving-center-gear', id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete gear rental');
      }
    }
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      latitude: parseFloat(formData.latitude) || null,
      longitude: parseFloat(formData.longitude) || null
    };

    updateMutation.mutate(submitData);
  };

  const handleAddGear = (e) => {
    e.preventDefault();
    if (!newGearItem.item_name.trim() || !newGearItem.cost.trim()) {
      toast.error('Please enter both item name and cost');
      return;
    }
    addGearMutation.mutate({
      item_name: newGearItem.item_name,
      cost: parseFloat(newGearItem.cost),
      currency: newGearItem.currency
    });
  };

  const handleDeleteGear = (gearId) => {
    if (window.confirm('Are you sure you want to delete this gear rental item?')) {
      deleteGearMutation.mutate(gearId);
    }
  };

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to edit diving centers.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-600">Failed to load diving center: {getErrorMessage(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(`/diving-centers/${id}`)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Diving Center
              </button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Diving Center</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Gear Rental Management */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Gear Rental Costs</h3>
                <button
                  type="button"
                  onClick={() => setIsAddingGear(!isAddingGear)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Gear Rental
                </button>
              </div>

              {/* Add Gear Rental Form */}
              {isAddingGear && (
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <form onSubmit={handleAddGear} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Item Name *
                        </label>
                        <input
                          type="text"
                          value={newGearItem.item_name}
                          onChange={(e) => setNewGearItem(prev => ({ ...prev, item_name: e.target.value }))}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Full Set, BCD, Regulator"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newGearItem.cost}
                          onChange={(e) => setNewGearItem(prev => ({ ...prev, cost: e.target.value }))}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Currency
                        </label>
                        <select
                          value={newGearItem.currency}
                          onChange={(e) => setNewGearItem(prev => ({ ...prev, currency: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {getCurrencyOptions().map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={addGearMutation.isLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {addGearMutation.isLoading ? 'Adding...' : 'Add Gear Rental'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingGear(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Gear Rental List */}
              <div className="space-y-3">
                {gearLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading gear rental...</p>
                  </div>
                )}
                {gearError && (
                  <div className="text-center py-4">
                    <p className="text-red-600">Failed to load gear rental data</p>
                  </div>
                )}
                {!gearLoading && !gearError && Array.isArray(gearRental) && gearRental.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No gear rental items added yet.</p>
                )}
                {!gearLoading && !gearError && Array.isArray(gearRental) && gearRental.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">{item.item_name}</h4>
                      <p className="text-sm text-gray-600">{formatCost(item.cost, item.currency || DEFAULT_CURRENCY)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteGear(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete gear rental"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate(`/diving-centers/${id}`)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isLoading}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditDivingCenter; 