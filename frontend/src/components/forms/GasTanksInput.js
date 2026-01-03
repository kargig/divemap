import { Plus, Trash2, RefreshCw } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { TANK_SIZES } from '../../utils/diveConstants';

import GasMixInput from './GasMixInput';

const GasTanksInput = ({ value, onChange, error, showSwitchMode = true }) => {
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
    } catch {
      setMode('simple');
    }
  }, [value]); // Run when value changes to handle async data loading

  // Sync structured data to parent as JSON string
  const updateParent = data => {
    // Add mode flag so we know how to parse it later
    const payload = { ...data, mode: 'structured' };
    onChange(JSON.stringify(payload));
  };

  // Helper to parse free-form text into structured data
  const parseTextToStructured = text => {
    if (!text) return null;

    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    const newStructured = {
      back_gas: { ...structuredData.back_gas },
      stages: [],
    };

    let validTanksCount = 0;

    lines.forEach(line => {
      const lineLower = line.toLowerCase();

      // Skip common header lines or lines that are too short
      if (lineLower.includes('gas bottles used') || lineLower.length < 5) return;

      // 1. Try to match Tank Size numerically (best for "11.094l" -> 11.1)
      let tankId = 'al80';
      const sizeMatch = lineLower.match(/(\d+(?:\.\d+)?)\s*l/);
      if (sizeMatch) {
        const vol = parseFloat(sizeMatch[1]);
        let minDiff = 2.0; // Maximum 2 liter difference allowed for a match
        TANK_SIZES.forEach(t => {
          const diff = Math.abs(t.size - vol);
          if (diff < minDiff) {
            minDiff = diff;
            tankId = t.id;
          }
        });
      } else {
        // Fallback to string ID match (e.g. "al80" in text)
        for (const t of TANK_SIZES) {
          if (lineLower.includes(t.id.toLowerCase())) {
            tankId = t.id;
            break;
          }
        }
      }

      // 2. Extract Pressures
      let startP = 200;
      let endP = 50;
      const pressureMatch = line.match(
        /(\d+(?:\.\d+)?)\s*(?:bar)?\s*[→\->]\s*(\d+(?:\.\d+)?)\s*(?:bar)?/
      );
      if (pressureMatch) {
        startP = Math.round(parseFloat(pressureMatch[1]));
        endP = Math.round(parseFloat(pressureMatch[2]));
      } else {
        // If no pressure range, check for single pressure
        const singlePressureMatch = line.match(/(\d+(?:\.\d+)?)\s*bar/);
        if (singlePressureMatch) {
          startP = Math.round(parseFloat(singlePressureMatch[1]));
        }
      }

      // 3. Extract Gas Mix
      let o2 = 21;
      let he = 0;
      const txMatch = line.match(/Tx\s*(\d+)\/(\d+)/i);
      const eanMatch = line.match(/EAN(\d+)/i);
      const o2Match = line.match(/O2:\s*(\d+(?:\.\d+)?)%/i);
      const heMatch = line.match(/He:\s*(\d+(?:\.\d+)?)%/i);

      if (txMatch) {
        o2 = parseInt(txMatch[1]);
        he = parseInt(txMatch[2]);
      } else if (eanMatch) {
        o2 = parseInt(eanMatch[1]);
      } else if (o2Match) {
        o2 = Math.round(parseFloat(o2Match[1]));
      } else if (lineLower.includes('air')) {
        o2 = 21;
      }

      if (heMatch) {
        he = Math.round(parseFloat(heMatch[1]));
      }

      // Heuristic: If we found a tank size OR a pressure range, it's a valid tank
      if (sizeMatch || pressureMatch) {
        const tankObj = {
          tank: tankId,
          start_pressure: startP,
          end_pressure: endP,
          gas: { o2, he },
        };

        if (validTanksCount === 0) {
          newStructured.back_gas = tankObj;
        } else {
          newStructured.stages.push({ ...tankObj, id: Date.now() + validTanksCount });
        }
        validTanksCount++;
      }
    });

    return validTanksCount > 0 ? newStructured : null;
  };

  const switchToStructured = () => {
    // If in simple mode, try to parse current text value
    if (mode === 'simple' && value && !value.trim().startsWith('{')) {
      const parsed = parseTextToStructured(value);
      if (parsed) {
        setStructuredData(parsed);
        // We need to update parent with this parsed data immediately
        // The setMode('structured') will trigger re-render
        // But we should update parent with JSON string
        const payload = { ...parsed, mode: 'structured' };
        onChange(JSON.stringify(payload));
        setMode('structured');
        return;
      }
    }

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
      text += `Back Gas: ${bgName} @ ${bg.start_pressure}->${bg.end_pressure}bar (${formatGas(bg.gas)})
`;

      if (structuredData.stages.length > 0) {
        structuredData.stages.forEach((stg, idx) => {
          const stgName = TANK_SIZES.find(t => t.id === stg.tank)?.name || stg.tank;
          text += `Stage ${idx + 1}: ${stgName} @ ${stg.start_pressure}->${stg.end_pressure}bar (${formatGas(stg.gas)})
`;
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
        {showSwitchMode && (
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
        )}
        {error && <p className='text-red-500 text-sm mt-1'>{error}</p>}
      </div>
    );
  }

  // Structured Mode UI
  return (
    <div className='space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50'>
      <div className='flex justify-between items-center mb-2'>
        <h3 className='font-medium text-gray-700'>Gas Configuration</h3>
        {showSwitchMode && (
          <button
            type='button'
            onClick={switchToSimple}
            className='text-xs text-gray-500 hover:text-gray-700 underline'
          >
            Switch to free-form text
          </button>
        )}
      </div>

      {/* Back Gas Section */}
      <div className='bg-white p-3 rounded shadow-sm border border-gray-200'>
        <h4 className='text-sm font-semibold text-gray-800 mb-2 border-b pb-1'>Back Gas</h4>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-3 items-start'>
          <div className='md:col-span-4'>
            <label htmlFor='back-gas-tank' className='block text-xs font-medium text-gray-500 mb-1'>
              Cylinder
            </label>
            <select
              id='back-gas-tank'
              value={structuredData.back_gas.tank}
              onChange={e => updateBackGas('tank', e.target.value)}
              className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
              aria-label='Back gas cylinder'
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
              <label
                htmlFor='back-gas-start'
                className='block text-xs font-medium text-gray-500 mb-1'
              >
                Start (bar)
              </label>
              <input
                id='back-gas-start'
                type='number'
                value={structuredData.back_gas.start_pressure}
                onChange={e => updateBackGas('start_pressure', parseInt(e.target.value) || 0)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                aria-label='Back gas start pressure'
              />
            </div>
            <div>
              <label
                htmlFor='back-gas-end'
                className='block text-xs font-medium text-gray-500 mb-1'
              >
                End (bar)
              </label>
              <input
                id='back-gas-end'
                type='number'
                value={structuredData.back_gas.end_pressure}
                onChange={e => updateBackGas('end_pressure', parseInt(e.target.value) || 0)}
                className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                aria-label='Back gas end pressure'
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
                <label
                  htmlFor={`stage-${idx}-tank`}
                  className='block text-xs font-medium text-gray-500 mb-1'
                >
                  Cylinder
                </label>
                <select
                  id={`stage-${idx}-tank`}
                  value={stage.tank}
                  onChange={e => updateStage(idx, 'tank', e.target.value)}
                  className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                  aria-label={`Stage ${idx + 1} cylinder`}
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
                  <label
                    htmlFor={`stage-${idx}-start`}
                    className='block text-xs font-medium text-gray-500 mb-1'
                  >
                    Start (bar)
                  </label>
                  <input
                    id={`stage-${idx}-start`}
                    type='number'
                    value={stage.start_pressure}
                    onChange={e =>
                      updateStage(idx, 'start_pressure', parseInt(e.target.value) || 0)
                    }
                    className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                    aria-label={`Stage ${idx + 1} start pressure`}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`stage-${idx}-end`}
                    className='block text-xs font-medium text-gray-500 mb-1'
                  >
                    End (bar)
                  </label>
                  <input
                    id={`stage-${idx}-end`}
                    type='number'
                    value={stage.end_pressure}
                    onChange={e => updateStage(idx, 'end_pressure', parseInt(e.target.value) || 0)}
                    className='w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border'
                    aria-label={`Stage ${idx + 1} end pressure`}
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

GasTanksInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  showSwitchMode: PropTypes.bool,
};

export default GasTanksInput;
