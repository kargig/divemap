import { Anchor, Info, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

import GasTanksInput from '../components/forms/GasTanksInput';

import { TANK_SIZES } from './diveConstants';

export const CONSTANTS = {
  // Typical densities for diving grade metals and gases.
  // Sources: Subsurface source code, Engineering ToolBox, and common industry standards.
  STEEL_DENSITY: 7.9, // kg/liter (Standard Chrome-Moly steel)
  ALU_DENSITY: 2.699, // kg/liter (6061-T6 Aluminum)
  AIR_DENSITY: 0.001225, // kg/liter (at 15°C, 1 atm - International Standard Atmosphere)
  SALT_DENSITY: 1.025, // kg/liter (Standard Mean Ocean Water at 15°C)
  FRESH_DENSITY: 1.0, // kg/liter (Pure water at 4°C)
  VALVE_WEIGHT: 0.8, // kg (Average DIN valve weight)
  // Specific Gravities (relative to Air)
  SG_O2: 1.105,
  SG_N2: 0.967,
  SG_HE: 0.138,
};

export const WATER_TYPES = [
  // Densities derived from UNESCO International Equation of State (EOS-80)
  // and regional salinity studies (ICAS, New World Encyclopedia, etc.)
  // assuming typical surface temperatures for diving (20°C - 25°C).
  { id: 'fresh', label: 'Freshwater (1.000)', density: 1.0 },
  { id: 'brackish', label: 'Brackish / Baltic (1.007)', density: 1.007 }, // Avg 8-10 ppt
  { id: 'black', label: 'Black Sea (1.014)', density: 1.014 }, // Avg 17-18 ppt
  { id: 'tropical', label: 'Tropical / Caribbean (1.024)', density: 1.024 }, // Avg 34-35 ppt (warmer)
  { id: 'standard', label: 'Standard Ocean (1.025)', density: 1.025 }, // Avg 35 ppt
  { id: 'med', label: 'Mediterranean (Western) (1.028)', density: 1.028 }, // Avg 38 ppt
  { id: 'aegean', label: 'Aegean / Eastern Med (1.029)', density: 1.029 }, // Avg 39 ppt
  { id: 'red', label: 'Red Sea (1.031)', density: 1.031 }, // Avg 40-41 ppt (Source: ICAS / New World Encyclopedia)
  { id: 'gulf', label: 'Persian Gulf (1.033)', density: 1.033 }, // Avg 42+ ppt
  { id: 'dead', label: 'Dead Sea (1.240)', density: 1.24 }, // Avg 340+ ppt
];

/**
 * Calculates tank buoyancy at full, empty, and specific pressure states with gas mix.
 */
export const calculateTankBuoyancy = ({
  liters,
  bar,
  weight,
  material,
  isSaltWater,
  waterDensity: customWaterDensity,
  isDoubles,
  includeValve,
  o2 = 21,
  he = 0,
  checkPressure = 50,
}) => {
  const metalDensity = material === 'alu' ? CONSTANTS.ALU_DENSITY : CONSTANTS.STEEL_DENSITY;
  const waterDensity =
    customWaterDensity !== undefined
      ? customWaterDensity
      : isSaltWater
        ? CONSTANTS.SALT_DENSITY
        : CONSTANTS.FRESH_DENSITY;

  let valveKg = includeValve ? CONSTANTS.VALVE_WEIGHT : 0;
  let currentLiters = parseFloat(liters) || 0;
  let currentKg = parseFloat(weight) || 0;
  const currentBar = parseFloat(bar) || 0;
  const checkBar = parseFloat(checkPressure) || 0;

  if (isDoubles) {
    valveKg *= 2;
    currentLiters *= 2;
    currentKg *= 2;
  }

  // Calculate Gas Mix Density
  const fO2 = parseFloat(o2) / 100;
  const fHe = parseFloat(he) / 100;
  const fN2 = 1 - fO2 - fHe;

  // Mix Specific Gravity
  const mixSG = fO2 * CONSTANTS.SG_O2 + fN2 * CONSTANTS.SG_N2 + fHe * CONSTANTS.SG_HE;
  const mixDensity = CONSTANTS.AIR_DENSITY * mixSG;

  const volMetal = currentKg / metalDensity;
  const volValve = valveKg / CONSTANTS.STEEL_DENSITY;
  const totalDisplacedVolume = volMetal + volValve + currentLiters;

  const buoyantForce = totalDisplacedVolume * waterDensity;
  const weightEmpty = currentKg + valveKg;

  // Weights of gas
  const weightGasFull = mixDensity * currentBar * currentLiters;
  const weightGasAtCheck = mixDensity * checkBar * currentLiters;

  const weightFull = weightEmpty + weightGasFull;
  const weightAtCheck = weightEmpty + weightGasAtCheck;

  return {
    buoyancyEmpty: buoyantForce - weightEmpty,
    buoyancyFull: buoyantForce - weightFull,
    buoyancyAtCheck: buoyantForce - weightAtCheck,
    gasWeightFull: weightGasFull,
    mixDensity,
    // Intermediate details for "Show Calculations"
    volMetal,
    volValve,
    totalDisplacedVolume,
    buoyantForce,
    weightEmpty,
    weightFull,
    weightGasAtCheck,
    currentLiters,
    metalDensity,
    waterDensity,
    totalValveWeight: valveKg,
    totalTankWeight: currentKg,
  };
};

const TankBuoyancy = () => {
  const [waterTypeIdx, setWaterTypeIdx] = useState(6); // Default Aegean Sea (1.025)
  const [showDetails, setShowDetails] = useState(false);
  const [includeValve, setIncludeValve] = useState(true);

  // Default to 12L Steel
  const [gasConfig, setGasConfig] = useState(
    JSON.stringify({
      mode: 'structured',
      back_gas: { tank: '12', start_pressure: 200, end_pressure: 50, gas: { o2: 21, he: 0 } },
      stages: [],
    })
  );

  const [result, setResult] = useState({
    buoyancyEmpty: 0,
    buoyancyFull: 0,
    buoyancyReserve: 0,
    totalGasWeight: 0,
    tankBreakdown: [],
  });

  useEffect(() => {
    let totalBuoyancyFull = 0;
    let totalBuoyancyReserve = 0;
    let totalBuoyancyEmpty = 0; // 0 bar
    let totalGasWeight = 0;
    const tankBreakdown = [];

    const waterType = WATER_TYPES[waterTypeIdx];

    try {
      let config = {};
      if (gasConfig.trim().startsWith('{')) {
        config = JSON.parse(gasConfig);
      }

      const processTank = (tankItem, type = 'Back Gas') => {
        if (!tankItem || !tankItem.tank) return;
        const tankDef = TANK_SIZES.find(t => t.id === tankItem.tank);
        if (!tankDef) return;

        const isDoubles = tankDef.isDoubles || false;

        const props = {
          liters: isDoubles ? tankDef.size / 2 : tankDef.size,
          weight: isDoubles ? tankDef.emptyWeight / 2 : tankDef.emptyWeight,
          material: tankDef.material,
          waterDensity: waterType.density,
          isDoubles,
          includeValve,
          o2: tankItem.gas?.o2 || 21,
          he: tankItem.gas?.he || 0,
          bar: tankItem.start_pressure || 200,
          checkPressure: tankItem.end_pressure || 50,
        };

        const res = calculateTankBuoyancy(props);

        totalBuoyancyFull += res.buoyancyFull;
        totalBuoyancyReserve += res.buoyancyAtCheck;
        totalBuoyancyEmpty += res.buoyancyEmpty;
        totalGasWeight += res.gasWeightFull;

        tankBreakdown.push({
          name: tankDef.name,
          type,
          data: res,
          props,
        });
      };

      if (config.mode === 'structured') {
        processTank(config.back_gas, 'Back Gas');
        if (config.stages) {
          config.stages.forEach(s => processTank(s, 'Stage'));
        }
      }
    } catch (e) {
      console.error('Error calculating buoyancy', e);
    }

    setResult({
      buoyancyFull: totalBuoyancyFull,
      buoyancyReserve: totalBuoyancyReserve,
      buoyancyEmpty: totalBuoyancyEmpty,
      totalGasWeight,
      tankBreakdown,
    });
  }, [waterTypeIdx, gasConfig, includeValve]);

  const formatNum = num => {
    const val = parseFloat(num);
    if (isNaN(val)) return '0.00';
    return (val > 0 ? '+' : '') + val.toFixed(2);
  };

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
      <div className='p-5 border-b border-gray-100 bg-sky-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-sky-600 rounded-lg text-white'>
            <Anchor className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Tank Buoyancy Calculator</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Calculate the buoyancy characteristics of your scuba cylinder(s) to perfect your
          weighting.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        {/* Tank Config */}
        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Cylinder Configuration
          </label>
          <GasTanksInput value={gasConfig} onChange={setGasConfig} />
        </div>

        {/* Environment */}
        <div className='flex flex-wrap items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 gap-3'>
          <div className='flex items-center gap-4'>
            <div>
              <label htmlFor='tankWaterType' className='text-sm font-semibold text-gray-700 mr-2'>
                Water:
              </label>
              <select
                id='tankWaterType'
                value={waterTypeIdx}
                onChange={e => setWaterTypeIdx(parseInt(e.target.value))}
                className='text-sm border-gray-300 rounded-md focus:ring-sky-500 focus:border-sky-500 py-1'
              >
                {WATER_TYPES.map((type, idx) => (
                  <option key={idx} value={idx}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className='flex items-center'>
              <input
                id='includeValve'
                type='checkbox'
                checked={includeValve}
                onChange={e => setIncludeValve(e.target.checked)}
                className='w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer'
              />
              <label
                htmlFor='includeValve'
                className='ml-2 text-sm font-medium text-gray-700 select-none cursor-pointer'
              >
                Include Valve(s)
              </label>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className='text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors'
          >
            {showDetails ? 'Hide Calculations' : 'Show Calculations'}
          </button>
        </div>

        {showDetails && (
          <div className='space-y-4 animate-in fade-in slide-in-from-top-1 duration-200'>
            {result.tankBreakdown.map((item, idx) => (
              <div key={idx} className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3'>
                <div className='flex justify-between items-center border-b border-gray-200 pb-2'>
                  <span className='text-sm font-bold text-gray-900'>{item.name}</span>
                  <span className='text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100'>
                    {item.type}
                  </span>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs font-mono text-gray-600'>
                  <div className='flex justify-between'>
                    <span>Steel/Alu Volume:</span>
                    <span>{(item.props.weight / item.data.metalDensity).toFixed(3)} L</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Valve Volume:</span>
                    <span>{item.data.volValve.toFixed(3)} L</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Internal Volume:</span>
                    <span>{item.data.currentLiters.toFixed(1)} L</span>
                  </div>
                  <div className='flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-1'>
                    <span>Total Displacement:</span>
                    <span>{item.data.totalDisplacedVolume.toFixed(3)} L</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Water Density:</span>
                    <span>{item.data.waterDensity.toFixed(3)} kg/L</span>
                  </div>
                  <div className='flex justify-between font-bold text-sky-700 border-t border-gray-200 pt-1'>
                    <span>Buoyant Force:</span>
                    <span>{item.data.buoyantForce.toFixed(3)} kg</span>
                  </div>
                  <div className='flex justify-between mt-2 border-t border-gray-200 pt-1'>
                    <span>Tank Weight (No Valve):</span>
                    <span>{item.data.totalTankWeight.toFixed(2)} kg</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Valve Weight:</span>
                    <span>{item.data.totalValveWeight.toFixed(2)} kg</span>
                  </div>
                  <div className='flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-1'>
                    <span>Total Weight (Empty):</span>
                    <span>{item.data.weightEmpty.toFixed(2)} kg</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Weight (Full):</span>
                    <span>{item.data.weightFull.toFixed(2)} kg</span>
                  </div>

                  <div className='flex justify-between font-bold border-t border-gray-200 pt-1'>
                    <span>Buoyancy (Empty):</span>
                    <span
                      className={item.data.buoyancyEmpty > 0 ? 'text-amber-600' : 'text-sky-700'}
                    >
                      {formatNum(item.data.buoyancyEmpty)} kg
                    </span>
                  </div>
                  <div className='flex justify-between font-bold'>
                    <span>Buoyancy (Full):</span>
                    <span
                      className={item.data.buoyancyFull > 0 ? 'text-amber-600' : 'text-sky-700'}
                    >
                      {formatNum(item.data.buoyancyFull)} kg
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        <div className='mt-8 grid grid-cols-1 md:grid-cols-3 gap-4'>
          {/* Full Tank */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${result.buoyancyFull > 0 ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}
          >
            <span className='text-xs uppercase tracking-wider font-bold text-gray-500 mb-1'>
              Start (Full)
            </span>
            <div className='flex items-baseline'>
              <span
                className={`text-3xl font-black ${result.buoyancyFull > 0 ? 'text-amber-600' : 'text-sky-700'}`}
              >
                {formatNum(result.buoyancyFull)}
              </span>
              <span className='ml-1 text-sm font-bold text-gray-400'>kg</span>
            </div>
          </div>

          {/* Reserve Pressure */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${result.buoyancyReserve > 0 ? 'bg-amber-50 border-amber-200' : 'bg-sky-50 border-sky-200'}`}
          >
            <span className='text-xs uppercase tracking-wider font-bold text-gray-500 mb-1'>
              Reserve (End)
            </span>
            <div className='flex items-baseline'>
              <span
                className={`text-3xl font-black ${result.buoyancyReserve > 0 ? 'text-amber-600' : 'text-sky-700'}`}
              >
                {formatNum(result.buoyancyReserve)}
              </span>
              <span className='ml-1 text-sm font-bold text-gray-400'>kg</span>
            </div>
          </div>

          {/* Empty Tank */}
          <div
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${result.buoyancyEmpty > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}
          >
            <span className='text-xs uppercase tracking-wider font-bold text-gray-500 mb-1'>
              Empty (0 bar)
            </span>
            <div className='flex items-baseline'>
              <span
                className={`text-3xl font-black ${result.buoyancyEmpty > 0 ? 'text-red-600' : 'text-emerald-600'}`}
              >
                {formatNum(result.buoyancyEmpty)}
              </span>
              <span className='ml-1 text-sm font-bold text-gray-400'>kg</span>
            </div>
          </div>
        </div>

        {result.buoyancyEmpty > 0 && (
          <div className='flex items-start p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-700'>
            <AlertTriangle className='h-5 w-5 mr-2 flex-shrink-0' />
            <p>
              <strong>Warning:</strong> Your rig becomes positively buoyant (
              {formatNum(result.buoyancyEmpty)} kg) when completely empty. Ensure you carry enough
              lead.
            </p>
          </div>
        )}

        <div className='text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100'>
          <p>
            <strong>Total Gas Mass (Full):</strong> {result.totalGasWeight.toFixed(2)} kg
          </p>
          <p className='mt-1'>
            Calculated based on selected cylinders, pressures, and gas densities.
          </p>
        </div>
      </div>

      <div className='p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          Buoyancy calculated using Archimedes principle. Values represent total system buoyancy
          (Back Gas + Stages).
        </p>
      </div>
    </div>
  );
};

export default TankBuoyancy;
