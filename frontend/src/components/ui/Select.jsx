import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check, ChevronUp } from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

const Select = ({
  value,
  onValueChange,
  defaultValue,
  placeholder = 'Select an option...',
  options = [],
  label,
  error,
  required = false,
  className = '',
  id,
  name,
  disabled = false,
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className='text-sm font-medium text-gray-700'>
          {label} {required && <span className='text-red-500'>*</span>}
        </label>
      )}
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        defaultValue={defaultValue}
        name={name}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          className={`
            flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm 
            ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
            ${error ? 'border-red-500' : 'border-gray-300'}
          `}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className='h-4 w-4 opacity-50' />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className='relative z-[100] min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
            position='popper'
            sideOffset={4}
          >
            <SelectPrimitive.ScrollUpButton className='flex cursor-default items-center justify-center py-1'>
              <ChevronUp className='h-4 w-4' />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className='p-1 h-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]'>
              {options.map(option => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value.toString()}
                  className='relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-blue-100 focus:text-blue-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer'
                >
                  <span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
                    <SelectPrimitive.ItemIndicator>
                      <Check className='h-4 w-4' />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className='flex cursor-default items-center justify-center py-1'>
              <ChevronDown className='h-4 w-4' />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className='text-xs text-red-500 mt-1'>{error}</p>}
    </div>
  );
};

Select.propTypes = {
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  defaultValue: PropTypes.string,
  placeholder: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string,
  disabled: PropTypes.bool,
};

export default Select;
