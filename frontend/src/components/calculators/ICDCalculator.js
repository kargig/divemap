import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { checkIsobaricCounterdiffusion } from '../../utils/physics';
import GasMixInput from '../forms/GasMixInput';

const icdSchema = z.object({
  currentGas: z.object({
    o2: z.number().min(1).max(100),
    he: z.number().min(0).max(99),
  }),
  nextGas: z.object({
    o2: z.number().min(1).max(100),
    he: z.number().min(0).max(99),
  }),
});

const ICDCalculator = () => {
  const [result, setResult] = useState(null);

  const { control, watch } = useForm({
    resolver: zodResolver(icdSchema),
    defaultValues: {
      currentGas: { o2: 18, he: 45 },
      nextGas: { o2: 50, he: 0 },
    },
    mode: 'onChange',
  });

  const values = watch();

  useEffect(() => {
    const icdResult = checkIsobaricCounterdiffusion(values.currentGas, values.nextGas);
    setResult(icdResult);
  }, [values.currentGas, values.nextGas]);

  return (
    <div className='bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full'>
      <div className='p-3 sm:p-5 border-b border-gray-100 bg-indigo-50/30'>
        <div className='flex items-center space-x-3'>
          <div className='p-2 bg-indigo-600 rounded-lg text-white'>
            <RefreshCw className='h-5 w-5 sm:h-6 sm:w-6' />
          </div>
          <h2 className='text-lg sm:text-xl font-bold text-gray-900'>ICD Check (Gas Switch)</h2>
        </div>
        <p className='mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600'>
          Check for Isobaric Counterdiffusion risk when switching from Trimix to another gas.
        </p>
      </div>

      <div className='p-3 sm:p-6 flex-grow space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Current Gas */}
          <div className='space-y-3'>
            <label className='block text-sm font-bold text-gray-700'>
              1. Current Gas (Breathed now)
            </label>
            <div className='p-4 bg-gray-50 rounded-xl border border-gray-200'>
              <Controller
                name='currentGas'
                control={control}
                render={({ field }) => (
                  <GasMixInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          {/* Next Gas */}
          <div className='space-y-3'>
            <label className='block text-sm font-bold text-gray-700'>
              2. Next Gas (Switching to)
            </label>
            <div className='p-4 bg-gray-50 rounded-xl border border-gray-200'>
              <Controller
                name='nextGas'
                control={control}
                render={({ field }) => (
                  <GasMixInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </div>

        {result && (
          <div className='mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300'>
            {result.warning ? (
              <div className='p-4 sm:p-6 bg-red-50 rounded-2xl border border-red-200 flex flex-col items-center text-center'>
                <div className='p-3 bg-red-100 rounded-full mb-3'>
                  <AlertTriangle className='h-8 w-8 text-red-600' />
                </div>
                <h3 className='text-lg font-bold text-red-900'>ICD RISK DETECTED</h3>
                <p className='mt-2 text-sm text-red-700 max-w-md'>{result.message}</p>
                <div className='mt-4 grid grid-cols-2 gap-4 w-full max-w-sm'>
                  <div className='bg-white p-3 rounded-lg border border-red-100'>
                    <div className='text-[10px] uppercase font-bold text-gray-400'>
                      N<sub>2</sub> Increase
                    </div>
                    <div className='text-xl font-black text-red-600'>
                      +{result.deltaN2.toFixed(1)}%
                    </div>
                  </div>
                  <div className='bg-white p-3 rounded-lg border border-red-100'>
                    <div className='text-[10px] uppercase font-bold text-gray-400'>He Decrease</div>
                    <div className='text-xl font-black text-blue-600'>
                      -{Math.abs(result.deltaHe).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className='p-4 sm:p-6 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col items-center text-center'>
                <div className='p-3 bg-emerald-100 rounded-full mb-3'>
                  <CheckCircle2 className='h-8 w-8 text-emerald-600' />
                </div>
                <h3 className='text-lg font-bold text-emerald-900'>Switch Appears Safe</h3>
                <p className='mt-2 text-sm text-emerald-700'>
                  Nitrogen increase is within safe limits (Rule of Fifths).
                </p>
                {!(parseFloat(values.currentGas.he) > 0) && (
                  <p className='mt-1 text-xs text-emerald-600 italic'>
                    * ICD is only a risk when switching away from a gas containing Helium.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3'>
          <h4 className='font-bold text-gray-700 flex items-center text-sm'>
            <Info className='h-4 w-4 mr-2 text-indigo-500' />
            ICD & The Rule of Fifths
          </h4>
          <div className='text-xs text-gray-600 space-y-2 leading-relaxed'>
            <p>
              <strong>Isobaric Counterdiffusion (ICD)</strong> occurs when switching from a light
              gas (Helium) to a heavy gas (Nitrogen). Helium diffuses out of tissues slower than
              Nitrogen diffuses in, causing a transient supersaturation spike even at constant
              depth.
            </p>
            <p>
              This is particularly dangerous for the <strong>Inner Ear (Vestibular DCS)</strong>,
              potentially causing severe vertigo and nausea underwater.
            </p>
            <p>
              <strong>GUE Approach:</strong> Global Underwater Explorers (GUE) addresses ICD by
              using standardized gases (e.g., 21/35, 18/45) that naturally avoid these risky ratios,
              effectively designing the risk out of the system without requiring per-dive
              calculation.
            </p>
            <p>
              <strong>Other Agency Guidelines (IANTD/TDI):</strong> Most agencies recommend the{' '}
              <strong>Rule of Fifths</strong>: ensure any increase in Nitrogen percentage is no more
              than 1/5th of the decrease in Helium percentage. Also, avoid sudden spikes in
              Equivalent Narcotic Depth (END).
            </p>
          </div>
          <div className='bg-indigo-50 p-2 rounded font-mono text-[10px] text-indigo-800 border border-indigo-100'>
            Warning if: 5 × (ΔN<sub>2</sub> %) &gt; |ΔHe %|
          </div>
        </div>
      </div>

      <div className='p-3 sm:p-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-start'>
        <Info className='h-4 w-4 mr-2 text-gray-400 flex-shrink-0' />
        <p>
          Based on Subsurface algorithms. This check helps identify risky gas switches in technical
          dive planning.
        </p>
      </div>
    </div>
  );
};

export default ICDCalculator;
