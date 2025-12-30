import React, { useEffect, useState } from 'react';

import { GAS_MIXES } from '../../utils/diveConstants';

const GasMixInput = ({ value, onChange, label = 'Gas Mix' }) => {
  // Determine initial preset based on value
  const getInitialPreset = () => {
    if (!value) return 'air';
    const match = GAS_MIXES.find(g => g.id !== 'custom' && g.o2 === value.o2 && g.he === value.he);
    return match ? match.id : 'custom';
  };

  const [preset, setPreset] = useState(getInitialPreset());

  // Update preset if external value changes significantly (e.g. form reset)
  useEffect(() => {
    setPreset(getInitialPreset());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.o2, value?.he]);

  const handlePresetChange = e => {
    const newPresetId = e.target.value;
    setPreset(newPresetId);

    if (newPresetId !== 'custom') {
      const mix = GAS_MIXES.find(g => g.id === newPresetId);
      onChange({ o2: mix.o2, he: mix.he });
    }
  };

  const handleCustomChange = (field, val) => {
    const numVal = parseInt(val) || 0;
    const newValue = { ...value, [field]: numVal };

    // Simple validation clamp
    if (newValue.o2 + newValue.he > 100) {
      // Don't update if invalid? Or just let it be and validate elsewhere?
      // Let's clamp slightly or just allow it but it might look weird.
      // Better to just pass it up and let user fix.
    }

    onChange(newValue);
  };

  return (
    <div className='flex flex-col space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <select
          value={preset}
          onChange={handlePresetChange}
          className='flex-1 min-w-[120px] rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
        >
          {GAS_MIXES.map(mix => (
            <option key={mix.id} value={mix.id}>
              {mix.name}
            </option>
          ))}
        </select>

        {preset === 'custom' && (
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
