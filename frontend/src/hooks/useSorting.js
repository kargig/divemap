import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getDefaultSort, validateSortParams } from '../utils/sortOptions';

const useSorting = (entityType, initialSortBy = null, initialSortOrder = null) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get default sort values for the entity type
  const defaultSort = getDefaultSort(entityType);

  // Initialize state from URL params or defaults
  const [sortBy, setSortBy] = useState(() => {
    const urlSortBy = searchParams.get('sort_by');
    const urlSortOrder = searchParams.get('sort_order');

    let finalSortBy = initialSortBy || defaultSort.sortBy;
    let finalSortOrder = initialSortOrder || defaultSort.sortOrder;

    if (urlSortBy) {
      // Validate sort_by if provided
      const validation = validateSortParams(
        urlSortBy,
        urlSortOrder || defaultSort.sortOrder,
        entityType
      );
      if (validation.isValid) {
        finalSortBy = urlSortBy;
      }
    }

    if (urlSortOrder) {
      // Validate sort_order if provided
      const validation = validateSortParams(
        urlSortBy || defaultSort.sortBy,
        urlSortOrder,
        entityType
      );
      if (validation.isValid) {
        finalSortOrder = urlSortOrder;
      }
    }

    return { sortBy: finalSortBy, sortOrder: finalSortOrder };
  });

  // No longer need this ref since we removed URL sync effect

  // Update URL params when sorting changes
  const updateURLParams = useCallback(
    (newSortBy, newSortOrder) => {
      const newSearchParams = new URLSearchParams(searchParams);

      if (newSortBy && newSortBy !== defaultSort.sortBy) {
        newSearchParams.set('sort_by', newSortBy);
      } else {
        newSearchParams.delete('sort_by');
      }

      if (newSortOrder && newSortOrder !== defaultSort.sortOrder) {
        newSearchParams.set('sort_order', newSortOrder);
      } else {
        newSearchParams.delete('sort_order');
      }

      // Reset to page 1 when sorting changes
      newSearchParams.delete('page');

      setSearchParams(newSearchParams);
    },
    [searchParams, setSearchParams, defaultSort]
  );

  // Handle sort field change
  const handleSortFieldChange = useCallback(
    (newSortBy, newSortOrder = null) => {
      const sortOrder = newSortOrder || sortBy.sortOrder;

      // Validate the new sort parameters
      const validation = validateSortParams(newSortBy, sortOrder, entityType);
      if (!validation.isValid) {
        console.error('Invalid sort parameters:', validation.errors);
        return;
      }

      setSortBy({ sortBy: newSortBy, sortOrder });
      updateURLParams(newSortBy, sortOrder);
    },
    [sortBy.sortOrder, entityType, updateURLParams]
  );

  // Handle sort order change
  const handleSortOrderChange = useCallback(
    newSortOrder => {
      if (!sortBy.sortBy) return;

      // Validate the new sort order
      const validation = validateSortParams(sortBy.sortBy, newSortOrder, entityType);
      if (!validation.isValid) {
        console.error('Invalid sort order:', validation.errors.sortOrder);
        return;
      }

      setSortBy(prev => {
        const newState = { ...prev, sortOrder: newSortOrder };
        // Update URL with the new state immediately
        updateURLParams(prev.sortBy, newSortOrder);
        return newState;
      });
    },
    [sortBy.sortBy, entityType, updateURLParams]
  );

  // Handle sort change (both field and order) - now only for reset
  const handleSortChange = useCallback(
    (newSortBy, newSortOrder) => {
      setSortBy({ sortBy: newSortBy, sortOrder: newSortOrder });
      updateURLParams(newSortBy, newSortOrder);
    },
    [updateURLParams]
  );

  // Handle sort apply - called when user clicks Sort button
  const handleSortApply = useCallback(
    (newSortBy, newSortOrder) => {
      setSortBy({ sortBy: newSortBy, sortOrder: newSortOrder });
      updateURLParams(newSortBy, newSortOrder);
    },
    [updateURLParams]
  );

  // Reset to default sorting
  const resetSorting = useCallback(() => {
    setSortBy(defaultSort);
    updateURLParams(defaultSort.sortBy, defaultSort.sortOrder);
  }, [defaultSort, updateURLParams]);

  // Get current sort parameters for API calls
  const getSortParams = useCallback(() => {
    // Always return current sort parameters for API calls
    const params = {};

    if (sortBy.sortBy) {
      params.sort_by = sortBy.sortBy;
    }

    if (sortBy.sortOrder) {
      params.sort_order = sortBy.sortOrder;
    }

    return params;
  }, [sortBy]);

  // No longer need URL sync effect since we use Sort button approach
  // The URL is only updated when user explicitly applies sorting

  return {
    // Current sort state
    sortBy: sortBy.sortBy,
    sortOrder: sortBy.sortOrder,

    // Handlers
    handleSortChange,
    handleSortFieldChange,
    handleSortOrderChange,
    handleSortApply,
    resetSorting,

    // Utility functions
    getSortParams,

    // Validation
    validateSort: (sortBy, sortOrder) => validateSortParams(sortBy, sortOrder, entityType),
  };
};

export default useSorting;
