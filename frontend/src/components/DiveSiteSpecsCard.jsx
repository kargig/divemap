import { Check, Copy, Anchor, Navigation, Calendar } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

import { formatDate } from '../utils/dateHelpers';
import { getDifficultyLabel } from '../utils/difficultyHelpers';

import DepthIcon from './ui/DepthIcon';
import DifficultyBadge from './ui/DifficultyBadge';

const DiveSiteSpecsCard = ({ diveSite }) => {
  const [copied, setCopied] = useState(false);

  if (!diveSite) return null;

  const hasCoords = diveSite.latitude != null && diveSite.longitude != null;
  const latStr = hasCoords
    ? `${Math.abs(diveSite.latitude).toFixed(4)}° ${diveSite.latitude >= 0 ? 'N' : 'S'}`
    : null;
  const lonStr = hasCoords
    ? `${Math.abs(diveSite.longitude).toFixed(4)}° ${diveSite.longitude >= 0 ? 'E' : 'W'}`
    : null;

  // Extract water entry from tags or access instructions
  const tags = diveSite.tags || [];
  const entryTag = tags.find(
    t =>
      t.name?.toLowerCase().includes('boat') ||
      t.name?.toLowerCase().includes('shore') ||
      t.name?.toLowerCase().includes('zodiac')
  );
  const entryLabel =
    entryTag?.name ||
    (diveSite.access_instructions?.toLowerCase().includes('beach') ? 'Shore Dive' : 'Unspecified');

  const handleCopyCoords = async e => {
    e.stopPropagation();
    if (!hasCoords) return;
    const rawCoords = `${diveSite.latitude.toFixed(6)}, ${diveSite.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(rawCoords);
      setCopied(true);
      toast.success('Coordinates copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy coordinates');
    }
  };

  const difficultyCode = diveSite.difficulty_code || diveSite.difficulty;
  const difficultyLabel = diveSite.difficulty_label || getDifficultyLabel(difficultyCode);
  const showDifficulty =
    difficultyCode != null || (difficultyLabel && difficultyLabel !== 'Unspecified');

  return (
    <div className='bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700'>
      <div className='flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700/60'>
        <h3 className='text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight'>
          Dive Site Specs
        </h3>
        {showDifficulty && (
          <DifficultyBadge
            code={typeof difficultyCode === 'string' ? difficultyCode : undefined}
            label={difficultyLabel}
            size='sm'
          />
        )}
      </div>

      <div className='grid grid-cols-2 gap-3 text-xs'>
        {/* Max Depth */}
        <div className='p-2.5 rounded-lg bg-gray-50/70 dark:bg-slate-700/60 border border-gray-100/80 dark:border-slate-600/50'>
          <span className='block text-[10px] font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider mb-1'>
            Max Depth
          </span>
          <div className='flex items-center gap-1.5 font-bold text-gray-900 dark:text-slate-100 text-sm'>
            <DepthIcon
              depth={diveSite.max_depth || 0}
              size={16}
              className='text-blue-600 dark:text-blue-400'
            />
            <span>{diveSite.max_depth ? `${diveSite.max_depth}m` : 'N/A'}</span>
          </div>
        </div>

        {/* Water Entry */}
        <div className='p-2.5 rounded-lg bg-gray-50/70 dark:bg-slate-700/60 border border-gray-100/80 dark:border-slate-600/50'>
          <span className='block text-[10px] font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider mb-1'>
            Entry Type
          </span>
          <div className='flex items-center gap-1.5 font-bold text-gray-900 dark:text-slate-100 text-sm'>
            <Anchor className='w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0' />
            <span className='truncate'>{entryLabel}</span>
          </div>
        </div>

        {/* Coordinates */}
        {hasCoords && (
          <div className='col-span-2 p-2.5 rounded-lg bg-gray-50/70 dark:bg-slate-700/60 border border-gray-100/80 dark:border-slate-600/50 flex items-center justify-between'>
            <div>
              <span className='block text-[10px] font-bold text-gray-500 dark:text-slate-300 uppercase tracking-wider mb-0.5'>
                Coordinates
              </span>
              <div className='flex items-center gap-1.5 font-mono font-medium text-gray-800 dark:text-slate-200 text-xs'>
                <Navigation className='w-3.5 h-3.5 text-blue-500 shrink-0' />
                <span>
                  {latStr}, {lonStr}
                </span>
              </div>
            </div>
            <button
              type='button'
              onClick={handleCopyCoords}
              className='p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-slate-600 text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 transition-colors'
              aria-label='Copy coordinates'
              title='Copy coordinates'
            >
              {copied ? <Check className='w-4 h-4 text-green-600' /> : <Copy className='w-4 h-4' />}
            </button>
          </div>
        )}

        {/* Added Date */}
        {diveSite.created_at && (
          <div className='col-span-2 flex items-center justify-between text-[11px] text-gray-400 px-1 pt-1'>
            <span className='flex items-center gap-1'>
              <Calendar className='w-3 h-3' />
              <span>Added to Divemap</span>
            </span>
            <span className='font-medium text-gray-600 dark:text-gray-400'>
              {formatDate(diveSite.created_at, { month: 'short' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

DiveSiteSpecsCard.propTypes = {
  diveSite: PropTypes.shape({
    max_depth: PropTypes.number,
    difficulty: PropTypes.number,
    latitude: PropTypes.number,
    longitude: PropTypes.number,
    created_at: PropTypes.string,
    access_instructions: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.object),
  }),
};

export default DiveSiteSpecsCard;
