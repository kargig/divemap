# Dive Route Drawing - Technical Specification

**Created**: September 29, 2025  
**Author**: AI Assistant  
**Status**: Technical Design  
**Related**: [Main Task](./task.md)

## Database Schema Details

### DiveRoute Model

```python
class DiveRoute(Base):
    __tablename__ = "dive_routes"
    
    id = Column(Integer, primary_key=True, index=True)
    dive_id = Column(Integer, ForeignKey("dives.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    route_data = Column(JSON, nullable=False)  # GeoJSON format
    route_type = Column(Enum(RouteType), default=RouteType.LINE)
    difficulty_level = Column(Integer, default=2, nullable=False)
    estimated_duration = Column(Integer)  # minutes
    max_depth = Column(DECIMAL(6, 3))  # meters
    is_public = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    view_count = Column(Integer, default=0, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    dive = relationship("Dive", back_populates="routes")
    creator = relationship("User", back_populates="created_routes")

class RouteType(str, Enum):
    LINE = "line"
    POLYGON = "polygon"
    WAYPOINTS = "waypoints"
```

### GeoJSON Route Data Format

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [longitude1, latitude1, depth1],
      [longitude2, latitude2, depth2],
      [longitude3, latitude3, depth3]
    ]
  },
  "properties": {
    "name": "Route Name",
    "description": "Route description",
    "difficulty": 2,
    "estimated_duration": 45,
    "max_depth": 18.5,
    "waypoints": [
      {
        "name": "Entry Point",
        "type": "entry",
        "depth": 0,
        "notes": "Easy entry from shore"
      },
      {
        "name": "Main Attraction",
        "type": "point_of_interest",
        "depth": 15,
        "notes": "Coral reef with abundant marine life"
      },
      {
        "name": "Exit Point",
        "type": "exit",
        "depth": 0,
        "notes": "Return to shore"
      }
    ]
  }
}
```

## API Specification

### Route Management Endpoints

#### Create Route
```http
POST /api/v1/dive-routes
Content-Type: application/json
Authorization: Bearer <token>

{
  "dive_id": 123,
  "name": "Shallow Reef Route",
  "description": "Easy route for beginners",
  "route_data": {
    "type": "Feature",
    "geometry": {
      "type": "LineString",
      "coordinates": [[-122.4, 37.8, 0], [-122.4, 37.81, 5], [-122.4, 37.82, 10]]
    },
    "properties": {
      "waypoints": [...]
    }
  },
  "route_type": "line",
  "difficulty_level": 2,
  "estimated_duration": 45,
  "max_depth": 10.5,
  "is_public": true
}
```

#### Get Routes
```http
GET /api/v1/dive-routes?dive_site_id=456&difficulty_level=2&is_public=true&page=1&page_size=25
```

#### Update Route
```http
PUT /api/v1/dive-routes/{route_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Route Name",
  "description": "Updated description",
  "route_data": {...},
  "is_public": false
}
```

#### Delete Route
```http
DELETE /api/v1/dive-routes/{route_id}
Authorization: Bearer <token>
```

### Route Discovery Endpoints

#### Get Routes for Dive Site
```http
GET /api/v1/dive-sites/{site_id}/routes?difficulty_level=2&route_type=line&sort_by=popularity
```

#### Get Routes for Dive
```http
GET /api/v1/dives/{dive_id}/routes
```

#### Search Routes
```http
GET /api/v1/dive-routes/search?q=reef&difficulty_level=1,2&max_depth=20&country=Mexico
```

## Frontend Component Architecture

### RouteDrawingCanvas Component

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';

const RouteDrawingCanvas = ({ 
  diveSiteId, 
  onRouteComplete, 
  onRouteCancel,
  initialRoute = null 
}) => {
  const [drawingMode, setDrawingMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const mapRef = useRef(null);
  const drawControlRef = useRef(null);

  // Initialize drawing tools
  useEffect(() => {
    if (mapRef.current) {
      const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
          polyline: {
            shapeOptions: {
              color: '#0072B2',
              weight: 3,
              opacity: 0.8
            }
          },
          polygon: {
            shapeOptions: {
              color: '#E69F00',
              weight: 2,
              opacity: 0.6,
              fillOpacity: 0.2
            }
          },
          marker: {
            icon: L.divIcon({
              className: 'route-waypoint',
              html: '<div class="waypoint-marker"></div>',
              iconSize: [20, 20]
            })
          }
        },
        edit: {
          featureGroup: routeLayer,
          remove: true
        }
      });
      
      mapRef.current.addControl(drawControl);
      drawControlRef.current = drawControl;
    }
  }, []);

  // Handle drawing events
  const handleDrawStart = () => {
    setDrawingMode(true);
  };

  const handleDrawCreated = (e) => {
    const { layerType, layer } = e;
    const routeData = convertLayerToGeoJSON(layer, layerType);
    setCurrentRoute(routeData);
    setDrawingMode(false);
  };

  const handleDrawCancel = () => {
    setDrawingMode(false);
    onRouteCancel();
  };

  const handleSaveRoute = async () => {
    if (currentRoute) {
      await onRouteComplete(currentRoute);
      setCurrentRoute(null);
    }
  };

  return (
    <div className="route-drawing-canvas">
      <MapContainer
        ref={mapRef}
        center={[diveSite.latitude, diveSite.longitude]}
        zoom={16}
        className="w-full h-96"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RouteDrawingLayer 
          onDrawStart={handleDrawStart}
          onDrawCreated={handleDrawCreated}
          onDrawCancel={handleDrawCancel}
        />
      </MapContainer>
      
      {currentRoute && (
        <div className="route-preview-panel">
          <h3>Route Preview</h3>
          <p>Type: {currentRoute.type}</p>
          <p>Points: {currentRoute.coordinates.length}</p>
          <div className="route-actions">
            <button onClick={handleSaveRoute}>Save Route</button>
            <button onClick={handleDrawCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
```

### RouteManagementPanel Component

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../api';

const RouteManagementPanel = ({ diveId, onRouteSelect }) => {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const queryClient = useQueryClient();

  // Fetch routes for dive
  const { data: routes, isLoading } = useQuery(
    ['dive-routes', diveId],
    () => api.get(`/api/v1/dives/${diveId}/routes`).then(res => res.data),
    { enabled: !!diveId }
  );

  // Delete route mutation
  const deleteRouteMutation = useMutation(
    (routeId) => api.delete(`/api/v1/dive-routes/${routeId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dive-routes', diveId]);
      }
    }
  );

  const handleDeleteRoute = (routeId) => {
    if (window.confirm('Are you sure you want to delete this route?')) {
      deleteRouteMutation.mutate(routeId);
    }
  };

  const handleEditRoute = (route) => {
    setSelectedRoute(route);
    // Open edit modal or navigate to edit page
  };

  const handleSelectRoute = (route) => {
    onRouteSelect(route);
  };

  if (isLoading) return <div>Loading routes...</div>;

  return (
    <div className="route-management-panel">
      <div className="panel-header">
        <h3>Dive Routes</h3>
        <button onClick={() => setSelectedRoute({})}>Add New Route</button>
      </div>
      
      <div className="routes-list">
        {routes?.map(route => (
          <div key={route.id} className="route-item">
            <div className="route-info">
              <h4>{route.name}</h4>
              <p>{route.description}</p>
              <div className="route-meta">
                <span>Difficulty: {route.difficulty_level}</span>
                <span>Duration: {route.estimated_duration}min</span>
                <span>Max Depth: {route.max_depth}m</span>
              </div>
            </div>
            <div className="route-actions">
              <button onClick={() => handleSelectRoute(route)}>Select</button>
              <button onClick={() => handleEditRoute(route)}>Edit</button>
              <button onClick={() => handleDeleteRoute(route.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### RouteSelectionInterface Component

```jsx
import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import api from '../api';

const RouteSelectionInterface = ({ 
  diveSiteId, 
  onRouteSelect, 
  filters = {} 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [selectedRouteType, setSelectedRouteType] = useState(null);

  // Fetch routes with filters
  const { data: routes, isLoading } = useQuery(
    ['dive-site-routes', diveSiteId, searchQuery, selectedDifficulty, selectedRouteType],
    () => {
      const params = new URLSearchParams({
        dive_site_id: diveSiteId,
        search: searchQuery,
        difficulty_level: selectedDifficulty,
        route_type: selectedRouteType,
        page_size: 50
      });
      return api.get(`/api/v1/dive-routes?${params}`).then(res => res.data);
    },
    { enabled: !!diveSiteId }
  );

  const handleRouteSelect = (route) => {
    onRouteSelect(route);
  };

  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'difficulty':
        setSelectedDifficulty(value);
        break;
      case 'type':
        setSelectedRouteType(value);
        break;
      default:
        break;
    }
  };

  if (isLoading) return <div>Loading routes...</div>;

  return (
    <div className="route-selection-interface">
      <div className="search-filters">
        <input
          type="text"
          placeholder="Search routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <select 
          value={selectedDifficulty || ''} 
          onChange={(e) => handleFilterChange('difficulty', e.target.value)}
        >
          <option value="">All Difficulties</option>
          <option value="1">Beginner</option>
          <option value="2">Intermediate</option>
          <option value="3">Advanced</option>
          <option value="4">Expert</option>
        </select>

        <select 
          value={selectedRouteType || ''} 
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="line">Line Route</option>
          <option value="polygon">Area Route</option>
          <option value="waypoints">Waypoint Route</option>
        </select>
      </div>

      <div className="routes-grid">
        {routes?.map(route => (
          <div key={route.id} className="route-card" onClick={() => handleRouteSelect(route)}>
            <div className="route-preview">
              <RoutePreviewMap route={route} />
            </div>
            <div className="route-info">
              <h4>{route.name}</h4>
              <p>{route.description}</p>
              <div className="route-meta">
                <span className="difficulty">Level {route.difficulty_level}</span>
                <span className="duration">{route.estimated_duration}min</span>
                <span className="depth">{route.max_depth}m</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Integration Points

### Dive Site Page Integration

```jsx
// In DiveSiteDetail.js
import RouteSelectionInterface from '../components/routes/RouteSelectionInterface';

const DiveSiteDetail = () => {
  const { id } = useParams();
  const [selectedRoute, setSelectedRoute] = useState(null);

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    // Show route on map or navigate to dive creation
  };

  return (
    <div className="dive-site-detail">
      {/* Existing dive site content */}
      
      <section className="dive-routes-section">
        <h2>Available Dive Routes</h2>
        <RouteSelectionInterface 
          diveSiteId={id}
          onRouteSelect={handleRouteSelect}
        />
      </section>
    </div>
  );
};
```

### Dive Detail Page Integration

```jsx
// In DiveDetail.js
import RouteManagementPanel from '../components/routes/RouteManagementPanel';

const DiveDetail = () => {
  const { id } = useParams();
  const [selectedRoute, setSelectedRoute] = useState(null);

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    // Display route on map
  };

  return (
    <div className="dive-detail">
      {/* Existing dive content */}
      
      <section className="dive-routes-section">
        <h2>Dive Routes</h2>
        <RouteManagementPanel 
          diveId={id}
          onRouteSelect={handleRouteSelect}
        />
      </section>
    </div>
  );
};
```

## Mobile Optimization

### Touch Drawing Implementation

```jsx
const TouchDrawingHandler = ({ onRouteComplete }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);

  const handleTouchStart = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const touch = e.touches[0];
    const latLng = mapRef.current.containerPointToLatLng([touch.clientX, touch.clientY]);
    setCurrentPath([latLng]);
  };

  const handleTouchMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const latLng = mapRef.current.containerPointToLatLng([touch.clientX, touch.clientY]);
    setCurrentPath(prev => [...prev, latLng]);
  };

  const handleTouchEnd = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    onRouteComplete(currentPath);
  };

  return (
    <div 
      className="touch-drawing-area"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};
```

## Performance Considerations

### Route Data Optimization

```javascript
// Route data compression
const compressRouteData = (routeData) => {
  // Simplify coordinates using Douglas-Peucker algorithm
  const simplified = simplify(routeData.geometry.coordinates, 0.0001);
  
  // Compress waypoint data
  const compressedWaypoints = routeData.properties.waypoints.map(wp => ({
    n: wp.name,
    t: wp.type,
    d: wp.depth,
    notes: wp.notes
  }));

  return {
    ...routeData,
    geometry: {
      ...routeData.geometry,
      coordinates: simplified
    },
    properties: {
      ...routeData.properties,
      waypoints: compressedWaypoints
    }
  };
};

// Lazy loading for route lists
const useInfiniteRoutes = (filters) => {
  return useInfiniteQuery(
    ['routes', filters],
    ({ pageParam = 1 }) => 
      api.get(`/api/v1/dive-routes?page=${pageParam}&page_size=20`).then(res => res.data),
    {
      getNextPageParam: (lastPage) => lastPage.next_page,
      enabled: !!filters.dive_site_id
    }
  );
};
```

## Testing Strategy

### Unit Tests

```javascript
// Route validation tests
describe('Route Validation', () => {
  test('validates route geometry', () => {
    const validRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-122.4, 37.8, 0], [-122.4, 37.81, 5]]
      }
    };
    expect(validateRouteGeometry(validRoute)).toBe(true);
  });

  test('rejects invalid coordinates', () => {
    const invalidRoute = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-200, 100, 0]] // Invalid longitude
      }
    };
    expect(validateRouteGeometry(invalidRoute)).toBe(false);
  });
});

// API endpoint tests
describe('Dive Routes API', () => {
  test('creates route successfully', async () => {
    const routeData = {
      dive_id: 1,
      name: 'Test Route',
      route_data: validRouteData
    };
    
    const response = await request(app)
      .post('/api/v1/dive-routes')
      .send(routeData)
      .expect(201);
    
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Test Route');
  });
});
```

### Integration Tests

```javascript
// End-to-end route creation test
describe('Route Creation Flow', () => {
  test('user can create and save route', async () => {
    // Login as user
    await loginAsUser();
    
    // Navigate to dive site
    await page.goto('/dive-sites/1');
    
    // Click "Add Route" button
    await page.click('[data-testid="add-route-button"]');
    
    // Draw route on map
    await page.click('[data-testid="draw-polyline"]');
    await page.click('[data-testid="map-canvas"]', { position: { x: 100, y: 100 } });
    await page.click('[data-testid="map-canvas"]', { position: { x: 200, y: 200 } });
    await page.click('[data-testid="map-canvas"]', { position: { x: 300, y: 300 } });
    
    // Fill route details
    await page.fill('[data-testid="route-name"]', 'Test Route');
    await page.fill('[data-testid="route-description"]', 'Test description');
    
    // Save route
    await page.click('[data-testid="save-route"]');
    
    // Verify route appears in list
    await expect(page.locator('[data-testid="route-list"]')).toContainText('Test Route');
  });
});
```

This technical specification provides the detailed implementation guidance needed to build the dive route drawing and selection feature, ensuring it integrates seamlessly with the existing Divemap platform while providing a robust and user-friendly experience.
