import { zodResolver } from '@hookform/resolvers/zod';
import { Timer, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { sacRateSchema } from '../../utils/calculatorSchemas';
import { TANK_SIZES } from '../../utils/diveConstants';
import GasMixInput from '../forms/GasMixInput';

// Gas compressibility factor (Z) using Subsurface's virial model
const getZFactor = (bar, gas) => {
  // Clamp pressure as Subsurface does
  const p = Math.max(0, Math.min(bar, 500));

  // Coefficients from Subsurface (3rd order virial)
  const O2_COEFFS = [-7.18092073703e-4, 2.81852572808e-6, -1.50290620492e-9];
  const N2_COEFFS = [-2.19260353292e-4, 2.92844845532e-6, -2.07613482075e-9];
  const HE_COEFFS = [4.87320026468e-4, -8.83632921053e-8, 5.33304543646e-11];

  const virial = (coeffs, x) => {
    return x * coeffs[0] + x * x * coeffs[1] + x * x * x * coeffs[2];
  };

  // Subsurface uses permille (0-1000)
  const o2 = (gas?.o2 || 21) * 10;
  const he = (gas?.he || 0) * 10;
  const n2 = 1000 - o2 - he;

  const z_m1 = virial(O2_COEFFS, p) * o2 + virial(HE_COEFFS, p) * he + virial(N2_COEFFS, p) * n2;

  return z_m1 * 0.001 + 1.0;
};

// Calculate Real Gas Volume in Liters (at 1 atm)
const getRealVolume = (bar, tankSize, gas) => {
  if (!bar || !tankSize) return 0;
  const z = getZFactor(bar, gas);
  // Subsurface uses 1 atm (1.01325 bar) as the standard pressure for volume
  return (tankSize * (bar / 1.01325)) / z;
};

const SacRateCalculator = () => {
  const [sacResults, setSacResults] = useState({ ideal: 0, real: 0 });
  const [showDetails, setShowDetails] = useState(false);

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(sacRateSchema),
    defaultValues: {
      depth: 15,
      time: 45,
      tankSize: 12,
      startPressure: 220,
      endPressure: 50,
      gas: { o2: 21, he: 0 },
    },
    mode: 'onChange',
  });

  const values = watch();

  useEffect(() => {
    const depth = parseFloat(values.depth) || 0;
    const time = parseFloat(values.time) || 1;
    const tankSize = parseFloat(values.tankSize) || 12;
    const startPressure = parseFloat(values.startPressure) || 0;
    const endPressure = parseFloat(values.endPressure) || 0;
    const gas = values.gas || { o2: 21, he: 0 };

    const ata = depth / 10 + 1;

    // Ideal SAC Calculation
    const idealGasUsedBar = startPressure - endPressure;
    const idealGasUsedLiters = idealGasUsedBar * tankSize;
    let idealSac = 0;
    if (time > 0 && ata > 0) {
      idealSac = idealGasUsedLiters / time / ata;
    }

    // Real SAC Calculation
    const realVolStart = getRealVolume(startPressure, tankSize, gas);
    const realVolEnd = getRealVolume(endPressure, tankSize, gas);
    const realGasUsedLiters = Math.max(0, realVolStart - realVolEnd);
    let realSac = 0;
    if (time > 0 && ata > 0) {
      realSac = realGasUsedLiters / time / ata;
    }

    setSacResults({
      ideal: Math.max(0, idealSac),
      real: Math.max(0, realSac),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-3 sm:p-5 border-b border-gray-100 bg-purple-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-purple-600 rounded-lg text-white'>
            <Timer className='h-5 w-5 sm:h-6 sm:w-6' />
          </div>
          <h2 className='text-lg sm:text-xl font-bold text-gray-900'>SAC Rate Calculator</h2>
        </div>
        <p className='mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600'>
          Calculate your Surface Air Consumption rate to estimate gas usage.
        </p>
      </div>

      <div className='p-3 sm:p-6 flex-grow space-y-3 sm:space-y-6'>
        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='sacDepth'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Average Depth (meters)
            </label>
            <input
              id='sacDepth'
              type='number'
              min='0'
              {...register('depth', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm'
            />
            {errors.depth && <p className='text-red-500 text-xs mt-1'>{errors.depth.message}</p>}
          </div>

          <div>
            <label
              htmlFor='sacTime'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Bottom Time (minutes)
            </label>
            <input
              id='sacTime'
              type='number'
              min='1'
              {...register('time', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm'
            />
            {errors.time && <p className='text-red-500 text-xs mt-1'>{errors.time.message}</p>}
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='sacTankSize'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Cylinder Size (Liters)
            </label>
            <select
              id='sacTankSize'
              {...register('tankSize', { valueAsNumber: true })}
              onChange={e => {
                const newSize = parseFloat(e.target.value);
                setValue('tankSize', newSize);
                const tank = TANK_SIZES.find(t => t.size === newSize);
                if (tank) {
                  setValue('startPressure', tank.defaultPressure);
                }
              }}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm'
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

          <div>
            <label className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'>
              Gas Mix
            </label>
            <Controller
              name='gas'
              control={control}
              render={({ field }) => <GasMixInput value={field.value} onChange={field.onChange} />}
            />
            {errors.gas?.o2 && <p className='text-red-500 text-xs mt-1'>{errors.gas.o2.message}</p>}
            <p className='text-[10px] sm:text-xs text-gray-500 mt-1'>
              Gas mix affects compressibility (Z-factor) for Real SAC calculation.
            </p>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='sacStartPressure'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Start Pressure (bar)
            </label>
            <input
              id='sacStartPressure'
              type='number'
              min='0'
              max='300'
              {...register('startPressure', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm'
            />
            {errors.startPressure && (
              <p className='text-red-500 text-xs mt-1'>{errors.startPressure.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor='sacEndPressure'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              End Pressure (bar)
            </label>
            <input
              id='sacEndPressure'
              type='number'
              min='0'
              max='300'
              {...register('endPressure', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs sm:text-sm'
            />
            {errors.endPressure && (
              <p className='text-red-500 text-xs mt-1'>{errors.endPressure.message}</p>
            )}
          </div>
        </div>

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1'>
              <span>Ideal SAC (PV=nRT)</span>
            </div>
            <div className='flex justify-between'>
              <span>Gas Used (bar):</span>
              <span>
                {(
                  (parseFloat(values.startPressure) || 0) - (parseFloat(values.endPressure) || 0)
                ).toFixed(0)}{' '}
                bar
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Total Volume (Ideal):</span>
              <span>
                {(
                  ((parseFloat(values.startPressure) || 0) -
                    (parseFloat(values.endPressure) || 0)) *
                  (parseFloat(values.tankSize) || 12)
                ).toFixed(0)}{' '}
                L
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Ambient Pressure:</span>
              <span>{((parseFloat(values.depth) || 0) / 10 + 1).toFixed(2)} ATA</span>
            </div>

            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
              <span>Real SAC (Van der Waals)</span>
            </div>
            <div className='flex justify-between text-gray-500'>
              <span>Takes gas compressibility (Z-factor) into account.</span>
            </div>
          </div>
        )}

        <div className='mt-1 sm:mt-2 p-3 sm:p-6 bg-purple-50 rounded-2xl border border-purple-100 flex flex-col items-center justify-center text-center'>
          <span className='text-xs sm:text-sm uppercase tracking-wider font-bold text-purple-800 mb-1 sm:mb-2'>
            SAC Rate
          </span>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 w-full max-w-sm'>
            <div className='flex flex-col items-center p-1 sm:p-0'>
              <span className='text-[10px] sm:text-xs font-bold text-gray-500 mb-0.5 sm:mb-1'>
                IDEAL
              </span>
              <div className='flex items-baseline'>
                <span className='text-2xl sm:text-4xl font-black text-gray-400'>
                  {sacResults.ideal.toFixed(1)}
                </span>
                <span className='ml-1 text-[10px] sm:text-xs font-bold text-gray-400'>L/min</span>
              </div>
            </div>
            <div className='flex flex-col items-center p-1 sm:p-0 border-t sm:border-t-0 sm:border-l border-purple-100 sm:pl-8'>
              <span className='text-[10px] sm:text-xs font-bold text-purple-600 mb-0.5 sm:mb-1'>
                REAL
              </span>
              <div className='flex items-baseline'>
                <span className='text-3xl sm:text-5xl font-black text-purple-600'>
                  {sacResults.real.toFixed(1)}
                </span>
                <span className='ml-1 text-base sm:text-xl font-bold text-purple-400'>L/min</span>
              </div>
            </div>
          </div>
          <div className='mt-2 sm:mt-4 text-[10px] sm:text-xs text-purple-700 font-medium'>
            Real SAC is more accurate for high-pressure fills.
          </div>
        </div>
      </div>

      <div className='p-3 sm:p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <div className='space-y-1'>
          <p>
            <span className='font-bold'>Ideal SAC:</span> Uses the Ideal Gas Law (PV=nRT). Assumes
            gas compresses linearly. Good enough for low pressures.
          </p>
          <p>
            <span className='font-bold'>Real SAC:</span> Uses the Virial Equation to account for gas
            compressibility (Z-factor). Gases like Air and Nitrox compress <i>less</i> than ideal at
            high pressures, meaning you actually have less gas than the ideal formula suggests. This
            gives a truer reflection of your consumption.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SacRateCalculator;
