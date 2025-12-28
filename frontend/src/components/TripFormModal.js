import { Plus, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';

import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { tripSchemas, createResolver, getErrorMessage } from '../utils/formHelpers';

import DivingCenterSearchableDropdown from './DivingCenterSearchableDropdown';
import Modal from './ui/Modal';

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

  // Prepare default values
  const getDefaultValues = () => {
    if (trip) {
      return {
        diving_center_id: trip.diving_center_id ? trip.diving_center_id : null,
        trip_date: trip.trip_date || '',
        trip_time: trip.trip_time || '',
        trip_duration: trip.trip_duration || '',
        trip_difficulty_code: trip.trip_difficulty_code || '',
        trip_price: trip.trip_price || '',
        trip_currency: trip.trip_currency || 'EUR',
        group_size_limit: trip.group_size_limit || '',
        current_bookings: trip.current_bookings || 0,
        trip_description: trip.trip_description || '',
        special_requirements: trip.special_requirements || '',
        trip_status: trip.trip_status || 'scheduled',
        dives:
          trip.dives?.map((dive, index) => ({
            id: dive.id || Date.now() + index,
            dive_number: dive.dive_number || index + 1,
            dive_site_id: dive.dive_site_id || null,
            dive_time: dive.dive_time || '',
            dive_duration: dive.dive_duration || '',
            dive_description: dive.dive_description || '',
          })) || [],
      };
    }
    return {
      diving_center_id: null,
      trip_date: '',
      trip_time: '',
      trip_duration: '',
      trip_difficulty_code: '',
      trip_price: '',
      trip_currency: 'EUR',
      group_size_limit: '',
      current_bookings: 0,
      trip_description: '',
      special_requirements: '',
      trip_status: 'scheduled',
      dives: [],
    };
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    getValues,
    setValue,
    watch,
  } = useForm({
    resolver: createResolver(tripSchemas.trip),
    mode: 'onChange',
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'dives',
  });

  // Reset form when trip prop changes
  useEffect(() => {
    reset(getDefaultValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  // Sync dive_number with index whenever fields change
  useEffect(() => {
    fields.forEach((_, index) => {
      setValue(`dives.${index}.dive_number`, index + 1, { shouldValidate: false });
    });
  }, [fields, setValue]);

  const addDive = () => {
    const newDive = {
      id: Date.now(),
      dive_number: fields.length + 1,
      dive_site_id: null,
      dive_time: '',
      dive_duration: '',
      dive_description: '',
    };
    append(newDive);
  };

  const removeDive = index => {
    remove(index);
    // dive_number will be automatically synced by useEffect
  };

  const onFormSubmit = data => {
    // Data is already validated and transformed by Zod schema
    // Just need to clean up temporary IDs and ensure proper formatting
    const submitData = {
      ...data,
      // Transform empty string difficulty_code to null for backend
      trip_difficulty_code: data.trip_difficulty_code === '' ? null : data.trip_difficulty_code,
      dives: data.dives.map((dive, index) => ({
        ...dive,
        dive_number: index + 1, // Ensure proper numbering
        // Remove temporary id if present
        ...(dive.id && typeof dive.id === 'number' && dive.id > 1000000000000
          ? {}
          : { id: dive.id }),
      })),
    };
    onSubmit(submitData);
  };

  const formContent = (
    <form onSubmit={handleSubmit(onFormSubmit)} className='space-y-6'>
      {/* Trip Details */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <DivingCenterSearchableDropdown
            divingCenters={divingCenters}
            selectedId={watch('diving_center_id')}
            onSelect={id => setValue('diving_center_id', id, { shouldValidate: true })}
            error={errors.diving_center_id ? getErrorMessage(errors.diving_center_id) : null}
            id='trip-diving-center'
          />
        </div>

        <div>
          <label htmlFor='trip-date' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Date *
          </label>
          <input
            id='trip-date'
            type='date'
            {...register('trip_date')}
            className={`w-full p-2 border rounded-md ${errors.trip_date ? 'border-red-500' : ''}`}
            required
          />
          {errors.trip_date && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_date)}</p>
          )}
        </div>

        <div>
          <label htmlFor='trip-time' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Time
          </label>
          <input
            id='trip-time'
            type='time'
            {...register('trip_time')}
            className={`w-full p-2 border rounded-md ${errors.trip_time ? 'border-red-500' : ''}`}
          />
          {errors.trip_time && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_time)}</p>
          )}
        </div>

        <div>
          <label htmlFor='trip-duration' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Duration (minutes)
          </label>
          <input
            id='trip-duration'
            type='number'
            {...register('trip_duration', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md ${
              errors.trip_duration ? 'border-red-500' : ''
            }`}
            min='1'
          />
          {errors.trip_duration && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_duration)}</p>
          )}
        </div>

        <div>
          <label htmlFor='trip-price' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Price
          </label>
          <input
            id='trip-price'
            type='number'
            step='0.01'
            {...register('trip_price', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md ${errors.trip_price ? 'border-red-500' : ''}`}
          />
          {errors.trip_price && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_price)}</p>
          )}
        </div>

        <div>
          <label htmlFor='trip-currency' className='block text-sm font-medium text-gray-700 mb-1'>
            Currency
          </label>
          <select
            id='trip-currency'
            {...register('trip_currency')}
            className={`w-full p-2 border rounded-md ${
              errors.trip_currency ? 'border-red-500' : ''
            }`}
          >
            <option value='EUR'>EUR</option>
            <option value='USD'>USD</option>
            <option value='GBP'>GBP</option>
          </select>
          {errors.trip_currency && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_currency)}</p>
          )}
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
            {...register('group_size_limit', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md ${
              errors.group_size_limit ? 'border-red-500' : ''
            }`}
            min='1'
          />
          {errors.group_size_limit && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.group_size_limit)}</p>
          )}
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
            {...register('current_bookings', {
              setValueAs: val => (val === '' ? 0 : Number(val)),
            })}
            className={`w-full p-2 border rounded-md ${
              errors.current_bookings ? 'border-red-500' : ''
            }`}
            min='0'
          />
          {errors.current_bookings && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.current_bookings)}</p>
          )}
        </div>

        <div>
          <label htmlFor='trip-status' className='block text-sm font-medium text-gray-700 mb-1'>
            Trip Status
          </label>
          <select
            id='trip-status'
            {...register('trip_status')}
            className={`w-full p-2 border rounded-md ${errors.trip_status ? 'border-red-500' : ''}`}
          >
            <option value='scheduled'>Scheduled</option>
            <option value='confirmed'>Confirmed</option>
            <option value='cancelled'>Cancelled</option>
            <option value='completed'>Completed</option>
          </select>
          {errors.trip_status && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_status)}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='trip-difficulty-code'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Trip Difficulty
          </label>
          <select
            id='trip-difficulty-code'
            {...register('trip_difficulty_code', {
              setValueAs: val => (val === '' || val === null ? null : val),
            })}
            className={`w-full p-2 border rounded-md ${
              errors.trip_difficulty_code ? 'border-red-500' : ''
            }`}
          >
            {getDifficultyOptions().map(option => (
              <option
                key={option.value === null ? 'null' : option.value}
                value={option.value === null ? '' : option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
          {errors.trip_difficulty_code && (
            <p className='text-red-500 text-sm mt-1'>
              {getErrorMessage(errors.trip_difficulty_code)}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor='trip-description' className='block text-sm font-medium text-gray-700 mb-1'>
          Trip Description
        </label>
        <textarea
          id='trip-description'
          {...register('trip_description')}
          className={`w-full p-2 border rounded-md ${
            errors.trip_description ? 'border-red-500' : ''
          }`}
          rows='3'
        />
        {errors.trip_description && (
          <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_description)}</p>
        )}
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
          {...register('special_requirements')}
          className={`w-full p-2 border rounded-md ${
            errors.special_requirements ? 'border-red-500' : ''
          }`}
          rows='2'
        />
        {errors.special_requirements && (
          <p className='text-red-500 text-sm mt-1'>
            {getErrorMessage(errors.special_requirements)}
          </p>
        )}
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

        {fields.length === 0 && (
          <p className='text-gray-500 text-sm'>
            No dives added yet. Click &quot;Add Dive&quot; to add dives to this trip.
          </p>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className='border rounded-lg p-4 mb-4 bg-gray-50'>
            <div className='flex justify-between items-center mb-3'>
              <h5 className='text-md font-medium text-gray-700'>Dive {index + 1}</h5>
              <button
                type='button'
                onClick={() => removeDive(index)}
                className='text-red-600 hover:text-red-800'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {/* Hidden field for dive_number */}
              <input
                type='hidden'
                {...register(`dives.${index}.dive_number`, {
                  value: index + 1,
                })}
              />
              <div>
                <label
                  htmlFor={`dive-site-${index}`}
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Dive Site
                </label>
                <select
                  id={`dive-site-${index}`}
                  {...register(`dives.${index}.dive_site_id`, {
                    setValueAs: val => (val === '' || val === null ? null : Number(val)),
                  })}
                  className={`w-full p-2 border rounded-md ${
                    errors.dives?.[index]?.dive_site_id ? 'border-red-500' : ''
                  }`}
                >
                  <option value=''>Select dive site</option>
                  {allDiveSites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
                {errors.dives?.[index]?.dive_site_id && (
                  <p className='text-red-500 text-sm mt-1'>
                    {getErrorMessage(errors.dives?.[index]?.dive_site_id)}
                  </p>
                )}
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
                  {...register(`dives.${index}.dive_time`)}
                  className={`w-full p-2 border rounded-md ${
                    errors.dives?.[index]?.dive_time ? 'border-red-500' : ''
                  }`}
                />
                {errors.dives?.[index]?.dive_time && (
                  <p className='text-red-500 text-sm mt-1'>
                    {getErrorMessage(errors.dives?.[index]?.dive_time)}
                  </p>
                )}
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
                  {...register(`dives.${index}.dive_duration`, {
                    setValueAs: val => (val === '' ? null : val),
                  })}
                  className={`w-full p-2 border rounded-md ${
                    errors.dives?.[index]?.dive_duration ? 'border-red-500' : ''
                  }`}
                  min='1'
                />
                {errors.dives?.[index]?.dive_duration && (
                  <p className='text-red-500 text-sm mt-1'>
                    {getErrorMessage(errors.dives?.[index]?.dive_duration)}
                  </p>
                )}
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
                  {...register(`dives.${index}.dive_description`)}
                  className={`w-full p-2 border rounded-md ${
                    errors.dives?.[index]?.dive_description ? 'border-red-500' : ''
                  }`}
                  rows='2'
                />
                {errors.dives?.[index]?.dive_description && (
                  <p className='text-red-500 text-sm mt-1'>
                    {getErrorMessage(errors.dives?.[index]?.dive_description)}
                  </p>
                )}
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
        <button
          type='submit'
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
        >
          Save Trip
        </button>
      </div>
    </form>
  );

  // Render as modal if isModal is true, otherwise render as standalone form
  if (isModal) {
    return (
      <Modal
        isOpen={true}
        onClose={onCancel}
        title={title || 'Dive Trip'}
        className='max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto'
      >
        {formContent}
      </Modal>
    );
  }

  // Standalone form (for CreateTrip page)
  return (
    <div className='bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto'>
      {title && (
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-gray-900'>{title}</h2>
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
