import { Calendar, Users, ArrowLeft } from 'lucide-react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { formatCost } from '../utils/currency';
import { formatDate, getStatusColorClasses, getDisplayStatus } from '../utils/tripHelpers';
import { generateTripName } from '../utils/tripNameGenerator';

import CurrencyIcon from './ui/CurrencyIcon';

const TripHeader = ({ trip }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const displayStatus = getDisplayStatus(trip);

  return (
    <>
      {/* Trip Header */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6'>
        <div className='flex flex-col lg:flex-row lg:items-start lg:justify-between'>
          <div className='flex-1'>
            <div className='flex items-center gap-1.5 sm:gap-4 w-full mb-2'>
              <button
                onClick={() => {
                  const from = location.state?.from;
                  if (from) {
                    navigate(from);
                  } else {
                    navigate('/dive-trips');
                  }
                }}
                className='text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0'
              >
                <ArrowLeft className='w-4 h-4 sm:w-6 sm:h-6' />
              </button>
              <div className='min-w-0 flex-1'>
                <h1 className='text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gray-900 break-words leading-tight'>
                  {generateTripName(trip) || 'Dive Trip'}
                </h1>
              </div>
            </div>
            <p className='text-gray-600 text-sm sm:text-base lg:text-lg mb-4'>
              {trip.trip_description || 'Experience an amazing diving adventure'}
            </p>

            {/* Trip Meta Information */}
            <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
              <div className='flex items-center space-x-2 sm:space-x-3'>
                <Calendar className='w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0' />
                <div>
                  <div className='text-xs sm:text-sm text-gray-500 uppercase tracking-wide'>
                    Date
                  </div>
                  <div className='font-medium text-xs sm:text-base'>
                    {formatDate(trip.trip_date)}
                  </div>
                </div>
              </div>

              <div className='flex items-center space-x-2 sm:space-x-3'>
                <CurrencyIcon
                  currencyCode={trip.trip_currency}
                  className='w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0'
                />
                <div>
                  <div className='text-xs sm:text-sm text-gray-500 uppercase tracking-wide'>
                    Price
                  </div>
                  <div className='font-medium text-xs sm:text-base'>
                    {trip.trip_price
                      ? formatCost(trip.trip_price, trip.trip_currency, {
                          showSymbol: false,
                          showCode: true,
                        })
                      : 'Contact'}
                  </div>
                </div>
              </div>

              <div className='flex items-center space-x-2 sm:space-x-3'>
                <Users className='w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0' />
                <div>
                  <div className='text-xs sm:text-sm text-gray-500 uppercase tracking-wide'>
                    Group
                  </div>
                  <div className='font-medium text-xs sm:text-base'>
                    {trip.group_size_limit ? `Max ${trip.group_size_limit}` : 'N/A'}
                  </div>
                </div>
              </div>

              <div className='flex items-center space-x-2 sm:space-x-3'>
                <div className='w-4 h-4 sm:w-5 sm:h-5 hidden sm:block'></div>
                <div>
                  <div className='text-xs sm:text-sm text-gray-500 uppercase tracking-wide'>
                    Status
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColorClasses(displayStatus, false)}`}
                  >
                    {displayStatus || 'Active'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trip Image Placeholder */}
          <div className='mt-6 lg:mt-0 lg:ml-6 shrink-0 w-full lg:w-auto'>
            <div className='w-full lg:w-64 h-48 sm:h-56 lg:h-48 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden'>
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
