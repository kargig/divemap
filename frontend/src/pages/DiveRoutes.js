import {
  Route,
  MapPin,
  Calendar,
  User,
  Clock,
  Navigation,
  Activity,
  Layers,
  ChevronRight,
  ChevronLeft,
  Filter,
  Grid,
  List,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getDiveRoutes } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import DesktopSearchBar from '../components/DesktopSearchBar';
import EmptyState from '../components/EmptyState';
import ErrorPage from '../components/ErrorPage';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useResponsive, useResponsiveScroll } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { getRouteTypeLabel } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';

const DiveRoutes = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [routeType, setRouteType] = useState(searchParams.get('route_type') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '20', 10));

  // Sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting } = useSorting('dive-routes');

  const { isMobile } = useResponsive();
  const { searchBarVisible } = useResponsiveScroll();
  const { compactLayout, handleDisplayOptionChange } = useCompactLayout();

  // View mode state
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'list';
  });

  const [showFilters, setShowFilters] = useState(false);
  const [quickFilters, setQuickFilters] = useState([]);

  // Fetch Routes
  const {
    data: routesData,
    isLoading,
    error,
  } = useQuery(
    ['dive-routes', search, routeType, page, pageSize, sortBy, sortOrder],
    () =>
      getDiveRoutes({
        search,
        route_type: routeType,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Update URL params
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (routeType) params.route_type = routeType;
    if (page > 1) params.page = page;
    if (pageSize !== 20) params.page_size = pageSize;
    if (sortBy) params.sort_by = sortBy;
    if (sortOrder) params.sort_order = sortOrder;
    if (viewMode !== 'list') params.view = viewMode;
    setSearchParams(params, { replace: true });
  }, [search, routeType, page, pageSize, sortBy, sortOrder, viewMode, setSearchParams]);

  const handleSearchChange = value => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = type => {
    setRouteType(type === routeType ? '' : type);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setRouteType('');
    setPage(1);
    resetSorting();
  };

  const handlePageSizeChange = newPageSize => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const handleViewModeChange = newMode => {
    setViewMode(newMode);
  };

  const handleQuickFilter = filterType => {
    if (filterType === 'scuba' || filterType === 'swim' || filterType === 'walk') {
      handleTypeChange(filterType);
    }
  };

  const routes = routesData?.routes || [];
  const totalPages = routesData?.pages || 1;
  const totalCount = routesData?.total || 0;

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dive Routes' }]} />

        {/* Page Header */}
        <PageHeader title='Dive Routes' actions={[]} />

        {/* Responsive Filter Bar */}
        <div className='mb-8'>
          {!isMobile && (
            <DesktopSearchBar
              searchValue={search}
              onSearchChange={handleSearchChange}
              onSearchSelect={selectedItem => {
                handleSearchChange(selectedItem.name);
              }}
              data={routes || []}
              configType='diveRoutes'
              placeholder='Search routes by name or description...'
              className='w-full mb-4'
            />
          )}

          <ResponsiveFilterBar
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onClearFilters={clearFilters}
            activeFiltersCount={routeType ? 1 : 0}
            filters={{}} // No complex filters yet besides quick ones
            onFilterChange={() => {}}
            onQuickFilter={handleQuickFilter}
            quickFilters={routeType ? [routeType] : []}
            variant='sticky'
            showQuickFilters={false} // We handle custom quick filters below or repurpose
            showAdvancedToggle={false}
            searchQuery={search}
            onSearchChange={handleSearchChange}
            onSearchSubmit={() => {}}
            sortBy={sortBy}
            sortOrder={sortOrder}
            sortOptions={[
              { value: 'created_at', label: 'Date Created', defaultOrder: 'desc' },
              { value: 'name', label: 'Name', defaultOrder: 'asc' },
            ]}
            onSortChange={handleSortChange}
            onReset={resetSorting}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            compactLayout={compactLayout}
            onDisplayOptionChange={handleDisplayOptionChange}
            pageType='dive-routes'
          />

          {/* Custom Route Type Filter Pills (acting as Quick Filters) */}
          <div className='flex flex-wrap items-center gap-2 mt-4 px-1'>
            <span className='text-sm font-medium text-gray-500 mr-2 flex items-center gap-1'>
              <Filter className='w-4 h-4' /> Filter:
            </span>
            <button
              onClick={() => handleTypeChange('scuba')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'scuba'
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              Scuba
            </button>
            <button
              onClick={() => handleTypeChange('swim')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'swim'
                  ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-300'
              }`}
            >
              Swim / Snorkel
            </button>
            <button
              onClick={() => handleTypeChange('walk')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'walk'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
              }`}
            >
              Walk
            </button>
          </div>
        </div>

        {/* Top Pagination Controls */}
        <div className='mb-6 sm:mb-8'>
          <div className='bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
              <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full justify-between'>
                {/* Page Size Selection */}
                <div className='flex items-center gap-2'>
                  <label htmlFor='page-size-top' className='text-sm font-medium text-gray-700'>
                    Show:
                  </label>
                  <select
                    id='page-size-top'
                    value={pageSize}
                    onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className='text-sm text-gray-600'>per page</span>
                </div>

                {/* Pagination Info */}
                <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                  Showing {Math.max(1, (page - 1) * pageSize + 1)} to{' '}
                  {Math.min(page * pageSize, totalCount)} of {totalCount} routes
                </div>

                {/* Pagination Navigation */}
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </button>

                  <span className='text-xs sm:text-sm text-gray-700'>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <LoadingSkeleton type='card' count={6} compact={compactLayout} />
        ) : error ? (
          <ErrorPage error={error} />
        ) : routes.length === 0 ? (
          <EmptyState
            title='No routes found'
            message='We couldn’t find any dive routes matching your search.'
            onClearFilters={clearFilters}
          />
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
                : 'flex flex-col gap-4'
            }
          >
            {routes.map(route => {
              const detectedType = getRouteTypeLabel(route.route_type, null, route.route_data);

              return (
                <div
                  key={route.id}
                  className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col ${compactLayout ? 'p-4' : 'p-6'}`}
                >
                  {/* Header: Title & Type */}
                  <div className='mb-2'>
                    <div className='flex items-start justify-between gap-3'>
                      <h3
                        className={`font-bold text-gray-900 leading-snug ${compactLayout ? 'text-base' : 'text-lg'}`}
                      >
                        <Link
                          to={`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`}
                          className='hover:text-blue-600 transition-colors'
                        >
                          {decodeHtmlEntities(route.name)}
                        </Link>
                      </h3>
                      {/* Route Type Badge */}
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          detectedType === 'scuba'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : detectedType === 'swim' || detectedType === 'free_swim'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-100'
                              : detectedType === 'mixed'
                                ? 'bg-purple-50 text-purple-700 border-purple-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        {detectedType.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Meta Info: Site & Creator */}
                  <div className='mb-4 flex flex-col gap-1.5'>
                    {route.dive_site && (
                      <div className='flex items-center gap-1.5 text-xs font-medium text-gray-600'>
                        <MapPin className='w-3.5 h-3.5 text-blue-600 flex-shrink-0' />
                        <span className='text-gray-500 leading-tight mt-1'>at</span>
                        <Link
                          to={`/dive-sites/${route.dive_site_id}`}
                          className='text-blue-600 hover:text-blue-800 hover:underline flex items-center'
                        >
                          <span className='leading-tight mt-1'>{route.dive_site.name}</span>
                        </Link>
                      </div>
                    )}

                    <div className='text-xs text-gray-500 flex items-center gap-1.5'>
                      <User className='w-3.5 h-3.5' />
                      <span>{route.creator?.username || route.owner?.username || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Body: Description (Hidden in List Compact Mode if desired, but good to keep) */}
                  {route.description && (
                    <div
                      className={`text-gray-500 leading-relaxed line-clamp-2 mb-4 ${compactLayout ? 'text-xs' : 'text-sm'}`}
                    >
                      {renderTextWithLinks(decodeHtmlEntities(route.description))}
                    </div>
                  )}

                  {/* Stats Strip */}
                  <div
                    className={`flex items-center gap-6 py-3 border-y border-gray-50 mb-4 mt-auto ${compactLayout ? 'py-2' : 'py-3'}`}
                  >
                    <div className='flex flex-col'>
                      <span className='text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5'>
                        Created
                      </span>
                      <div className='flex items-center gap-1.5'>
                        <Calendar className='w-3.5 h-3.5 text-gray-400' />
                        <span
                          className={`font-semibold text-gray-700 ${compactLayout ? 'text-[11px]' : 'text-sm'}`}
                        >
                          {new Date(route.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer: Creator & Actions */}
                  <div className='flex items-center justify-end'>
                    <Link
                      to={`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`}
                      className='inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors group'
                    >
                      View Route
                      <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5' />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Pagination */}
        {totalCount > 0 && (
          <div className='mt-8 bg-white rounded-lg shadow-md p-4 sm:p-6'>
            <div className='flex flex-col lg:flex-row justify-between items-center gap-4'>
              <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full justify-between'>
                {/* Page Size Selection */}
                <div className='flex items-center gap-2'>
                  <label htmlFor='page-size-bottom' className='text-sm font-medium text-gray-700'>
                    Show:
                  </label>
                  <select
                    id='page-size-bottom'
                    value={pageSize}
                    onChange={e => handlePageSizeChange(parseInt(e.target.value))}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className='text-sm text-gray-600'>per page</span>
                </div>

                {/* Pagination Info */}
                <div className='text-xs sm:text-sm text-gray-600 text-center sm:text-left'>
                  Showing {Math.max(1, (page - 1) * pageSize + 1)} to{' '}
                  {Math.min(page * pageSize, totalCount)} of {totalCount} routes
                </div>

                {/* Pagination Navigation */}
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </button>
                  <span className='px-4 py-2 text-sm font-medium text-gray-600 flex items-center'>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className='px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiveRoutes;
