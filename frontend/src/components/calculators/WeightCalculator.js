import { Gauge, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { TANK_SIZES } from '../../utils/diveConstants';
import { calculateTankBuoyancy, WATER_TYPES } from '../../utils/TankBuoyancy';
import GasTanksInput from '../forms/GasTanksInput';

const SUIT_OPTIONS = [
  { label: 'Swimsuit / Dive Skin', multiplier: 0.01, offset: 1 },
  { label: '3mm Wetsuit (Full)', multiplier: 0.05, offset: 0 },
  { label: '5mm Wetsuit (Full)', multiplier: 0.08, offset: 0 },
  { label: '7mm Wetsuit (Full)', multiplier: 0.1, offset: 2 },
  { label: 'Neoprene Drysuit', multiplier: 0.1, offset: 4 },
  { label: 'Shell Drysuit (Thin Undergarment)', multiplier: 0.1, offset: 3 },
  { label: 'Shell Drysuit (Heavy Undergarment)', multiplier: 0.1, offset: 6 },
];

const WeightCalculator = () => {
  const [bodyWeight, setBodyWeight] = useState(80);
  const [suitIdx, setSuitIdx] = useState(2); // Default 5mm
  const [waterTypeIdx, setWaterTypeIdx] = useState(6); // Default Aegean Sea (1.029)
  const [experience, setExperience] = useState('proficient'); // novice, proficient, expert
  const [neutralityTarget, setNeutralityTarget] = useState('empty'); // 'empty' or 'reserve'
  const [isPrecisionMode, setIsPrecisionMode] = useState(false);
  const [includeValve, setIncludeValve] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  // Default to 12L Steel
  const [gasConfig, setGasConfig] = useState(
    JSON.stringify({
      mode: 'structured',
      back_gas: { tank: '12', start_pressure: 200, end_pressure: 50, gas: { o2: 21, he: 0 } },
      stages: [],
    })
  );

  const [result, setResult] = useState({
    totalLead: 0,
    suitLead: 0,
    tankAdjustment: 0,
    waterAdjustment: 0,
    experienceAdjustment: 0,
    tankBreakdown: [],
  });

  useEffect(() => {
    const suit = SUIT_OPTIONS[suitIdx];
    const waterType = WATER_TYPES[waterTypeIdx];

    // 1. Base Suit Weight
    const suitLead = bodyWeight * suit.multiplier + suit.offset;

    // 2. Tank Buoyancy Adjustment (Sum of all tanks)
    let totalTankAdjustment = 0;
    const tankBreakdown = [];

    try {
      // Parse configuration
      let config = {};
      if (gasConfig.trim().startsWith('{')) {
        config = JSON.parse(gasConfig);
      }

      const processTank = (tankItem, role) => {
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

        const buoyancy = calculateTankBuoyancy(props);
        const adjustment =
          neutralityTarget === 'reserve' ? buoyancy.buoyancyAtCheck : buoyancy.buoyancyEmpty;

        totalTankAdjustment += adjustment;
        tankBreakdown.push({
          role,
          name: tankDef.name,
          adjustment,
          full: buoyancy.buoyancyFull,
          empty: buoyancy.buoyancyEmpty,
          check: buoyancy.buoyancyAtCheck,
          gasWeightFull: buoyancy.gasWeightFull,
          valveWeight: buoyancy.totalValveWeight,
          manifoldWeight: buoyancy.totalManifoldWeight,
        });
      };

      if (config.mode === 'structured') {
        processTank(config.back_gas, 'Back Gas');
        if (config.stages) {
          config.stages.forEach((stage, idx) => {
            processTank(stage, `Stage ${idx + 1}`);
          });
        }
      }
    } catch (e) {
      console.error('Error calculating tank buoyancy', e);
    }

    const tankAdjustment = totalTankAdjustment;

    // 3. Water Type Adjustment
    // Baseline is Standard Ocean (1.025).
    // Formula: Weight Adjustment = Body Weight * (New Density - Base Density)
    // Example: Fresh (1.000) -> 80 * (1.000 - 1.025) = 80 * -0.025 = -2kg.
    const waterAdjustment = bodyWeight * (waterType.density - 1.025);

    // 4. Experience Adjustment
    let experienceAdjustment = 0;
    if (experience === 'novice') experienceAdjustment = 2;
    if (experience === 'expert') experienceAdjustment = -2;

    const totalLead = suitLead + tankAdjustment + waterAdjustment + experienceAdjustment;

    setResult({
      totalLead: Math.max(0, totalLead),
      suitLead,
      tankAdjustment,
      waterAdjustment,
      experienceAdjustment,
      tankBreakdown,
    });
  }, [bodyWeight, suitIdx, waterTypeIdx, gasConfig, experience, neutralityTarget, includeValve]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col'>
      <div className='p-5 border-b border-gray-100 bg-emerald-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-emerald-600 rounded-lg text-white'>
            <Gauge className='h-6 w-6' />
          </div>
          <h2 className='text-xl font-bold text-gray-900'>Estimated Diving Weight</h2>
        </div>
        <p className='mt-2 text-sm text-gray-600'>
          Estimate how much lead you need based on your gear and environment.
        </p>
      </div>

      <div className='p-6 flex-grow space-y-6'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label htmlFor='bodyWeight' className='block text-sm font-semibold text-gray-700 mb-2'>
              Your Weight (kg)
            </label>
            <input
              id='bodyWeight'
              type='number'
              min='30'
              max='250'
              value={bodyWeight}
              onChange={e => setBodyWeight(parseFloat(e.target.value) || 0)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
            />
          </div>
          <div>
            <label htmlFor='experience' className='block text-sm font-semibold text-gray-700 mb-2'>
              Experience Level
            </label>
            <select
              id='experience'
              value={experience}
              onChange={e => setExperience(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
            >
              <option value='novice'>Novice (+2kg)</option>
              <option value='proficient'>Proficient (Baseline)</option>
              <option value='expert'>Expert (-2kg)</option>
            </select>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label htmlFor='suitType' className='block text-sm font-semibold text-gray-700 mb-2'>
              Exposure Suit
            </label>
            <select
              id='suitType'
              value={suitIdx}
              onChange={e => setSuitIdx(parseInt(e.target.value))}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
            >
              {SUIT_OPTIONS.map((suit, idx) => (
                <option key={idx} value={idx}>
                  {suit.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor='waterType' className='block text-sm font-semibold text-gray-700 mb-2'>
              Water Salinity
            </label>
            <select
              id='waterType'
              value={waterTypeIdx}
              onChange={e => setWaterTypeIdx(parseInt(e.target.value))}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'
            >
              {WATER_TYPES.map((type, idx) => (
                <option key={idx} value={idx}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Cylinder Configuration
          </label>
          <GasTanksInput value={gasConfig} onChange={setGasConfig} />
          <p className='text-xs text-gray-500 mt-1'>
            Select cylinders to account for their buoyancy swing.
          </p>
        </div>

        <div>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>
            Weighting Strategy
          </label>
          <div className='grid grid-cols-2 gap-4'>
            <div
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${neutralityTarget === 'empty' ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              onClick={() => setNeutralityTarget('empty')}
            >
              <div className='flex items-center'>
                <input
                  type='radio'
                  checked={neutralityTarget === 'empty'}
                  onChange={() => setNeutralityTarget('empty')}
                  className='h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300'
                />
                <span className='ml-2 text-sm font-medium text-gray-900'>Neutral at 0 bar</span>
              </div>
              <p className='mt-1 text-xs text-gray-500 ml-6'>
                Safest. Ensures you can hold a stop even if completely out of gas.
              </p>
            </div>
            <div
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${neutralityTarget === 'reserve' ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              onClick={() => setNeutralityTarget('reserve')}
            >
              <div className='flex items-center'>
                <input
                  type='radio'
                  checked={neutralityTarget === 'reserve'}
                  onChange={() => setNeutralityTarget('reserve')}
                  className='h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300'
                />
                <span className='ml-2 text-sm font-medium text-gray-900'>Neutral at Reserve</span>
              </div>
              <p className='mt-1 text-xs text-gray-500 ml-6'>
                Standard practice. Neutral with ~50 bar remaining in tanks.
              </p>
            </div>
          </div>
        </div>

        <div className='flex flex-wrap items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 gap-3'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center'>
              <input
                id='includeValveWeight'
                type='checkbox'
                checked={includeValve}
                onChange={e => setIncludeValve(e.target.checked)}
                className='w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer'
              />
              <label
                htmlFor='includeValveWeight'
                className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
              >
                Include Valve(s)
              </label>
            </div>
          </div>
          <div className='flex items-center gap-4'>
            <div className='flex items-center'>
              <input
                id='isPrecisionMode'
                type='checkbox'
                checked={isPrecisionMode}
                onChange={e => setIsPrecisionMode(e.target.checked)}
                className='w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer'
              />
              <label
                htmlFor='isPrecisionMode'
                className='ml-2 text-sm font-medium text-gray-700 cursor-pointer select-none'
              >
                Precision Mode
              </label>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className='text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors'
            >
              {showDetails ? 'Hide Calculations' : 'Show Calculations'}
            </button>
          </div>
        </div>

        {showDetails && (
          <div className='bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 mb-6'>
            <div>
              <h4 className='font-bold text-gray-800 border-b border-gray-300 pb-1 mb-2'>
                1. Base Suit Weight
              </h4>
              <div className='flex justify-between text-gray-600'>
                <span>
                  {SUIT_OPTIONS[suitIdx].label} (
                  {Math.round(SUIT_OPTIONS[suitIdx].multiplier * 100)}% of body weight):
                </span>
                <span>{(bodyWeight * SUIT_OPTIONS[suitIdx].multiplier).toFixed(1)} kg</span>
              </div>
              <div className='flex justify-between text-gray-600'>
                <span>Offset (inherent buoyancy):</span>
                <span>+{SUIT_OPTIONS[suitIdx].offset} kg</span>
              </div>
              <div className='flex justify-between font-semibold text-emerald-700 mt-1 border-t border-gray-200 pt-1'>
                <span>Suit Total:</span>
                <span>{result.suitLead.toFixed(1)} kg</span>
              </div>
            </div>

            <div>
              <h4 className='font-bold text-gray-800 border-b border-gray-300 pb-1 mb-2'>
                2. Cylinder Buoyancy
              </h4>
              {result.tankBreakdown.map((tank, i) => (
                <div key={i} className='mb-2 last:mb-0'>
                  <div className='flex justify-between font-semibold text-gray-700'>
                    <span>
                      {tank.role}: {tank.name}
                    </span>
                    <span className={tank.adjustment > 0 ? 'text-red-600' : 'text-emerald-600'}>
                      {tank.adjustment > 0 ? '+' : ''}
                      {tank.adjustment.toFixed(1)} kg
                    </span>
                  </div>
                  <div className='pl-2 text-gray-500 space-y-0.5 border-l-2 border-gray-200 ml-1'>
                    <div className='flex justify-between'>
                      <span>Gas Weight (Full):</span>
                      <span>{tank.gasWeightFull.toFixed(1)} kg</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Valve Weight:</span>
                      <span>{tank.valveWeight.toFixed(1)} kg</span>
                    </div>
                    {tank.manifoldWeight > 0 && (
                      <div className='flex justify-between'>
                        <span>Manifold Weight:</span>
                        <span>{tank.manifoldWeight.toFixed(1)} kg</span>
                      </div>
                    )}
                    <div className='flex justify-between'>
                      <span>Buoyancy (Empty):</span>
                      <span>{tank.empty.toFixed(1)} kg</span>
                    </div>
                    <div className='flex justify-between'>
                      <span>Buoyancy (Reserve):</span>
                      <span>{tank.check.toFixed(1)} kg</span>
                    </div>
                    <div className='flex justify-between italic'>
                      <span>Target: {neutralityTarget === 'reserve' ? 'Reserve' : 'Empty'}</span>
                      <span>
                        {(neutralityTarget === 'reserve' ? tank.check : tank.empty).toFixed(1)} kg
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className='flex justify-between font-semibold text-emerald-700 mt-1 border-t border-gray-200 pt-1'>
                <span>Total Tank Adjustment:</span>
                <span>
                  {(result.tankAdjustment > 0 ? '+' : '') + result.tankAdjustment.toFixed(1)} kg
                </span>
              </div>
            </div>

            <div>
              <h4 className='font-bold text-gray-800 border-b border-gray-300 pb-1 mb-2'>
                3. Environmental & Personal
              </h4>
              <div className='flex justify-between text-gray-600'>
                <span>Water Type ({WATER_TYPES[waterTypeIdx].label}):</span>
                <span>{result.waterAdjustment.toFixed(1)} kg</span>
              </div>
              <div className='flex justify-between text-gray-600'>
                <span>Experience ({experience}):</span>
                <span>
                  {result.experienceAdjustment > 0 ? '+' : ''}
                  {result.experienceAdjustment} kg
                </span>
              </div>
            </div>

            <div className='flex justify-between font-black text-base text-gray-900 pt-2 border-t-2 border-gray-300 mt-2'>
              <span>Calculated Total:</span>
              <span>{result.totalLead.toFixed(2)} kg</span>
            </div>
          </div>
        )}

        <div className='mt-0 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center'>
          <span className='text-sm uppercase tracking-wider font-bold text-emerald-800 mb-1'>
            Recommended Lead
          </span>
          <div className='flex items-baseline'>
            <span className='text-6xl font-black text-emerald-600'>
              {isPrecisionMode ? result.totalLead.toFixed(1) : Math.round(result.totalLead)}
            </span>
            <span className='ml-2 text-2xl font-bold text-emerald-400'>kg</span>
          </div>
          <p className='mt-2 text-sm text-emerald-700 font-medium'>
            Estimated total weight for neutral buoyancy.
          </p>
        </div>
      </div>

      <div className='p-4 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-start'>
        <AlertTriangle className='h-4 w-4 mr-2 text-amber-600 flex-shrink-0 mt-0.5' />
        <p>
          <strong>Always perform a buoyancy check!</strong> This is only an estimate. Your physical
          composition, specific gear brands, and lung volume significantly affect actual weighting
          requirements.
        </p>
      </div>

      {/* Detailed Formulas Section */}
      <div className='border-t border-gray-200'>
        <details className='group'>
          <summary className='flex justify-between items-center font-medium cursor-pointer list-none p-4 bg-gray-50 hover:bg-gray-100 transition-colors'>
            <span className='text-sm text-gray-700 font-semibold flex items-center gap-2'>
              <Gauge className='h-4 w-4 text-emerald-600' />
              View Calculation Formulas
            </span>
            <span className='transition group-open:rotate-180'>
              <svg
                fill='none'
                height='24'
                shapeRendering='geometricPrecision'
                stroke='currentColor'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='1.5'
                viewBox='0 0 24 24'
                width='24'
              >
                <path d='M6 9l6 6 6-6'></path>
              </svg>
            </span>
          </summary>
          <div className='text-gray-600 text-xs p-6 bg-white space-y-6 animate-in slide-in-from-top-2 duration-200'>
            <div>
              <h4 className='font-bold text-gray-900 mb-1 text-sm'>1. Total Lead Required</h4>
              <p className='mb-2'>
                The sum of all positive buoyancy factors that need to be counteracted.
              </p>
              <div className='bg-gray-50 p-3 rounded-lg font-mono text-emerald-800 border border-gray-100'>
                <p>Total = Suit Buoyancy + Tank Adjustment + Water Density Adj + Experience</p>
              </div>
            </div>

            <div>
              <h4 className='font-bold text-gray-900 mb-1 text-sm'>2. Suit Buoyancy</h4>
              <p className='mb-2'>Estimates the positive buoyancy of your exposure protection.</p>
              <div className='bg-gray-50 p-3 rounded-lg font-mono text-emerald-800 border border-gray-100'>
                <p>Suit Buoyancy = (Body Weight × Multiplier) + Offset</p>
              </div>
              <ul className='mt-2 list-disc pl-4 space-y-1 text-gray-500'>
                <li>Multiplier: 5mm = 0.08, 7mm = 0.10, Drysuit = 0.10</li>
                <li>Offset: Added for thick suits or drysuits (2-6 kg)</li>
              </ul>
            </div>

            <div>
              <h4 className='font-bold text-gray-900 mb-1 text-sm'>3. Tank Adjustment</h4>
              <p className='mb-2'>
                Compensates for the buoyancy characteristics of your cylinders.
              </p>
              <div className='bg-gray-50 p-3 rounded-lg font-mono text-emerald-800 border border-gray-100'>
                <p>Adjustment = Σ (Tank Buoyancy at Target Pressure)</p>
              </div>
              <p className='mt-2 text-gray-500'>
                If target is 'Empty', we add lead to ensure you are neutral with 0 bar. If
                'Reserve', we check at 50 bar.
              </p>
            </div>

            <div>
              <h4 className='font-bold text-gray-900 mb-1 text-sm'>4. Water Density Adjustment</h4>
              <p className='mb-2'>Compensates for the extra lift provided by saltier water.</p>
              <div className='bg-gray-50 p-3 rounded-lg font-mono text-emerald-800 border border-gray-100'>
                <p>Adj = Body Weight × (Current Density - 1.025)</p>
              </div>
              <p className='mt-2 text-gray-500'>
                Baseline is Standard Ocean (1.025). Freshwater (1.000) provides less lift, so you
                need less weight (result is negative).
              </p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default WeightCalculator;
