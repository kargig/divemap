import { zodResolver } from '@hookform/resolvers/zod';
import { Wind, Info, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { bestMixSchema } from '../../utils/calculatorSchemas';

const BestMixCalculator = () => {
  const [bestMixResult, setBestMixResult] = useState({
    fO2: 32,
    fHe: 0,
    label: 'EAN32',
    details: {},
  });
  const [showDetails, setShowDetails] = useState(false);

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bestMixSchema),
    defaultValues: {
      depth: 33,
      pO2: 1.4,
      isTrimix: false,
      targetEAD: 30,
    },
    mode: 'onChange',
  });

  const values = watch();

  useEffect(() => {
    if (values.depth === '' || values.pO2 === '') return;

    const depth = Math.max(0, parseFloat(values.depth) || 0);
    const pO2Limit = parseFloat(values.pO2) || 1.4;
    // Effective depth for ATA calc is actual depth
    const ata = depth / 10 + 1;

    // 1. Maximize O2 based on pO2 limit
    let fO2 = pO2Limit / ata;
    if (fO2 > 1.0) fO2 = 1.0;

    let fHe = 0;
    let maxPPN2 = 0;
    let maxFN2 = 0;
    let ataEAD = 0;

    // 2. If Trimix, add Helium to limit Narcosis (END/EAD)
    if (values.isTrimix) {
      const targetEAD = parseFloat(values.targetEAD) || 30;
      ataEAD = targetEAD / 10 + 1;

      // Max allowed N2 partial pressure to simulate Air at target EAD
      // Air is 79% N2. pN2 at EAD = 0.79 * ataEAD
      maxPPN2 = 0.79 * ataEAD;

      // Max N2 fraction at ACTUAL depth to stay below that pN2
      maxFN2 = maxPPN2 / ata;

      // Current O2 takes up some space. Remainder is available for N2 + He.
      // We want to limit N2 to maxFN2.
      // So He = 1 - O2 - N2
      // But we use '1 - fO2' as the "available inert gas space"
      // If allowed N2 (maxFN2) is LESS than available space, we must fill the gap with He.
      const availableInert = 1 - fO2;

      if (maxFN2 < availableInert) {
        fHe = availableInert - maxFN2;
      }
    }

    const o2Pct = fO2 * 100;
    const hePct = fHe * 100;
    const n2Pct = 100 - o2Pct - hePct;

    let label = '';
    if (hePct > 0.1) {
      label = `Tx ${Math.floor(o2Pct)}/${Math.floor(hePct)}`;
    } else {
      if (Math.abs(o2Pct - 21) < 0.5) label = 'Air';
      else label = `EAN${Math.floor(o2Pct)}`;
    }

    setBestMixResult({
      fO2: o2Pct,
      fHe: hePct,
      label,
      details: {
        depth,
        ata,
        pO2Limit,
        fO2,
        isTrimix: values.isTrimix,
        targetEAD: parseFloat(values.targetEAD) || 30,
        ataEAD,
        maxPPN2,
        maxFN2,
        n2Pct,
      },
    });
  }, [values.depth, values.pO2, values.isTrimix, values.targetEAD]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-5 border-b border-gray-100 bg-emerald-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-emerald-600 rounded-lg text-white'>
            <Wind className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Best Gas Mix</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Calculate the ideal gas mix for your planned depth.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        <div>
          <label htmlFor='bestMixDepth' className='block text-sm font-semibold text-gray-700 mb-2'>
            Planned Depth (meters)
          </label>
          <input
            id='bestMixDepth'
            type='range'
            min='0'
            max='100'
            step='1'
            {...register('depth', { valueAsNumber: true })}
            className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600'
          />
          <div className='flex justify-between mt-2'>
            <span className='text-sm text-gray-500'>0m</span>
            <div className='flex flex-col items-center'>
              <span className='text-lg font-bold text-emerald-600'>{values.depth}m</span>
              {errors.depth && <span className='text-red-500 text-xs'>{errors.depth.message}</span>}
            </div>
            <span className='text-sm text-gray-500'>100m</span>
          </div>
        </div>

        <div>
          <label htmlFor='bestMixPO2' className='block text-sm font-semibold text-gray-700 mb-2'>
            Max pO<sub>2</sub> (bar)
          </label>
          <div id='bestMixPO2' className='grid grid-cols-3 gap-2'>
            {[1.2, 1.4, 1.6].map(val => (
              <button
                key={val}
                type='button'
                onClick={() => setValue('pO2', val)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  parseFloat(values.pO2) === val
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {val} bar
              </button>
            ))}
          </div>
          {errors.pO2 && <p className='text-red-500 text-xs mt-1'>{errors.pO2.message}</p>}
        </div>

        <div className='flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200'>
          <input
            id='trimixToggle'
            type='checkbox'
            {...register('isTrimix')}
            className='w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer'
          />
          <label
            htmlFor='trimixToggle'
            className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
          >
            Enable Trimix (Helium)
          </label>
        </div>

        {values.isTrimix && (
          <div>
            <label htmlFor='targetEAD' className='block text-sm font-semibold text-gray-700 mb-2'>
              Target EAD (meters)
            </label>
            <input
              id='targetEAD'
              type='range'
              min='0'
              max='60'
              step='1'
              {...register('targetEAD', { valueAsNumber: true })}
              className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600'
            />
            <div className='flex justify-between mt-2'>
              <span className='text-sm text-gray-500'>0m</span>
              <div className='flex flex-col items-center'>
                <span className='text-lg font-bold text-emerald-600'>{values.targetEAD}m</span>
                {errors.targetEAD && (
                  <span className='text-red-500 text-xs'>{errors.targetEAD.message}</span>
                )}
              </div>
              <span className='text-sm text-gray-500'>60m</span>
            </div>
          </div>
        )}

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && bestMixResult.details.ata && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1'>
              <span>1. Ambient Pressure</span>
            </div>
            <div className='flex justify-between'>
              <span>Formula:</span>
              <span>(Depth / 10) + 1</span>
            </div>
            <div className='flex justify-between'>
              <span>Calculation:</span>
              <span>
                ({bestMixResult.details.depth} / 10) + 1 = {bestMixResult.details.ata.toFixed(2)}{' '}
                ATA
              </span>
            </div>

            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
              <span>2. Oxygen Fraction</span>
            </div>
            <div className='flex justify-between'>
              <span>Formula:</span>
              <span>
                Max pO<sub>2</sub> / ATA
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Calculation:</span>
              <span>
                {bestMixResult.details.pO2Limit} / {bestMixResult.details.ata.toFixed(2)} ={' '}
                {bestMixResult.details.fO2.toFixed(3)}
              </span>
            </div>
            <div className='flex justify-between font-bold text-emerald-600'>
              <span>Result:</span>
              <span>
                {(bestMixResult.details.fO2 * 100).toFixed(1)}% O<sub>2</sub>
              </span>
            </div>

            {bestMixResult.details.isTrimix && (
              <>
                <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
                  <span>3. Nitrogen Limit (Narcosis)</span>
                </div>
                <div className='flex justify-between text-gray-500'>
                  <span>Target EAD:</span>
                  <span>{bestMixResult.details.targetEAD}m</span>
                </div>
                <div className='flex justify-between'>
                  <span>Allowed pN2 (at EAD):</span>
                  <span>
                    0.79 * {bestMixResult.details.ataEAD.toFixed(2)} ATA ={' '}
                    {bestMixResult.details.maxPPN2.toFixed(2)} bar
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Max N2 % (at Depth):</span>
                  <span>
                    {bestMixResult.details.maxPPN2.toFixed(2)} bar /{' '}
                    {bestMixResult.details.ata.toFixed(2)} ATA ={' '}
                    {(bestMixResult.details.maxFN2 * 100).toFixed(1)}%
                  </span>
                </div>

                <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
                  <span>4. Helium Fill</span>
                </div>
                <div className='flex justify-between'>
                  <span>Formula:</span>
                  <span>
                    100% - O<sub>2</sub>% - Max N<sub>2</sub>%
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Calculation:</span>
                  <span>
                    100 - {bestMixResult.fO2.toFixed(1)} -{' '}
                    {(bestMixResult.details.maxFN2 * 100).toFixed(1)}
                  </span>
                </div>
                <div className='flex justify-between font-bold text-purple-600'>
                  <span>Result:</span>
                  <span>{bestMixResult.fHe.toFixed(1)}% He</span>
                </div>
              </>
            )}
          </div>
        )}

        <div className='mt-2 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center'>
          <span className='text-sm uppercase tracking-wider font-bold text-emerald-800 mb-1'>
            Ideal Gas Mix
          </span>
          <div className='flex items-baseline'>
            <span className='text-5xl font-black text-emerald-600'>{bestMixResult.label}</span>
          </div>
          {bestMixResult.fHe > 0.1 && (
            <div className='mt-1 text-sm text-emerald-600 font-medium'>
              {bestMixResult.fO2.toFixed(0)}% O<sub>2</sub> / {bestMixResult.fHe.toFixed(0)}% He
            </div>
          )}
          {bestMixResult.fO2 > 40 && (
            <div className='mt-3 flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100'>
              <AlertTriangle className='h-3 w-3 mr-1' />
              Exceeds standard Nitrox (40%)
            </div>
          )}
        </div>
      </div>

      <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          Calculates Best Mix based on pO<sub>2</sub> limit. If Trimix is enabled, Helium is added
          to keep Equivalent Air Depth (EAD) within limits.
        </p>
      </div>
    </div>
  );
};

export default BestMixCalculator;
