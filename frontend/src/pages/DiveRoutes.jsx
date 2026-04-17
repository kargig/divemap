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

import DesktopSearchBar from '../components/DesktopSearchBar';
import EmptyState from '../components/EmptyState';
import ErrorPage from '../components/ErrorPage';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import ResponsiveFilterBar from '../components/ResponsiveFilterBar';
import Pagination from '../components/ui/Pagination';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useResponsive } from '../hooks/useResponsive';
import useSorting from '../hooks/useSorting';
import { getDiveRoutes } from '../services/diveSites';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { MARKER_TYPES } from '../utils/markerTypes';
import { getRouteTypeLabel } from '../utils/routeUtils';
import { slugify } from '../utils/slugify';
import { renderTextWithLinks } from '../utils/textHelpers';

const DiveRoutes = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [routeType, setRouteType] = useState(searchParams.get('route_type') || '');
  const [poiTypes, setPoiTypes] = useState(searchParams.getAll('poi_types') || []);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('page_size') || '20', 10));

  // Sorting
  const { sortBy, sortOrder, handleSortChange, resetSorting } = useSorting('dive-routes');

  const { isMobile } = useResponsive();
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
    ['dive-routes', search, routeType, poiTypes, page, pageSize, sortBy, sortOrder],
    () =>
      getDiveRoutes({
        search,
        route_type: routeType,
        poi_types: poiTypes,
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
    const urlParams = new URLSearchParams();
    if (search) urlParams.append('search', search);
    if (routeType) urlParams.append('route_type', routeType);
    if (poiTypes.length > 0) {
      poiTypes.forEach(t => urlParams.append('poi_types', t));
    }
    if (page > 1) urlParams.append('page', page);
    if (pageSize !== 20) urlParams.append('page_size', pageSize);
    if (sortBy) urlParams.append('sort_by', sortBy);
    if (sortOrder) urlParams.append('sort_order', sortOrder);
    if (viewMode !== 'list') urlParams.append('view', viewMode);

    setSearchParams(urlParams, { replace: true });
  }, [search, routeType, poiTypes, page, pageSize, sortBy, sortOrder, viewMode, setSearchParams]);

  const handleSearchChange = value => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = type => {
    setRouteType(type === routeType ? '' : type);
    setPage(1);
  };

  const handlePoiTypeToggle = type => {
    setPoiTypes(prev => (prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]));
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setRouteType('');
    setPoiTypes([]);
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

  const getActiveFiltersCount = () => {
    let count = 0;
    if (search) count++;
    if (routeType) count++;
    if (poiTypes.length > 0) count++;
    return count;
  };

  const routes = routesData?.routes || [];
  const totalPages = routesData?.pages || 1;
  const totalCount = routesData?.total || 0;

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        <PageHeader
          title='Dive Routes'
          titleIcon={Route}
          breadcrumbItems={[{ label: 'Dive Routes' }]}
        />

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
            activeFiltersCount={getActiveFiltersCount()}
            filters={{}} // No complex filters yet besides quick ones
            onFilterChange={() => {}}
            onQuickFilter={handleQuickFilter}
            quickFilters={routeType ? [routeType] : []}
            variant='inline'
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
          <div className='flex flex-wrap items-center gap-1.5 sm:gap-2 mt-4 px-1'>
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 mr-1 sm:mr-2 flex items-center gap-1 uppercase tracking-wider'>
              <Filter className='w-3 h-3 sm:w-4 sm:h-4' /> Filter:
            </span>
            <button
              onClick={() => handleTypeChange('scuba')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'scuba'
                  ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              Scuba
            </button>
            <button
              onClick={() => handleTypeChange('swim')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'swim'
                  ? 'bg-cyan-100 text-cyan-700 border-cyan-200 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-cyan-300'
              }`}
            >
              Swim / Snorkel
            </button>
            <button
              onClick={() => handleTypeChange('walk')}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors border ${
                routeType === 'walk'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
              }`}
            >
              Walk
            </button>
          </div>

          {/* POI Feature Filter Pills */}
          <div className='flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 px-1'>
            <span className='text-[11px] sm:text-sm font-bold text-gray-500 mr-1 sm:mr-2 flex items-center gap-1 uppercase tracking-wider'>
              <MapPin className='w-3 h-3 sm:w-4 sm:h-4' /> Features:
            </span>
            {Object.values(MARKER_TYPES)
              .filter(t => t.id !== 'generic')
              .map(poi => {
                const Icon = poi.icon;
                const isSelected = poiTypes.includes(poi.id);
                return (
                  <button
                    key={poi.id}
                    onClick={() => handlePoiTypeToggle(poi.id)}
                    className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors border ${
                      isSelected
                        ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Icon
                      className='w-2.5 h-2.5 sm:w-3 h-3'
                      style={{ color: isSelected ? 'white' : poi.color }}
                    />
                    {poi.name}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Top Pagination Controls */}
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalCount={totalCount}
          itemName='routes'
          onPageChange={newPage => setPage(newPage)}
          onPageSizeChange={handlePageSizeChange}
          className='mb-4 sm:mb-6 lg:mb-8'
        />

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
                  className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(0,114,178)] hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col ${compactLayout ? 'p-2 sm:p-4' : 'p-3 sm:p-6'}`}
                >
                  {/* Header: Title & Type */}
                  <div className='mb-2'>
                    <div className='flex items-start justify-between gap-2 sm:gap-3'>
                      <h3
                        className={`font-bold text-gray-900 leading-snug ${compactLayout ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}
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
                        className={`flex-shrink-0 px-1.5 py-0 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border ${
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
                  <div className='mb-2 sm:mb-4 flex flex-col gap-1 sm:gap-1.5'>
                    {route.dive_site && (
                      <div className='flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium text-gray-600'>
                        <MapPin className='w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600 flex-shrink-0' />
                        <span className='text-gray-500 leading-tight mt-0.5 sm:mt-1'>at</span>
                        <Link
                          to={`/dive-sites/${route.dive_site_id}`}
                          className='text-blue-600 hover:text-blue-800 hover:underline flex items-center'
                        >
                          <span className='leading-tight mt-0.5 sm:mt-1'>
                            {route.dive_site.name}
                          </span>
                        </Link>
                      </div>
                    )}

                    <div className='text-[11px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5'>
                      <User className='w-3 h-3 sm:w-3.5 sm:h-3.5' />
                      <span>{route.creator?.username || route.owner?.username || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Body: Description (Hidden in List Compact Mode if desired, but good to keep) */}
                  {route.description && (
                    <div
                      className={`text-gray-500 leading-relaxed line-clamp-2 mb-2 sm:mb-4 ${compactLayout ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-sm'}`}
                    >
                      {renderTextWithLinks(decodeHtmlEntities(route.description))}
                    </div>
                  )}

                  {/* Stats Strip & Actions */}
                  <div
                    className={`flex items-center justify-between py-2 sm:py-3 border-y border-gray-50 mt-auto ${compactLayout ? 'py-1.5 sm:py-2' : 'py-2 sm:py-3'}`}
                  >
                    <div className='flex flex-col'>
                      <span className='text-[9px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0 sm:mb-0.5'>
                        Created
                      </span>
                      <div className='flex items-center gap-1 sm:gap-1.5'>
                        <Calendar className='w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400' />
                        <span
                          className={`font-semibold text-gray-700 ${compactLayout ? 'text-[10px] sm:text-[11px]' : 'text-xs sm:text-sm'}`}
                        >
                          {new Date(route.created_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/dive-sites/${route.dive_site_id}/route/${route.id}/${slugify(route.name)}`}
                      className='w-8 h-8 inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group'
                      title='View Route Details'
                    >
                      <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Pagination */}
        {totalCount > 0 && (
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            totalCount={totalCount}
            itemName='routes'
            onPageChange={newPage => setPage(newPage)}
            onPageSizeChange={handlePageSizeChange}
            className='mt-6 sm:mt-8'
          />
        )}
      </div>
    </div>
  );
};

export default DiveRoutes;
