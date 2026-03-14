import {
  Calculator,
  MapPin,
  Search,
  CloudSun,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  GraduationCap,
  MessageCircle,
  Package,
  Fish,
  Calendar,
  History,
  Star,
} from 'lucide-react';
import React, { useState } from 'react';

const ToolIcon = ({ name, size = 16 }) => {
  switch (name) {
    case 'calculate_diving_physics':
      return <Calculator size={size} />;
    case 'search_dive_sites':
      return <MapPin size={size} />;
    case 'search_diving_centers':
      return <Package size={size} />;
    case 'search_diving_trips':
      return <Calendar size={size} />;
    case 'search_gear_rental':
      return <Package size={size} />;
    case 'search_marine_life':
      return <Fish size={size} />;
    case 'compare_certifications':
      return <Layers size={size} />;
    case 'get_certification_path':
      return <GraduationCap size={size} />;
    case 'get_dive_site_details':
      return <Info size={size} />;
    case 'get_user_dive_logs':
      return <History size={size} />;
    case 'get_reviews_and_comments':
      return <Star size={size} />;
    case 'ask_user_for_clarification':
      return <MessageCircle size={size} />;
    case 'enrich_with_weather':
      return <CloudSun size={size} />;
    default:
      return <Search size={size} />;
  }
};

const CollapsibleSection = ({ title, data, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (
    !data ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0)
  ) {
    return null;
  }

  const isArray = Array.isArray(data);
  const count = isArray ? data.length : null;

  return (
    <div className='mt-2'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors'
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}{' '}
        {count !== null && (
          <span className='lowercase font-normal text-gray-400'>({count} items)</span>
        )}
      </button>

      {isOpen && (
        <div className='mt-1 bg-black/5 dark:bg-black/20 rounded border border-black/5 dark:border-white/5 p-2 overflow-x-auto'>
          <pre className='text-[10px] font-mono leading-relaxed text-gray-700 dark:text-gray-300'>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const AgentExecutionTimeline = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className='mt-4 space-y-0 relative'>
      {/* Vertical line connecting the icons */}
      <div className='absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700 z-0' />

      {steps.map((step, index) => (
        <div key={index} className='relative pl-8 pb-6 last:pb-0'>
          {/* Icon node */}
          <div className='absolute left-0 top-0 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-blue-500 flex items-center justify-center text-blue-500 z-10 shadow-sm'>
            <ToolIcon name={step.tool_name} size={12} />
          </div>

          <div className='bg-white dark:bg-gray-800/40 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50 shadow-sm'>
            <div className='flex justify-between items-start mb-1'>
              <h4 className='text-xs font-bold text-gray-800 dark:text-gray-200 font-mono'>
                {step.tool_name}
              </h4>
              {step.execution_time_ms && (
                <span className='text-[10px] font-mono text-gray-400'>
                  {step.execution_time_ms.toFixed(0)}ms
                </span>
              )}
            </div>

            {step.reasoning && (
              <p className='text-[11px] text-gray-600 dark:text-gray-400 italic mb-2'>
                {step.reasoning}
              </p>
            )}

            <CollapsibleSection title='Input Arguments' data={step.tool_args || step.parameters} />

            <CollapsibleSection title='Output Result' data={step.tool_result} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentExecutionTimeline;
