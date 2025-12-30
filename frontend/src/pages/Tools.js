import { Calculator, Gauge, Wind, Info, AlertTriangle, Timer, Compass } from 'lucide-react';
import { useState, useEffect } from 'react';

import usePageTitle from '../hooks/usePageTitle';

const Tools = () => {
  usePageTitle('Divemap - Diving Tools');

  // MOD State
  const [modO2, setModO2] = useState(21);
  const [modPO2, setModPO2] = useState(1.4);
  const [modResult, setModResult] = useState(0);

  // Best Mix State
  const [bestMixDepth, setBestMixDepth] = useState(30);
  const [bestMixPO2, setBestMixPO2] = useState(1.4);
  const [isTrimixEnabled, setIsTrimixEnabled] = useState(false);
  const [targetEAD, setTargetEAD] = useState(30);
  const [bestMixResult, setBestMixResult] = useState({ fO2: 32, fHe: 0, label: 'EAN32' });

  // SAC Rate State
  const [sacDepth, setSacDepth] = useState(15);
  const [sacTime, setSacTime] = useState(45);
  const [sacTankSize, setSacTankSize] = useState(12);
  const [sacStartPressure, setSacStartPressure] = useState(200);
  const [sacEndPressure, setSacEndPressure] = useState(50);
  const [sacResult, setSacResult] = useState(0);

  // Gas Planning State
  const [planDepth, setPlanDepth] = useState(30);
  const [planTime, setPlanTime] = useState(45);
  const [planSAC, setPlanSAC] = useState(20);
  const [planTankSize, setPlanTankSize] = useState(12);
  const [planTankPressure, setPlanTankPressure] = useState(230);
  const [planGasResult, setPlanGasResult] = useState({
    diveGasLiters: 0,
    reserveGasLiters: 0,
    totalGasLiters: 0,
    totalPressure: 0,
    isSafe: true,
  });

  const getDefaultPressure = size => {
    // AL80 (11.1) and Double AL80 (22.2) are typically 200/207 bar
    if (size === 11.1 || size === 22.2) return 200;
    return 230;
  };

  // Calculate MOD
  useEffect(() => {
    const fO2 = modO2 / 100;
    let mod = (modPO2 / fO2 - 1) * 10;
    // Cap at 60m as per requirements
    if (mod > 60) mod = 60;
    if (mod < 0) mod = 0;
    setModResult(mod);
  }, [modO2, modPO2]);

  // Calculate Best Mix
  useEffect(() => {
    const depth = Math.min(bestMixDepth, 60);
    const ata = depth / 10 + 1;

    // 1. Calculate max O2 based on pO2
    let fO2 = bestMixPO2 / ata;
    if (fO2 > 1.0) fO2 = 1.0;

    let fHe = 0;

    // 2. Calculate Helium if Trimix enabled
    if (isTrimixEnabled) {
      const ataEAD = targetEAD / 10 + 1;
      const maxPPN2 = 0.79 * ataEAD;
      const maxFN2 = maxPPN2 / ata;

      const remainder = 1 - fO2;
      if (maxFN2 < remainder) {
        fHe = remainder - maxFN2;
      }
    }

    const o2Pct = fO2 * 100;
    const hePct = fHe * 100;

    let label = '';
    if (hePct > 0.1) {
      label = `Tx ${Math.floor(o2Pct)}/${Math.floor(hePct)}`;
    } else {
      if (Math.abs(o2Pct - 21) < 0.5) label = 'Air';
      else label = `EAN${Math.floor(o2Pct)}`;
    }

    setBestMixResult({ fO2: o2Pct, fHe: hePct, label });
  }, [bestMixDepth, bestMixPO2, isTrimixEnabled, targetEAD]);

  // Calculate SAC Rate
  useEffect(() => {
    const gasUsedBar = sacStartPressure - sacEndPressure;
    const gasUsedLiters = gasUsedBar * sacTankSize;
    const ata = sacDepth / 10 + 1;
    let sac = 0;
    if (sacTime > 0 && ata > 0) {
      sac = gasUsedLiters / sacTime / ata;
    }
    if (sac < 0) sac = 0;
    setSacResult(sac);
  }, [sacDepth, sacTime, sacTankSize, sacStartPressure, sacEndPressure]);

  // Calculate Gas Planning
  useEffect(() => {
    const ata = planDepth / 10 + 1;
    const diveGasLiters = planSAC * ata * planTime;
    // Rule of Thirds: Dive Gas = 2/3 of Total. Reserve = 1/3 of Total.
    // So Total = Dive Gas * 1.5
    const totalGasLiters = diveGasLiters * 1.5;
    const reserveGasLiters = totalGasLiters - diveGasLiters;
    const totalPressure = totalGasLiters / planTankSize;

    const isSafe = totalPressure <= planTankPressure;

    setPlanGasResult({
      diveGasLiters,
      reserveGasLiters,
      totalGasLiters,
      totalPressure,
      isSafe,
    });
  }, [planDepth, planTime, planSAC, planTankSize, planTankPressure]);

  return (
    <div className='w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='bg-white shadow-sm rounded-lg overflow-hidden mb-8'>
        <div className='p-6 border-b border-gray-200'>
          <h1 className='text-3xl font-bold text-gray-900 flex items-center'>
            <Calculator className='h-8 w-8 mr-3 text-blue-600' />
            Diving Tools
          </h1>
          <p className='mt-1 text-gray-600'>
            Useful calculators for dive planning. Remember to always double-check your calculations.
          </p>
        </div>

        <div className='bg-gray-50 p-6'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
            {/* MOD Calculator */}
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
              <div className='p-5 border-b border-gray-100 bg-blue-50/30'>
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-blue-600 rounded-lg text-white'>
                    <Gauge className='h-6 w-6' />
                  </div>
                  <h2 className='text-xl font-bold text-gray-900'>Maximum Operating Depth (MOD)</h2>
                </div>
                <p className='mt-2 text-sm text-gray-600'>
                  Calculate the maximum depth for a given gas mixture and partial pressure of
                  oxygen.
                </p>
              </div>

              <div className='p-6 flex-grow space-y-6'>
                <div>
                  <label htmlFor='modO2' className='block text-sm font-semibold text-gray-700 mb-2'>
                    Oxygen Percentage (%)
                  </label>
                  <input
                    id='modO2'
                    type='range'
                    min='21'
                    max='40'
                    step='1'
                    value={modO2}
                    onChange={e => setModO2(parseInt(e.target.value))}
                    className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600'
                  />
                  <div className='flex justify-between mt-2'>
                    <span className='text-sm text-gray-500'>21% (Air)</span>
                    <span className='text-lg font-bold text-blue-600'>{modO2}%</span>
                    <span className='text-sm text-gray-500'>40%</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor='modPO2'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Max pO2 (bar)
                  </label>
                  <div id='modPO2' className='grid grid-cols-3 gap-2'>
                    {[1.2, 1.4, 1.6].map(val => (
                      <button
                        key={val}
                        onClick={() => setModPO2(val)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          modPO2 === val
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val} bar
                      </button>
                    ))}
                  </div>
                  <p className='mt-2 text-xs text-gray-500'>
                    1.4 bar is recommended for recreational diving, 1.6 bar for deco.
                  </p>
                </div>

                <div className='mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center'>
                  <span className='text-sm uppercase tracking-wider font-bold text-blue-800 mb-1'>
                    Maximum Operating Depth
                  </span>
                  <div className='flex items-baseline'>
                    <span className='text-5xl font-black text-blue-600'>
                      {modResult.toFixed(1)}
                    </span>
                    <span className='ml-2 text-xl font-bold text-blue-400'>meters</span>
                  </div>
                  {modResult >= 60 && (
                    <div className='mt-3 flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100'>
                      <AlertTriangle className='h-3 w-3 mr-1' />
                      Capped at 60m limit
                    </div>
                  )}
                </div>
              </div>

              <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
                <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
                <p>
                  Formula: MOD = (pO2_max / fO2 - 1) * 10. Based on standard salt water density.
                  Never exceed your training limits.
                </p>
              </div>
            </div>

            {/* Best Mix Calculator */}
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
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
                  <label
                    htmlFor='bestMixDepth'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Planned Depth (meters)
                  </label>
                  <input
                    id='bestMixDepth'
                    type='range'
                    min='0'
                    max='60'
                    step='1'
                    value={bestMixDepth}
                    onChange={e => setBestMixDepth(parseInt(e.target.value))}
                    className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600'
                  />
                  <div className='flex justify-between mt-2'>
                    <span className='text-sm text-gray-500'>0m</span>
                    <span className='text-lg font-bold text-emerald-600'>{bestMixDepth}m</span>
                    <span className='text-sm text-gray-500'>60m</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor='bestMixPO2'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Max pO2 (bar)
                  </label>
                  <div id='bestMixPO2' className='grid grid-cols-3 gap-2'>
                    {[1.2, 1.4, 1.6].map(val => (
                      <button
                        key={val}
                        onClick={() => setBestMixPO2(val)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                          bestMixPO2 === val
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val} bar
                      </button>
                    ))}
                  </div>
                </div>

                <div className='flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200'>
                  <input
                    id='trimixToggle'
                    type='checkbox'
                    checked={isTrimixEnabled}
                    onChange={e => setIsTrimixEnabled(e.target.checked)}
                    className='w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer'
                  />
                  <label
                    htmlFor='trimixToggle'
                    className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
                  >
                    Enable Trimix (Helium)
                  </label>
                </div>

                {isTrimixEnabled && (
                  <div>
                    <label
                      htmlFor='targetEAD'
                      className='block text-sm font-semibold text-gray-700 mb-2'
                    >
                      Target EAD (meters)
                    </label>
                    <input
                      id='targetEAD'
                      type='range'
                      min='20'
                      max='60'
                      step='1'
                      value={targetEAD}
                      onChange={e => setTargetEAD(parseInt(e.target.value))}
                      className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600'
                    />
                    <div className='flex justify-between mt-2'>
                      <span className='text-sm text-gray-500'>20m</span>
                      <span className='text-lg font-bold text-emerald-600'>{targetEAD}m</span>
                      <span className='text-sm text-gray-500'>60m</span>
                    </div>
                  </div>
                )}

                <div className='mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center'>
                  <span className='text-sm uppercase tracking-wider font-bold text-emerald-800 mb-1'>
                    Ideal Gas Mix
                  </span>
                  <div className='flex items-baseline'>
                    <span className='text-5xl font-black text-emerald-600'>
                      {bestMixResult.label}
                    </span>
                  </div>
                  {bestMixResult.fHe > 0.1 && (
                    <div className='mt-1 text-sm text-emerald-600 font-medium'>
                      {bestMixResult.fO2.toFixed(0)}% O2 / {bestMixResult.fHe.toFixed(0)}% He
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
                  Calculates Best Mix based on pO2 limit. If Trimix is enabled, Helium is added to
                  keep Equivalent Air Depth (EAD) within limits.
                </p>
              </div>
            </div>

            {/* SAC Rate Calculator */}
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
              <div className='p-5 border-b border-gray-100 bg-purple-50/30'>
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-purple-600 rounded-lg text-white'>
                    <Timer className='h-6 w-6' />
                  </div>
                  <h2 className='text-xl font-bold text-gray-900'>SAC Rate Calculator</h2>
                </div>
                <p className='mt-2 text-sm text-gray-600'>
                  Calculate your Surface Air Consumption rate to estimate gas usage.
                </p>
              </div>

              <div className='p-6 flex-grow space-y-6'>
                <div>
                  <label
                    htmlFor='sacDepth'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Average Depth (meters)
                  </label>
                  <input
                    id='sacDepth'
                    type='number'
                    min='0'
                    value={sacDepth}
                    onChange={e => setSacDepth(parseFloat(e.target.value) || 0)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                  />
                </div>

                <div>
                  <label
                    htmlFor='sacTime'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Bottom Time (minutes)
                  </label>
                  <input
                    id='sacTime'
                    type='number'
                    min='1'
                    value={sacTime}
                    onChange={e => setSacTime(parseFloat(e.target.value) || 0)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                  />
                </div>

                <div>
                  <label
                    htmlFor='sacTankSize'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Cylinder Size (Liters)
                  </label>
                  <select
                    id='sacTankSize'
                    value={sacTankSize}
                    onChange={e => setSacTankSize(parseFloat(e.target.value))}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                  >
                    <option value='7'>7 Liters</option>
                    <option value='8.5'>8.5 Liters</option>
                    <option value='10'>10 Liters</option>
                    <option value='11.1'>11.1 Liters (AL80)</option>
                    <option value='12'>12 Liters</option>
                    <option value='14'>14 Liters (Double 7s)</option>
                    <option value='15'>15 Liters</option>
                    <option value='18'>18 Liters</option>
                    <option value='22.2'>22.2 Liters (Double AL80)</option>
                    <option value='24'>24 Liters (Double 12s)</option>
                  </select>
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label
                      htmlFor='sacStartPressure'
                      className='block text-sm font-semibold text-gray-700 mb-2'
                    >
                      Start Pressure (bar)
                    </label>
                    <input
                      id='sacStartPressure'
                      type='number'
                      min='0'
                      max='300'
                      value={sacStartPressure}
                      onChange={e => setSacStartPressure(parseFloat(e.target.value) || 0)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                    />
                  </div>
                  <div>
                    <label
                      htmlFor='sacEndPressure'
                      className='block text-sm font-semibold text-gray-700 mb-2'
                    >
                      End Pressure (bar)
                    </label>
                    <input
                      id='sacEndPressure'
                      type='number'
                      min='0'
                      max='300'
                      value={sacEndPressure}
                      onChange={e => setSacEndPressure(parseFloat(e.target.value) || 0)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                    />
                  </div>
                </div>

                <div className='mt-8 p-6 bg-purple-50 rounded-2xl border border-purple-100 flex flex-col items-center justify-center text-center'>
                  <span className='text-sm uppercase tracking-wider font-bold text-purple-800 mb-1'>
                    SAC Rate / RMV
                  </span>
                  <div className='flex items-baseline'>
                    <span className='text-5xl font-black text-purple-600'>
                      {sacResult.toFixed(1)}
                    </span>
                    <span className='ml-2 text-xl font-bold text-purple-400'>L/min</span>
                  </div>
                  <div className='mt-2 text-sm text-purple-600'>
                    ~{(sacResult / sacTankSize).toFixed(2)} bar/min for this tank
                  </div>
                </div>
              </div>

              <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
                <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
                <p>
                  Formula: SAC = (Gas Consumed / Duration) / Pressure at Depth. Result is in Liters
                  per minute (surface equivalent).
                </p>
              </div>
            </div>

            {/* Gas Planning Calculator */}
            <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
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
                  <h2 className='text-xl font-bold text-gray-900'>Gas Planning (Rule of 1/3)</h2>
                </div>
                <p className='mt-2 text-sm text-gray-600'>
                  Calculate minimum gas required for a planned dive using the Rule of Thirds.
                </p>
              </div>

              <div className='p-6 flex-grow space-y-6'>
                <div>
                  <label
                    htmlFor='planDepth'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Planned Depth (meters)
                  </label>
                  <input
                    id='planDepth'
                    type='number'
                    min='0'
                    value={planDepth}
                    onChange={e => setPlanDepth(parseFloat(e.target.value) || 0)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
                  />
                </div>

                <div>
                  <label
                    htmlFor='planTime'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    Total Dive Time (minutes)
                  </label>
                  <input
                    id='planTime'
                    type='number'
                    min='1'
                    value={planTime}
                    onChange={e => setPlanTime(parseFloat(e.target.value) || 0)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
                  />
                </div>

                <div>
                  <label
                    htmlFor='planSAC'
                    className='block text-sm font-semibold text-gray-700 mb-2'
                  >
                    SAC Rate (L/min)
                  </label>
                  <input
                    id='planSAC'
                    type='number'
                    min='5'
                    value={planSAC}
                    onChange={e => setPlanSAC(parseFloat(e.target.value) || 0)}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
                  />
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
                      value={planTankSize}
                      onChange={e => {
                        const newSize = parseFloat(e.target.value);
                        setPlanTankSize(newSize);
                        setPlanTankPressure(getDefaultPressure(newSize));
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
                    >
                      <option value='7'>7 Liters</option>
                      <option value='8.5'>8.5 Liters</option>
                      <option value='10'>10 Liters</option>
                      <option value='11.1'>11.1 Liters (AL80)</option>
                      <option value='12'>12 Liters</option>
                      <option value='14'>14 Liters (Double 7s)</option>
                      <option value='15'>15 Liters</option>
                      <option value='18'>18 Liters</option>
                      <option value='22.2'>22.2 Liters (Double AL80)</option>
                      <option value='24'>24 Liters (Double 12s)</option>
                    </select>
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
                      value={planTankPressure}
                      onChange={e => setPlanTankPressure(parseFloat(e.target.value) || 0)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500'
                    />
                  </div>
                </div>

                <div
                  className={`mt-8 p-6 rounded-2xl border flex flex-col items-center justify-center text-center ${
                    planGasResult.isSafe
                      ? 'bg-emerald-50 border-emerald-100'
                      : 'bg-red-50 border-red-100'
                  }`}
                >
                  <span
                    className={`text-sm uppercase tracking-wider font-bold mb-1 ${
                      planGasResult.isSafe ? 'text-emerald-800' : 'text-red-800'
                    }`}
                  >
                    Minimum Gas Required
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
                      WARNING: Exceeds cylinder capacity ({planGasResult.maxTankPressure} bar)
                    </div>
                  )}

                  {planGasResult.isSafe && (
                    <div className='mt-3 flex items-center text-emerald-600 bg-white px-3 py-1 rounded-full text-xs font-medium border border-emerald-200'>
                      <div className='w-2 h-2 rounded-full bg-emerald-500 mr-2'></div>
                      Within safe limits (Max {planGasResult.maxTankPressure} bar)
                    </div>
                  )}

                  <div className='mt-4 w-full grid grid-cols-2 gap-2 text-xs'>
                    <div className='bg-white p-2 rounded border border-orange-200'>
                      <div className='font-bold text-gray-500'>Dive Gas (2/3)</div>
                      <div className='text-gray-900 font-bold text-base'>
                        {planGasResult.diveGasLiters.toFixed(0)} L
                      </div>
                    </div>
                    <div className='bg-white p-2 rounded border border-orange-200'>
                      <div className='font-bold text-gray-500'>Reserve (1/3)</div>
                      <div className='text-gray-900 font-bold text-base'>
                        {planGasResult.reserveGasLiters.toFixed(0)} L
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
                <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
                <p>
                  Formula: Total Gas = (SAC * ATA * Time) * 1.5. This assumes your planned dive time
                  consumes 2/3 of your total supply, leaving 1/3 as a safety reserve.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className='p-6 bg-amber-50 border-t border-amber-100'>
          <div className='flex items-start'>
            <AlertTriangle className='h-6 w-6 text-amber-600 mr-3 mt-0.5' />
            <div>
              <h3 className='text-sm font-bold text-amber-800'>SAFETY WARNING</h3>
              <p className='mt-1 text-sm text-amber-700'>
                These tools are for educational purposes only. Diving involves inherent risks. Never
                dive beyond your certification level or physical capabilities. Always use a
                calibrated dive computer and have your dive plan verified by your buddy or dive
                supervisor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tools;
