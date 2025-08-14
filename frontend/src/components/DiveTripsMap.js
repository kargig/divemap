import { MapPin, Calendar, Users, DollarSign } from 'lucide-react';
import PropTypes from 'prop-types';

const DiveTripsMap = ({ diveTrips = [] }) => {
  // For now, we'll create a placeholder map component
  // In a real implementation, this would use a mapping library like Mapbox or Google Maps

  if (!diveTrips || diveTrips.length === 0) {
    return (
      <div className='flex items-center justify-center h-full bg-gray-50'>
        <div className='text-center'>
          <MapPin className='h-12 w-12 text-gray-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>No trips to display</h3>
          <p className='text-gray-600'>No dive trips are available to show on the map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='h-full bg-gray-50 flex items-center justify-center'>
      <div className='text-center'>
        <MapPin className='h-12 w-12 text-blue-600 mx-auto mb-4' />
        <h3 className='text-lg font-medium text-gray-900 mb-2'>Map View</h3>
        <p className='text-gray-600 mb-4'>
          Showing {diveTrips.length} dive trip{diveTrips.length !== 1 ? 's' : ''}
        </p>
        <div className='space-y-2 text-sm text-gray-600'>
          <div className='flex items-center justify-center gap-2'>
            <Calendar className='h-4 w-4' />
            <span>Map integration coming soon</span>
          </div>
          <div className='flex items-center justify-center gap-2'>
            <Users className='h-4 w-4' />
            <span>Interactive trip locations</span>
          </div>
          <div className='flex items-center justify-center gap-2'>
            <DollarSign className='h-4 w-4' />
            <span>Price and availability info</span>
          </div>
        </div>
      </div>
    </div>
  );
};

DiveTripsMap.propTypes = {
  diveTrips: PropTypes.array,
};

export default DiveTripsMap;
