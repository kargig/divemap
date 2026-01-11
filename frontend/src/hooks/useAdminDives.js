import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';

import api from '../api';

export const useAdminDives = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({
    pageIndex: parseInt(searchParams.get('page')) - 1 || 0,
    pageSize: parseInt(searchParams.get('page_size')) || 50,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [diveSiteSearchTerm, setDiveSiteSearchTerm] = useState('');
  const [diveSiteSearchResults, setDiveSiteSearchResults] = useState([]);
  const [isDiveSiteLoading, setIsDiveSiteLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    user_id: '',
    dive_site_ids: [],
    difficulty_code: '',
    suit_type: '',
    min_depth: '',
    max_depth: '',
    min_visibility: '',
    max_visibility: '',
    min_rating: '',
    max_rating: '',
    start_date: '',
    end_date: '',
  });

  // Update URL helper
  const updateURL = useCallback(
    newPagination => {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('page', (newPagination.pageIndex + 1).toString());
      newSearchParams.set('page_size', newPagination.pageSize.toString());
      setSearchParams(newSearchParams);
    },
    [searchParams, setSearchParams]
  );

  // Map sorting fields
  const mapColumnIdToSortField = columnId => {
    const fieldMapping = {
      id: 'id',
      dive: 'name',
      name: 'name',
      user: 'user_username',
      user_username: 'user_username',
      dive_site: 'dive_site_name',
      'dive_site.name': 'dive_site_name',
      date: 'dive_date',
      dive_date: 'dive_date',
      max_depth: 'max_depth',
      duration: 'duration',
      rating: 'user_rating',
      user_rating: 'user_rating',
      visibility_rating: 'visibility_rating',
      views: 'view_count',
      view_count: 'view_count',
      created_at: 'created_at',
      updated_at: 'updated_at',
    };
    return fieldMapping[columnId] || null;
  };

  const getSortParams = () => {
    if (sorting.length === 0) return {};
    const sort = sorting[0];
    const sortField = mapColumnIdToSortField(sort.id);
    if (!sortField) return {};
    return {
      sort_by: sortField,
      sort_order: sort.desc ? 'desc' : 'asc',
    };
  };

  // Queries
  const { data: totalCount } = useQuery(
    ['admin-dives-count', filters],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'dive_site_ids') {
          if (value && value.length > 0) {
            params.append('dive_site_ids', value.join(','));
          }
        } else if (value) {
          params.append(key, value);
        }
      });
      return api.get(`/api/v1/dives/admin/dives/count?${params.toString()}`);
    },
    {
      select: response => response.data.total,
    }
  );

  const { data: dives, isLoading } = useQuery(
    ['admin-dives', filters, pagination, sorting],
    () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'dive_site_ids') {
          if (value && value.length > 0) {
            params.append('dive_site_ids', value.join(','));
          }
        } else if (value) {
          params.append(key, value);
        }
      });

      const sortParams = getSortParams();
      if (sortParams.sort_by) {
        params.append('sort_by', sortParams.sort_by);
        params.append('sort_order', sortParams.sort_order);
      }
      params.append('limit', pagination.pageSize.toString());
      params.append('offset', (pagination.pageIndex * pagination.pageSize).toString());
      return api.get(`/api/v1/dives/admin/dives?${params.toString()}`);
    },
    {
      select: response => response.data,
      keepPreviousData: true,
    }
  );

  const { data: users } = useQuery(['admin-users'], () => api.get('/api/v1/users/admin/users'), {
    select: response => response.data,
  });

  // Search Logic
  const debouncedSearch = useMemo(
    () =>
      (() => {
        let timeoutId;
        return searchValue => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchValue }));
            setPagination(prev => {
              const newPagination = { ...prev, pageIndex: 0 };
              updateURL(newPagination);
              return newPagination;
            });
          }, 500);
        };
      })(),
    [updateURL]
  );

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (diveSiteSearchTerm.trim().length >= 2) {
        setIsDiveSiteLoading(true);
        try {
          const response = await api.get('/api/v1/dive-sites/', {
            params: { search: diveSiteSearchTerm, limit: 20 },
          });
          setDiveSiteSearchResults(response.data);
        } catch (error) {
          console.error('Failed to search dive sites:', error);
        } finally {
          setIsDiveSiteLoading(false);
        }
      } else if (diveSiteSearchTerm.length === 0 && filters.dive_site_ids.length === 0) {
        setDiveSiteSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [diveSiteSearchTerm, filters.dive_site_ids.length]);

  // Mutations
  const deleteDiveMutation = useMutation(id => api.delete(`/api/v1/dives/admin/dives/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-dives']);
      toast.success('Dive deleted successfully!');
    },
    onError: () => {
      toast.error('Failed to delete dive');
    },
  });

  const massDeleteMutation = useMutation(
    ids => Promise.all(ids.map(id => api.delete(`/api/v1/dives/admin/dives/${id}`))),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-dives']);
        toast.success('Selected dives deleted successfully!');
        setRowSelection({});
      },
      onError: () => {
        toast.error('Failed to delete some dives');
      },
    }
  );

  // Handlers
  const handleMassDelete = () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) {
      toast.error('Please select dives to delete');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} dive(s)?`)) {
      massDeleteMutation.mutate(selectedIds.map(id => parseInt(id)));
    }
  };

  const handleEditDive = dive => {
    navigate(`/dives/${dive.id}/edit`);
  };

  const handleDeleteDive = dive => {
    if (window.confirm(`Are you sure you want to delete dive "${dive.name}"?`)) {
      deleteDiveMutation.mutate(dive.id);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => {
      const newPagination = { ...prev, pageIndex: 0 };
      updateURL(newPagination);
      return newPagination;
    });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      user_id: '',
      dive_site_ids: [],
      difficulty_code: '',
      suit_type: '',
      min_depth: '',
      max_depth: '',
      min_visibility: '',
      max_visibility: '',
      min_rating: '',
      max_rating: '',
      start_date: '',
      end_date: '',
    });
    setSearchInput('');
    setDiveSiteSearchTerm('');
    setDiveSiteSearchResults([]);
    setPagination(prev => {
      const newPagination = { ...prev, pageIndex: 0 };
      updateURL(newPagination);
      return newPagination;
    });
  };

  return {
    // State
    sorting,
    setSorting,
    pagination,
    setPagination,
    rowSelection,
    setRowSelection,
    searchInput,
    setSearchInput,
    diveSiteSearchTerm,
    setDiveSiteSearchTerm,
    diveSiteSearchResults,
    isDiveSiteLoading,
    filters,

    // Data
    dives,
    isLoading,
    totalCount,
    users,

    // Handlers
    handleMassDelete,
    handleEditDive,
    handleDeleteDive,
    handleFilterChange,
    clearFilters,
    debouncedSearch,

    // Loading states
    isDeleting: deleteDiveMutation.isLoading,
    isMassDeleting: massDeleteMutation.isLoading,
    setFilters,
  };
};
