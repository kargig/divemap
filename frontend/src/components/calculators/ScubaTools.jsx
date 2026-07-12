import { Calculator, ArrowRight, Eye, Notebook, Compass, MapPin } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { calculateMOD } from '../../utils/physics';

const SUIT_MULTIPLIERS = {
  skin: { label: 'Swimsuit / Skin', mult: 0.01, offset: 1 },
  w3mm: { label: '3mm Wetsuit', mult: 0.05, offset: 0 },
  w5mm: { label: '5mm Wetsuit', mult: 0.08, offset: 0 },
  w7mm: { label: '7mm Wetsuit', mult: 0.1, offset: 2 },
  dry: { label: 'Drysuit', mult: 0.1, offset: 4 },
};

export default function ScubaTools() {
  const [activeTab, setActiveTab] = useState('mod');

  // MOD State
  const [modO2, setModO2] = useState(32);
  const [modPO2, setModPO2] = useState(1.4);

  // Best Mix State
  const [mixDepth, setMixDepth] = useState(30);
  const [mixPO2, setMixPO2] = useState(1.4);

  // Weight State
  const [weightKg, setWeightKg] = useState(80);
  const [weightSuit, setWeightSuit] = useState('w5mm');
  const [weightWater, setWeightWater] = useState('salt');

  // Derived Calculations
  const calculatedMOD = calculateMOD({ o2: modO2, he: 0 }, parseFloat(modPO2));

  const rawBestMixO2 = (parseFloat(mixPO2) / ((mixDepth + 10) / 10)) * 100;
  const calculatedBestMix = Math.min(Math.max(Math.floor(rawBestMixO2), 21), 40);

  const suit = SUIT_MULTIPLIERS[weightSuit];
  const baseWeight = weightKg * suit.mult + suit.offset;
  const saltWaterAdj = weightWater === 'salt' ? weightKg * 0.025 : 0;
  const calculatedLeadMin = Math.max(Math.round(baseWeight + saltWaterAdj - 1), 1);
  const calculatedLeadMax = Math.round(baseWeight + saltWaterAdj + 1);

  return (
    <div className='bg-white rounded-none sm:rounded-2xl border-y sm:border border-gray-100 shadow-sm sm:shadow-xl overflow-hidden w-full my-0'>
      {/* Rebranded Header with Divemap Colors */}
      <div className='bg-[#eaf4f9]/50 p-5 border-b border-gray-100 flex items-center gap-3.5'>
        <div className='bg-white p-2.5 rounded-xl border border-blue-100/50 shadow-sm shrink-0 flex items-center justify-center h-11 w-11'>
          <Calculator className='h-5 w-5 text-[#0072B2]' />
        </div>
        <div className='min-w-0 flex-1 text-left'>
          <h3 className='text-base font-extrabold text-gray-900 leading-snug'>Scuba Tools</h3>
          <p className='text-xs text-gray-500 leading-tight mt-0.5'>
            Instant, interactive dive planning calculators
          </p>
        </div>
      </div>

      <div className='flex border-b border-gray-100 bg-gray-50/50'>
        {['mod', 'mix', 'weight'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-3 text-xs font-bold capitalize transition-all border-b-2 ${
              activeTab === t
                ? 'bg-white border-[#0072B2] text-[#0072B2] shadow-sm'
                : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            {t === 'mod' ? 'Max Depth (MOD)' : t === 'mix' ? 'Nitrox Best Mix' : 'Buoyancy Weight'}
          </button>
        ))}
      </div>

      <div className='p-4 sm:p-6 min-h-[260px] flex flex-col justify-between'>
        <div className='space-y-5 flex-grow'>
          {activeTab === 'mod' && (
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-bold text-gray-600 mb-1.5'>
                  Oxygen Percentage: <span className='text-[#0072B2]'>{modO2}%</span>
                </label>
                <input
                  type='range'
                  min='21'
                  max='40'
                  value={modO2}
                  onChange={e => setModO2(parseInt(e.target.value, 10))}
                  className='w-full accent-[#0072B2] cursor-pointer'
                />
              </div>
              <div>
                <span className='block text-xs font-bold text-gray-600 mb-2'>
                  Max ppO2 Limit (bar):
                </span>
                <div className='flex flex-wrap gap-x-4 gap-y-2 items-center'>
                  {[1.2, 1.4].map(val => (
                    <label
                      key={val}
                      className='flex items-center gap-1.5 cursor-pointer font-bold text-xs text-gray-700 select-none'
                    >
                      <input
                        type='radio'
                        name='modPO2'
                        value={val}
                        checked={modPO2 === val}
                        onChange={() => setModPO2(val)}
                        className='h-4 w-4 text-[#0072B2] focus:ring-[#0072B2] border-gray-300 accent-[#0072B2]'
                      />
                      <span>{val.toFixed(1)} bar</span>
                    </label>
                  ))}
                  <span className='text-[10px] text-gray-400 italic sm:ml-auto leading-tight'>
                    For other ppO2 limits (like 1.3 or 1.6), try our{' '}
                    <Link
                      to='/resources/tools/mod'
                      className='text-[#0072B2] hover:underline font-bold'
                    >
                      Advanced Tool →
                    </Link>
                  </span>
                </div>
              </div>
              <div className='bg-[#eaf4f9]/50 p-4 rounded-xl text-center border border-[#eaf4f9]'>
                <span className='text-xs text-gray-500 block font-semibold'>
                  Maximum Operating Depth
                </span>
                <span className='text-3xl font-black text-[#0072B2] mt-1 block'>
                  {calculatedMOD.toFixed(1)} m
                </span>
              </div>
            </div>
          )}

          {activeTab === 'mix' && (
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-bold text-gray-600 mb-1.5'>
                  Target Max Depth: <span className='text-[#0072B2]'>{mixDepth} meters</span>
                </label>
                <input
                  type='range'
                  min='10'
                  max='40'
                  value={mixDepth}
                  onChange={e => setMixDepth(parseInt(e.target.value, 10))}
                  className='w-full accent-[#0072B2] cursor-pointer'
                />
              </div>
              <div>
                <span className='block text-xs font-bold text-gray-600 mb-2'>
                  Max ppO2 Limit (bar):
                </span>
                <div className='flex flex-wrap gap-x-4 gap-y-2 items-center'>
                  {[1.2, 1.4].map(val => (
                    <label
                      key={val}
                      className='flex items-center gap-1.5 cursor-pointer font-bold text-xs text-gray-700 select-none'
                    >
                      <input
                        type='radio'
                        name='mixPO2'
                        value={val}
                        checked={mixPO2 === val}
                        onChange={() => setMixPO2(val)}
                        className='h-4 w-4 text-[#0072B2] focus:ring-[#0072B2] border-gray-300 accent-[#0072B2]'
                      />
                      <span>{val.toFixed(1)} bar</span>
                    </label>
                  ))}
                  <span className='text-[10px] text-gray-400 italic sm:ml-auto leading-tight'>
                    For other ppO2 limits (like 1.3 or 1.6), try our{' '}
                    <Link
                      to='/resources/tools/best-mix'
                      className='text-[#0072B2] hover:underline font-bold'
                    >
                      Advanced Tool →
                    </Link>
                  </span>
                </div>
              </div>
              <div className='bg-[#eaf4f9]/50 p-4 rounded-xl text-center border border-[#eaf4f9]'>
                <span className='text-xs text-gray-500 block font-semibold'>
                  Recommended Nitrox Blend
                </span>
                <span className='text-3xl font-black text-[#0072B2] mt-1 block'>
                  EAN{calculatedBestMix}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'weight' && (
            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-bold text-gray-600 mb-1.5'>
                  Your Weight: <span className='text-[#0072B2]'>{weightKg} kg</span>
                </label>
                <input
                  type='range'
                  min='40'
                  max='120'
                  value={weightKg}
                  onChange={e => setWeightKg(parseInt(e.target.value, 10))}
                  className='w-full accent-[#0072B2] cursor-pointer'
                />
              </div>
              <div className='grid grid-cols-2 gap-3 text-xs'>
                <div>
                  <label className='block font-bold text-gray-600 mb-1'>Wetsuit Type</label>
                  <select
                    value={weightSuit}
                    onChange={e => setWeightSuit(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none focus:border-[#0072B2] focus:ring-1 focus:ring-[#0072B2]'
                  >
                    {Object.entries(SUIT_MULTIPLIERS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block font-bold text-gray-600 mb-1'>Water Type</label>
                  <select
                    value={weightWater}
                    onChange={e => setWeightWater(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none focus:border-[#0072B2] focus:ring-1 focus:ring-[#0072B2]'
                  >
                    <option value='salt'>Salt Water (Ocean)</option>
                    <option value='fresh'>Fresh Water (Lake)</option>
                  </select>
                </div>
              </div>
              <div className='bg-[#eaf4f9]/50 p-4 rounded-xl text-center border border-[#eaf4f9]'>
                <span className='text-xs text-gray-500 block font-semibold'>
                  Recommended Lead Weight
                </span>
                <span className='text-2xl font-black text-[#0072B2] mt-1 block'>
                  {calculatedLeadMin} - {calculatedLeadMax} kg
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Informative Suggested Link to Advanced Tool for each specific type */}
        <div className='mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between'>
          <span className='leading-tight pr-4'>
            {activeTab === 'mod' && 'Need multi-gas deco, Trimix, or EAD calculations?'}
            {activeTab === 'mix' && 'Planning a deeper tech dive? Find the optimal gas mix.'}
            {activeTab === 'weight' && 'Want to calculate drysuit offsets or tank buoyancy?'}
          </span>
          <Link
            to={
              activeTab === 'mod'
                ? '/resources/tools/mod'
                : activeTab === 'mix'
                  ? '/resources/tools/best-mix'
                  : '/resources/tools/weight'
            }
            className='inline-flex items-center gap-1 font-bold text-[#0072B2] hover:text-[#56B4E9] shrink-0 transition-colors'
          >
            <span>Advanced Tool</span>
            <ArrowRight className='h-3.5 w-3.5' />
          </Link>
        </div>
      </div>
    </div>
  );
}
