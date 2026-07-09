import { Bookmark, Plus, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { getDiveSiteListStatus, addListItem, deleteListItem, createList } from '../api';

import Button from './ui/Button';
import Modal from './ui/Modal';

const SaveToListModal = ({ isOpen, onClose, diveSiteId, diveSiteName }) => {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchStatus = async () => {
    try {
      const data = await getDiveSiteListStatus(diveSiteId);
      setLists(data);
    } catch (e) {
      toast.error('Failed to load list status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStatus();
    }
  }, [isOpen, diveSiteId]);

  const handleToggle = async (listId, isInList, item) => {
    try {
      if (isInList) {
        if (!item.item_id) {
          toast.error('Cannot remove site: list item ID is missing');
          return;
        }
        const toastId = toast.loading('Removing from list...');
        await deleteListItem(listId, item.item_id);
        toast.success('Removed from list!', { id: toastId });
      } else {
        const toastId = toast.loading('Adding to list...');
        await addListItem(listId, { dive_site_id: diveSiteId });
        toast.success('Added to list!', { id: toastId });
      }
      fetchStatus();
    } catch (err) {
      toast.error('Failed to update list');
    }
  };

  const handleCreateAndAdd = async e => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const newList = await createList({ title: newTitle, is_public: true });
      await addListItem(newList.id, { dive_site_id: diveSiteId });
      toast.success(`Created "${newTitle}" and saved!`);
      setNewTitle('');
      fetchStatus();
    } catch (e) {
      toast.error('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className='flex items-center gap-2 text-gray-900 dark:text-white'>
          <Bookmark className='h-5 w-5 text-blue-600 dark:text-blue-400' />
          <span>Save "{diveSiteName}" to Lists</span>
        </div>
      }
      className='max-w-md w-full'
    >
      <div className='mt-4 space-y-4'>
        {/* Lists Container */}
        <div className='max-h-60 overflow-y-auto space-y-2 pr-1'>
          {loading ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='animate-spin text-blue-600 dark:text-blue-400 h-8 w-8' />
            </div>
          ) : lists.length === 0 ? (
            <p className='text-center py-6 text-sm text-gray-500 dark:text-gray-400 italic'>
              No lists found. Create one below to get started!
            </p>
          ) : (
            lists.map(lst => (
              <label
                key={lst.list_id}
                className='flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-blue-100/30 dark:hover:bg-blue-900/10 transition-colors'
              >
                <div className='flex flex-col'>
                  <span className='font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base'>
                    {lst.title}
                  </span>
                  {lst.system_type && (
                    <span className='text-[10px] text-blue-600 dark:text-blue-400 font-medium capitalize mt-0.5'>
                      Default List
                    </span>
                  )}
                </div>
                <input
                  type='checkbox'
                  checked={lst.is_in_list}
                  onChange={() => handleToggle(lst.list_id, lst.is_in_list, lst)}
                  className='rounded border-gray-300 dark:border-gray-600 text-blue-600 h-5 w-5 focus:ring-blue-500 cursor-pointer'
                />
              </label>
            ))
          )}
        </div>

        {/* Create List Form */}
        <form
          onSubmit={handleCreateAndAdd}
          className='pt-4 border-t border-gray-100 dark:border-gray-700'
        >
          <div className='flex gap-2 items-center'>
            <input
              type='text'
              placeholder='Create new custom list...'
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className='flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              disabled={creating}
              maxLength={100}
            />
            <Button
              type='submit'
              disabled={creating || !newTitle.trim()}
              size='sm'
              className='flex-shrink-0'
            >
              {creating ? (
                <Loader2 className='animate-spin h-4 w-4' />
              ) : (
                <>
                  <Plus className='h-4 w-4 mr-1' /> Create
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default SaveToListModal;
