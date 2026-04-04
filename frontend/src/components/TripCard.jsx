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
  Star,
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';

import { formatCost } from '../utils/currency';
import { decodeHtmlEntities } from '../utils/htmlDecode';
import { slugify } from '../utils/slugify';
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
  // Helper function to get dive site rating
  const getDiveSiteRating = diveSiteId => {
    if (!diveSiteId) return null;
    const diveSite =
      diveSites.find(site => site.id === diveSiteId) ||
      additionalDiveSites.find(site => site.id === diveSiteId);
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
  const renderRatingBadge = (diveSiteId, diveSiteName) => {
    if (!diveSiteName) return null;
    const rating = getDiveSiteRating(diveSiteId);
    if (rating === null || rating <= 0) return null;

    return (
      <div className='flex items-center gap-1 bg-yellow-50 dark:bg-yellow-100/50 rounded-full px-1.5 py-0.5 shrink-0 ml-auto'>
        <Star className='w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-500 fill-current' />
        <span className='text-[10px] sm:text-[11px] font-bold text-yellow-800 leading-none'>
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

  // Card classes based on view mode
  const cardClasses = isGrid
    ? 'bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-300'
    : `bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[rgb(45,107,138)] mb-6 hover:shadow-md transition-shadow duration-300 relative ${
        !user ? 'pointer-events-none' : ''
      }`;

  const cardStyle = !user && !isGrid ? { filter: 'blur(1.5px)' } : {};

  return (
    <div className={cardClasses} style={cardStyle}>
      {!user && !isGrid && <div className='absolute inset-0 bg-white bg-opacity-30 z-10'></div>}

      {isGrid && (
        <div className='relative h-48 bg-blue-600 flex items-center justify-center text-white overflow-hidden'>
          <div className='absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10'></div>
          <div className='z-20 text-center p-4'>
            <Calendar className='w-12 h-12 mx-auto mb-2 opacity-80' />
            <h3 className='font-bold text-lg leading-tight'>{tripName}</h3>
          </div>
          <div className='absolute top-3 right-3 z-30'>
            <span
              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                trip.trip_status === 'confirmed'
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {trip.trip_status}
            </span>
          </div>
        </div>
      )}

      <div className={isGrid ? 'p-4 flex-1 flex flex-col' : 'p-4 sm:p-6'}>
        {!isGrid && (
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4'>
            <div className='flex items-center gap-3'>
              <div>
                <h3
                  className={`font-semibold text-gray-900 ${compactLayout ? 'text-sm' : 'text-lg'}`}
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
                      className='p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors'
                      title='Edit Trip'
                    >
                      <Edit className='h-4 w-4' />
                    </button>
                    <button
                      onClick={() => onDelete?.(trip.id)}
                      className='p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors'
                      title='Delete Trip'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Location & Tags Row */}
        <div className='flex flex-wrap items-center gap-3 mb-4'>
          <div className='gap-1.5 text-gray-600 min-w-0 flex-1 sm:flex-initial flex'>
            <Building className='w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5' />
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
          {trip.trip_difficulty_code && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getDifficultyColorClasses(trip.trip_difficulty_code)} shrink-0`}
            >
              {trip.trip_difficulty_label || getDifficultyLabel(trip.trip_difficulty_code)}
            </span>
          )}
          {!isGrid && trip.trip_status && (
            <span
              className={`sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                trip.trip_status === 'confirmed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              } shrink-0`}
            >
              {trip.trip_status}
            </span>
          )}
        </div>

        {/* Description - Hidden on grid if too long */}
        {trip.trip_description && (
          <p
            className={`text-gray-700 text-sm leading-relaxed mb-4 ${isGrid ? 'line-clamp-2' : 'line-clamp-3'}`}
          >
            {decodeHtmlEntities(trip.trip_description)}
          </p>
        )}

        {/* Details Grid - Always 2 cols on mobile */}
        <div
          className={`grid grid-cols-2 ${isGrid ? 'gap-2' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4'} mb-5`}
        >
          <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Calendar className='h-3.5 w-3.5 mr-2 text-blue-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
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

          <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Clock className='h-3.5 w-3.5 mr-2 text-green-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
                Time
              </div>
              <div className='font-medium text-xs sm:text-sm'>
                {trip.trip_time ? formatTime(trip.trip_time) : 'N/A'}
              </div>
            </div>
          </div>

          <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Euro className='h-3.5 w-3.5 mr-2 text-amber-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
                Price
              </div>
              <div className='font-medium text-xs sm:text-sm truncate'>
                {trip.trip_price ? `${trip.trip_price} ${trip.trip_currency}` : 'Contact'}
              </div>
            </div>
          </div>

          <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
            <Users className='h-3.5 w-3.5 mr-2 text-orange-600 flex-shrink-0' />
            <div className='min-w-0'>
              <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
                Group
              </div>
              <div className='font-medium text-xs sm:text-sm'>
                Max {trip.group_size_limit || 'N/A'}
              </div>
            </div>
          </div>

          {!isGrid && (
            <>
              {trip.trip_duration && (
                <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
                  <Clock className='h-3.5 w-3.5 mr-2 text-purple-600 flex-shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
                      Duration
                    </div>
                    <div className='font-medium text-xs sm:text-sm'>{trip.trip_duration}m</div>
                  </div>
                </div>
              )}
              {trip.max_depth && (
                <div className='flex items-center text-gray-600 p-1.5 sm:p-3 bg-gray-50/50 rounded-lg border border-gray-100'>
                  <TrendingUp className='h-3.5 w-3.5 mr-2 text-blue-400 flex-shrink-0' />
                  <div className='min-w-0'>
                    <div className='text-[10px] text-gray-500 uppercase tracking-wide leading-tight'>
                      Max Depth
                    </div>
                    <div className='font-medium text-xs sm:text-sm'>{trip.max_depth}m</div>
                  </div>
                </div>
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
              {renderRatingBadge(trip.dive_site_id, trip.dive_site_name)}
            </div>
          </div>
        )}

        {/* Compact Dive Plan */}
        {trip.dives && trip.dives.length > 0 && (
          <div className='mb-4'>
            <h4 className='text-[10px] sm:text-xs font-semibold text-gray-500 mb-2 flex items-center leading-tight uppercase tracking-wider'>
              Dive Plan ({trip.dives.length})
            </h4>
            <div className='space-y-1.5'>
              {trip.dives.map((dive, index) => (
                <div
                  key={dive.id}
                  className='flex gap-2 p-1.5 sm:p-2 bg-blue-50/30 rounded-md border border-blue-100/50 overflow-hidden'
                >
                  <div className='flex justify-center w-4 h-4 sm:w-5 sm:h-5 bg-blue-100 rounded text-[9px] sm:text-[10px] font-bold text-blue-700 shrink-0'>
                    {index + 1}
                  </div>
                  <div className='flex gap-1.5 flex-1 min-w-0'>
                    <MapPin className='w-3.5 h-3.5 text-blue-400 shrink-0' />
                    {renderSiteName(dive.dive_site_id, dive.dive_site_name)}
                  </div>
                  {renderRatingBadge(dive.dive_site_id, dive.dive_site_name)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer info: Added/Updated */}
        {!isGrid && (
          <div className='flex flex-row flex-wrap items-center gap-y-1 text-[10px] sm:text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50'>
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
