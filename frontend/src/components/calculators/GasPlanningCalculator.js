import { zodResolver } from '@hookform/resolvers/zod';
import { Compass, Info, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { gasPlanningSchema } from '../../utils/calculatorSchemas';
import { TANK_SIZES } from '../../utils/diveConstants';

const GasPlanningCalculator = () => {
  const [planGasResult, setPlanGasResult] = useState({
    diveGasLiters: 0,
    reserveGasLiters: 0,
    totalGasLiters: 0,
    totalPressure: 0,
    isSafe: true,
    remainingPressure: 0,
  });
  const [showDetails, setShowDetails] = useState(false);

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(gasPlanningSchema),
    defaultValues: {
      depth: 15,
      time: 45,
      sac: 15,
      tankSize: 12,
      pressure: 220,
      isAdvanced: false,
    },
    mode: 'onChange',
  });

  const values = watch();

  // Safe parsed values for calculation
  const depth = parseFloat(values.depth) || 0;
  const time = parseFloat(values.time) || 0;
  const sac = parseFloat(values.sac) || 0;
  const tankSize = parseFloat(values.tankSize) || 12;
  const pressure = parseFloat(values.pressure) || 0;

  useEffect(() => {
    const ata = depth / 10 + 1;
    const diveGasLiters = sac * ata * time;

    let totalGasLiters = 0;
    let reserveGasLiters = 0;

    if (values.isAdvanced) {
      // Rule of Thirds: Dive Gas = 2/3, Reserve = 1/3
      // Total = Dive * 1.5
      totalGasLiters = diveGasLiters * 1.5;
      reserveGasLiters = totalGasLiters - diveGasLiters;
    } else {
      // Standard: Total Required = Dive Gas
      totalGasLiters = diveGasLiters;
      reserveGasLiters = 0;
    }

    const totalPressure = totalGasLiters / tankSize;
    const isSafe = totalPressure <= pressure;
    const remainingPressure = pressure - totalPressure;

    setPlanGasResult({
      diveGasLiters,
      reserveGasLiters,
      totalGasLiters,
      totalPressure,
      isSafe,
      remainingPressure,
    });
  }, [depth, time, sac, tankSize, pressure, values.isAdvanced]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div
        className={`p-5 border-b border-gray-100 ${
          planGasResult.isSafe ? 'bg-orange-50/30' : 'bg-red-50'
        }`}
      >
        <div className='flex items-center space-x-3'>
          <div
            className={`p-2 rounded-lg text-white ${
              planGasResult.isSafe ? 'bg-orange-600' : 'bg-red-600'
            }`}
          >
            <Compass className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Gas Consumption</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Estimate the total gas volume consumed for your planned depth and bottom time.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label htmlFor='planDepth' className='block text-sm font-semibold text-gray-700 mb-2'>
              Average Depth (meters)
            </label>
            <input
              id='planDepth'
              type='number'
              min='0'
              {...register('depth', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
            />
            {errors.depth && <p className='text-red-500 text-xs mt-1'>{errors.depth.message}</p>}
          </div>

          <div>
            <label htmlFor='planTime' className='block text-sm font-semibold text-gray-700 mb-2'>
              Total Dive Time (minutes)
            </label>
            <input
              id='planTime'
              type='number'
              min='1'
              {...register('time', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
            />
            {errors.time && <p className='text-red-500 text-xs mt-1'>{errors.time.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor='planSAC' className='block text-sm font-semibold text-gray-700 mb-2'>
            SAC Rate (L/min)
          </label>
          <input
            id='planSAC'
            type='number'
            min='5'
            {...register('sac', { valueAsNumber: true })}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
          />
          {errors.sac && <p className='text-red-500 text-xs mt-1'>{errors.sac.message}</p>}
        </div>

        <div className='flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200'>
          <input
            id='advancedGasToggle'
            type='checkbox'
            {...register('isAdvanced')}
            className='w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer'
          />
          <label
            htmlFor='advancedGasToggle'
            className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
          >
            Advanced/Tech Mode (Rule of Thirds)
          </label>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label
              htmlFor='planTankSize'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Cylinder Size (Liters)
            </label>
            <select
              id='planTankSize'
              {...register('tankSize', { valueAsNumber: true })}
              onChange={e => {
                const newSize = parseFloat(e.target.value);
                setValue('tankSize', newSize);
                const tank = TANK_SIZES.find(t => t.size === newSize);
                if (tank) {
                  setValue('pressure', tank.defaultPressure);
                }
              }}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
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
            <label
              htmlFor='planTankPressure'
              className='block text-sm font-semibold text-gray-700 mb-2'
            >
              Max Pressure (bar)
            </label>
            <input
              id='planTankPressure'
              type='number'
              min='0'
              max='300'
              {...register('pressure', { valueAsNumber: true })}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
            />
            {errors.pressure && (
              <p className='text-red-500 text-xs mt-1'>{errors.pressure.message}</p>
            )}
          </div>
        </div>

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between'>
              <span>Ambient Pressure:</span>
              <span>
                ({depth}m / 10) + 1 = {(depth / 10 + 1).toFixed(2)} ATA
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Consumption at Depth:</span>
              <span>
                {sac.toFixed(1)} L/min * {(depth / 10 + 1).toFixed(2)} ATA ={' '}
                {(sac * (depth / 10 + 1)).toFixed(1)} L/min
              </span>
            </div>
            <div className='flex justify-between border-t border-gray-200 pt-1'>
              <span>Total Volume:</span>
              <span>
                {(sac * (depth / 10 + 1)).toFixed(1)} L/min * {time} min ={' '}
                {planGasResult.diveGasLiters.toFixed(0)} L
              </span>
            </div>
            <div className='flex justify-between'>
              <span>Pressure Required:</span>
              <span>
                {planGasResult.totalGasLiters.toFixed(0)} L / {tankSize}L ={' '}
                {planGasResult.totalPressure.toFixed(0)} bar
              </span>
            </div>
            {values.isAdvanced && (
              <div className='flex justify-between text-gray-400 border-t border-gray-100 pt-1'>
                <span>Rule of Thirds (x1.5):</span>
                <span>
                  {planGasResult.diveGasLiters.toFixed(0)} L * 1.5 ={' '}
                  {planGasResult.totalGasLiters.toFixed(0)} L
                </span>
              </div>
            )}
          </div>
        )}

        <div
          className={`mt-8 p-6 rounded-2xl border flex flex-col items-center justify-center text-center ${
            planGasResult.isSafe ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
          }`}
        >
          <span
            className={`text-sm uppercase tracking-wider font-bold mb-1 ${
              planGasResult.isSafe ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            Total Gas Consumed
          </span>
          <div className='flex items-baseline'>
            <span
              className={`text-5xl font-black ${
                planGasResult.isSafe ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {planGasResult.totalPressure.toFixed(0)}
            </span>
            <span
              className={`ml-2 text-xl font-bold ${
                planGasResult.isSafe ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              bar
            </span>
          </div>
          <div
            className={`mt-2 text-sm font-medium ${
              planGasResult.isSafe ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            ({planGasResult.totalGasLiters.toFixed(0)} Liters total)
          </div>

          {!planGasResult.isSafe && (
            <div className='mt-3 flex items-center text-red-600 bg-white px-3 py-2 rounded-lg text-sm font-bold border border-red-200 shadow-sm'>
              <AlertTriangle className='h-5 w-5 mr-2' />
              WARNING: Exceeds cylinder capacity ({pressure} bar)
            </div>
          )}

          {planGasResult.isSafe && !values.isAdvanced && planGasResult.remainingPressure < 50 && (
            <div className='mt-3 flex items-center text-amber-600 bg-white px-3 py-2 rounded-lg text-sm font-bold border border-amber-200 shadow-sm'>
              <AlertTriangle className='h-5 w-5 mr-2' />
              WARNING: Low reserve ({planGasResult.remainingPressure.toFixed(0)} bar left)
            </div>
          )}

          {planGasResult.isSafe && (values.isAdvanced || planGasResult.remainingPressure >= 50) && (
            <div className='mt-3 flex items-center text-emerald-600 bg-white px-3 py-1 rounded-full text-xs font-medium border border-emerald-200'>
              <div className='w-2 h-2 rounded-full bg-emerald-500 mr-2'></div>
              Within safe limits (Max {pressure} bar)
            </div>
          )}

          <div className='mt-4 w-full grid grid-cols-2 gap-2 text-xs'>
            <div className='bg-white p-2 rounded border border-gray-200'>
              <div className='font-bold text-gray-500'>Dive Gas</div>
              <div className='text-gray-900 font-bold text-base'>
                {planGasResult.diveGasLiters.toFixed(0)} L
                <span className='text-gray-400 font-normal ml-1'>
                  ({(planGasResult.diveGasLiters / tankSize).toFixed(0)} bar)
                </span>
              </div>
            </div>
            {values.isAdvanced && (
              <div className='bg-white p-2 rounded border border-orange-200'>
                <div className='font-bold text-gray-500'>Reserve (1/3)</div>
                <div className='text-gray-900 font-bold text-base'>
                  {planGasResult.reserveGasLiters.toFixed(0)} L
                  <span className='text-gray-400 font-normal ml-1'>
                    ({(planGasResult.reserveGasLiters / tankSize).toFixed(0)} bar)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          {values.isAdvanced
            ? 'Total Gas = (SAC * ATA * Time) * 1.5. Uses Rule of Thirds to ensure you only use 2/3 of your gas for the planned dive profile.'
            : 'Total Gas = SAC * ATA * Time. Calculates estimated total gas usage for your planned bottom time.'}
        </p>
      </div>
    </div>
  );
};

export default GasPlanningCalculator;
