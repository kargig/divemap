import { Plus, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

const TripFormModal = ({
  trip,
  onSubmit,
  onCancel,
  title,
  diveSites,
  divingCenters,
  additionalDiveSites = [],
  isModal = true,
}) => {
  // Combine regular dive sites with additional ones
  const allDiveSites = [...diveSites, ...additionalDiveSites];

  const [formData, setFormData] = useState({
    diving_center_id: trip?.diving_center_id ? parseInt(trip.diving_center_id) : null,
    trip_date: trip?.trip_date || '',
    trip_time: trip?.trip_time || '',
    trip_duration: trip?.trip_duration || '',
    trip_difficulty_code: trip?.trip_difficulty_code || '',
    trip_price: trip?.trip_price || '',
    trip_currency: trip?.trip_currency || 'EUR',
    group_size_limit: trip?.group_size_limit || '',
    current_bookings: trip?.current_bookings || 0,
    trip_description: trip?.trip_description || '',
    special_requirements: trip?.special_requirements || '',
    trip_status: trip?.trip_status || 'scheduled',
    dives: trip?.dives || [],
  });

  const addDive = () => {
    const newDive = {
      id: Date.now(), // Temporary ID for new dives
      dive_number: formData.dives.length + 1,
      dive_site_id: null,
      dive_time: '',
      dive_duration: '',
      dive_description: '',
    };
    setFormData({
      ...formData,
      dives: [...formData.dives, newDive],
    });
  };

  const removeDive = index => {
    const updatedDives = formData.dives.filter((_, i) => i !== index);
    // Renumber the dives
    const renumberedDives = updatedDives.map((dive, i) => ({
      ...dive,
      dive_number: i + 1,
    }));
    setFormData({
      ...formData,
      dives: renumberedDives,
    });
  };

  const updateDive = (index, field, value) => {
    const updatedDives = [...formData.dives];
    updatedDives[index] = {
      ...updatedDives[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      dives: updatedDives,
    });
  };

  const handleSubmit = e => {
    e.preventDefault();

    // Convert form data to API format
    const submitData = {
      ...formData,
      diving_center_id: formData.diving_center_id ? parseInt(formData.diving_center_id) : null,
      trip_duration: formData.trip_duration ? parseInt(formData.trip_duration) : null,
      trip_price: formData.trip_price ? parseFloat(formData.trip_price) : null,
      group_size_limit: formData.group_size_limit ? parseInt(formData.group_size_limit) : null,
      current_bookings: parseInt(formData.current_bookings),
      trip_time: formData.trip_time || null,
      dives: formData.dives.map(dive => ({
        ...dive,
        dive_site_id: dive.dive_site_id ? parseInt(dive.dive_site_id) : null,
        dive_duration: dive.dive_duration ? parseInt(dive.dive_duration) : null,
        dive_time: dive.dive_time || null,
      })),
    };

    onSubmit(submitData);
  };

  const formContent = (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* Trip Details */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label
            htmlFor='trip-diving-center'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Diving Center
          </label>
          <select
            id='trip-diving-center'
            value={formData.diving_center_id ? formData.diving_center_id.toString() : ''}
            onChange={e =>
              setFormData({
                ...formData,
                diving_center_id: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            className='w-full p-2 border rounded-md'
          >
            <option value=''>Select diving center</option>
            {divingCenters.map(center => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor='trip-date' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Date *
          </label>
          <input
            id='trip-date'
            type='date'
            value={formData.trip_date}
            onChange={e => setFormData({ ...formData, trip_date: e.target.value })}
            className='w-full p-2 border rounded-md'
            required
          />
        </div>

        <div>
          <label htmlFor='trip-time' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Time
          </label>
          <input
            id='trip-time'
            type='time'
            value={formData.trip_time}
            onChange={e => setFormData({ ...formData, trip_time: e.target.value })}
            className='w-full p-2 border rounded-md'
          />
        </div>

        <div>
          <label
            htmlFor='trip-duration'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Trip Duration (minutes)
          </label>
          <input
            id='trip-duration'
            type='number'
            value={formData.trip_duration}
            onChange={e => setFormData({ ...formData, trip_duration: e.target.value })}
            className='w-full p-2 border rounded-md'
            min='1'
          />
        </div>

        <div>
          <label htmlFor='trip-price' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Price
          </label>
          <input
            id='trip-price'
            type='number'
            step='0.01'
            value={formData.trip_price}
            onChange={e => setFormData({ ...formData, trip_price: e.target.value })}
            className='w-full p-2 border rounded-md'
          />
        </div>

        <div>
          <label
            htmlFor='trip-currency'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Currency
          </label>
          <select
            id='trip-currency'
            value={formData.trip_currency}
            onChange={e => setFormData({ ...formData, trip_currency: e.target.value })}
            className='w-full p-2 border rounded-md'
          >
            <option value='EUR'>EUR</option>
            <option value='USD'>USD</option>
            <option value='GBP'>GBP</option>
          </select>
        </div>

        <div>
          <label
            htmlFor='trip-group-size-limit'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Group Size Limit
          </label>
          <input
            id='trip-group-size-limit'
            type='number'
            value={formData.group_size_limit}
            onChange={e => setFormData({ ...formData, group_size_limit: e.target.value })}
            className='w-full p-2 border rounded-md'
            min='1'
          />
        </div>

        <div>
          <label
            htmlFor='trip-current-bookings'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Current Bookings
          </label>
          <input
            id='trip-current-bookings'
            type='number'
            value={formData.current_bookings}
            onChange={e => setFormData({ ...formData, current_bookings: e.target.value })}
            className='w-full p-2 border rounded-md'
            min='0'
          />
        </div>

        <div>
          <label htmlFor='trip-status' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Status
          </label>
          <select
            id='trip-status'
            value={formData.trip_status}
            onChange={e => setFormData({ ...formData, trip_status: e.target.value })}
            className='w-full p-2 border rounded-md'
          >
            <option value='scheduled'>Scheduled</option>
            <option value='confirmed'>Confirmed</option>
            <option value='cancelled'>Cancelled</option>
            <option value='completed'>Completed</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor='trip-description'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Trip Description
        </label>
        <textarea
          id='trip-description'
          value={formData.trip_description}
          onChange={e => setFormData({ ...formData, trip_description: e.target.value })}
          className='w-full p-2 border rounded-md'
          rows='3'
        />
      </div>

      <div>
        <label
          htmlFor='trip-special-requirements'
          className='block text-sm font-medium text-gray-700 mb-1'
        >
          Special Requirements
        </label>
        <textarea
          id='trip-special-requirements'
          value={formData.special_requirements}
          onChange={e => setFormData({ ...formData, special_requirements: e.target.value })}
          className='w-full p-2 border rounded-md'
          rows='2'
        />
      </div>

      {/* Dives Section */}
      <div className='border-t pt-4'>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-lg font-medium text-gray-900'>Dives</h4>
          <button
            type='button'
            onClick={addDive}
            className='flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm'
          >
            <Plus className='h-4 w-4 mr-1' />
            Add Dive
          </button>
        </div>

        {formData.dives.length === 0 && (
          <p className='text-gray-500 text-sm'>
            No dives added yet. Click &quot;Add Dive&quot; to add dives to this trip.
          </p>
        )}

        {formData.dives.map((dive, index) => (
          <div key={dive.id} className='border rounded-lg p-4 mb-4 bg-gray-50'>
            <div className='flex justify-between items-center mb-3'>
              <h5 className='text-md font-medium text-gray-700'>Dive {dive.dive_number}</h5>
              <button
                type='button'
                onClick={() => removeDive(index)}
                className='text-red-600 hover:text-red-800'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label
                  htmlFor={`dive-site-${index}`}
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Dive Site
                </label>
                <select
                  id={`dive-site-${index}`}
                  value={dive.dive_site_id ? dive.dive_site_id.toString() : ''}
                  onChange={e =>
                    updateDive(
                      index,
                      'dive_site_id',
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className='w-full p-2 border rounded-md'
                >
                  <option value=''>Select dive site</option>
                  {allDiveSites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`dive-time-${index}`}
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Dive Time
                </label>
                <input
                  id={`dive-time-${index}`}
                  type='time'
                  value={dive.dive_time}
                  onChange={e => updateDive(index, 'dive_time', e.target.value)}
                  className='w-full p-2 border rounded-md'
                />
              </div>

              <div>
                <label
                  htmlFor={`dive-duration-${index}`}
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Duration (min)
                </label>
                <input
                  id={`dive-duration-${index}`}
                  type='number'
                  value={dive.dive_duration}
                  onChange={e => updateDive(index, 'dive_duration', e.target.value)}
                  className='w-full p-2 border rounded-md'
                  min='1'
                />
              </div>

              <div>
                <label
                  htmlFor={`dive-description-${index}`}
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Description
                </label>
                <textarea
                  id={`dive-description-${index}`}
                  value={dive.dive_description}
                  onChange={e => updateDive(index, 'dive_description', e.target.value)}
                  className='w-full p-2 border rounded-md'
                  rows='2'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='flex justify-end space-x-3 pt-4 border-t'>
        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50'
          >
            Cancel
          </button>
        )}
        <button type='submit' className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'>
          Save Trip
        </button>
      </div>
    </form>
  );

  // Render as modal if isModal is true, otherwise render as standalone form
  if (isModal) {
    return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
        <div className='bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
          <div className='flex justify-between items-center mb-4'>
            <h3 className='text-lg font-semibold'>{title || 'Dive Trip'}</h3>
            {onCancel && (
              <button onClick={onCancel} className='text-gray-500 hover:text-gray-700'>
                ×
              </button>
            )}
          </div>
          {formContent}
        </div>
      </div>
    );
  }

  // Standalone form (for CreateTrip page)
  return (
    <div className='bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto'>
      {title && (
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>{title}</h1>
        </div>
      )}
      {formContent}
    </div>
  );
};

TripFormModal.propTypes = {
  trip: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  title: PropTypes.string,
  diveSites: PropTypes.array.isRequired,
  divingCenters: PropTypes.array.isRequired,
  additionalDiveSites: PropTypes.array,
  isModal: PropTypes.bool,
};

export default TripFormModal;

