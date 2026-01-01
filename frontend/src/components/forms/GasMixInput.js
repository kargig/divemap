import React, { useState } from 'react';

import { GAS_MIXES } from '../../utils/diveConstants';

const GasMixInput = ({ value, onChange }) => {
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // 1. Derive matching preset from current value
  const matchingPreset = GAS_MIXES.find(
    g => g.id !== 'custom' && g.o2 === value?.o2 && g.he === value?.he
  );

  // 2. Determine what to show in dropdown
  // If we are explicitly editing custom, show 'custom'.
  // Otherwise, if we have a match, show that match.
  // Fallback to 'custom' if no match (implicit custom).
  const selectedPresetId = isEditingCustom
    ? 'custom'
    : matchingPreset
      ? matchingPreset.id
      : 'custom';

  const handlePresetChange = e => {
    const newPresetId = e.target.value;

    if (newPresetId === 'custom') {
      setIsEditingCustom(true);
      // No onChange call needed; we just switch UI mode to show inputs
      // Values remain what they were (e.g. Air), but now editable
    } else {
      setIsEditingCustom(false);
      const mix = GAS_MIXES.find(g => g.id === newPresetId);
      if (mix) {
        onChange({ o2: mix.o2, he: mix.he });
      }
    }
  };

  const handleCustomChange = (field, val) => {
    const numVal = parseInt(val) || 0;
    const newValue = { ...value, [field]: numVal };
    // Ensure we stay in custom mode while editing
    // (though implicit match check might find "Air" if we type 21/0,
    // keeping isEditingCustom=true prevents snapping back to non-editable state)
    onChange(newValue);
  };

  return (
    <div className='flex flex-col space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <select
          value={selectedPresetId}
          onChange={handlePresetChange}
          className='flex-1 min-w-[120px] rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
        >
          {GAS_MIXES.map(mix => (
            <option key={mix.id} value={mix.id}>
              {mix.name}
            </option>
          ))}
        </select>

        {selectedPresetId === 'custom' && (
          <div className='flex items-center gap-2'>
            <div className='relative w-20'>
              <input
                type='number'
                min='0'
                max='100'
                value={value?.o2 || ''}
                onChange={e => handleCustomChange('o2', e.target.value)}
                className='w-full rounded-md border-gray-300 pr-8 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                placeholder='O2'
              />
              <span className='absolute right-2 top-2 text-gray-500 text-xs'>%O2</span>
            </div>
            <div className='relative w-20'>
              <input
                type='number'
                min='0'
                max='100'
                value={value?.he || 0}
                onChange={e => handleCustomChange('he', e.target.value)}
                className='w-full rounded-md border-gray-300 pr-8 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                placeholder='He'
              />
              <span className='absolute right-2 top-2 text-gray-500 text-xs'>%He</span>
            </div>
          </div>
        )}
      </div>
      {/* Display computed mix label for clarity */}
      <div className='text-xs text-gray-500'>
        {value?.he > 0
          ? `Trimix ${value.o2}/${value.he}`
          : value?.o2 > 21
            ? `EAN${value.o2}`
            : value?.o2 === 21
              ? 'Air'
              : `O2: ${value?.o2}%`}
      </div>
    </div>
  );
};

export default GasMixInput;
