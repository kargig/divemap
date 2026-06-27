import { Shield, Anchor, Compass } from 'lucide-react';
import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

const DiveStyleRadar = ({ data, boatPct = 0, shorePct = 0 }) => {
  if (!data || data.length === 0) {
    return <p className='text-gray-500 text-sm mt-2'>Not enough tag data to map dive styles.</p>;
  }

  // Calculate highest count to find the primary archetype
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const topDimension = sortedData[0]?.subject || 'Explorer';
  const hasMultipleStyles = sortedData[0]?.value > 0;

  const getArchetypeLabel = dimension => {
    if (!hasMultipleStyles) return 'General Explorer';
    const labels = {
      'Reef & Eco': 'Marine Biologist & Eco Enthusiast',
      'Wreck & History': 'Sunken History Hunter',
      'Deep & Technical': 'Technical Deep Diver',
      'Drift & Wall': 'Adrenaline Drift & Wall Rider',
      'Cave & Overhead': 'Cave & Cavern Penetration Specialist',
      'Night & Shadow': 'Nocturnal Aquatic Observer',
      Photography: 'Creative Underwater Photographer',
      Training: 'Active Instructor / Student Learner',
    };
    return labels[dimension] || 'Adventurer';
  };

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-6 hover:shadow-md transition-shadow animate-fade-in'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center'>
        {/* Radar Map Column */}
        <div>
          <h3 className='text-md font-semibold text-gray-800 mb-1 flex items-center gap-2'>
            <Compass className='w-5 h-5 text-blue-600' />
            Dive Style Radar Chart
          </h3>
          <p className='text-xs text-gray-500 mb-6'>Mappings based on your logged dive tags.</p>
          <div className='h-64 w-full flex justify-center'>
            <ResponsiveContainer width='100%' height='100%'>
              <RadarChart cx='50%' cy='50%' outerRadius='60%' data={data}>
                <PolarGrid stroke='#e2e8f0' />
                <PolarAngleAxis
                  dataKey='subject'
                  tick={{ fontSize: 9, fill: '#64748b', fontWeight: '600' }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 'auto']}
                  tick={{ fontSize: 9 }}
                  stroke='#94a3b8'
                />
                <Radar
                  name='Style'
                  dataKey='value'
                  stroke='#2563eb'
                  fill='#2563eb'
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Summary & Archetype Column */}
        <div className='flex flex-col justify-between h-full py-2 gap-4'>
          <div>
            <h4 className='text-sm font-semibold text-gray-700 mb-2'>Diver Persona Archetype</h4>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold rounded-full mb-4'>
              <Shield className='w-3.5 h-3.5' />
              {getArchetypeLabel(topDimension)}
            </div>
            <p className='text-xs text-gray-500 leading-relaxed mb-6'>
              Your logged tags indicate a strong preference for {topDimension.toLowerCase()} diving.
              Keep logging dives and assigning tags to see how your dive style evolves over time!
            </p>
          </div>

          {/* Logistics Summary */}
          {(boatPct > 0 || shorePct > 0) && (
            <div className='bg-gray-50 p-4 rounded-xl border border-gray-100'>
              <h5 className='text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider flex items-center gap-1.5'>
                <Anchor className='w-4 h-4 text-blue-500' />
                Logistics & Entry Preference
              </h5>
              <div className='flex gap-4 items-center text-sm'>
                {boatPct > 0 && (
                  <div className='flex-1100'>
                    <div className='flex justify-between text-xs font-medium text-gray-700 mb-1'>
                      <span>Boat / Charter</span>
                      <span>{boatPct}%</span>
                    </div>
                    <div className='w-full bg-gray-200 h-1.5 rounded-full overflow-hidden'>
                      <div
                        className='bg-blue-600 h-1.5 rounded-full'
                        style={{ width: `${boatPct}%` }}
                      />
                    </div>
                  </div>
                )}
                {shorePct > 0 && (
                  <div className='flex-1100'>
                    <div className='flex justify-between text-xs font-medium text-gray-700 mb-1'>
                      <span>Shore / Coastal</span>
                      <span>{shorePct}%</span>
                    </div>
                    <div className='w-full bg-gray-200 h-1.5 rounded-full overflow-hidden'>
                      <div
                        className='bg-sky-500 h-1.5 rounded-full'
                        style={{ width: `${shorePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiveStyleRadar;
