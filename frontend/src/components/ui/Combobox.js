import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown, Check, Search, X, Loader } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';

const Combobox = ({
  value,
  onValueChange,
  options = [],
  groups = [], // New prop for grouped options
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  label,
  error,
  required = false,
  className = '',
  id,
  disabled = false,
  onSearchChange,
  searchTerm: externalSearchTerm,
  isLoading = false,
  renderItem,
  popoverClassName = 'z-[100]',
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalSearchTerm, setInternalSearchTerm] = useState('');

  const open = internalOpen;
  const setOpen = setInternalOpen;
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

  const selectedOption = useMemo(() => {
    // Search in flat options
    let found = options.find(option => option.value.toString() === value?.toString());
    if (found) return found;

    // Search in groups
    for (const group of groups) {
      found = group.options.find(option => option.value.toString() === value?.toString());
      if (found) return found;
    }
    return null;
  }, [options, groups, value]);

  const hasResults = useMemo(() => {
    if (groups.length > 0) {
      return groups.some(group => group.options.length > 0);
    }
    return options.length > 0;
  }, [options, groups]);

  const handleSelect = optionValue => {
    onValueChange(optionValue);
    setOpen(false);
    if (!onSearchChange) setInternalSearchTerm('');
  };

  const handleClear = e => {
    e.stopPropagation();
    onValueChange('');
    if (!onSearchChange) setInternalSearchTerm('');
  };

  const handleSearchInputChange = e => {
    const newValue = e.target.value;
    if (onSearchChange) {
      onSearchChange(newValue);
    } else {
      setInternalSearchTerm(newValue);
    }
  };

  const renderOptionList = items => {
    return items.map(option => (
      <div
        key={option.value}
        className={`
          relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none 
          hover:bg-blue-100 hover:text-blue-900 transition-colors cursor-pointer
          ${value?.toString() === option.value.toString() ? 'bg-blue-50 text-blue-900' : ''}
        `}
        onClick={() => handleSelect(option.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleSelect(option.value);
          }
        }}
        role='option'
        aria-selected={value?.toString() === option.value.toString()}
        tabIndex={0}
      >
        <span className='absolute left-2 flex h-3.5 w-3.5 items-center justify-center'>
          {value?.toString() === option.value.toString() && <Check className='h-4 w-4' />}
        </span>
        {renderItem ? renderItem(option) : option.label}
      </div>
    ));
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className='text-sm font-medium text-gray-700'>
          {label} {required && <span className='text-red-500'>*</span>}
        </label>
      )}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            id={id}
            type='button'
            disabled={disabled}
            role='combobox'
            aria-expanded={open}
            aria-controls={`${id}-content`}
            className={`
              flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm 
              ring-offset-background focus:outline-none focus:ring-2 
              focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
              ${error ? 'border-red-500' : 'border-gray-300'}
            `}
          >
            <span className={!selectedOption ? 'text-gray-500 truncate' : 'text-gray-900 truncate'}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <div className='flex items-center gap-1 flex-shrink-0'>
              {value && !disabled && (
                <X
                  className='h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer'
                  onClick={handleClear}
                />
              )}
              <ChevronDown className='h-4 w-4 opacity-50' />
            </div>
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            id={`${id}-content`}
            className={`${popoverClassName} w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-gray-200 bg-white p-0 text-gray-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}
            align='start'
            sideOffset={4}
          >
            <div className='flex items-center border-b px-3 border-gray-100'>
              <Search className='mr-2 h-4 w-4 shrink-0 opacity-50' />
              <input
                className='flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50'
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={handleSearchInputChange}
              />
              {isLoading && <Loader className='ml-2 h-4 w-4 animate-spin opacity-50' />}
            </div>
            <div className='max-h-[350px] overflow-y-auto overflow-x-hidden p-1'>
              {!isLoading && !hasResults && searchTerm.length > 0 && (
                <div className='py-6 text-center text-sm text-gray-500'>{emptyMessage}</div>
              )}

              {groups.length > 0
                ? groups.map((group, gIdx) =>
                    group.options.length > 0 ? (
                      <div key={group.label || gIdx} className='mb-2 last:mb-0'>
                        {group.label && (
                          <div className='px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase flex items-center gap-2 bg-gray-50/50 rounded-sm mb-1'>
                            {group.icon && <span className='h-3 w-3'>{group.icon}</span>}
                            {group.label}
                          </div>
                        )}
                        {renderOptionList(group.options, gIdx)}
                      </div>
                    ) : null
                  )
                : renderOptionList(options)}

              {isLoading && !hasResults && (
                <div className='py-6 text-center text-sm text-gray-500'>Searching...</div>
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {error && <p className='text-xs text-red-500 mt-1'>{error}</p>}
    </div>
  );
};

Combobox.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onValueChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      icon: PropTypes.node,
      options: PropTypes.array.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  emptyMessage: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
  disabled: PropTypes.bool,
  onSearchChange: PropTypes.func,
  searchTerm: PropTypes.string,
  isLoading: PropTypes.bool,
  renderItem: PropTypes.func,
  popoverClassName: PropTypes.string,
};

export default Combobox;
