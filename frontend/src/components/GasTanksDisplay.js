import { Info } from 'lucide-react';
import React, { useMemo } from 'react';

import { TANK_SIZES } from '../utils/diveConstants';

const GasTanksDisplay = ({ gasData, averageDepth, duration, profileData }) => {
  // Calculate gas usage statistics from profile data (Hook must be at top level)
  const gasStats = useMemo(() => {
    if (!profileData?.samples || !profileData?.events) return null;

    const stats = {}; // Key: cylinderIndex (number), Value: { duration: 0, depthSum: 0 }

    // Sort events by time
    const gasChanges = profileData.events
      .filter(e => e.name === 'gaschange')
      .sort((a, b) => a.time_minutes - b.time_minutes);

    let currentCylinder = 0; // Default to cylinder 0

    // Check for gas change at very start (t=0)
    const startGasEvent = gasChanges.find(e => e.time_minutes <= 0.05);
    if (startGasEvent && startGasEvent.cylinder !== undefined) {
      currentCylinder = parseInt(startGasEvent.cylinder, 10);
    }

    // Process samples to accumulate time and depth per gas
    for (let i = 1; i < profileData.samples.length; i++) {
      const prevSample = profileData.samples[i - 1];
      const sample = profileData.samples[i];

      const t0 = prevSample.time_minutes;
      const t1 = sample.time_minutes;
      const dt = t1 - t0;
      if (dt <= 0) continue;

      const avgDepthInterval = (prevSample.depth + sample.depth) / 2;

      // Determine active gas at start of interval t0
      const activeChange = [...gasChanges].reverse().find(e => e.time_minutes <= t0 + 0.001); // tolerance

      if (activeChange && activeChange.cylinder !== undefined) {
        currentCylinder = parseInt(activeChange.cylinder, 10);
      }

      if (isNaN(currentCylinder)) currentCylinder = 0; // Fallback

      if (!stats[currentCylinder]) stats[currentCylinder] = { duration: 0, depthSum: 0 };

      stats[currentCylinder].duration += dt;
      stats[currentCylinder].depthSum += avgDepthInterval * dt;
    }

    // Calculate averages
    Object.keys(stats).forEach(k => {
      if (stats[k].duration > 0) {
        stats[k].avgDepth = stats[k].depthSum / stats[k].duration;
      }
    });

    return stats;
  }, [profileData]);

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
  const calculateSAC = (item, cylinderIndex) => {
    // Determine calculation parameters
    let calcDuration = parseFloat(duration);
    let calcAvgDepth = parseFloat(averageDepth);
    let isSpecific = false;

    // Try to find specific stats for this cylinder index
    if (gasStats && cylinderIndex !== undefined) {
      const stats = gasStats[cylinderIndex];
      if (stats && stats.duration > 0) {
        calcDuration = stats.duration;
        calcAvgDepth = stats.avgDepth;
        isSpecific = true;
      }
    }

    if (!calcAvgDepth || !calcDuration || calcDuration <= 0) return null;

    const start = item.start_pressure || item.pressure;
    const end = item.end_pressure;

    if (!start || !end) return null;

    // Ideal SAC
    const consumedLiters = calculateConsumption(item.tank, start, end);
    const avgDepthATA = calcAvgDepth / 10 + 1;
    const idealSAC = consumedLiters / calcDuration / avgDepthATA;

    // Real SAC
    const realConsumedLiters = calculateRealGasConsumption(item.tank, start, end, item.gas);
    const realSAC = realConsumedLiters / calcDuration / avgDepthATA;

    return {
      ideal: idealSAC.toFixed(1),
      real: realSAC.toFixed(1),
      isSpecific,
      duration: calcDuration,
      avgDepth: calcAvgDepth,
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

  const renderTankRow = (
    label,
    item,
    colorClass,
    borderClass,
    bgClass,
    showSAC = false,
    cylinderIndex,
    showStats = true
  ) => {
    const tankName = getTankInfo(item.tank)?.name || item.tank;
    const start = item.start_pressure || item.pressure;
    const end = item.end_pressure;
    const consumed = calculateConsumption(item.tank, start, end);
    const sacData = showSAC ? calculateSAC(item, cylinderIndex) : null;

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
          <span className='font-bold'>{formatGas(item.gas)}</span>
          <span className={`${borderClass.replace('border-', 'text-').replace('100', '400')}`}>
            |
          </span>
          {getPressureDisplay(item)}

          {consumed !== null && (
            <>
              <span className={`${borderClass.replace('border-', 'text-').replace('100', '400')}`}>
                |
              </span>
              <span className='text-xs' title={`${consumed} Liters consumed (Ideal)`}>
                -{consumed} L
              </span>
            </>
          )}
        </div>

        {sacData && (
          <div className='ml-2 flex items-center gap-2'>
            <div className='flex items-center gap-2'>
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

              {showStats && (
                <div className='px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md text-sm border border-gray-200 flex items-center gap-2'>
                  <span className='text-xs text-gray-500'>
                    Time:{' '}
                    <span className='font-medium text-gray-700'>
                      {sacData.duration.toFixed(0)} min
                    </span>
                  </span>
                  <span className='text-gray-300'>|</span>
                  <span className='text-xs text-gray-500'>
                    Avg. Depth:{' '}
                    <span className='font-medium text-gray-700'>
                      {sacData.avgDepth.toFixed(1)}m
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className='group relative'>
              {sacData.isSpecific ? (
                <Info size={16} className='text-blue-500 cursor-help' />
              ) : (
                <Info size={16} className='text-gray-400 hover:text-blue-500 cursor-help' />
              )}
              <div className='absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50'>
                <div className='font-semibold mb-1'>SAC Calculation Methods</div>
                <div className='mb-1'>
                  <span className='text-gray-300'>Ideal ({sacData.ideal}):</span> Standard formula
                  (PV=nRT). Ignores gas compressibility.
                </div>
                <div className='mb-2'>
                  <span className='text-gray-300'>Real ({sacData.real}):</span> Accurate model used
                  by Subsurface (Virial Equation). Accounts for compressibility (Z-factor).
                </div>
                {sacData.isSpecific ? (
                  <div className='pt-1 border-t border-gray-600 text-green-300'>
                    Based on actual usage from profile:
                    <br />
                    Time: {sacData.duration.toFixed(1)} min
                    <br />
                    Avg Depth: {sacData.avgDepth.toFixed(1)} m
                  </div>
                ) : (
                  <div className='pt-1 border-t border-gray-600 text-yellow-300'>
                    Based on total dive averages (no specific usage data found for Cylinder{' '}
                    {cylinderIndex}).
                  </div>
                )}
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
        true,
        data.back_gas.index !== undefined ? data.back_gas.index : 0,
        data.stages && data.stages.length > 0
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
                'bg-purple-50',
                true,
                stage.index !== undefined ? stage.index : idx + 1,
                true
              )}
            </div>
          ))}
        </div>
      )}

      {/* Combined SAC for multiple tanks */}
      {data.stages && data.stages.length > 0 && (
        <div className='mt-4 pt-3 border-t border-gray-200'>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='text-sm font-bold text-gray-900 min-w-[70px]'>Combined SAC:</span>

            <div className='flex items-center gap-2'>
              <div className='px-3 py-1.5 bg-sky-50 text-sky-800 rounded-md text-sm border border-sky-100 flex items-center gap-1 shadow-sm'>
                <span className='text-xs text-sky-400'>Ideal</span>
                <span className='font-medium'>
                  {(
                    (calculateConsumption(
                      data.back_gas.tank,
                      data.back_gas.start_pressure || data.back_gas.pressure,
                      data.back_gas.end_pressure
                    ) +
                      data.stages.reduce(
                        (acc, stage) =>
                          acc +
                          (calculateConsumption(
                            stage.tank,
                            stage.start_pressure || stage.pressure,
                            stage.end_pressure
                          ) || 0),
                        0
                      )) /
                    parseFloat(duration) /
                    (parseFloat(averageDepth) / 10 + 1)
                  ).toFixed(1)}
                </span>
                <span className='text-sky-200 text-xs mx-0.5'>/</span>
                <span className='text-xs text-sky-400'>Real</span>
                <span className='text-sky-600 font-bold'>
                  {(
                    (calculateRealGasConsumption(
                      data.back_gas.tank,
                      data.back_gas.start_pressure || data.back_gas.pressure,
                      data.back_gas.end_pressure,
                      data.back_gas.gas
                    ) +
                      data.stages.reduce(
                        (acc, stage) =>
                          acc +
                          (calculateRealGasConsumption(
                            stage.tank,
                            stage.start_pressure || stage.pressure,
                            stage.end_pressure,
                            stage.gas
                          ) || 0),
                        0
                      )) /
                    parseFloat(duration) /
                    (parseFloat(averageDepth) / 10 + 1)
                  ).toFixed(1)}
                  <span className='text-xs ml-0.5 font-normal text-sky-500'>L/min</span>
                </span>
              </div>

              <div className='px-3 py-1.5 bg-sky-50/50 text-sky-700 rounded-md text-sm border border-sky-100 flex items-center gap-2'>
                <span className='text-xs text-sky-500'>
                  Time:{' '}
                  <span className='font-medium text-sky-800'>
                    {parseFloat(duration).toFixed(0)} min
                  </span>
                </span>
                <span className='text-sky-200'>|</span>
                <span className='text-xs text-sky-500'>
                  Avg. Depth:{' '}
                  <span className='font-medium text-sky-800'>
                    {parseFloat(averageDepth).toFixed(1)}m
                  </span>
                </span>
              </div>
            </div>

            <div className='text-xs text-gray-500 ml-1 italic'>
              (Total gas consumed / Total duration / Avg depth)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GasTanksDisplay;
