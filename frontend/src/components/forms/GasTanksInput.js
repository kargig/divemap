import { Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { UI_COLORS } from '../../utils/colorPalette';
import { TANK_SIZES } from '../../utils/diveConstants';

import GasMixInput from './GasMixInput';

const GasTanksInput = ({ value, onChange, error }) => {
  const [mode, setMode] = useState('simple'); // 'simple' | 'structured'
  const [structuredData, setStructuredData] = useState({
    back_gas: {
      tank: 'al80',
      start_pressure: 200,
      end_pressure: 50,
      gas: { o2: 21, he: 0 },
    },
    stages: [],
  });

  // Parse initial value
  useEffect(() => {
    try {
      if (value && value.trim().startsWith('{')) {
        const parsed = JSON.parse(value);
        if (parsed.mode === 'structured') {
          setMode('structured');
          // Migration for old format (pressure -> start_pressure)
          const migratedData = { ...parsed };

          if (
            migratedData.back_gas &&
            migratedData.back_gas.pressure !== undefined &&
            migratedData.back_gas.start_pressure === undefined
          ) {
            migratedData.back_gas.start_pressure = migratedData.back_gas.pressure;
            migratedData.back_gas.end_pressure = 50; // Default end pressure
            delete migratedData.back_gas.pressure;
          }

          if (migratedData.stages) {
            migratedData.stages = migratedData.stages.map(stage => {
              if (stage.pressure !== undefined && stage.start_pressure === undefined) {
                return {
                  ...stage,
                  start_pressure: stage.pressure,
                  end_pressure: 50, // Default end pressure
                };
              }
              return stage;
            });
          }

          setStructuredData(migratedData);
        } else {
          setMode('simple');
        }
      } else {
        setMode('simple');
      }
    } catch (e) {
      setMode('simple');
    }
  }, []); // Only run on mount

  // Sync structured data to parent as JSON string
  const updateParent = data => {
    // Add mode flag so we know how to parse it later
    const payload = { ...data, mode: 'structured' };
    onChange(JSON.stringify(payload));
  };

  const switchToStructured = () => {
    setMode('structured');
    updateParent(structuredData);
  };

  const switchToSimple = () => {
    if (
      window.confirm(
        'Switching to free-form text will lose the structured tank data selection. Continue?'
      )
    ) {
      setMode('simple');
      // Convert current structure to text as a starting point
      let text = '';
      const bg = structuredData.back_gas;
      const bgName = TANK_SIZES.find(t => t.id === bg.tank)?.name || bg.tank;
      text += `Back Gas: ${bgName} @ ${bg.start_pressure}->${bg.end_pressure}bar (${formatGas(bg.gas)})\n`;

      if (structuredData.stages.length > 0) {
        structuredData.stages.forEach((stg, idx) => {
          const stgName = TANK_SIZES.find(t => t.id === stg.tank)?.name || stg.tank;
          text += `Stage ${idx + 1}: ${stgName} @ ${stg.start_pressure}->${stg.end_pressure}bar (${formatGas(stg.gas)})\n`;
        });
      }
      onChange(text.trim());
    }
  };

  const formatGas = gas => {
    if (!gas) return 'Air';
    if (gas.he > 0) return `Tx ${gas.o2}/${gas.he}`;
    if (gas.o2 === 21) return 'Air';
    return `EAN${gas.o2}`;
  };

  // Handlers for Structured Mode
  const updateBackGas = (field, val) => {
    const newData = {
      ...structuredData,
      back_gas: {
        ...structuredData.back_gas,
        [field]: val,
      },
    };
    setStructuredData(newData);
    updateParent(newData);
  };

  const addStage = () => {
    const newData = {
      ...structuredData,
      stages: [
        ...structuredData.stages,
        {
          id: Date.now(),
          tank: 'al40',
          start_pressure: 200,
          end_pressure: 50,
          gas: { o2: 50, he: 0 },
        },
      ],
    };
    setStructuredData(newData);
    updateParent(newData);
  };

  const removeStage = idx => {
    const newStages = [...structuredData.stages];
    newStages.splice(idx, 1);
    const newData = { ...structuredData, stages: newStages };
    setStructuredData(newData);
    updateParent(newData);
  };

  const updateStage = (idx, field, val) => {
    const newStages = [...structuredData.stages];
    newStages[idx] = { ...newStages[idx], [field]: val };
    const newData = { ...structuredData, stages: newStages };
    setStructuredData(newData);
    updateParent(newData);
  };

  if (mode === 'simple') {
    return (
      <div className='space-y-2'>
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className='w-full border border-gray-300 rounded-md px-3 py-2'
          rows='3'
          placeholder='e.g., 12L aluminum tank, 200 bar...'
        />
        <div className='flex justify-end'>
          <button
            type='button'
            onClick={switchToStructured}
            className='text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1'
          >
            <RefreshCw size={14} />
            Switch to Tank Selector
          </button>
        </div>
        {error && <p className='text-red-500 text-sm mt-1'>{error}</p>}
      </div>
    );
  }

  // Structured Mode UI
  return (
    <div className='space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50'>
      <div className='flex justify-between items-center mb-2'>
        <h3 className='font-medium text-gray-700'>Gas Configuration</h3>
        <button
          type='button'
          onClick={switchToSimple}
          className='text-xs text-gray-500 hover:text-gray-700 underline'
        >
          Switch to free-form text
        </button>
      </div>

      {/* Back Gas Section */}
      <div className='bg-white p-3 rounded shadow-sm border border-gray-200'>
        <h4 className='text-sm font-semibold text-gray-800 mb-2 border-b pb-1'>Back Gas</h4>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-start'>
          <div className='md:col-span-4'>
            <label className='block text-xs font-medium text-gray-500 mb-1'>Cylinder</label>
            <select
              value={structuredData.back_gas.tank}
              onChange={e => updateBackGas('tank', e.target.value)}
              className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
            >
              {TANK_SIZES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className='md:col-span-4 grid grid-cols-2 gap-2'>
            <div>
              <label className='block text-xs font-medium text-gray-500 mb-1'>Start (bar)</label>
              <input
                type='number'
                value={structuredData.back_gas.start_pressure}
                onChange={e => updateBackGas('start_pressure', parseInt(e.target.value) || 0)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-gray-500 mb-1'>End (bar)</label>
              <input
                type='number'
                value={structuredData.back_gas.end_pressure}
                onChange={e => updateBackGas('end_pressure', parseInt(e.target.value) || 0)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
              />
            </div>
          </div>

          <div className='md:col-span-4'>
            <label className='block text-xs font-medium text-gray-500 mb-1'>Gas Mix</label>
            <GasMixInput
              value={structuredData.back_gas.gas}
              onChange={val => updateBackGas('gas', val)}
            />
          </div>
        </div>
      </div>

      {/* Stages Section */}
      <div className='space-y-2'>
        {structuredData.stages.map((stage, idx) => (
          <div
            key={stage.id || idx}
            className='bg-white p-3 rounded shadow-sm border border-gray-200 relative'
          >
            <button
              type='button'
              onClick={() => removeStage(idx)}
              className='absolute top-2 right-2 text-gray-400 hover:text-red-500'
              title='Remove Stage'
            >
              <Trash2 size={16} />
            </button>

            <h4 className='text-sm font-semibold text-gray-800 mb-2 border-b pb-1 pr-6'>
              Stage {idx + 1}
            </h4>

            <div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-start'>
              <div className='md:col-span-4'>
                <label className='block text-xs font-medium text-gray-500 mb-1'>Cylinder</label>
                <select
                  value={stage.tank}
                  onChange={e => updateStage(idx, 'tank', e.target.value)}
                  className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                >
                  <optgroup label='Stage Tanks'>
                    <option value='al40'>AL40 (5.7L)</option>
                    <option value='al80'>AL80 (11.1L)</option>
                  </optgroup>
                  <optgroup label='Other Sizes'>
                    {TANK_SIZES.filter(t => t.id !== 'al40' && t.id !== 'al80').map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className='md:col-span-4 grid grid-cols-2 gap-2'>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>
                    Start (bar)
                  </label>
                  <input
                    type='number'
                    value={stage.start_pressure}
                    onChange={e =>
                      updateStage(idx, 'start_pressure', parseInt(e.target.value) || 0)
                    }
                    className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>End (bar)</label>
                  <input
                    type='number'
                    value={stage.end_pressure}
                    onChange={e => updateStage(idx, 'end_pressure', parseInt(e.target.value) || 0)}
                    className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                  />
                </div>
              </div>

              <div className='md:col-span-4'>
                <label className='block text-xs font-medium text-gray-500 mb-1'>Gas Mix</label>
                <GasMixInput value={stage.gas} onChange={val => updateStage(idx, 'gas', val)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type='button'
        onClick={addStage}
        className='w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2 transition-colors'
      >
        <Plus size={16} />
        Add Stage Cylinder
      </button>

      {error && <p className='text-red-500 text-sm mt-1'>{error}</p>}
    </div>
  );
};

export default GasTanksInput;
