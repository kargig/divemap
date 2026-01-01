import { zodResolver } from '@hookform/resolvers/zod';
import { Gauge, Info, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { modSchema } from '../../utils/calculatorSchemas';
import GasMixInput from '../forms/GasMixInput';

const ModCalculator = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(modSchema),
    defaultValues: {
      gas: { o2: 32, he: 0 },
      pO2: 1.4,
    },
    mode: 'onChange',
  });

  const gas = watch('gas');
  const pO2 = watch('pO2');

  // Calculate results directly during render (derived state)
  const calculateResults = () => {
    if (!gas || !pO2) return { mod: 0, end: 0, ata: 0, fO2: 0, fHe: 0 };

    const fO2 = gas.o2 / 100;
    const fHe = (gas.he || 0) / 100;

    if (fO2 <= 0) return { mod: 0, end: 0, ata: 0, fO2, fHe };

    // 1. Calculate Max Ambient Pressure (ATA)
    const maxAta = parseFloat(pO2) / fO2;

    // 2. Calculate MOD (Depth)
    const mod = (maxAta - 1) * 10;

    // 3. Calculate END
    const endAta = maxAta * (1 - fHe);
    const end = (endAta - 1) * 10;

    return {
      mod: Math.max(0, mod),
      end: Math.max(0, end),
      ata: maxAta,
      fO2,
      fHe,
    };
  };

  const result = calculateResults();

  const handleSliderChange = e => {
    const newO2 = parseFloat(e.target.value);
    setValue('gas', { o2: newO2, he: 0 });
  };

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-5 border-b border-gray-100 bg-blue-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-blue-600 rounded-lg text-white'>
            <Gauge className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Maximum Operating Depth (MOD)</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Calculate the maximum depth for a given gas mixture and partial pressure of oxygen.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        <div className='flex justify-end'>
          <div className='flex items-center space-x-2 text-sm'>
            <span className={!isAdvanced ? 'font-bold text-blue-600' : 'text-gray-500'}>
              Standard (Nitrox)
            </span>
            <button
              aria-label='Toggle Advanced Mode'
              onClick={() => {
                setIsAdvanced(!isAdvanced);
                // Reset Helium when switching back to Standard
                if (isAdvanced) {
                  setValue('gas', { ...gas, he: 0 });
                }
              }}
              className={`relative inline-flex h-6 w-11 !min-h-0 !p-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isAdvanced ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`${
                  isAdvanced ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </button>
            <span className={isAdvanced ? 'font-bold text-blue-600' : 'text-gray-500'}>
              Advanced (Trimix)
            </span>
          </div>
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Gas Mixture (
            {isAdvanced ? (
              <span>
                O<sub>2</sub> / He
              </span>
            ) : (
              `Nitrox ${gas?.o2}%`
            )}
            )
          </label>

          {!isAdvanced ? (
            <div className='space-y-4'>
              <input
                type='range'
                min='21'
                max='100'
                step='1'
                value={gas?.o2 || 21}
                onChange={handleSliderChange}
                className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600'
              />
              <div className='flex justify-between text-xs text-gray-500 font-medium'>
                <span>Air (21%)</span>
                <span>
                  O<sub>2</sub> (100%)
                </span>
              </div>
              <div className='flex justify-center'>
                <div className='bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-xl shadow-sm border border-blue-100'>
                  {gas?.o2 === 21 ? 'Air' : `EAN${gas?.o2}`}
                </div>
              </div>
            </div>
          ) : (
            <Controller
              name='gas'
              control={control}
              render={({ field }) => <GasMixInput value={field.value} onChange={field.onChange} />}
            />
          )}
          {errors.gas?.o2 && <p className='text-red-500 text-xs mt-1'>{errors.gas.o2.message}</p>}
        </div>

        <div>
          <label htmlFor='modPO2' className='block text-sm font-semibold text-gray-700 mb-2'>
            Max pO<sub>2</sub> (bar)
          </label>
          <div id='modPO2' className='grid grid-cols-3 gap-2'>
            {[1.2, 1.4, 1.6].map(val => (
              <button
                key={val}
                onClick={() => setValue('pO2', val)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  parseFloat(pO2) === val
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {val} bar
              </button>
            ))}
          </div>
          {errors.pO2 && <p className='text-red-500 text-xs mt-1'>{errors.pO2.message}</p>}
          <p className='mt-2 text-xs text-gray-500'>
            1.4 bar is recommended for recreational diving, 1.6 bar for deco.
          </p>
        </div>

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && gas && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1'>
              <span>1. Max Ambient Pressure</span>
            </div>
            <div className='flex justify-between'>
              <span>Formula:</span>
              <span>
                Max pO<sub>2</sub> / Fraction O<sub>2</sub>
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Calculation:</span>
              <span>
                {pO2} / {result.fO2.toFixed(2)} = {result.ata.toFixed(2)} ATA
              </span>
            </div>

            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
              <span>2. Maximum Depth</span>
            </div>
            <div className='flex justify-between'>
              <span>Formula:</span>
              <span>(ATA - 1) * 10</span>
            </div>
            <div className='flex justify-between font-bold text-blue-600'>
              <span>Result:</span>
              <span>{result.mod.toFixed(1)} m</span>
            </div>

            {result.fHe > 0 && (
              <>
                <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
                  <span>3. Equivalent Narcotic Depth</span>
                </div>
                <div className='flex justify-between'>
                  <span>Logic:</span>
                  <span>
                    Treating O<sub>2</sub> as Narcotic (Standard)
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Calculation:</span>
                  <span>
                    ({result.mod.toFixed(1)}m + 10) * (1 - {result.fHe.toFixed(2)}) - 10
                  </span>
                </div>
                <div className='flex justify-between font-bold text-purple-600'>
                  <span>END at MOD:</span>
                  <span>{result.end.toFixed(1)} m</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className='mt-2 p-6 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center'>
          <span className='text-sm uppercase tracking-wider font-bold text-blue-800 mb-1'>
            Max Operating Depth
          </span>
          <div className='flex items-baseline'>
            <span className='text-5xl font-black text-blue-600'>{result.mod.toFixed(1)}</span>
            <span className='ml-2 text-xl font-bold text-blue-400'>m</span>
          </div>
          {result.fHe > 0 && (
            <div className='mt-2 text-sm font-medium text-purple-700'>
              END at limit: {result.end.toFixed(1)}m
            </div>
          )}
          {result.mod > 60 && !result.fHe && (
            <div className='mt-3 flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100'>
              <AlertTriangle className='h-3 w-3 mr-1' />
              Warning: Exceeds 60m on Air/Nitrox
            </div>
          )}
        </div>
      </div>

      <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          Formula: MOD = (pO<sub>2</sub>_max / fO<sub>2</sub> - 1) * 10.
          {result.fHe > 0 ? (
            <span>
              {' '}
              Includes Helium (Trimix) calculation for Narcotic Depth (assuming O<sub>2</sub> is
              narcotic).
            </span>
          ) : (
            ' Based on standard salt water density.'
          )}
        </p>
      </div>
    </div>
  );
};

export default ModCalculator;
