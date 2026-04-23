import { formatDate as coreFormatDate } from './dateHelpers';

export const getDifficultyColor = difficulty => {
  switch (difficulty?.toLowerCase()) {
    case 'beginner':
      return 'bg-green-100 text-green-800';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800';
    case 'advanced':
      return 'bg-red-100 text-red-800';
    case 'expert':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const formatPrice = price => {
  if (!price) return 'Contact for pricing';
  return `$${price}`;
};

export const formatDate = dateString => {
  return coreFormatDate(dateString);
};

export const getStatusColorClasses = (status, isSolid = false) => {
  if (isSolid) {
    // For grid view badges (solid backgrounds)
    switch (status) {
      case 'scheduled':
        return 'bg-divemap-blue text-white';
      case 'confirmed':
        return 'bg-green-600 text-white';
      case 'cancelled':
        return 'bg-red-600 text-white';
      case 'completed':
        return 'bg-gray-600 text-white';
      case 'today':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  // For list view badges (light backgrounds)
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    case 'today':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getDisplayStatus = trip => {
  if (!trip || !trip.trip_status || !trip.trip_date) return 'unknown';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tripDate = new Date(trip.trip_date);
  tripDate.setHours(0, 0, 0, 0);

  // If the trip is in the past and it wasn't explicitly cancelled, it's completed
  if (tripDate < today && trip.trip_status !== 'cancelled') {
    return 'completed';
  }

  // If the trip is happening exactly today and wasn't explicitly cancelled
  if (tripDate.getTime() === today.getTime() && trip.trip_status !== 'cancelled') {
    return 'today';
  }

  return trip.trip_status;
};
