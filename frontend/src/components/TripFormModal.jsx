import { Plus, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

import { getDifficultyOptions } from '../utils/difficultyHelpers';
import { tripSchemas, createResolver, getErrorMessage } from '../utils/formHelpers';

import DivingCenterSearchableDropdown from './DivingCenterSearchableDropdown';
import Button from './ui/Button';
import { DiveSiteSearchDropdown } from './ui/DiveSiteSearchDropdown';
import MarkdownEditor from './ui/MarkdownEditor';
import Modal from './ui/Modal';
import Select from './ui/Select';

const TripFormModal = ({
  trip,
  onSubmit,
  onCancel,
  onClose,
  title,
  diveSites,
  divingCenters,
  additionalDiveSites = [],
  isModal = true,
  divingCenterId = null,
  isOpen = false,
}) => {
  // Combine regular dive sites with additional ones
  const allDiveSites = [...diveSites, ...additionalDiveSites];

  const [customDiveSites, setCustomDiveSites] = useState({});

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
        enable_online_booking: Boolean(trip.is_bookable),
        different_rental_price:
          trip.different_rental_price !== undefined ? Boolean(trip.different_rental_price) : true,
        custom_rental_price: trip.custom_rental_price || '',
        broadcast_to_followers: false,
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
      diving_center_id: divingCenterId || null,
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
      enable_online_booking: false,
      different_rental_price: true,
      custom_rental_price: '',
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
          <label
            htmlFor='trip-date'
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Trip Date *
          </label>
          <input
            id='trip-date'
            type='date'
            {...register('trip_date')}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 ${
              errors.trip_date ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
            }`}
            required
          />
          {errors.trip_date && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_date)}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='trip-time'
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Trip Time
          </label>
          <input
            id='trip-time'
            type='time'
            {...register('trip_time')}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 ${
              errors.trip_time ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
            }`}
          />
          {errors.trip_time && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_time)}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='trip-duration'
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Trip Duration (minutes)
          </label>
          <input
            id='trip-duration'
            type='number'
            {...register('trip_duration', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${
              errors.trip_duration ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
            }`}
            min='1'
          />
          {errors.trip_duration && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_duration)}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='trip-price'
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Trip Price
          </label>
          <input
            id='trip-price'
            type='number'
            step='0.01'
            {...register('trip_price', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${
              errors.trip_price ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
            }`}
          />
          {errors.trip_price && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.trip_price)}</p>
          )}
        </div>

        <Controller
          name='trip_currency'
          control={control}
          render={({ field }) => (
            <Select
              id='trip-currency'
              label='Currency'
              value={field.value}
              onValueChange={field.onChange}
              error={errors.trip_currency ? getErrorMessage(errors.trip_currency) : null}
              options={[
                { value: 'EUR', label: 'EUR' },
                { value: 'USD', label: 'USD' },
                { value: 'GBP', label: 'GBP' },
              ]}
            />
          )}
        />

        <div>
          <label
            htmlFor='trip-group-size-limit'
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Group Size Limit
          </label>
          <input
            id='trip-group-size-limit'
            type='number'
            {...register('group_size_limit', {
              setValueAs: val => (val === '' ? null : val),
            })}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${
              errors.group_size_limit ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
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
            className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
          >
            Current Bookings
          </label>
          <input
            id='trip-current-bookings'
            type='number'
            {...register('current_bookings', {
              setValueAs: val => (val === '' ? 0 : Number(val)),
            })}
            className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${
              errors.current_bookings ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
            }`}
            min='0'
          />
          {errors.current_bookings && (
            <p className='text-red-500 text-sm mt-1'>{getErrorMessage(errors.current_bookings)}</p>
          )}
        </div>

        <Controller
          name='trip_status'
          control={control}
          render={({ field }) => (
            <Select
              id='trip-status'
              label='Trip Status'
              value={field.value}
              onValueChange={field.onChange}
              error={errors.trip_status ? getErrorMessage(errors.trip_status) : null}
              options={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          )}
        />

        <Controller
          name='trip_difficulty_code'
          control={control}
          render={({ field }) => (
            <Select
              id='trip-difficulty-code'
              label='Trip Difficulty'
              value={field.value || 'all'}
              onValueChange={value => field.onChange(value === 'all' ? null : value)}
              error={
                errors.trip_difficulty_code ? getErrorMessage(errors.trip_difficulty_code) : null
              }
              options={[
                { value: 'all', label: 'Unspecified' },
                ...getDifficultyOptions()
                  .filter(opt => opt.value !== null)
                  .map(opt => ({ value: opt.value, label: opt.label })),
              ]}
            />
          )}
        />
      </div>

      {/* Instant Online Booking Section (Top Half for Easy Access) */}
      <div className='p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl'>
        <div className='flex items-start space-x-3'>
          <input
            type='checkbox'
            id='enable-online-booking'
            {...register('enable_online_booking')}
            className='w-5 h-5 mt-0.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer'
          />
          <div className='flex-1'>
            <label
              htmlFor='enable-online-booking'
              className='text-sm font-bold text-gray-900 dark:text-white block cursor-pointer'
            >
              Enable Instant Online Booking on Divemap
            </label>
            <p className='text-xs text-gray-600 dark:text-gray-400 mt-0.5'>
              Allows registered divers to book spots online, pre-fill gear sizing, complete
              encrypted DMSC medical forms, and digitally sign legal waivers. Automatically
              provisions your dockside boat manifest and crate packing loadouts.
            </p>

            {watch('enable_online_booking') && (
              <div className='mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800 space-y-2.5'>
                <label className='block text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-emerald-200'>
                  Equipment Rental Pricing Policy
                </label>

                <div className='space-y-2'>
                  <label className='flex items-start gap-2.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='rental_pricing_mode'
                      checked={watch('different_rental_price') !== false}
                      onChange={() => setValue('different_rental_price', true)}
                      className='mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer'
                    />
                    <div className='text-xs'>
                      <strong className='font-bold text-gray-900 dark:text-white block'>
                        Different price for equipment rental
                      </strong>
                      <span className='text-gray-600 dark:text-gray-400 block'>
                        Divers renting full gear pay a separate rental fee (center standard package
                        add-on or custom price).
                      </span>
                    </div>
                  </label>

                  {watch('different_rental_price') !== false && (
                    <div className='pl-6 pt-1 flex items-center gap-3'>
                      <label
                        htmlFor='custom-rental-price'
                        className='text-xs font-medium text-gray-700 dark:text-gray-300 shrink-0'
                      >
                        Custom price with full rental ({watch('trip_currency') || 'EUR'}):
                      </label>
                      <input
                        id='custom-rental-price'
                        type='number'
                        step='0.01'
                        placeholder='Empty for center standard'
                        {...register('custom_rental_price', {
                          setValueAs: val => (val === '' ? null : Number(val)),
                        })}
                        className='w-52 p-1.5 text-xs border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                      />
                    </div>
                  )}

                  <label className='flex items-start gap-2.5 cursor-pointer'>
                    <input
                      type='radio'
                      name='rental_pricing_mode'
                      checked={watch('different_rental_price') === false}
                      onChange={() => {
                        setValue('different_rental_price', false);
                        setValue('custom_rental_price', null);
                      }}
                      className='mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer'
                    />
                    <div className='text-xs'>
                      <strong className='font-bold text-gray-900 dark:text-white block'>
                        Same price (Full equipment rental included)
                      </strong>
                      <span className='text-gray-600 dark:text-gray-400 block'>
                        Same price for all divers whether bringing their own gear or renting all
                        equipment from the center.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <Controller
          name='trip_description'
          control={control}
          render={({ field, fieldState: { error } }) => (
            <MarkdownEditor
              label='Trip Description'
              value={field.value}
              onChange={field.onChange}
              error={error?.message}
              placeholder='Enter trip description'
            />
          )}
        />
      </div>

      <div>
        <Controller
          name='special_requirements'
          control={control}
          render={({ field, fieldState: { error } }) => (
            <MarkdownEditor
              label='Special Requirements'
              value={field.value}
              onChange={field.onChange}
              error={error?.message}
              placeholder='Any special requirements or instructions'
            />
          )}
        />
      </div>

      {/* Dives Section */}
      <div className='border-t border-gray-200 dark:border-slate-700 pt-4'>
        <div className='flex justify-between items-center mb-4'>
          <h4 className='text-lg font-medium text-gray-900 dark:text-slate-100'>Dives</h4>
          <Button
            type='button'
            onClick={addDive}
            variant='secondary'
            size='sm'
            icon={<Plus className='h-4 w-4' />}
          >
            Add Dive
          </Button>
        </div>

        {fields.length === 0 && (
          <p className='text-gray-500 dark:text-slate-400 text-sm'>
            No dives added yet. Click &quot;Add Dive&quot; to add dives to this trip.
          </p>
        )}

        {fields.map((field, index) => (
          <div
            key={field.id}
            className='border border-gray-200 dark:border-slate-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-slate-900/40'
          >
            <div className='flex justify-between items-center mb-3'>
              <h5 className='text-md font-medium text-gray-700 dark:text-slate-200'>
                Dive {index + 1}
              </h5>
              <button
                type='button'
                onClick={() => removeDive(index)}
                className='text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300'
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
              <Controller
                name={`dives.${index}.dive_site_id`}
                control={control}
                render={({ field }) => {
                  let site = allDiveSites.find(s => s.id === field.value);
                  if (!site && field.value && customDiveSites[field.value]) {
                    site = { id: field.value, name: customDiveSites[field.value] };
                  }
                  const siteValue = site ? { id: site.id, name: site.name } : null;

                  return (
                    <DiveSiteSearchDropdown
                      label='Dive Site'
                      value={siteValue}
                      onChange={selectedSite => {
                        if (selectedSite && !allDiveSites.some(s => s.id === selectedSite.id)) {
                          setCustomDiveSites(prev => ({
                            ...prev,
                            [selectedSite.id]: selectedSite.name,
                          }));
                        }
                        field.onChange(selectedSite ? selectedSite.id : null);
                      }}
                      error={
                        errors.dives?.[index]?.dive_site_id
                          ? getErrorMessage(errors.dives?.[index]?.dive_site_id)
                          : null
                      }
                    />
                  );
                }}
              />

              <div>
                <label
                  htmlFor={`dive-time-${index}`}
                  className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
                >
                  Dive Time
                </label>
                <input
                  id={`dive-time-${index}`}
                  type='time'
                  {...register(`dives.${index}.dive_time`)}
                  className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 ${
                    errors.dives?.[index]?.dive_time
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-slate-600'
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
                  className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'
                >
                  Duration (min)
                </label>
                <input
                  id={`dive-duration-${index}`}
                  type='number'
                  {...register(`dives.${index}.dive_duration`, {
                    setValueAs: val => (val === '' ? null : val),
                  })}
                  className={`w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${
                    errors.dives?.[index]?.dive_duration
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-slate-600'
                  }`}
                  min='1'
                />
                {errors.dives?.[index]?.dive_duration && (
                  <p className='text-red-500 text-sm mt-1'>
                    {getErrorMessage(errors.dives?.[index]?.dive_duration)}
                  </p>
                )}
              </div>

              <div className='md:col-span-2'>
                <Controller
                  name={`dives.${index}.dive_description`}
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <MarkdownEditor
                      label='Dive Description'
                      value={field.value}
                      onChange={field.onChange}
                      error={error?.message}
                      placeholder='Describe this specific dive'
                      minHeight='100px'
                    />
                  )}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Broadcast Option */}
      <div className='flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700'>
        <input
          type='checkbox'
          id='broadcast'
          {...register('broadcast_to_followers')}
          className='w-4 h-4 text-divemap-blue border-gray-300 dark:border-slate-600 rounded focus:ring-divemap-sky'
        />
        <label
          htmlFor='broadcast'
          className='text-sm font-medium text-gray-700 dark:text-slate-300'
        >
          {trip ? 'Broadcast update to followers' : 'Broadcast this trip to followers'}
        </label>
      </div>

      <div className='flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-slate-700'>
        {onCancel && (
          <Button type='button' onClick={onCancel} variant='secondary'>
            Cancel
          </Button>
        )}
        <Button type='submit' variant='primary'>
          Save Trip
        </Button>
      </div>
    </form>
  );

  // Render as modal if isModal is true, otherwise render as standalone form
  if (isModal) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose || onCancel}
        title={title || 'Dive Trip'}
        className='max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto'
      >
        {formContent}
      </Modal>
    );
  }

  // Standalone form (for CreateTrip page)
  return (
    <div className='bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-100 dark:border-slate-700 p-6 max-w-4xl mx-auto'>
      {title && (
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-gray-900 dark:text-slate-100'>{title}</h2>
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
  onClose: PropTypes.func,
  title: PropTypes.string,
  diveSites: PropTypes.array.isRequired,
  divingCenters: PropTypes.array.isRequired,
  additionalDiveSites: PropTypes.array,
  isModal: PropTypes.bool,
  isOpen: PropTypes.bool,
  divingCenterId: PropTypes.number,
};

export default TripFormModal;
