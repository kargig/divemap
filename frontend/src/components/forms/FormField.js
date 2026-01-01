import PropTypes from 'prop-types';
import { forwardRef } from 'react';
import { useFormContext } from 'react-hook-form';

/**
 * Reusable form field wrapper component
 * Provides consistent error display and label handling
 */
export const FormField = forwardRef(
  ({ name, label, error, children, className = '', required = false, ...props }, ref) => {
    const {
      register,
      formState: { errors },
    } = useFormContext();
    const fieldError = error || errors[name];

    return (
      <div className={`mb-4 ${className}`}>
        {label && (
          <label htmlFor={name} className='block text-sm font-medium text-gray-700 mb-1'>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </label>
        )}
        {children({ register, name, ref, ...props })}
        {fieldError && <p className='mt-1 text-sm text-red-600'>{fieldError.message}</p>}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

FormField.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  error: PropTypes.object,
  children: PropTypes.func.isRequired,
  className: PropTypes.string,
  required: PropTypes.bool,
};
