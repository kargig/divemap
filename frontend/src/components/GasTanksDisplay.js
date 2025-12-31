import { Info } from 'lucide-react';
import React from 'react';

import { TANK_SIZES } from '../utils/diveConstants';

const GasTanksDisplay = ({ gasData, averageDepth, duration }) => {
  if (!gasData) return null;

  let data = null;
  let isStructured = false;

  // Try parsing the data
  try {
    if (gasData.trim().startsWith('{')) {
      const parsed = JSON.parse(gasData);
      if (parsed.mode === 'structured') {
        data = parsed;
        isStructured = true;
      }
    }
  } catch (e) {
    // Fallback to plain text
  }

  // Legacy Text Mode Rendering
  if (!isStructured) {
    return (
      <div className='text-gray-600'>
        {gasData.split('\n').map((line, index) => (
          <div key={index} className={index > 0 ? 'mt-1' : ''}>
            {line.trim()}
          </div>
        ))}
      </div>
    );
  }

  // Helper to format gas mix
  const formatGas = gas => {
    if (!gas) return 'Air';
    if (gas.he > 0) return `Tx ${gas.o2}/${gas.he}`;
    if (gas.o2 === 21) return 'Air';
    return `EAN${gas.o2}`;
  };

  // Helper to get tank info
  const getTankInfo = id => {
    return TANK_SIZES.find(t => t.id === id);
  };

  // Helper to calculate consumption (Ideal - uses 1 bar as standard)
  const calculateConsumption = (tankId, start, end) => {
    const tank = getTankInfo(tankId);
    if (!tank || !start || !end) return null;
    if (start <= end) return null; // Invalid consumption
    const usedBar = start - end;
    const usedLiters = usedBar * tank.size;
    return Math.round(usedLiters);
  };

  // Gas compressibility factor (Z) using Subsurface's virial model
  // Ref: https://github.com/subsurface/subsurface/blob/master/core/gas-model.cpp
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
  // Ref: https://github.com/subsurface/subsurface/blob/master/core/equipment.cpp
  const getRealVolume = (bar, tankSize, gas) => {
    if (!bar || !tankSize) return 0;
    const z = getZFactor(bar, gas);
    // Subsurface uses 1 atm (1.01325 bar) as the standard pressure for volume
    return (tankSize * (bar / 1.01325)) / z;
  };

  // Calculate Real Gas Consumption (Subsurface style)
  const calculateRealGasConsumption = (tankId, start, end, gas) => {
    const tank = getTankInfo(tankId);
    if (!tank || !start || !end) return null;

    const volStart = getRealVolume(start, tank.size, gas);
    const volEnd = getRealVolume(end, tank.size, gas);

    return Math.max(0, volStart - volEnd);
  };

  // Calculate SAC Rates
  const calculateSAC = item => {
    if (!averageDepth || !duration || duration <= 0) return null;

    const start = item.start_pressure || item.pressure;
    const end = item.end_pressure;

    if (!start || !end) return null;

    // Ideal SAC
    const consumedLiters = calculateConsumption(item.tank, start, end);
    const avgDepthATA = parseFloat(averageDepth) / 10 + 1;
    const idealSAC = consumedLiters / parseFloat(duration) / avgDepthATA;

    // Real SAC
    const realConsumedLiters = calculateRealGasConsumption(item.tank, start, end, item.gas);
    const realSAC = realConsumedLiters / parseFloat(duration) / avgDepthATA;

    return {
      ideal: idealSAC.toFixed(1),
      real: realSAC.toFixed(1),
    };
  };

  // Helper to handle pressure display (backward compatibility)
  const getPressureDisplay = item => {
    const start = item.start_pressure || item.pressure;
    const end = item.end_pressure;

    if (start && end) {
      return (
        <span className='flex items-center gap-1'>
          <span>{start}</span>
          <span className='text-gray-400'>→</span>
          <span>{end} bar</span>
        </span>
      );
    }
    return <span>{start} bar</span>;
  };

  // Render a single tank row
  const renderTankRow = (label, item, colorClass, borderClass, bgClass, showSAC = false) => {
    const tankName = getTankInfo(item.tank)?.name || item.tank;
    const start = item.start_pressure || item.pressure;
    const end = item.end_pressure;
    const consumed = calculateConsumption(item.tank, start, end);
    const sacData = showSAC ? calculateSAC(item) : null;

    return (
      <div className='flex items-center gap-2 flex-wrap'>
        <span className='text-sm font-semibold text-gray-700 min-w-[70px]'>{label}:</span>
        <div
          className={`${bgClass} ${colorClass} px-3 py-1.5 rounded-md text-sm font-medium flex gap-3 items-center border ${borderClass}`}
        >
          <span>{tankName}</span>
          <span className={`${borderClass.replace('border-', 'text-').replace('100', '400')}`}>
            |
          </span>
          {getPressureDisplay(item)}

          {consumed !== null && (
            <>
              <span className={`${borderClass.replace('border-', 'text-').replace('100', '400')}`}>
                |
              </span>
              <span className='text-xs font-bold' title={`${consumed} Liters consumed (Ideal)`}>
                -{consumed} L
              </span>
            </>
          )}

          <span className={`${borderClass.replace('border-', 'text-').replace('100', '400')}`}>
            |
          </span>
          <span className='font-bold'>{formatGas(item.gas)}</span>
        </div>

        {sacData && (
          <div className='ml-2 flex items-center gap-2'>
            <div className='px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-sm border border-gray-200 flex items-center gap-1'>
              <span className='font-semibold'>SAC:</span>
              <span className='hidden sm:inline text-xs text-gray-400 ml-1'>Ideal</span>
              <span>{sacData.ideal}</span>
              <span className='text-gray-400 text-xs mx-0.5'>/</span>
              <span className='hidden sm:inline text-xs text-gray-400'>Real</span>
              <span className='text-gray-500' title='Real Gas SAC (Subsurface style)'>
                {sacData.real} L/min
              </span>
            </div>

            <div className='group relative'>
              <Info size={16} className='text-gray-400 hover:text-blue-500 cursor-help' />
              <div className='absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50'>
                <div className='font-semibold mb-1'>SAC Calculation Methods</div>
                <div className='mb-1'>
                  <span className='text-gray-300'>Ideal ({sacData.ideal}):</span> Standard formula
                  (PV=nRT). Ignores gas compressibility.
                </div>
                <div>
                  <span className='text-gray-300'>Real ({sacData.real}):</span> Accurate model used
                  by Subsurface (Virial Equation). Accounts for compressibility (Z-factor).
                </div>
                <div className='absolute left-1/2 top-full -mt-1 -ml-1 border-4 border-transparent border-t-gray-800'></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='space-y-3'>
      {renderTankRow(
        'Back Gas',
        data.back_gas,
        'text-blue-800',
        'border-blue-100',
        'bg-blue-50',
        true
      )}

      {data.stages && data.stages.length > 0 && (
        <div className='space-y-2'>
          {data.stages.map((stage, idx) => (
            <div key={idx}>
              {renderTankRow(
                `Stage ${idx + 1}`,
                stage,
                'text-purple-800',
                'border-purple-100',
                'bg-purple-50'
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GasTanksDisplay;
