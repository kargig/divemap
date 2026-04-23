import { formatDate } from './dateHelpers';
/**
 * Generate a trip name from diving center name and date
 * @param {Object} trip - Trip object with diving_center_name and trip_date
 * @returns {string} Generated trip name
 */
export const generateTripName = trip => {
  if (trip.trip_name) {
    return trip.trip_name;
  }

  const divingCenterName = trip.diving_center_name || 'Unknown Center';
  const tripDate = trip.trip_date;

  if (tripDate) {
    const date = new Date(tripDate);
    const formattedDate = formatDate(date, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return `${divingCenterName} - ${formattedDate}`;
  }

  return divingCenterName;
};
