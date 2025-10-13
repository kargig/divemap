import { ArrowLeft, Save, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';

import api from '../api';
import RouteCanvas from '../components/RouteCanvas';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const DiveRouteDrawing = () => {
  const { diveSiteId, routeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const editRouteId = routeId;
  const isEditing = !!editRouteId;

  usePageTitle(isEditing ? 'Edit Dive Route' : 'Draw Dive Route');

  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeType, setRouteType] = useState('scuba'); // Default to scuba
  const [routeData, setRouteData] = useState(null);

  const [isSaving, setIsSaving] = useState(false);

  // Function to auto-detect drawing type from GeoJSON geometry
  const detectDrawingType = geoJsonData => {
    if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
      return 'line'; // Default fallback
    }

    const geometryTypes = geoJsonData.features
      .map(feature => feature.geometry?.type)
      .filter(Boolean);

    // If all features are the same type, use that type
    const uniqueTypes = [...new Set(geometryTypes)];
    if (uniqueTypes.length === 1) {
      switch (uniqueTypes[0]) {
        case 'LineString':
        case 'MultiLineString':
          return 'line';
        case 'Polygon':
        case 'MultiPolygon':
          return 'polygon';
        case 'Point':
        case 'MultiPoint':
          return 'waypoint';
        default:
          return 'line';
      }
    }

    // If mixed types, determine the primary type
    const typeCounts = geometryTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Return the most common type, defaulting to line
    const mostCommonType = Object.keys(typeCounts).reduce((a, b) =>
      typeCounts[a] > typeCounts[b] ? a : b
    );

    switch (mostCommonType) {
      case 'LineString':
      case 'MultiLineString':
        return 'line';
      case 'Polygon':
      case 'MultiPolygon':
        return 'polygon';
      case 'Point':
      case 'MultiPoint':
        return 'waypoint';
      default:
        return 'line';
    }
  };

  // Fetch dive site data
  const {
    data: diveSite,
    isLoading,
    error: diveSiteError,
  } = useQuery(
    ['dive-site', diveSiteId],
    () => api.get(`/api/v1/dive-sites/${diveSiteId}`).then(res => res.data),
    {
      enabled: !!diveSiteId,
    }
  );

  // Fetch route data for editing
  const { data: existingRoute, isLoading: routeLoading } = useQuery(
    ['route', editRouteId],
    () => api.get(`/api/v1/dive-routes/${editRouteId}`).then(res => res.data),
    {
      enabled: !!editRouteId,
    }
  );

  // Detect existing route and set appropriate data
  useEffect(() => {
    if (existingRoute?.route_data) {
      const routeData = existingRoute.route_data;

      // Populate form fields
      setRouteName(existingRoute.name || '');
      setRouteDescription(existingRoute.description || '');
      setRouteType(existingRoute.route_type || 'scuba');

      // Set the route data for editing
      setRouteData(routeData);
    }
  }, [existingRoute]);

  // Route creation mutation
  const createRouteMutation = useMutation(
    async routeData => {
      console.log('=== DEBUG: createRouteMutation called ===');
      console.log('routeData parameter:', routeData);
      console.log('routeData.route_data:', routeData.route_data);

      const response = await api.post('/api/v1/dive-routes/', {
        dive_site_id: parseInt(diveSiteId),
        name: routeData.name,
        description: routeData.description,
        route_data: routeData.route_data,
        route_type: routeData.route_type,
        // drawing_type will be auto-detected by backend
      });

      console.log('=== DEBUG: API Response ===');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      return response.data;
    },
    {
      onSuccess: async data => {
        toast.success('Route saved successfully!');

        // Refetch dive site data to ensure it's available before navigation
        await queryClient.refetchQueries(['dive-site', diveSiteId]);

        // Invalidate related queries to ensure consistency
        queryClient.invalidateQueries(['dive-routes']);
        queryClient.invalidateQueries(['dive-site-routes', diveSiteId]);

        navigate(`/dive-sites/${diveSiteId}`);
      },
      onError: error => {
        console.error('Error creating route:', error);

        // Handle different types of error responses
        let errorMessage = 'Failed to save route';

        if (error.response?.data?.detail) {
          const detail = error.response.data.detail;

          // If detail is an array (Pydantic validation errors), extract the first error message
          if (Array.isArray(detail)) {
            errorMessage = detail[0]?.msg || detail[0]?.message || 'Validation error';
          }
          // If detail is a string, use it directly
          else if (typeof detail === 'string') {
            errorMessage = detail;
          }
          // If detail is an object, try to extract a meaningful message
          else if (typeof detail === 'object') {
            errorMessage = detail.msg || detail.message || 'Validation error';
          }
        }

        toast.error(errorMessage);
      },
    }
  );

  // Route update mutation
  const updateRouteMutation = useMutation(
    async routeData => {
      console.log('=== DEBUG: updateRouteMutation called ===');
      console.log('routeData parameter:', routeData);

      const response = await api.put(`/api/v1/dive-routes/${editRouteId}`, {
        name: routeData.name,
        description: routeData.description,
        route_data: routeData.route_data,
        route_type: routeData.route_type,
      });

      console.log('=== DEBUG: API Response ===');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      return response.data;
    },
    {
      onSuccess: data => {
        toast.success('Route updated successfully!');

        // Immediately update the cache with the new route data to prevent race condition
        queryClient.setQueryData(['route', editRouteId], data);

        // Invalidate related queries to ensure consistency
        queryClient.invalidateQueries(['dive-site', diveSiteId]);
        queryClient.invalidateQueries(['dive-routes']);
        queryClient.invalidateQueries(['dive-site-routes', diveSiteId]);

        navigate(`/dive-sites/${diveSiteId}/route/${editRouteId}`);
      },
      onError: error => {
        console.error('Error updating route:', error);

        // Handle different types of error responses
        let errorMessage = 'Failed to update route';

        if (error.response?.data?.detail) {
          const detail = error.response.data.detail;

          // If detail is an array (Pydantic validation errors), extract the first error message
          if (Array.isArray(detail)) {
            errorMessage = detail[0]?.msg || detail[0]?.message || 'Validation error';
          }
          // If detail is a string, use it directly
          else if (typeof detail === 'string') {
            errorMessage = detail;
          }
          // If detail is an object, try to extract a meaningful message
          else if (typeof detail === 'object') {
            errorMessage = detail.msg || detail.message || 'Validation error';
          }
        }

        toast.error(errorMessage);
      },
    }
  );

  // Populate form fields when editing
  useEffect(() => {
    if (existingRoute) {
      setRouteName(existingRoute.name || '');
      setRouteDescription(existingRoute.description || '');
      setRouteType(existingRoute.route_type || 'line');
    }
  }, [existingRoute]);

  // Authentication check - redirect if not logged in
  if (!user) {
    toast.error('Please log in to draw routes');
    navigate('/login');
    return null;
  }

  const handleSave = drawnRouteData => {
    console.log('=== DEBUG: handleSave called ===');
    console.log('drawnRouteData received:', drawnRouteData);
    console.log('routeData state:', routeData);
    console.log('routeName:', routeName);
    console.log('routeType:', routeType);

    // Validation checks
    if (!routeName.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    if (routeName.trim().length < 3) {
      toast.error('Route name must be at least 3 characters long');
      return;
    }

    // Use the provided routeData or the stored routeData
    const dataToSave = drawnRouteData || routeData;
    console.log('dataToSave:', dataToSave);

    if (!dataToSave) {
      toast.error('Please draw a route before saving');
      return;
    }

    // Validate route data structure (all routes are now multi-segment)
    if (!dataToSave.type || dataToSave.type !== 'FeatureCollection') {
      toast.error('Invalid route data');
      return;
    }
    if (!dataToSave.features || dataToSave.features.length === 0) {
      toast.error('Please draw at least one route segment');
      return;
    }

    const payload = {
      dive_site_id: parseInt(diveSiteId),
      name: routeName,
      description: routeDescription,
      route_data: dataToSave,
      route_type: routeType,
      // drawing_type will be auto-detected by backend from geometry
    };

    console.log('=== DEBUG: Payload being sent ===');
    console.log('Full payload:', payload);
    console.log('detectDrawingType result:', detectDrawingType(dataToSave));
    console.log('route_data.features:', dataToSave.features);
    console.log('route_data.features[0]:', dataToSave.features[0]);

    if (isEditing) {
      updateRouteMutation.mutate(payload);
    } else {
      createRouteMutation.mutate(payload);
    }
  };

  const handleCancel = () => {
    navigate(`/dive-sites/${diveSiteId}`);
  };

  // Show loading state
  if (isLoading || routeLoading || !diveSite || !diveSite.latitude || !diveSite.longitude) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>{isEditing ? 'Loading route...' : 'Loading dive site...'}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (diveSiteError) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-red-600 mb-4'>Failed to load dive site</p>
          <button
            onClick={() => navigate(`/dive-sites/${diveSiteId}`)}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Back to Dive Site
          </button>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!diveSite) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-600 mb-4'>Dive site not found</p>
          <button
            onClick={() => navigate('/dive-sites')}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Browse Dive Sites
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col'>
      {/* Compact Header - Fixed Position */}
      <div className='bg-white shadow-sm border-b fixed top-16 left-0 right-0 z-50'>
        <div className='container mx-auto px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <button
                onClick={handleCancel}
                className='flex items-center text-gray-600 hover:text-gray-800 transition-colors'
              >
                <ArrowLeft className='w-5 h-5 mr-2' />
                Back to Dive Site
              </button>
              <div className='h-6 w-px bg-gray-300'></div>
              <h1 className='text-lg font-semibold text-gray-800'>
                {isEditing ? 'Edit Route' : 'Draw Route'} for {diveSite.name}
              </h1>
            </div>

            <div className='flex items-center space-x-3'>
              <div className='text-sm text-gray-500'>
                Use the drawing tools on the map to create your route
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Form - Fixed Position */}
      <div className='bg-white border-b fixed top-28 left-0 right-0 z-40 pointer-events-none'>
        <div className='px-4 py-1'>
          <div className='max-w-6xl mx-auto'>
            {/* Single Row - All Fields */}
            <div className='flex gap-3 items-end'>
              <div className='pointer-events-auto flex-1'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Route Name *</label>
                <input
                  type='text'
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  placeholder='Enter route name...'
                  className='w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                  required
                />
              </div>

              <div className='pointer-events-auto w-32'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Type</label>
                <select
                  value={routeType}
                  onChange={e => setRouteType(e.target.value)}
                  className='w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='scuba'>Scuba</option>
                  <option value='walk'>Walk</option>
                  <option value='swim'>Swim</option>
                </select>
              </div>

              <div className='pointer-events-auto flex-1'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Description</label>
                <input
                  type='text'
                  value={routeDescription}
                  onChange={e => setRouteDescription(e.target.value)}
                  placeholder='Optional description...'
                  className='w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              {/* Route Status Indicator */}
              <div className='pointer-events-auto w-32'>
                <div className='px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600'>
                  {routeData ? (
                    <span className='text-green-600'>✓ Ready</span>
                  ) : (
                    <span className='text-orange-600'>⚠ Draw first</span>
                  )}
                </div>
              </div>

              <div className='pointer-events-auto flex gap-2'>
                <button
                  onClick={handleCancel}
                  className='px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors text-sm border border-gray-300 rounded hover:bg-gray-50'
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(routeData)}
                  disabled={isSaving || !routeName.trim() || !routeData}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    isSaving || !routeName.trim() || !routeData
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className='w-3 h-3 mr-1 animate-spin inline' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className='w-3 h-3 mr-1 inline' />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Drawing Canvas - With Top Padding */}
      <div className='flex-1 pt-32' style={{ height: 'calc(100vh - 160px)' }}>
        <RouteCanvas
          diveSite={diveSite}
          onSave={handleSave}
          onCancel={handleCancel}
          isVisible={true}
          routeName={routeName}
          setRouteName={setRouteName}
          routeDescription={routeDescription}
          setRouteDescription={setRouteDescription}
          routeType={routeType}
          showForm={false} // Hide the internal form as we have a compact one
          onSegmentsChange={setRouteData} // Callback to update route data
          existingRouteData={existingRoute?.route_data} // Pass existing route data for editing
        />
      </div>
    </div>
  );
};

export default DiveRouteDrawing;
