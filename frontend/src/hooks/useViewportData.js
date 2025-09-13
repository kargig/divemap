import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from 'react-query';

import api from '../api';

/**
 * Hook for viewport-based data loading with performance optimization
 * Loads only data visible in the current map viewport
 */
export const useViewportData = (viewport, filters, selectedEntityType) => {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    dataPoints: 0,
    loadTime: 0,
    memoryUsage: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });

  const cacheRef = useRef(new Map());
  const lastViewportRef = useRef(null);
  const loadStartTimeRef = useRef(0);

  // Debounce viewport changes to prevent excessive API calls
  const [debouncedViewport, setDebouncedViewport] = useState(viewport);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedViewport(viewport);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [viewport]);

  // Generate cache key for current viewport and filters
  const generateCacheKey = useCallback((viewport, filters, entityType) => {
    const bounds = viewport?.bounds;
    if (!bounds) return null;

    // Round bounds to reduce cache fragmentation
    const roundedBounds = {
      north: Math.round(bounds.north * 100) / 100,
      south: Math.round(bounds.south * 100) / 100,
      east: Math.round(bounds.east * 100) / 100,
      west: Math.round(bounds.west * 100) / 100,
    };

    return `${entityType}-${JSON.stringify(roundedBounds)}-${JSON.stringify(filters)}`;
  }, []);

  // Check if viewport has changed significantly
  const hasViewportChanged = useCallback((newViewport, oldViewport) => {
    if (!oldViewport || !newViewport?.bounds) return true;

    const oldBounds = oldViewport?.bounds;
    const newBounds = newViewport?.bounds;

    // Check if bounds have changed by more than 10%
    if (!oldBounds || !newBounds) return true;

    const latDiff =
      Math.abs(newBounds.north - oldBounds.north) / Math.abs(oldBounds.north - oldBounds.south);
    const lonDiff =
      Math.abs(newBounds.east - oldBounds.east) / Math.abs(oldBounds.east - oldBounds.west);

    return latDiff > 0.1 || lonDiff > 0.1 || Math.abs(newViewport.zoom - oldViewport.zoom) > 1;
  }, []);

  // Fetch data from existing APIs
  const fetchData = useCallback(async (viewport, filters, entityType) => {
    // If no bounds are available yet, load all data (for initial load)
    const bounds = viewport?.bounds;

    const results = {
      dive_sites: [],
      diving_centers: [],
      dives: [],
    };

    try {
      // Fetch dive sites if needed
      if (entityType === 'dive-sites') {
        const diveSitesParams = new URLSearchParams();
        diveSitesParams.append('page_size', '1000'); // Max allowed page size
        diveSitesParams.append('page', '1');

        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
          if (
            value &&
            value !== '' &&
            [
              'search',
              'name',
              'difficulty_level',
              'min_rating',
              'tag_ids',
              'country',
              'region',
            ].includes(key)
          ) {
            if (Array.isArray(value)) {
              value.forEach(v => diveSitesParams.append(key, v));
            } else {
              diveSitesParams.append(key, value);
            }
          }
        });

        const diveSitesResponse = await api.get(
          `/api/v1/dive-sites/?${diveSitesParams.toString()}`
        );
        results.dive_sites = diveSitesResponse.data || [];
      }

      // Fetch diving centers if needed
      if (entityType === 'diving-centers') {
        const divingCentersParams = new URLSearchParams();
        divingCentersParams.append('page_size', '1000'); // Max allowed page size
        divingCentersParams.append('page', '1');

        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
          if (
            value &&
            value !== '' &&
            ['search', 'name', 'min_rating', 'max_rating', 'country', 'region', 'city'].includes(
              key
            )
          ) {
            if (Array.isArray(value)) {
              value.forEach(v => divingCentersParams.append(key, v));
            } else {
              divingCentersParams.append(key, value);
            }
          }
        });

        const divingCentersResponse = await api.get(
          `/api/v1/diving-centers/?${divingCentersParams.toString()}`
        );
        results.diving_centers = divingCentersResponse.data || [];
      }

      // Fetch dives if needed
      if (entityType === 'dives') {
        const divesParams = new URLSearchParams();
        divesParams.append('page_size', '1000'); // Max allowed page size
        divesParams.append('page', '1');

        // Add filters
        Object.entries(filters).forEach(([key, value]) => {
          if (
            value &&
            value !== '' &&
            [
              'search',
              'dive_site_id',
              'diving_center_id',
              'min_rating',
              'max_rating',
              'min_depth',
              'max_depth',
              'difficulty_level',
              'suit_type',
              'min_visibility',
              'max_visibility',
              'start_date',
              'end_date',
              'tag_ids',
            ].includes(key)
          ) {
            if (Array.isArray(value)) {
              value.forEach(v => divesParams.append(key, v));
            } else {
              divesParams.append(key, value);
            }
          }
        });

        const divesResponse = await api.get(`/api/v1/dives/?${divesParams.toString()}`);
        results.dives = divesResponse.data || [];
      }

      return results;
    } catch (error) {
      console.error('Error fetching map data:', error);
      return results;
    }
  }, []);

  // Main data fetching query
  const { data, isLoading, error, refetch } = useQuery(
    ['viewport-data', debouncedViewport, filters, selectedEntityType],
    async () => {
      const cacheKey = generateCacheKey(debouncedViewport, filters, selectedEntityType);

      // Check cache first
      if (cacheKey && cacheRef.current.has(cacheKey)) {
        const cachedData = cacheRef.current.get(cacheKey);
        setPerformanceMetrics(prev => ({
          ...prev,
          cacheHits: prev.cacheHits + 1,
        }));
        return cachedData;
      }

      // Track load time
      loadStartTimeRef.current = Date.now();
      setPerformanceMetrics(prev => ({
        ...prev,
        cacheMisses: prev.cacheMisses + 1,
      }));

      // Fetch from API
      const data = await fetchData(debouncedViewport, filters, selectedEntityType);

      // Cache the result
      if (cacheKey && data) {
        cacheRef.current.set(cacheKey, data);

        // Limit cache size to prevent memory issues
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }
      }

      // Update performance metrics
      const loadTime = Date.now() - loadStartTimeRef.current;
      const totalPoints =
        (data?.dive_sites?.length || 0) +
        (data?.diving_centers?.length || 0) +
        (data?.dives?.length || 0);

      setPerformanceMetrics(prev => ({
        ...prev,
        dataPoints: totalPoints,
        loadTime: loadTime,
        memoryUsage: cacheRef.current.size,
      }));

      return data;
    },
    {
      enabled: true, // Always enabled to allow initial data loading
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 2,
      retryDelay: 1000,
    }
  );

  // Clear cache when filters change significantly
  useEffect(() => {
    const filterKey = JSON.stringify(filters);
    const lastFilterKey = localStorage.getItem('lastMapFilterKey');

    if (filterKey !== lastFilterKey) {
      cacheRef.current.clear();
      localStorage.setItem('lastMapFilterKey', filterKey);
    }
  }, [filters]);

  // Clear cache when entity type changes
  useEffect(() => {
    const lastEntityType = localStorage.getItem('lastMapEntityType');

    if (selectedEntityType !== lastEntityType) {
      cacheRef.current.clear();
      localStorage.setItem('lastMapEntityType', selectedEntityType);
    }
  }, [selectedEntityType]);

  // Check if we should refetch data
  const shouldRefetch = hasViewportChanged(debouncedViewport, lastViewportRef.current);

  useEffect(() => {
    if (shouldRefetch && !isLoading) {
      lastViewportRef.current = debouncedViewport;
    }
  }, [shouldRefetch, isLoading, debouncedViewport]);

  // Clear cache function
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    setPerformanceMetrics(prev => ({
      ...prev,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
    }));
  }, []);

  // Preload data for adjacent viewports
  const preloadAdjacentData = useCallback(
    async viewport => {
      if (!viewport.bounds) return;

      const bounds = viewport.bounds;
      const latRange = bounds.north - bounds.south;
      const lonRange = bounds.east - bounds.west;

      // Calculate adjacent viewport bounds
      const adjacentViewports = [
        // North
        {
          ...viewport,
          bounds: {
            north: bounds.north + latRange,
            south: bounds.north,
            east: bounds.east,
            west: bounds.west,
          },
        },
        // South
        {
          ...viewport,
          bounds: {
            north: bounds.south,
            south: bounds.south - latRange,
            east: bounds.east,
            west: bounds.west,
          },
        },
        // East
        {
          ...viewport,
          bounds: {
            north: bounds.north,
            south: bounds.south,
            east: bounds.east + lonRange,
            west: bounds.east,
          },
        },
        // West
        {
          ...viewport,
          bounds: {
            north: bounds.north,
            south: bounds.south,
            east: bounds.west,
            west: bounds.west - lonRange,
          },
        },
      ];

      // Preload data for adjacent viewports
      adjacentViewports.forEach(async adjViewport => {
        const cacheKey = generateCacheKey(adjViewport, filters, selectedEntityType);
        if (cacheKey && !cacheRef.current.has(cacheKey)) {
          try {
            const data = await fetchData(adjViewport, filters, selectedEntityType);
            if (data) {
              cacheRef.current.set(cacheKey, data);
            }
          } catch (error) {
            console.warn('Failed to preload adjacent data:', error);
          }
        }
      });
    },
    [filters, selectedEntityType, generateCacheKey, fetchData]
  );

  // Trigger preloading after successful data fetch
  useEffect(() => {
    if (data && !isLoading) {
      preloadAdjacentData(debouncedViewport);
    }
  }, [data, isLoading, debouncedViewport, preloadAdjacentData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    performanceMetrics,
    clearCache,
    hasViewportChanged: shouldRefetch,
  };
};

export default useViewportData;
