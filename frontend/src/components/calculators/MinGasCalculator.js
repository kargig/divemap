import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { minGasSchema } from '../../utils/calculatorSchemas';

const MinGasCalculator = () => {
  const [minGasResult, setMinGasResult] = useState({ liters: 0, bar: 0 });
  const [showDetails, setShowDetails] = useState(false);
  const [breakdown, setBreakdown] = useState({});

  const {
    register,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(minGasSchema),
    defaultValues: {
      depth: 30,
      sac: 60,
      solveTime: 1,
      ascentRate: 10,
      safetyStopDuration: 3,
      tankSize: 24,
      isTech: false,
      targetDepth: 21,
    },
    mode: 'onChange',
  });

  const values = watch();

  const depth = parseFloat(values.depth) || 0;
  const sac = parseFloat(values.sac) || 0;
  const solveTime = parseFloat(values.solveTime) || 0;
  const ascentRate = parseFloat(values.ascentRate) || 1; // prevent div by 0
  const safetyStopDuration = parseFloat(values.safetyStopDuration) || 0;
  const tankSize = parseFloat(values.tankSize) || 24;
  const targetDepth = parseFloat(values.targetDepth) || 0;

  useEffect(() => {
    // 1. Problem Solving at Depth (1 min typically)
    const depthATA = depth / 10 + 1;
    const volSolve = depthATA * solveTime * sac;

    let volAscent = 0;
    let volSafety = 0;
    let volSurface = 0;

    if (values.isTech) {
      // Tech Mode: Ascent to Target Depth (Gas Switch)
      // We assume we switch gas immediately upon reaching target depth.
      if (depth > targetDepth) {
        const ascentTime = (depth - targetDepth) / ascentRate;
        const avgAscentDepth = (depth + targetDepth) / 2;
        const avgAscentATA = avgAscentDepth / 10 + 1;
        volAscent = avgAscentATA * ascentTime * sac;
      }
      // No safety stop or surface ascent calculated for this gas in tech mode (gas switch assumed)
    } else {
      // Recreational Mode
      // 2. Ascent to Safety Stop (assume 5m)
      if (depth > 5) {
        const ascentTime = (depth - 5) / ascentRate;
        const avgAscentDepth = (depth + 5) / 2;
        const avgAscentATA = avgAscentDepth / 10 + 1;
        volAscent = avgAscentATA * ascentTime * sac;
      }

      // 3. Safety Stop at 5m
      const safetyStopATA = 5 / 10 + 1; // 1.5 ATA
      volSafety = safetyStopATA * safetyStopDuration * sac;

      // 4. Ascent from 5m to Surface
      const shallowestDepth = Math.min(depth, 5);
      const surfaceAscentTime = shallowestDepth / ascentRate;
      const avgSurfaceDepth = shallowestDepth / 2;
      const avgSurfaceATA = avgSurfaceDepth / 10 + 1;
      volSurface = avgSurfaceATA * surfaceAscentTime * sac;
    }

    const totalLiters = volSolve + volAscent + volSafety + volSurface;
    const totalBar = totalLiters / tankSize;

    setMinGasResult({ liters: totalLiters, bar: totalBar });
    setBreakdown({
      volSolve,
      volAscent,
      volSafety,
      volSurface,
    });
  }, [depth, sac, solveTime, ascentRate, safetyStopDuration, tankSize, values.isTech, targetDepth]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-5 border-b border-gray-100 bg-red-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-red-600 rounded-lg text-white'>
            <AlertTriangle className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Minimum Gas (Rock Bottom)</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Calculate the emergency reserve needed to share air with a buddy and ascend from the
          deepest part of the dive.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        <div>
          <label htmlFor='minGasDepth' className='block text-sm font-semibold text-gray-700 mb-2'>
            Depth (meters)
          </label>
          <input
            id='minGasDepth'
            type='number'
            min='0'
            {...register('depth', { valueAsNumber: true })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
          />
          {errors.depth && <p className='text-red-500 text-xs mt-1'>{errors.depth.message}</p>}
        </div>

        <div>
          <label htmlFor='minGasSAC' className='block text-sm font-semibold text-gray-700 mb-2'>
            Emergency SAC (L/min)
          </label>
          <input
            id='minGasSAC'
            type='number'
            min='10'
            {...register('sac', { valueAsNumber: true })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
          />
          {errors.sac && <p className='text-red-500 text-xs mt-1'>{errors.sac.message}</p>}
          <p className='text-xs text-gray-500 mt-1'>
            Typically 60 L/min for two stressed divers (30 L/min each).
          </p>
        </div>

        <div className='flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200'>
          <input
            id='techMinGasToggle'
            type='checkbox'
            {...register('isTech')}
            className='w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer'
          />
          <label
            htmlFor='techMinGasToggle'
            className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
          >
            Gas Switch Mode
          </label>
        </div>

        {values.isTech && (
          <div>
            <label
              htmlFor='minGasTargetDepth'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Target Depth / Gas Switch (meters)
            </label>
            <input
              id='minGasTargetDepth'
              type='number'
              min='0'
              max={depth || 100}
              {...register('targetDepth', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
            />
            {errors.targetDepth && (
              <p className='text-red-500 text-xs mt-1'>{errors.targetDepth.message}</p>
            )}
            <p className='text-xs text-gray-500 mt-1'>Depth where you switch to a deco gas.</p>
          </div>
        )}

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label
              htmlFor='minGasSolveTime'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Time to Solve (min)
            </label>
            <input
              id='minGasSolveTime'
              type='number'
              min='0'
              {...register('solveTime', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
            />
            {errors.solveTime && (
              <p className='text-red-500 text-xs mt-1'>{errors.solveTime.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor='minGasAscentRate'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Ascent Rate (m/min)
            </label>
            <input
              id='minGasAscentRate'
              type='number'
              min='1'
              {...register('ascentRate', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
            />
            {errors.ascentRate && (
              <p className='text-red-500 text-xs mt-1'>{errors.ascentRate.message}</p>
            )}
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          {!values.isTech && (
            <div>
              <label
                htmlFor='minGasSafetyStopDuration'
                className='block text-sm font-semibold text-gray-700 mb-2'
              >
                Safety Stop (min)
              </label>
              <input
                id='minGasSafetyStopDuration'
                type='number'
                min='0'
                {...register('safetyStopDuration', { valueAsNumber: true })}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
              />
              {errors.safetyStopDuration && (
                <p className='text-red-500 text-xs mt-1'>{errors.safetyStopDuration.message}</p>
              )}
              <p className='text-xs text-gray-500 mt-1'>Usually 3 min at 5m.</p>
            </div>
          )}
          <div className={values.isTech ? 'col-span-2' : ''}>
            <label
              htmlFor='minGasTankSize'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Cylinder Size (Liters)
            </label>
            <select
              id='minGasTankSize'
              {...register('tankSize', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500'
            >
              <option value='7'>7 Liters</option>
              <option value='8.5'>8.5 Liters</option>
              <option value='10'>10 Liters</option>
              <option value='11.1'>11.1 Liters (AL80)</option>
              <option value='12'>12 Liters</option>
              <option value='14'>14 Liters (Double 7s)</option>
              <option value='15'>15 Liters</option>
              <option value='17'>Double 8.5s (17L)</option>
              <option value='18'>18 Liters</option>
              <option value='20'>Double 10s (20L)</option>
              <option value='22.2'>22.2 Liters (Double AL80)</option>
              <option value='24'>24 Liters (Double 12s)</option>
            </select>
            {errors.tankSize && (
              <p className='text-red-500 text-xs mt-1'>{errors.tankSize.message}</p>
            )}
          </div>
        </div>

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-red-600 hover:text-red-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between'>
              <span>Solve Problem:</span>
              <span>
                {depth / 10 + 1} ATA * {solveTime} min * {sac}L = {breakdown.volSolve?.toFixed(0)} L
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Ascent Gas:</span>
              <span>{breakdown.volAscent?.toFixed(0)} L</span>
            </div>
            {!values.isTech && (
              <>
                <div className='flex justify-between'>
                  <span>Safety Stop:</span>
                  <span>
                    1.5 ATA * {safetyStopDuration} min * {sac}L = {breakdown.volSafety?.toFixed(0)}{' '}
                    L
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Surface Ascent:</span>
                  <span>{breakdown.volSurface?.toFixed(0)} L</span>
                </div>
              </>
            )}
            <div className='flex justify-between border-t border-gray-200 pt-1 font-bold'>
              <span>Total Volume:</span>
              <span>{minGasResult.liters.toFixed(0)} L</span>
            </div>
            <div className='flex justify-between text-gray-400'>
              <span>In Bar:</span>
              <span>
                {minGasResult.liters.toFixed(0)} L / {tankSize}L = {minGasResult.bar.toFixed(1)} bar
              </span>
            </div>
          </div>
        )}

        <div className='mt-2 p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center'>
          <span className='text-sm uppercase tracking-wider font-bold text-red-800 mb-1'>
            Minimum Gas
          </span>
          <div className='flex items-baseline'>
            <span className='text-5xl font-black text-red-600'>{Math.ceil(minGasResult.bar)}</span>
            <span className='ml-2 text-xl font-bold text-red-400'>bar</span>
          </div>
          <p className='mt-2 text-sm text-red-700 font-medium'>
            Reserve required for safe ascent in emergency.
          </p>
        </div>

        <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
          <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
          <p>
            This calculates the 'Rock Bottom' or 'Minimum Gas' reserve. This is the amount of gas
            required to handle a stress situation at the deepest point and perform a safe ascent for
            two divers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinGasCalculator;
