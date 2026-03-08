import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { gasFillSchema } from '../../utils/calculatorSchemas';
import { TANK_SIZES } from '../../utils/diveConstants';
import GasMixInput from '../forms/GasMixInput';

const GasFillPriceCalculator = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [results, setResults] = useState({
    totalVolume: 0,
    totalO2: 0,
    addedO2: 0,
    totalHe: 0,
    airVolume: 0,
    airO2Liters: 0,
    totalCost: 0,
    o2Cost: 0,
    heCost: 0,
  });

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(gasFillSchema),
    defaultValues: {
      tankSize: 12,
      pressure: 220,
      gas: { o2: 32, he: 0 },
      o2Price: 0.02,
      hePrice: 0.1,
    },
    mode: 'onChange',
  });

  const values = watch();

  useEffect(() => {
    const tankSize = parseFloat(values.tankSize) || 0;
    const pressure = parseFloat(values.pressure) || 0;
    const o2Price = parseFloat(values.o2Price) || 0;
    const hePrice = parseFloat(values.hePrice) || 0;
    const gas = values.gas || { o2: 21, he: 0 };

    const totalVolume = tankSize * pressure;
    const o2Fraction = (gas.o2 || 21) / 100;
    const heFraction = (gas.he || 0) / 100;
    const n2Fraction = Math.max(0, 1 - o2Fraction - heFraction);

    // Calculate Helium Cost (pay for all Helium)
    const totalHeLiters = totalVolume * heFraction;
    const heCost = totalHeLiters * hePrice;

    // Calculate Added Oxygen Cost (pay for O2 above what's in Air top-up)
    // Air is ~79% N2. The amount of Air we can use is limited by the required N2.
    // Equivalent Air Volume = N2 Volume / 0.79
    const totalN2Liters = totalVolume * n2Fraction;
    const airVolume = totalN2Liters / 0.79;

    // O2 provided free by the air
    const airO2Liters = airVolume * 0.21;

    // Total O2 needed
    const totalO2Liters = totalVolume * o2Fraction;

    // Added O2 (cannot be negative)
    const addedO2Liters = Math.max(0, totalO2Liters - airO2Liters);
    const o2Cost = addedO2Liters * o2Price;

    setResults({
      totalVolume,
      totalO2: totalO2Liters,
      addedO2: addedO2Liters,
      totalHe: totalHeLiters,
      airVolume,
      airO2Liters,
      o2Cost: o2Cost,
      heCost: heCost,
      totalCost: o2Cost + heCost,
    });
  }, [JSON.stringify(values)]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-3 sm:p-5 border-b border-gray-100 bg-emerald-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-emerald-600 rounded-lg text-white'>
            <Coins className='h-5 w-5 sm:h-6 sm:w-6' />
          </div>
          <h2 className='text-lg sm:text-xl font-bold text-gray-900'>Gas Fill Price</h2>
        </div>
        <p className='mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600'>
          Estimate the cost of a gas fill based on component prices.
        </p>
      </div>

      <div className='p-3 sm:p-6 flex-grow space-y-3 sm:space-y-6'>
        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='tankSize'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Cylinder Size (Liters)
            </label>
            <select
              id='tankSize'
              {...register('tankSize', { valueAsNumber: true })}
              onChange={e => {
                const newSize = parseFloat(e.target.value);
                setValue('tankSize', newSize);
                const tank = TANK_SIZES.find(t => t.size === newSize);
                if (tank) {
                  setValue('pressure', tank.defaultPressure);
                }
              }}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm'
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
              htmlFor='pressure'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              Fill Pressure (bar)
            </label>
            <input
              id='pressure'
              type='number'
              min='0'
              max='400'
              {...register('pressure', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm'
            />
            {errors.pressure && (
              <p className='text-red-500 text-xs mt-1'>{errors.pressure.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'>
            Target Gas Mix
          </label>
          <Controller
            name='gas'
            control={control}
            render={({ field }) => <GasMixInput value={field.value} onChange={field.onChange} />}
          />
          {errors.gas?.o2 && <p className='text-red-500 text-xs mt-1'>{errors.gas.o2.message}</p>}
        </div>

        <div className='grid grid-cols-2 gap-2 sm:gap-4'>
          <div>
            <label
              htmlFor='o2Price'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              O<sub>2</sub> Price (€/Liter)
            </label>
            <input
              id='o2Price'
              type='number'
              step='0.01'
              min='0'
              {...register('o2Price', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm'
            />
            {errors.o2Price && (
              <p className='text-red-500 text-xs mt-1'>{errors.o2Price.message}</p>
            )}
          </div>
          <div>
            <label
              htmlFor='hePrice'
              className='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
            >
              He Price (€/Liter)
            </label>
            <input
              id='hePrice'
              type='number'
              step='0.01'
              min='0'
              {...register('hePrice', { valueAsNumber: true })}
              className='w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs sm:text-sm'
            />
            {errors.hePrice && (
              <p className='text-red-500 text-xs mt-1'>{errors.hePrice.message}</p>
            )}
          </div>
        </div>

        <div className='flex justify-end'>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && (
          <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs font-mono text-gray-600 animate-in fade-in slide-in-from-top-1 duration-200'>
            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1'>
              <span>Volume Analysis</span>
            </div>
            <div className='flex justify-between'>
              <span>Total Gas Volume:</span>
              <span>{results.totalVolume.toFixed(0)} L</span>
            </div>
            <div className='flex justify-between'>
              <div className='flex flex-col'>
                <span>Total Helium Needed:</span>
                <span className='text-[10px] text-gray-400 font-normal'>
                  ({values.tankSize}L × {values.pressure}bar × {values.gas.he}%)
                </span>
              </div>
              <span className='self-end'>{results.totalHe.toFixed(1)} L</span>
            </div>
            <div className='flex justify-between'>
              <div className='flex flex-col'>
                <span>
                  Total O<sub>2</sub> Needed:
                </span>
                <span className='text-[10px] text-gray-400 font-normal'>
                  ({values.tankSize}L × {values.pressure}bar × {values.gas.o2}%)
                </span>
              </div>
              <span className='self-end'>{results.totalO2.toFixed(1)} L</span>
            </div>

            <div className='flex justify-between font-bold text-gray-700 border-b border-gray-200 pb-1 mb-1 mt-3'>
              <span>Partial Pressure Blending</span>
            </div>
            <div className='flex justify-between'>
              <span>Top-up Air (21%) Volume:</span>
              <span>{results.airVolume.toFixed(1)} L</span>
            </div>
            <div className='flex justify-between text-gray-500 pl-2'>
              <span>
                ↳ Provides O<sub>2</sub>:
              </span>
              <span>{results.airO2Liters.toFixed(1)} L</span>
            </div>
            <div className='flex justify-between font-bold text-emerald-700'>
              <span>
                Added Pure O<sub>2</sub>:
              </span>
              <span>{results.addedO2.toFixed(1)} L</span>
            </div>
          </div>
        )}

        <div className='mt-1 sm:mt-2 p-3 sm:p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center'>
          <span className='text-xs sm:text-sm uppercase tracking-wider font-bold text-emerald-800 mb-1 sm:mb-2'>
            Estimated Cost
          </span>
          <div className='text-3xl sm:text-4xl font-black text-emerald-600 mb-2 sm:mb-4'>
            €{results.totalCost.toFixed(2)}
          </div>

          <div className='w-full grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm border-t border-emerald-200 pt-2 sm:pt-4'>
            <div className='flex flex-col items-center'>
              <span className='font-bold text-emerald-700'>
                O<sub>2</sub> Cost
              </span>
              <span className='text-gray-600'>€{results.o2Cost.toFixed(2)}</span>
              <span className='text-[10px] text-gray-400'>
                ({results.addedO2.toFixed(0)}L added)
              </span>
            </div>
            <div className='flex flex-col items-center border-l border-emerald-200'>
              <span className='font-bold text-emerald-700'>He Cost</span>
              <span className='text-gray-600'>€{results.heCost.toFixed(2)}</span>
              <span className='text-[10px] text-gray-400'>
                ({results.totalHe.toFixed(0)}L total)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className='p-3 sm:p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          Calculation assumes <b>Partial Pressure Blending</b> (topping up with Air). You only pay
          for Helium and the <i>added</i> Oxygen required above what air provides. Service/blending
          fees are not included.
        </p>
      </div>
    </div>
  );
};

export default GasFillPriceCalculator;
