import { AlertCircle, Link2, Plus, Loader2 } from 'lucide-react';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';

import FuzzySearchInput from './FuzzySearchInput';
import QuickCreateDiveSiteModal from './QuickCreateDiveSiteModal';
import Modal from './ui/Modal';

const LinkDiveSiteModal = ({ isOpen, onClose, dive, onSuccess }) => {
  const queryClient = useQueryClient();
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchString, setSearchString] = useState(dive?.unlinked_site_name || '');
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Fetch dive sites list for fuzzy search
  const { data: diveSites = [], isLoading: isLoadingSites } = useQuery(
    ['dive-sites-list-all'],
    async () => {
      const res = await api.get('/api/v1/dive-sites/', {
        params: { limit: 1000 },
      });
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
    {
      enabled: isOpen,
      staleTime: 60000,
    }
  );

  const linkMutation = useMutation(
    async ({ siteId }) => {
      await api.put(`/api/v1/dives/${dive.id}`, {
        dive_site_id: siteId,
      });
    },
    {
      onSuccess: (data, { site }) => {
        queryClient.invalidateQueries(['dives']);
        queryClient.invalidateQueries(['user-dives']);
        queryClient.invalidateQueries(['dive', dive.id]);
        queryClient.invalidateQueries(['dive', String(dive.id)]);
        toast.success('Dive site linked successfully!');
        if (onSuccess) {
          onSuccess(site || selectedSite);
        }
        if (onClose) {
          onClose();
        }
      },
      onError: () => {
        toast.error('Failed to link dive site.');
      },
    }
  );

  if (!isOpen || !dive) return null;

  const handleConfirmLink = () => {
    if (!selectedSite) {
      toast.error('Please select a dive site first.');
      return;
    }
    linkMutation.mutate({ siteId: selectedSite.id, site: selectedSite });
  };

  const handleQuickCreateSuccess = createdSite => {
    queryClient.invalidateQueries(['dive-sites-list-all']);
    setSelectedSite(createdSite);
    setSearchString(createdSite.name);
    linkMutation.mutate({ siteId: createdSite.id, site: createdSite });
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isQuickCreateOpen}
        onClose={onClose}
        title='Link Dive to Dive Site'
        className='w-full max-w-lg p-0 overflow-hidden'
      >
        <div className='p-4 sm:p-6 space-y-4'>
          {/* Current Unlinked Site Info */}
          <div className='p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2'>
            <AlertCircle className='w-4 h-4 text-amber-600 shrink-0 mt-0.5' />
            <div>
              Current site label from log:{' '}
              <strong className='font-mono bg-amber-100/70 dark:bg-amber-900/60 px-1 py-0.5 rounded'>
                {dive.unlinked_site_name || 'Unlinked Site'}
              </strong>
            </div>
          </div>

          <div>
            <label className='block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1'>
              Search Divemap Sites
            </label>
            {isLoadingSites ? (
              <div className='flex items-center gap-2 text-xs text-gray-500 py-2'>
                <Loader2 className='w-3.5 h-3.5 animate-spin' /> Loading dive sites...
              </div>
            ) : (
              <FuzzySearchInput
                data={diveSites}
                searchValue={searchString}
                onSearchChange={setSearchString}
                onSearchSelect={site => {
                  setSelectedSite(site);
                  setSearchString(site.name);
                }}
                placeholder='Type at least 3 letters to search...'
                minQueryLength={3}
                configType='diveSites'
              />
            )}
          </div>

          {selectedSite && (
            <div className='p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md flex items-center justify-between text-xs sm:text-sm'>
              <div>
                <span className='font-semibold text-blue-900 dark:text-blue-200'>
                  Selected: {selectedSite.name}
                </span>
                {selectedSite.country && (
                  <div className='text-xs text-blue-700 dark:text-blue-300'>
                    {selectedSite.country}
                  </div>
                )}
              </div>
              <span className='text-xs text-blue-600 dark:text-blue-400 font-semibold'>Ready</span>
            </div>
          )}

          <div className='flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700'>
            <button
              type='button'
              onClick={() => setIsQuickCreateOpen(true)}
              className='inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700'
            >
              <Plus className='w-3.5 h-3.5' />
              <span>Create New Dive Site</span>
            </button>
          </div>
        </div>

        <div className='p-4 bg-gray-50 dark:bg-slate-900/60 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            disabled={linkMutation.isLoading}
            className='px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirmLink}
            disabled={!selectedSite || linkMutation.isLoading}
            className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50'
          >
            {linkMutation.isLoading ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                <span>Linking...</span>
              </>
            ) : (
              <>
                <Link2 className='w-4 h-4' />
                <span>Link Site</span>
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* Embedded Quick Create Modal fallback */}
      {isQuickCreateOpen && (
        <QuickCreateDiveSiteModal
          isOpen={true}
          onClose={() => setIsQuickCreateOpen(false)}
          initialData={{
            name: dive.unlinked_site_name || '',
          }}
          matchingCount={1}
          onSuccess={handleQuickCreateSuccess}
        />
      )}
    </>
  );
};

LinkDiveSiteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dive: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    unlinked_site_name: PropTypes.string,
  }),
  onSuccess: PropTypes.func,
};

export default LinkDiveSiteModal;
