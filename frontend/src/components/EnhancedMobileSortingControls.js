import {
  ChevronDown,
  RotateCcw,
  SortAsc,
  SortDesc,
  Filter,
  Settings,
  Plus,
  Search,
  Grid,
  List,
  Map,
  Calendar,
  TrendingUp,
  Clock,
  Target,
  DollarSign,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const EnhancedMobileSortingControls = ({
  sortBy,
  sortOrder,
  sortOptions,
  onSortChange,
  onSortApply,
  onReset,
  className = '',
  entityType = '',
  showFilters = false,
  onToggleFilters = () => {},
  viewMode = 'list',
  onViewModeChange = () => {},
  showQuickActions = true,
  showFAB = true,
  showTabs = true,
  showThumbnails = false,
  compactLayout = false,
  onDisplayOptionChange = () => {},
}) => {
  const [pendingSortBy, setPendingSortBy] = useState(sortBy);
  const [pendingSortOrder, setPendingSortOrder] = useState(sortOrder);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('sort');
  const [showGestureHint, setShowGestureHint] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update pending values when props change
  useEffect(() => {
    setPendingSortBy(sortBy);
    setPendingSortOrder(sortOrder);
  }, [sortBy, sortOrder]);

  // Show gesture hint on first mobile visit
  useEffect(() => {
    if (isMobile && !localStorage.getItem('mobileSortingHintShown')) {
      setTimeout(() => {
        setShowGestureHint(true);
        setTimeout(() => setShowGestureHint(false), 3000);
        localStorage.setItem('mobileSortingHintShown', 'true');
      }, 1000);
    }
  }, [isMobile]);

  // Mobile version - enhanced sorting controls
  const handleSortFieldChange = newSortBy => {
    const option = sortOptions.find(opt => opt.value === newSortBy);
    const newSortOrder = option?.defaultOrder || pendingSortOrder;
    setPendingSortBy(newSortBy);
    setPendingSortOrder(newSortOrder);
  };

  const handleSortOrderToggle = () => {
    const newSortOrder = pendingSortOrder === 'asc' ? 'desc' : 'asc';
    setPendingSortOrder(newSortOrder);
  };

  const handleReset = () => {
    const firstOption = sortOptions[0];
    if (firstOption) {
      const defaultSortBy = firstOption.value;
      const defaultSortOrder = firstOption.defaultOrder || 'asc';
      setPendingSortBy(defaultSortBy);
      setPendingSortOrder(defaultSortOrder);
      onReset();
    }
  };

  const handleApplySort = () => {
    onSortApply(pendingSortBy, pendingSortOrder);
    setIsExpanded(false);
  };

  const handleViewModeChange = newViewMode => {
    onViewModeChange(newViewMode);
  };

  const handleDisplayOptionChange = option => {
    // This will be handled by the parent component
    // For now, we'll just log the change
    console.log('Display option changed:', option);
  };

  // Get current sort option for display
  const currentSortOption = sortOptions.find(opt => opt.value === sortBy);
  const currentSortLabel = currentSortOption ? currentSortOption.label : 'Default';

  // Get display text for sort order
  const getSortOrderText = order => {
    return order === 'asc' ? 'Ascending' : 'Descending';
  };

  // Quick action buttons
  const quickActions = [
    {
      id: 'filters',
      label: 'Filters',
      icon: <Filter className='w-4 h-4' />,
      action: onToggleFilters,
      active: showFilters,
    },
    {
      id: 'view',
      label: 'View',
      icon: viewMode === 'list' ? <List className='w-4 h-4' /> : <Grid className='w-4 h-4' />,
      action: () => onViewModeChange(viewMode === 'list' ? 'grid' : 'list'),
    },
    {
      id: 'map',
      label: 'Map',
      icon: <Map className='w-4 h-4' />,
      action: () => onViewModeChange('map'),
      active: viewMode === 'map',
    },
  ];

  return (
    <>
      {/* Desktop Version - Horizontal, Compact Layout */}
      {!isMobile && (
        <div className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900'>Sorting & View Controls</h3>
            {showFilters && (
              <button
                onClick={onToggleFilters}
                className='inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors'
              >
                <Filter className='w-4 h-4' />
                Filters
              </button>
            )}
          </div>

          {/* Desktop Controls Grid */}
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
            {/* Sort Field Selection */}
            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700'>Sort By</label>
              <select
                value={pendingSortBy}
                onChange={e => handleSortFieldChange(e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700'>Order</label>
              <button
                onClick={handleSortOrderToggle}
                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 transition-colors flex items-center justify-between'
              >
                <span>{getSortOrderText(pendingSortOrder)}</span>
                {pendingSortOrder === 'asc' ? (
                  <SortAsc className='w-4 h-4 text-gray-600' />
                ) : (
                  <SortDesc className='w-4 h-4 text-gray-600' />
                )}
              </button>
            </div>

            {/* View Mode Selection */}
            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700'>View Mode</label>
              <div className='flex gap-1'>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <List className='w-3 h-3 inline mr-1' />
                  List
                </button>
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Grid className='w-3 h-3 inline mr-1' />
                  Grid
                </button>
                <button
                  onClick={() => handleViewModeChange('map')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Map className='w-3 h-3 inline mr-1' />
                  Map
                </button>
              </div>
            </div>

            {/* Display Options & Actions */}
            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700'>Options</label>
              <div className='flex gap-2'>
                <button
                  onClick={() => onDisplayOptionChange('thumbnails')}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    showThumbnails
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Thumbnails
                </button>
                <button
                  onClick={() => onDisplayOptionChange('compact')}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    compactLayout
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className='flex gap-3 mt-4 pt-4 border-t border-gray-200'>
            <button
              onClick={handleApplySort}
              className='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors'
            >
              Apply Sort
            </button>
            <button
              onClick={handleReset}
              className='px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2'
            >
              <RotateCcw className='w-4 h-4' />
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Mobile Version - Vertical, Tabbed Interface */}
      {isMobile && (
        <>
          {/* Sticky Header for Mobile */}
          <div className='mobile-sticky-header'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-bold text-white'>
                {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
              </h2>
              <div className='flex items-center gap-2'>
                {showFilters && (
                  <button
                    onClick={onToggleFilters}
                    className='p-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500'
                    aria-label='Toggle filters'
                  >
                    <Filter className='w-4 h-4' />
                  </button>
                )}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className='p-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500'
                  aria-label='Toggle sorting controls'
                >
                  <Settings className='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Controls Container - Only show when expanded */}
          {isExpanded && (
            <>
              {/* Tabbed Interface */}
              {showTabs && (
                <div className='mobile-tabs'>
                  <button
                    className={`mobile-tab ${activeTab === 'sort' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sort')}
                  >
                    Sorting Options
                  </button>
                  <button
                    className={`mobile-tab ${activeTab === 'view' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view')}
                  >
                    View Options
                  </button>
                  <button
                    className={`mobile-tab ${activeTab === 'actions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('actions')}
                  >
                    Quick Actions
                  </button>
                </div>
              )}

              <div className='mobile-controls-container'>
                <div className='mobile-controls-header'>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    {activeTab === 'sort'
                      ? 'Sorting Options'
                      : activeTab === 'view'
                        ? 'View Options'
                        : 'Quick Actions'}
                  </h3>
                </div>
                <div className='mobile-controls-content'>
                  {activeTab === 'sort' && (
                    <div className='space-y-4'>
                      <h4 className='text-sm font-medium text-gray-700'>Sort Field</h4>
                      <div className='space-y-2'>
                        {sortOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleSortFieldChange(option.value)}
                            className={`enhanced-sort-option ${
                              pendingSortBy === option.value ? 'active' : ''
                            }`}
                          >
                            <div className='flex items-center gap-3'>
                              {option.icon || <TrendingUp className='w-5 h-5' />}
                              <div className='flex-1 text-left'>
                                <span className='font-medium'>{option.label}</span>
                                <p className='text-xs text-gray-500'>
                                  {option.defaultOrder === 'asc' ? 'Low to High' : 'High to Low'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <h4 className='text-sm font-medium text-gray-700'>Sort Order</h4>
                      <button
                        onClick={handleSortOrderToggle}
                        className='w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 transition-colors'
                      >
                        <div className='flex items-center justify-between'>
                          <span className='text-sm font-medium text-gray-900'>
                            {getSortOrderText(pendingSortOrder)}
                          </span>
                          {pendingSortOrder === 'asc' ? (
                            <SortAsc className='w-5 h-5 text-gray-600' />
                          ) : (
                            <SortDesc className='w-5 h-5 text-gray-600' />
                          )}
                        </div>
                      </button>

                      <div className='flex gap-3 pt-4'>
                        <button
                          onClick={handleApplySort}
                          className='flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors'
                        >
                          Apply Sort
                        </button>
                        <button
                          onClick={handleReset}
                          className='flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors'
                        >
                          <RotateCcw className='w-4 h-4 inline mr-2' />
                          Reset
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'view' && (
                    <div className='space-y-4'>
                      <h4 className='text-sm font-medium text-gray-700'>View Mode</h4>
                      <div className='space-y-3'>
                        <button
                          onClick={() => handleViewModeChange('list')}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            viewMode === 'list'
                              ? 'bg-blue-50 border-blue-200 text-blue-900'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className='flex items-center gap-3'>
                            <List className='w-5 h-5' />
                            <div>
                              <span className='text-sm font-medium'>List View</span>
                              <p className='text-xs text-gray-500'>Traditional list layout</p>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => handleViewModeChange('grid')}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            viewMode === 'grid'
                              ? 'bg-blue-50 border-blue-200 text-blue-900'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className='flex items-center gap-3'>
                            <Grid className='w-5 h-5' />
                            <div>
                              <span className='text-sm font-medium'>Grid View</span>
                              <p className='text-xs text-gray-500'>Card-based grid layout</p>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => handleViewModeChange('map')}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            viewMode === 'map'
                              ? 'bg-blue-50 border-blue-200 text-blue-900'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className='flex items-center gap-3'>
                            <Map className='w-5 h-5' />
                            <div>
                              <span className='text-sm font-medium'>Map View</span>
                              <p className='text-xs text-gray-500'>Geographic visualization</p>
                            </div>
                          </div>
                        </button>
                      </div>

                      <h4 className='text-sm font-medium text-gray-700'>Display Options</h4>
                      <div className='space-y-3'>
                        <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                          <input
                            type='checkbox'
                            className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                            checked={showThumbnails}
                            onChange={() => onDisplayOptionChange('thumbnails')}
                          />
                          <span className='text-sm text-gray-700'>Show thumbnails</span>
                        </label>

                        <label className='flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'>
                          <input
                            type='checkbox'
                            className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                            checked={compactLayout}
                            onChange={() => onDisplayOptionChange('compact')}
                          />
                          <span className='text-sm text-gray-700'>Compact layout</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTab === 'actions' && (
                    <div className='space-y-4'>
                      <h4 className='text-sm font-medium text-gray-700'>Quick Actions</h4>

                      {/* Quick Actions Bar */}
                      <div className='mobile-quick-actions'>
                        {quickActions.map(action => (
                          <button
                            key={action.id}
                            onClick={action.action}
                            className={`quick-action-btn ${action.active ? 'active' : ''}`}
                          >
                            {action.icon}
                            <span className='ml-2'>{action.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Additional Actions */}
                      <div className='space-y-3'>
                        <button className='w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 transition-colors'>
                          <div className='flex items-center gap-3'>
                            <Plus className='w-5 h-5 text-gray-600' />
                            <div>
                              <span className='text-sm font-medium text-gray-900'>
                                Add New {entityType.replace('-', ' ').slice(0, -1)}
                              </span>
                              <p className='text-xs text-gray-500'>Create a new entry</p>
                            </div>
                          </div>
                        </button>

                        {showFilters && (
                          <button
                            className='w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-left hover:bg-gray-100 transition-colors'
                            onClick={() => {
                              onToggleFilters();
                              setIsExpanded(false);
                            }}
                          >
                            <div className='flex items-center gap-3'>
                              <Search className='w-5 h-5 text-gray-600' />
                              <div>
                                <span className='text-sm font-medium text-gray-900'>
                                  Advanced Search
                                </span>
                                <p className='text-xs text-gray-500'>Use advanced filters</p>
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Floating Action Button */}
          {showFAB && (
            <button
              className='mobile-fab'
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label='Quick access to sorting controls'
            >
              <Settings className='fab-icon' />
            </button>
          )}

          {/* Gesture Hint */}
          {showGestureHint && (
            <div className='mobile-gesture-hint show'>👆 Tap to expand sorting options</div>
          )}
        </>
      )}
    </>
  );
};

EnhancedMobileSortingControls.propTypes = {
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.oneOf(['asc', 'desc']).isRequired,
  sortOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      defaultOrder: PropTypes.oneOf(['asc', 'desc']),
      adminOnly: PropTypes.bool,
    })
  ).isRequired,
  onSortChange: PropTypes.func.isRequired,
  onSortApply: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  className: PropTypes.string,
  entityType: PropTypes.string,
  showFilters: PropTypes.bool,
  onToggleFilters: PropTypes.func,
  viewMode: PropTypes.oneOf(['list', 'grid', 'map']),
  onViewModeChange: PropTypes.func,
  showQuickActions: PropTypes.bool,
  showFAB: PropTypes.bool,
  showTabs: PropTypes.bool,
  showThumbnails: PropTypes.bool,
  compactLayout: PropTypes.bool,
  onDisplayOptionChange: PropTypes.func,
};

export default EnhancedMobileSortingControls;
