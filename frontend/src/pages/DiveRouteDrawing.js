import { ArrowLeft, Save, RotateCcw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';

import api from '../api';
import MultiSegmentRouteCanvas from '../components/MultiSegmentRouteCanvas';
import RouteDrawingCanvas from '../components/RouteDrawingCanvas';
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
  const [routeType, setRouteType] = useState('scuba'); // Default to scuba for single mode
  const [routeMode, setRouteMode] = useState('single'); // 'single' or 'multi'
  const [multiSegmentData, setMultiSegmentData] = useState(null);
  const [singleRouteData, setSingleRouteData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update route type when mode changes
  useEffect(() => {
    if (routeMode === 'single') {
      setRouteType('scuba');
    } else if (routeMode === 'multi') {
      setRouteType('walk'); // Default to walk for multi-segment
    }
  }, [routeMode]);

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

  // Detect if existing route is multi-segment and set appropriate mode
  useEffect(() => {
    if (existingRoute?.route_data) {
      const routeData = existingRoute.route_data;

      // Populate form fields
      setRouteName(existingRoute.name || '');
      setRouteDescription(existingRoute.description || '');

      // Check if this is a multi-segment route
      const isMultiSegment =
        routeData.type === 'FeatureCollection' &&
        routeData.features &&
        routeData.features.length > 0 &&
        routeData.features.some(
          feature =>
            feature.properties &&
            feature.properties.segmentType &&
            ['walk', 'swim', 'scuba'].includes(feature.properties.segmentType)
        );

      if (isMultiSegment) {
        console.log('Detected multi-segment route, switching to multi mode');
        setRouteMode('multi');
        // Set the multi-segment data for editing
        setMultiSegmentData(routeData);
      } else {
        console.log('Detected single-segment route, staying in single mode');
        setRouteMode('single');
      }
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

  const handleSave = routeData => {
    console.log('=== DEBUG: handleSave called ===');
    console.log('routeData received:', routeData);
    console.log('routeData type:', typeof routeData);
    console.log('routeData keys:', routeData ? Object.keys(routeData) : 'null');

    // Validation checks
    if (!routeName.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    if (routeName.trim().length < 3) {
      toast.error('Route name must be at least 3 characters long');
      return;
    }

    // For multi-segment mode, use the stored multiSegmentData if no routeData is provided
    // For single mode, use the stored singleRouteData if no routeData is provided
    const dataToSave =
      routeMode === 'multi' && !routeData
        ? multiSegmentData
        : routeMode === 'single' && !routeData
          ? singleRouteData
          : routeData;

    if (!dataToSave) {
      toast.error('Please draw a route before saving');
      return;
    }

    // Validate route data structure
    if (routeMode === 'multi') {
      if (!dataToSave.type || dataToSave.type !== 'FeatureCollection') {
        toast.error('Invalid multi-segment route data');
        return;
      }
      if (!dataToSave.features || dataToSave.features.length === 0) {
        toast.error('Please draw at least one route segment');
        return;
      }
    } else {
      if (!dataToSave.type || dataToSave.type !== 'Feature') {
        toast.error('Invalid single route data');
        return;
      }
      if (!dataToSave.geometry || !dataToSave.geometry.coordinates) {
        toast.error('Please draw a complete route');
        return;
      }
    }

    // Determine route type based on mode and data
    let finalRouteType = routeType;
    if (routeMode === 'multi' && dataToSave.type === 'FeatureCollection') {
      // For multi-segment routes, use 'line' as the base type
      finalRouteType = 'line';
    }

    const payload = {
      dive_site_id: parseInt(diveSiteId),
      name: routeName,
      description: routeDescription,
      route_data: dataToSave,
      route_type: finalRouteType,
    };

    console.log('=== DEBUG: Payload being sent ===');
    console.log('Full payload:', payload);
    console.log('route_data specifically:', payload.route_data);
    console.log('route_data type:', typeof payload.route_data);
    console.log('route_data has type field:', payload.route_data && 'type' in payload.route_data);
    console.log('route_data.type value:', payload.route_data?.type);

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

      {/* Enhanced Form - Fixed Position */}
      <div className='bg-white border-b fixed top-28 left-0 right-0 z-40 pointer-events-none'>
        <div className='px-4 py-2'>
          <div className='max-w-6xl mx-auto'>
            {/* First Row - Basic Info */}
            <div className='flex gap-3 mb-2'>
              <div className='pointer-events-auto flex-1'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Route Name *</label>
                <input
                  type='text'
                  value={routeName}
                  onChange={e => setRouteName(e.target.value)}
                  placeholder='Enter route name...'
                  className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  required
                />
              </div>

              <div className='pointer-events-auto w-32'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Mode</label>
                <select
                  value={routeMode}
                  onChange={e => setRouteMode(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                >
                  <option value='single'>Single Segment</option>
                  <option value='multi'>Multi Segment</option>
                </select>
              </div>

              <div className='pointer-events-auto w-40'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Route Type</label>
                <select
                  value={routeType}
                  onChange={e => setRouteType(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  disabled={false}
                >
                  {routeMode === 'single' ? (
                    <option value='scuba'>Scuba Route</option>
                  ) : (
                    <>
                      <option value='walk'>Walk Route</option>
                      <option value='swim'>Swim Route</option>
                      <option value='scuba'>Scuba Route</option>
                    </>
                  )}
                </select>
              </div>

              <div className='pointer-events-auto flex items-end'>
                <button
                  onClick={handleCancel}
                  className='px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  Cancel
                </button>
              </div>
              <div className='pointer-events-auto flex items-end'>
                <button
                  onClick={() => handleSave(routeMode === 'single' ? singleRouteData : multiSegmentData)}
                  disabled={isSaving || !routeName.trim()}
                  className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center'
                >
                  {isSaving ? (
                    <>
                      <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className='w-4 h-4 mr-2' />
                      Save Route
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Second Row - Description */}
            <div className='flex gap-3'>
              <div className='pointer-events-auto flex-1'>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Description</label>
                <input
                  type='text'
                  value={routeDescription}
                  onChange={e => setRouteDescription(e.target.value)}
                  placeholder='Optional description of the route...'
                  className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              {/* Route Status Indicator */}
              <div className='pointer-events-auto w-48 flex items-end'>
                <div className='w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600'>
                  {routeMode === 'multi' ? (
                    multiSegmentData ? (
                      <span className='text-green-600'>✓ Multi-segment route ready</span>
                    ) : (
                      <span className='text-orange-600'>⚠ Draw segments to continue</span>
                    )
                  ) : singleRouteData ? (
                    <span className='text-green-600'>✓ Single route ready</span>
                  ) : (
                    <span className='text-orange-600'>⚠ Draw route to continue</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Drawing Canvas - With Top Padding */}
      <div className='flex-1 pt-40' style={{ height: 'calc(100vh - 200px)' }}>
        {routeMode === 'multi' ? (
          <MultiSegmentRouteCanvas
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
            onSegmentsChange={setMultiSegmentData} // Callback to update segments data
            existingRouteData={existingRoute?.route_data} // Pass existing route data for editing
          />
        ) : (
          <RouteDrawingCanvas
            diveSite={diveSite}
            onSave={handleSave}
            onCancel={handleCancel}
            isVisible={true}
            routeName={routeName}
            setRouteName={setRouteName}
            routeDescription={routeDescription}
            setRouteDescription={setRouteDescription}
            routeType={routeType}
            setRouteType={setRouteType}
            existingRouteData={existingRoute?.route_data}
            showForm={false} // Hide internal form as we have external buttons
            onRouteDataChange={setSingleRouteData} // Callback to update route data
          />
        )}
      </div>
    </div>
  );
};

export default DiveRouteDrawing;
