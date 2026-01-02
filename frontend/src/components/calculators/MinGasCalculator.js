import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { minGasSchema } from '../../utils/calculatorSchemas';
import { TANK_SIZES } from '../../utils/diveConstants';
import { calculatePressureFromVolume, SURFACE_PRESSURE_BAR } from '../../utils/physics';

const MinGasCalculator = () => {
  const [minGasResult, setMinGasResult] = useState({ liters: 0, barIdeal: 0, barReal: 0 });
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
      tankSize: 12,
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
    const depthATA = depth / 10 + SURFACE_PRESSURE_BAR;
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
        const avgAscentATA = avgAscentDepth / 10 + SURFACE_PRESSURE_BAR;
        volAscent = avgAscentATA * ascentTime * sac;
      }
      // No safety stop or surface ascent calculated for this gas in tech mode (gas switch assumed)
    } else {
      // Recreational Mode
      // 2. Ascent to Safety Stop (assume 5m)
      if (depth > 5) {
        const ascentTime = (depth - 5) / ascentRate;
        const avgAscentDepth = (depth + 5) / 2;
        const avgAscentATA = avgAscentDepth / 10 + SURFACE_PRESSURE_BAR;
        volAscent = avgAscentATA * ascentTime * sac;
      }

      // 3. Safety Stop at 5m
      const safetyStopATA = 5 / 10 + SURFACE_PRESSURE_BAR;
      volSafety = safetyStopATA * safetyStopDuration * sac;

      // 4. Ascent from 5m to Surface
      const shallowestDepth = Math.min(depth, 5);
      const surfaceAscentTime = shallowestDepth / ascentRate;
      const avgSurfaceDepth = shallowestDepth / 2;
      const avgSurfaceATA = avgSurfaceDepth / 10 + SURFACE_PRESSURE_BAR;
      volSurface = avgSurfaceATA * surfaceAscentTime * sac;
    }

    const totalLiters = volSolve + volAscent + volSafety + volSurface;

    // Ideal Gas Law
    const barIdeal = totalLiters / tankSize;

    // Real Gas Law (Assuming Air for simple calculation)
    const barReal = calculatePressureFromVolume(totalLiters, tankSize, { o2: 21, he: 0 });

    setMinGasResult({ liters: totalLiters, barIdeal, barReal });
    setBreakdown({
      volSolve,
      volAscent,
      volSafety,
      volSurface,
    });
  }, [depth, sac, solveTime, ascentRate, safetyStopDuration, tankSize, values.isTech, targetDepth]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-3 sm:p-5 border-b border-gray-100 bg-red-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-red-600 rounded-lg text-white'>
            <AlertTriangle className='h-5 w-5 sm:h-6 sm:w-6' />
          </div>
          <h2 className='text-lg sm:text-xl font-bold text-gray-900'>Minimum Gas (Rock Bottom)</h2>
        </div>
        <p className='mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600'>
          Calculate the emergency reserve needed to share air with a buddy and ascend from the
          deepest part of the dive.
        </p>
      </div>

      <div className='p-3 sm:p-6 flex-grow space-y-3 sm:space-y-6'>
        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='minGasDepth'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Depth (meters)
            </label>
            <input
              id='minGasDepth'
              type='number'
              min='0'
              {...register('depth', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            />
            {errors.depth && <p className='text-red-500 text-xs mt-1'>{errors.depth.message}</p>}
          </div>

          <div>
            <label
              htmlFor='minGasSAC'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Emergency SAC (L/min)
            </label>
            <input
              id='minGasSAC'
              type='number'
              min='10'
              {...register('sac', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            />
            {errors.sac && <p className='text-red-500 text-xs mt-1'>{errors.sac.message}</p>}
            <p className='text-[10px] sm:text-xs text-gray-500 mt-1'>
              Typically 60 L/min for two stressed divers (30 L/min each).
            </p>
          </div>
        </div>

        <div className='flex items-center p-2 sm:p-3 bg-gray-50 rounded-lg border border-gray-200'>
          <input
            id='techMinGasToggle'
            type='checkbox'
            {...register('isTech')}
            className='w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer'
          />
          <label
            htmlFor='techMinGasToggle'
            className='ml-2 text-xs sm:text-sm font-medium text-gray-700 cursor-pointer select-none'
          >
            Gas Switch Mode
          </label>
        </div>

        {values.isTech && (
          <div>
            <label
              htmlFor='minGasTargetDepth'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Target Depth / Gas Switch (meters)
            </label>
            <input
              id='minGasTargetDepth'
              type='number'
              min='0'
              max={depth || 100}
              {...register('targetDepth', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            />
            {errors.targetDepth && (
              <p className='text-red-500 text-xs mt-1'>{errors.targetDepth.message}</p>
            )}
            <p className='text-[10px] sm:text-xs text-gray-500 mt-1'>
              Depth where you switch to a deco gas.
            </p>
          </div>
        )}

        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='minGasSolveTime'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Time to Solve (min)
            </label>
            <input
              id='minGasSolveTime'
              type='number'
              min='0'
              {...register('solveTime', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            />
            {errors.solveTime && (
              <p className='text-red-500 text-xs mt-1'>{errors.solveTime.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor='minGasAscentRate'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Ascent Rate (m/min)
            </label>
            <input
              id='minGasAscentRate'
              type='number'
              min='1'
              {...register('ascentRate', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            />
            {errors.ascentRate && (
              <p className='text-red-500 text-xs mt-1'>{errors.ascentRate.message}</p>
            )}
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          {!values.isTech && (
            <div>
              <label
                htmlFor='minGasSafetyStopDuration'
                className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
              >
                Safety Stop (min)
              </label>
              <input
                id='minGasSafetyStopDuration'
                type='number'
                min='0'
                {...register('safetyStopDuration', { valueAsNumber: true })}
                className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
              />
              {errors.safetyStopDuration && (
                <p className='text-red-500 text-xs mt-1'>{errors.safetyStopDuration.message}</p>
              )}
              <p className='text-[10px] sm:text-xs text-gray-500 mt-1'>Usually 3 min at 5m.</p>
            </div>
          )}
          <div className={values.isTech ? 'col-span-2' : ''}>
            <label
              htmlFor='minGasTankSize'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Cylinder Size (Liters)
            </label>
            <select
              id='minGasTankSize'
              {...register('tankSize', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 text-xs sm:text-sm'
            >
              {TANK_SIZES.map(t => (
                <option key={t.id} value={t.size}>
                  {t.name}
                </option>
              ))}
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
                {(depth / 10 + SURFACE_PRESSURE_BAR).toFixed(2)} ATA * {solveTime} min * {sac}L ={' '}
                {breakdown.volSolve?.toFixed(0)} L
              </span>
            </div>
            <div className='text-[10px] text-gray-400 italic text-right mb-1'>
              * {SURFACE_PRESSURE_BAR} bar is Standard Surface Pressure (1 atm).
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
                    {(5 / 10 + SURFACE_PRESSURE_BAR).toFixed(2)} ATA * {safetyStopDuration} min *{' '}
                    {sac}L = {breakdown.volSafety?.toFixed(0)} L
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
              <span>Ideal Pressure:</span>
              <span>
                {minGasResult.liters.toFixed(0)} L / {tankSize}L ={' '}
                {minGasResult.barIdeal.toFixed(1)} bar
              </span>
            </div>
            <div className='flex justify-between text-gray-600 pt-1'>
              <span>Real Pressure (Z-Factor):</span>
              <span>{minGasResult.barReal.toFixed(1)} bar</span>
            </div>
            <div className='text-[10px] text-gray-400 italic mt-1'>
              Real Pressure accounts for gas becoming less compressible at high pressures.
            </div>
          </div>
        )}

        <div className='mt-1 sm:mt-2 p-3 sm:p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center justify-center text-center'>
          <span className='text-xs sm:text-sm uppercase tracking-wider font-bold text-red-800 mb-1 sm:mb-2'>
            Minimum Gas (Real)
          </span>
          <div className='flex items-baseline'>
            <span className='text-3xl sm:text-5xl font-black text-red-600'>
              {Math.ceil(minGasResult.barReal)}
            </span>
            <span className='ml-1 sm:ml-2 text-lg sm:text-xl font-bold text-red-400'>bar</span>
          </div>
          <p className='mt-1 sm:mt-2 text-xs sm:text-sm text-red-700 font-medium'>
            Reserve required (accounting for compressibility).
          </p>
        </div>

        <div className='p-3 sm:p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
          <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
          <p>
            This calculates the 'Rock Bottom' reserve using the Real Gas Law (Z-Factor), ensuring
            you have enough actual gas volume for an emergency ascent.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinGasCalculator;
