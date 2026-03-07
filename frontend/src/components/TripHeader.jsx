import { Calendar, DollarSign, Users, ArrowLeft } from 'lucide-react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { formatPrice, formatDate } from '../utils/tripHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

const TripHeader = ({ trip }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {/* Back Button */}
      <button
        onClick={() => {
          const from = location.state?.from;
          if (from) {
            navigate(from);
          } else {
            navigate('/dive-trips');
          }
        }}
        className='flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-6 transition-colors'
      >
        <ArrowLeft className='w-4 h-4' />
        <span>Back to Trips</span>
      </button>

      {/* Trip Header */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6'>
        <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between'>
          <div className='flex-1'>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2'>
              {generateTripName(trip) || 'Dive Trip'}
            </h1>
            <p className='text-gray-600 text-sm sm:text-base lg:text-lg mb-4'>
              {trip.trip_description || 'Experience an amazing diving adventure'}
            </p>

            {/* Trip Meta Information */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
              <div className='flex items-center space-x-3'>
                <Calendar className='w-5 h-5 text-gray-500' />
                <div>
                  <div className='text-sm text-gray-500'>Date</div>
                  <div className='font-medium'>{formatDate(trip.trip_date)}</div>
                </div>
              </div>

              <div className='flex items-center space-x-3'>
                <DollarSign className='w-5 h-5 text-gray-500' />
                <div>
                  <div className='text-sm text-gray-500'>Price</div>
                  <div className='font-medium'>{formatPrice(trip.trip_price)}</div>
                </div>
              </div>

              <div className='flex items-center space-x-3'>
                <Users className='w-5 h-5 text-gray-500' />
                <div>
                  <div className='text-sm text-gray-500'>Max Group Size</div>
                  <div className='font-medium'>
                    {trip.group_size_limit
                      ? `Max ${trip.group_size_limit} people`
                      : 'Contact center'}
                  </div>
                </div>
              </div>

              <div className='flex items-center space-x-3'>
                <div className='w-5 h-5'></div>
                <div>
                  <div className='text-sm text-gray-500'>Status</div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      trip.trip_status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : trip.trip_status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : trip.trip_status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : trip.trip_status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {trip.trip_status || 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trip Image Placeholder */}
          <div className='mt-6 lg:mt-0 lg:ml-6'>
            <div className='w-64 h-48 bg-gray-200 rounded-lg flex items-center justify-center'>
              {trip.trip_image_url ? (
                <img
                  src={trip.trip_image_url}
                  alt={generateTripName(trip)}
                  className='w-full h-full object-cover rounded-lg'
                />
              ) : (
                <div className='text-center text-gray-500'>
                  <div className='text-sm'>Trip Image</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

TripHeader.propTypes = {
  trip: PropTypes.shape({
    trip_name: PropTypes.string,
    trip_description: PropTypes.string,
    trip_date: PropTypes.string,
    trip_price: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    group_size_limit: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    trip_status: PropTypes.string,
    trip_image_url: PropTypes.string,
  }).isRequired,
};

export default TripHeader;
