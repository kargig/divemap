import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';

import api from '../api';
import RouteDrawingCanvas from '../components/RouteDrawingCanvas';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const DiveRouteDrawing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  usePageTitle('Draw Dive Route');

  // Authentication check - redirect if not logged in
  if (!user) {
    toast.error('Please log in to draw routes');
    navigate('/login');
    return null;
  }

  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeType, setRouteType] = useState('line');

  // Fetch dive site data
  const { data: diveSite, isLoading, error: diveSiteError } = useQuery(
    ['dive-site', id],
    () => api.get(`/api/v1/dive-sites/${id}`).then(res => res.data),
    {
      enabled: !!id,
    }
  );

  // Route creation mutation
  const createRouteMutation = useMutation(
    async (routeData) => {
      console.log('=== DEBUG: createRouteMutation called ===');
      console.log('routeData parameter:', routeData);
      console.log('routeData.route_data:', routeData.route_data);
      
      const response = await api.post('/api/v1/dive-routes/', {
        dive_site_id: parseInt(id),
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
      onSuccess: (data) => {
        toast.success('Route saved successfully!');
        queryClient.invalidateQueries(['dive-site', id]);
        queryClient.invalidateQueries(['dive-routes']);
        navigate(`/dive-sites/${id}`);
      },
      onError: (error) => {
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

  const handleSave = (routeData) => {
    console.log('=== DEBUG: handleSave called ===');
    console.log('routeData received:', routeData);
    console.log('routeData type:', typeof routeData);
    console.log('routeData keys:', routeData ? Object.keys(routeData) : 'null');
    
    if (!routeData) {
      toast.error('Please draw a route before saving');
      return;
    }

    if (!routeName.trim()) {
      toast.error('Please enter a route name');
      return;
    }

    const payload = {
      dive_site_id: parseInt(id),
      name: routeName,
      description: routeDescription,
      route_data: routeData,
      route_type: routeType,
    };

    console.log('=== DEBUG: Payload being sent ===');
    console.log('Full payload:', payload);
    console.log('route_data specifically:', payload.route_data);
    console.log('route_data type:', typeof payload.route_data);
    console.log('route_data has type field:', payload.route_data && 'type' in payload.route_data);
    console.log('route_data.type value:', payload.route_data?.type);

    createRouteMutation.mutate(payload);
  };

  const handleCancel = () => {
    navigate(`/dive-sites/${id}`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dive site...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (diveSiteError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load dive site</p>
          <button
            onClick={() => navigate(`/dive-sites/${id}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Dive site not found</p>
          <button
            onClick={() => navigate('/dive-sites')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Browse Dive Sites
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Compact Header - Fixed Position */}
      <div className="bg-white shadow-sm border-b fixed top-16 left-0 right-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dive Site
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-800">
                Draw Route for {diveSite.name}
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                Use the drawing tools on the map to create your route
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ultra-Compact Form - Fixed Position */}
      <div className="bg-white border-b fixed top-28 left-0 right-0 z-40 pointer-events-none">
        <div className="px-4 py-1">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <div className="pointer-events-auto flex-1">
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Route Name *"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                required
              />
            </div>

            <div className="pointer-events-auto w-32">
              <select
                value={routeType}
                onChange={(e) => setRouteType(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="line">Line Route</option>
                <option value="polygon">Area Route</option>
                <option value="waypoints">Waypoints</option>
              </select>
            </div>

            <div className="pointer-events-auto flex-1">
              <input
                type="text"
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder="Description"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Drawing Canvas - With Top Padding */}
      <div className="flex-1 pt-32" style={{ height: 'calc(100vh - 180px)' }}>
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
        />
      </div>
    </div>
  );
};

export default DiveRouteDrawing;
