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
    }, 1000); // 1 second debounce to reduce API calls

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
    // If no old viewport, this is the first load
    if (!oldViewport) return true;

    // If new viewport has no bounds, don't refetch (wait for bounds to be calculated)
    if (!newViewport?.bounds) return false;

    const oldBounds = oldViewport?.bounds;
    const newBounds = newViewport?.bounds;

    // If old viewport had no bounds but new one does, this is a significant change
    if (!oldBounds && newBounds) return true;

    // If both have bounds, check if they've changed significantly
    if (oldBounds && newBounds) {
      // Safety checks for bounds properties
      if (
        typeof oldBounds.north !== 'number' ||
        typeof oldBounds.south !== 'number' ||
        typeof oldBounds.east !== 'number' ||
        typeof oldBounds.west !== 'number' ||
        typeof newBounds.north !== 'number' ||
        typeof newBounds.south !== 'number' ||
        typeof newBounds.east !== 'number' ||
        typeof newBounds.west !== 'number'
      ) {
        return false; // Invalid bounds, don't refetch
      }

      // Calculate the size of the viewport to determine relative changes
      const oldLatRange = Math.abs(oldBounds.north - oldBounds.south);
      const oldLonRange = Math.abs(oldBounds.east - oldBounds.west);
      const newLatRange = Math.abs(newBounds.north - newBounds.south);
      const newLonRange = Math.abs(newBounds.east - newBounds.west);

      // Calculate relative changes (more sensitive to zoom changes)
      const latDiff = Math.abs(newBounds.north - oldBounds.north) / oldLatRange;
      const lonDiff = Math.abs(newBounds.east - oldBounds.east) / oldLonRange;
      const latRangeDiff = Math.abs(newLatRange - oldLatRange) / oldLatRange;
      const lonRangeDiff = Math.abs(newLonRange - oldLonRange) / oldLonRange;

      // Only refetch for very significant changes to prevent rate limiting:
      // - Position change > 100% of viewport size (user moved to completely different area)
      // - Viewport size change > 50% (major zoom change)
      // - Zoom level change > 3 levels
      return (
        latDiff > 1.0 ||
        lonDiff > 1.0 ||
        latRangeDiff > 0.5 ||
        lonRangeDiff > 0.5 ||
        Math.abs(newViewport.zoom - oldViewport.zoom) > 3
      );
    }

    // If we get here, don't refetch
    return false;
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
      if (entityType === 'dive-sites' || entityType === 'dive-trips') {
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
              'difficulty_code',
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
          } else if (key === 'exclude_unspecified_difficulty' && value) {
            diveSitesParams.append('exclude_unspecified_difficulty', 'true');
          }
        });

        const diveSitesResponse = await api.get(
          `/api/v1/dive-sites/?${diveSitesParams.toString()}`
        );
        results.dive_sites = diveSitesResponse.data || [];
      }

      // Fetch diving centers if needed
      if (entityType === 'diving-centers' || entityType === 'dive-trips') {
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
              'difficulty_code',
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
          } else if (key === 'exclude_unspecified_difficulty' && value) {
            divesParams.append('exclude_unspecified_difficulty', 'true');
          }
        });

        const divesResponse = await api.get(`/api/v1/dives/?${divesParams.toString()}`);
        results.dives = divesResponse.data || [];
      }

      // Fetch dive trips if needed
      if (entityType === 'dive-trips') {
        const tripsParams = new URLSearchParams();
        tripsParams.append('page_size', '1000'); // Max allowed page size
        tripsParams.append('page', '1');

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
              'trip_status',
              'difficulty_code',
              'min_price',
              'max_price',
              'start_date',
              'end_date',
              'tag_ids',
            ].includes(key)
          ) {
            if (Array.isArray(value)) {
              value.forEach(v => tripsParams.append(key, v));
            } else {
              tripsParams.append(key, value);
            }
          } else if (key === 'exclude_unspecified_difficulty' && value) {
            tripsParams.append('exclude_unspecified_difficulty', 'true');
          }
        });

        const tripsResponse = await api.get(`/api/v1/newsletters/trips?${tripsParams.toString()}`);
        results.dive_trips = tripsResponse.data || [];
      }

      return results;
    } catch (error) {
      console.error('Error fetching map data:', error);
      // Re-throw the error with more context for better error handling
      throw {
        ...error,
        isRateLimited: error?.response?.status === 429,
        retryAfter: error?.response?.headers?.['retry-after'],
        message:
          error?.response?.status === 429
            ? 'Rate limit exceeded. Please wait before trying again.'
            : error?.message || 'Failed to load map data',
      };
    }
  }, []);

  // Disable automatic viewport change detection for smooth map movement
  // Data will only be loaded once on initial load and when filters/entity type changes
  const shouldRefetch = false; // Always false to prevent automatic refetches

  // Main data fetching query - only load once on initial load and when filters/entity type changes
  const { data, isLoading, error, refetch } = useQuery(
    ['viewport-data', filters, selectedEntityType], // Removed refetchTrigger - no automatic viewport refetches
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

      // Calculate points based on selected entity type and filter for valid coordinates
      let totalPoints = 0;
      if (selectedEntityType === 'dive-sites') {
        totalPoints = (data?.dive_sites || []).filter(
          site => site.latitude && site.longitude
        ).length;
      } else if (selectedEntityType === 'diving-centers') {
        totalPoints = (data?.diving_centers || []).filter(
          center => center.latitude && center.longitude
        ).length;
      } else if (selectedEntityType === 'dives') {
        totalPoints = (data?.dives || []).filter(
          dive => dive.dive_site?.latitude && dive.dive_site?.longitude
        ).length;
      } else if (selectedEntityType === 'dive-trips') {
        // For dive trips, we need to count only those that have valid coordinates
        totalPoints = (data?.dive_trips || []).filter(trip => {
          // Check if trip has coordinates from dive sites or diving centers
          let hasCoordinates = false;

          // Check dive sites coordinates
          if (trip.dives && trip.dives.length > 0 && data?.dive_sites) {
            const firstDive = trip.dives[0];
            if (firstDive.dive_site_id) {
              const diveSite = data.dive_sites.find(site => site.id === firstDive.dive_site_id);
              if (diveSite && diveSite.latitude && diveSite.longitude) {
                hasCoordinates = true;
              }
            }
          }

          // Check diving centers coordinates
          if (!hasCoordinates && trip.diving_center_id && data?.diving_centers) {
            const divingCenter = data.diving_centers.find(
              center => center.id === trip.diving_center_id
            );
            if (divingCenter && divingCenter.latitude && divingCenter.longitude) {
              hasCoordinates = true;
            }
          }

          return hasCoordinates;
        }).length;
      } else {
        // Fallback: count all entities if entity type is unknown
        totalPoints =
          (data?.dive_sites || []).filter(site => site.latitude && site.longitude).length +
          (data?.diving_centers || []).filter(center => center.latitude && center.longitude)
            .length +
          (data?.dives || []).filter(dive => dive.dive_site?.latitude && dive.dive_site?.longitude)
            .length +
          (data?.dive_trips || []).filter(trip => {
            // Same logic as above for dive trips
            let hasCoordinates = false;
            if (trip.dives && trip.dives.length > 0 && data?.dive_sites) {
              const firstDive = trip.dives[0];
              if (firstDive.dive_site_id) {
                const diveSite = data.dive_sites.find(site => site.id === firstDive.dive_site_id);
                if (diveSite && diveSite.latitude && diveSite.longitude) {
                  hasCoordinates = true;
                }
              }
            }
            if (!hasCoordinates && trip.diving_center_id && data?.diving_centers) {
              const divingCenter = data.diving_centers.find(
                center => center.id === trip.diving_center_id
              );
              if (divingCenter && divingCenter.latitude && divingCenter.longitude) {
                hasCoordinates = true;
              }
            }
            return hasCoordinates;
          }).length;
      }

      setPerformanceMetrics(prev => ({
        ...prev,
        dataPoints: totalPoints,
        loadTime: loadTime,
        memoryUsage: cacheRef.current.size,
      }));

      return data;
    },
    {
      enabled: !!debouncedViewport, // Always enabled when viewport is available
      staleTime: 300000, // 5 minutes - data stays fresh longer
      cacheTime: 600000, // 10 minutes - keep in cache longer
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        // Don't retry on 429 errors (rate limiting)
        if (error?.response?.status === 429) {
          return false;
        }
        // Retry other errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: attemptIndex => {
        // Exponential backoff for retries, but don't retry 429 errors
        return Math.min(1000 * Math.pow(2, attemptIndex), 5000);
      },
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

  // Update lastViewportRef when data is successfully loaded
  useEffect(() => {
    if (data && !isLoading) {
      lastViewportRef.current = debouncedViewport;
    }
  }, [data, isLoading]);

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
