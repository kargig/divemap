import PropTypes from 'prop-types';
import React, { useMemo } from 'react';

import Combobox from './ui/Combobox';

const DivingCenterSearchableDropdown = ({
  divingCenters = [],
  selectedId,
  onSelect,
  placeholder = 'Search for a diving center...',
  label = 'Diving Center',
  error,
  required = false,
  className = '',
  id = 'diving-center-search',
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const options = useMemo(() => {
    const formattedOptions = divingCenters.map(center => ({
      value: center.id.toString(),
      label: center.country ? `${center.name} (${center.country})` : center.name,
    }));

    if (!searchTerm.trim()) return formattedOptions;

    const lowerSearchTerm = searchTerm.toLowerCase();
    return formattedOptions.filter(option => option.label.toLowerCase().includes(lowerSearchTerm));
  }, [divingCenters, searchTerm]);

  const handleValueChange = value => {
    const selectedCenter = divingCenters.find(c => c.id.toString() === value.toString());
    onSelect(value || null, selectedCenter ? selectedCenter.name : '');
  };

  return (
    <Combobox
      id={id}
      label={label}
      value={selectedId ? selectedId.toString() : ''}
      onValueChange={handleValueChange}
      options={options}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      placeholder={placeholder}
      searchPlaceholder='Type to filter diving centers...'
      emptyMessage='No diving centers found.'
      error={error}
      required={required}
      className={className}
    />
  );
};

DivingCenterSearchableDropdown.propTypes = {
  divingCenters: PropTypes.array.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default DivingCenterSearchableDropdown;
