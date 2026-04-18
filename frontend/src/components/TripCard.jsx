import {
  Calendar,
  Clock,
  Euro,
  Users,
  TrendingUp,
  MapPin,
  Building,
  Edit,
  X,
  ChevronRight,
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

import { formatCost } from '../utils/currency';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
import { getStatusColorClasses, getDisplayStatus } from '../utils/tripHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

/**
 * Reusable Trip Card component for both list and grid views.
 * Handles mobile-first responsive layout and management actions.
 */
const TripCard = ({
  trip,
  user,
  shouldShowManage = false,
  onEdit = null,
  onDelete = null,
  diveSites = [],
  additionalDiveSites = [],
  compactLayout = false,
  viewMode = 'list',
}) => {
  // Helper function to get dive site details
  const getDiveSite = diveSiteId => {
    if (!diveSiteId) return null;
    return (
      diveSites.find(site => site.id === diveSiteId) ||
      additionalDiveSites.find(site => site.id === diveSiteId) ||
      null
    );
  };

  // Helper function to get dive site rating
  const getDiveSiteRating = (diveSiteId, averageRating) => {
    if (averageRating !== undefined && averageRating !== null) {
      return averageRating;
    }
    const diveSite = getDiveSite(diveSiteId);
    return diveSite?.average_rating || null;
  };

  // Helper to render the site name link/span
  const renderSiteName = (diveSiteId, diveSiteName) => {
    if (diveSiteId) {
      return (
        <Link
          to={`/dive-sites/${diveSiteId}/${slugify(diveSiteName)}`}
          state={{ from: window.location.pathname + window.location.search }}
          className='text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors truncate !min-h-0'
        >
          {diveSiteName}
        </Link>
      );
    }
    return (
      <span className='text-xs sm:text-sm font-medium text-gray-700 truncate !min-h-0'>
        {diveSiteName}
      </span>
    );
  };

  // Helper to render the rating badge
  const renderRatingBadge = (diveSiteId, diveSiteName, averageRating) => {
    if (!diveSiteName) return null;
    const rating = getDiveSiteRating(diveSiteId, averageRating);
    if (rating === null || rating <= 0) return null;

    return (
      <div className='flex items-center gap-1 bg-yellow-50 dark:bg-yellow-100/50 rounded-full px-1.5 py-0.5 shrink-0 ml-auto'>
        <img
          src='/arts/divemap_shell.png'
          alt='Rating'
          className='w-2.5 h-2.5 sm:w-3 sm:h-3 object-contain'
        />
        <span className='text-xs sm:text-sm font-bold text-yellow-800 leading-none'>
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };
  const isGrid = viewMode === 'grid';

  const getDifficultyColorClasses = code => {
    switch (code) {
      case 'OPEN_WATER':
        return 'bg-green-100 text-green-800';
      case 'ADVANCED_OPEN_WATER':
        return 'bg-blue-100 text-blue-800';
      case 'DEEP_NITROX':
        return 'bg-purple-100 text-purple-800';
      case 'TECHNICAL_DIVING':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = code => {
    switch (code) {
      case 'OPEN_WATER':
        return 'Open Water';
      case 'ADVANCED_OPEN_WATER':
        return 'Advanced';
      case 'DEEP_NITROX':
        return 'Deep/Nitrox';
      case 'TECHNICAL_DIVING':
        return 'Technical';
      default:
        return code?.replace(/_/g, ' ') || 'Unspecified';
    }
  };

  const formatTime = timeString => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const tripName = generateTripName(trip);
  const tripSlug = slugify(tripName);
  const tripUrl = `/dive-trips/${trip.id}/${tripSlug}`;
  const displayStatus = getDisplayStatus(trip);

  const isInactive = displayStatus === 'completed' || displayStatus === 'cancelled';
  const borderLeftColor = isInactive ? 'border-l-gray-400' : 'border-l-[rgb(0,114,178)]';

  // Card classes based on view mode
  const cardClasses = isGrid
    ? `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderLeftColor} overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300`
    : `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderLeftColor} mb-6 hover:shadow-md transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;

  const cardStyle = {
    ...(!user && !isGrid ? { filter: 'blur(1.5px)' } : {}),
    ...(isInactive ? { opacity: 0.85, backgroundColor: '#f9fafb' } : {}),
  };

  return (
    <div className={cardClasses} style={cardStyle}>
      {!user && !isGrid && <div className='absolute inset-0 bg-white bg-opacity-30 z-10'></div>}

      {isGrid && (
        <div
          className={`relative h-48 ${isInactive ? 'bg-gray-500' : 'bg-divemap-blue'} flex items-center justify-center text-white overflow-hidden`}
        >
          <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10'></div>
          <div className='z-20 text-center p-3 sm:p-4'>
            <Calendar className='w-12 h-12 mx-auto mb-2 opacity-80' />
            <h3 className='font-bold text-lg leading-tight'>{tripName}</h3>
          </div>
          <div className='absolute top-3 right-3 z-30'>
            <span
              className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${getStatusColorClasses(displayStatus, true)}`}
            >
              {displayStatus}
            </span>
          </div>
        </div>
      )}

      <div className={isGrid ? 'p-3 sm:p-4 flex-1 flex flex-col' : 'p-3 sm:p-5 lg:p-4'}>
        {!isGrid && (
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 lg:mb-2'>
            <div className='flex items-center gap-3'>
              <div>
                <h3
                  className={`font-semibold text-gray-900 ${compactLayout ? 'text-sm' : 'text-base sm:text-lg'}`}
                >
                  {user ? (
                    <Link
                      to={tripUrl}
                      className='text-blue-600 hover:text-blue-800 transition-colors'
                    >
                      {tripName}
                    </Link>
                  ) : (
                    <span>{tripName}</span>
                  )}
                </h3>
                <p className='text-gray-600 text-xs'>
                  {trip.trip_date
                    ? new Date(trip.trip_date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'}
                </p>
              </div>
            </div>
            {user && (
              <div className='flex items-center space-x-2'>
                {shouldShowManage && (
                  <div className='flex items-center space-x-1 mr-2'>
                    <button
                      onClick={() => onEdit?.(trip)}
                      className='min-h-[44px] min-w-[44px] flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                      title='Edit Trip'
                    >
                      <Edit className='h-5 w-5' />
                    </button>
                    <button
                      onClick={() => onDelete?.(trip.id)}
                      className='min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:bg-red-50 rounded-md transition-colors'
                      title='Delete Trip'
                    >
                      <X className='h-5 w-5' />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Location & Tags Row */}
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 lg:mb-2'>
          <div className='flex items-center gap-1.5 text-gray-600 min-w-0 flex-1'>
            <Building className='w-3.5 h-3.5 text-gray-400 shrink-0' />
            {trip.diving_center_id && trip.diving_center_name ? (
              <Link
                to={`/diving-centers/${trip.diving_center_id}/${slugify(trip.diving_center_name)}`}
                className='text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate'
              >
                {trip.diving_center_name}
              </Link>
            ) : (
              <span className='text-xs sm:text-sm font-medium text-gray-700 truncate'>
                {trip.diving_center_name || 'Unknown Location'}
              </span>
            )}
          </div>

          <div className='flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0'>
            {trip.trip_difficulty_code && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColorClasses(trip.trip_difficulty_code)} shrink-0`}
              >
                {trip.trip_difficulty_label || getDifficultyLabel(trip.trip_difficulty_code)}
              </span>
            )}
            {!isGrid && displayStatus && (
              <span
                className={`sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(displayStatus, false)} shrink-0`}
              >
                {displayStatus}
              </span>
            )}
          </div>
        </div>

        {/* Description - Hidden on grid if too long */}
        {trip.trip_description && (
          <p
            className={`text-gray-700 text-sm leading-relaxed mb-3 lg:mb-2 ${isGrid ? 'line-clamp-2' : 'line-clamp-3'}`}
          >
            {decodeHtmlEntities(trip.trip_description)}
          </p>
        )}

        {/* Details Grid - Always 2 cols on mobile, up to 6 on desktop */}
        <div
          className={`grid grid-cols-2 ${isGrid ? 'gap-2' : 'sm:grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-2'} mb-4 lg:mb-3`}
        >
          <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Calendar className='h-3.5 w-3.5 mr-2 text-blue-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                Date
              </div>
              <div className='font-medium text-xs sm:text-sm truncate'>
                {trip.trip_date
                  ? new Date(trip.trip_date).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'N/A'}
              </div>
            </div>
          </div>

          <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Clock className='h-3.5 w-3.5 mr-2 text-green-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                Time
              </div>
              <div className='font-medium text-xs sm:text-sm'>
                {trip.trip_time ? formatTime(trip.trip_time) : 'N/A'}
              </div>
            </div>
          </div>

          <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Euro className='h-3.5 w-3.5 mr-2 text-amber-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                Price
              </div>
              <div className='font-medium text-xs sm:text-sm truncate'>
                {trip.trip_price ? `${trip.trip_price} ${trip.trip_currency}` : 'Contact'}
              </div>
            </div>
          </div>

          <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Users className='h-3.5 w-3.5 mr-2 text-orange-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                Group
              </div>
              <div className='font-medium text-xs sm:text-sm'>
                Max {trip.group_size_limit || 'N/A'}
              </div>
            </div>
          </div>

          {!isGrid && (
            <>
              {trip.trip_duration ? (
                <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
                  <Clock className='h-3.5 w-3.5 mr-2 text-purple-600 flex-shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                      Duration
                    </div>
                    <div className='font-medium text-xs sm:text-sm'>{trip.trip_duration}m</div>
                  </div>
                </div>
              ) : (
                <div className='hidden lg:block'></div>
              )}
              {trip.max_depth ? (
                <div className='flex items-center text-gray-600 p-1.5 sm:p-2 lg:p-1.5 bg-gray-50/50 rounded-lg border border-gray-100'>
                  <TrendingUp className='h-3.5 w-3.5 mr-2 text-blue-400 flex-shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-xs text-gray-500 uppercase tracking-wide leading-tight'>
                      Max Depth
                    </div>
                    <div className='font-medium text-xs sm:text-sm'>{trip.max_depth}m</div>
                  </div>
                </div>
              ) : (
                <div className='hidden lg:block'></div>
              )}
            </>
          )}
        </div>

        {/* Fallback for old single dive site display */}
        {(!trip.dives || trip.dives.length === 0) && trip.dive_site_name && (
          <div className='mb-4'>
            <div className='flex gap-2 p-1.5 sm:p-2 bg-green-50/30 rounded-md border border-green-100/50 overflow-hidden'>
              <div className='flex gap-1.5 flex-1 min-w-0'>
                <MapPin className='w-3.5 h-3.5 text-green-600 shrink-0' />
                {renderSiteName(trip.dive_site_id, trip.dive_site_name)}
              </div>
              {renderRatingBadge(
                trip.dive_site_id,
                trip.dive_site_name,
                trip.dives?.[0]?.dive_site_average_rating
              )}
            </div>
          </div>
        )}

        {/* Compact Dive Plan */}
        {trip.dives && trip.dives.length > 0 && (
          <div className='mb-3 lg:mb-2'>
            <h4 className='text-xs sm:text-sm font-semibold text-gray-500 mb-1.5 lg:mb-1 flex items-center leading-tight uppercase tracking-wider'>
              Dive Plan ({trip.dives.length})
            </h4>
            <div className='space-y-1 lg:space-y-0.5'>
              {trip.dives.map((dive, index) => {
                const site = dive.dive_site_tags
                  ? { tags: dive.dive_site_tags }
                  : getDiveSite(dive.dive_site_id);
                return (
                  <div
                    key={dive.id}
                    className='flex gap-2 p-1.5 sm:p-2 lg:p-1.5 bg-blue-50/30 rounded-md border border-blue-100/50 overflow-hidden items-center'
                  >
                    <div className='flex justify-center items-center w-4 h-4 sm:w-5 sm:h-5 bg-blue-100 rounded text-xs sm:text-sm font-bold text-blue-700 shrink-0'>
                      {index + 1}
                    </div>
                    <div className='flex gap-1.5 items-center min-w-0'>
                      <MapPin className='w-3.5 h-3.5 text-blue-400 shrink-0' />
                      {renderSiteName(dive.dive_site_id, dive.dive_site_name)}
                    </div>
                    {/* Tags inline on desktop */}
                    {!isGrid && site?.tags?.length > 0 && (
                      <div className='hidden sm:flex flex-wrap gap-1 mx-2 overflow-hidden flex-1'>
                        {site.tags.map(tag => (
                          <span
                            key={tag.id}
                            className='inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-blue-100/50 text-blue-800 border border-blue-200/50 whitespace-nowrap'
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Spacer for mobile so rating stays right aligned */}
                    {(!site?.tags || site.tags.length === 0 || isGrid) && (
                      <div className='flex-1'></div>
                    )}
                    {renderRatingBadge(
                      dive.dive_site_id,
                      dive.dive_site_name,
                      dive.dive_site_average_rating
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info: Added/Updated */}
        {!isGrid && (
          <div className='flex flex-row flex-wrap items-center gap-y-1 text-xs sm:text-sm text-gray-400 mt-auto pt-3 border-t border-gray-50'>
            <div className='flex flex-wrap gap-y-1 flex-1'>
              {trip.created_at && (
                <div className='flex items-center'>
                  <span className='font-medium text-gray-500 mr-1'>Added:</span>
                  <span className='whitespace-nowrap'>
                    {new Date(trip.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {trip.updated_at && trip.updated_at !== trip.created_at && (
                <div className='flex items-center ml-2 sm:ml-3 pl-2 sm:pl-3 border-l border-gray-200'>
                  <span className='font-medium text-gray-500 mr-1'>Updated:</span>
                  <span className='whitespace-nowrap'>
                    {new Date(trip.updated_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {user && (
              <Link
                to={tripUrl}
                className='w-8 h-8 ml-auto inline-flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-all group shrink-0'
                title='View Trip Details'
              >
                <ChevronRight className='w-4 h-4 transition-transform group-hover:translate-x-0.5 flex-shrink-0' />
              </Link>
            )}
          </div>
        )}

        {isGrid && (
          <Link
            to={tripUrl}
            className='mt-auto w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm'
          >
            View Trip
          </Link>
        )}
      </div>
    </div>
  );
};

TripCard.propTypes = {
  trip: PropTypes.object.isRequired,
  user: PropTypes.object,
  shouldShowManage: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  diveSites: PropTypes.array,
  additionalDiveSites: PropTypes.array,
  compactLayout: PropTypes.bool,
  viewMode: PropTypes.oneOf(['list', 'grid']),
};

export default TripCard;
