import { Tag } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../../api';
import { extractErrorMessage } from '../../utils/apiErrors';
import { UI_COLORS } from '../../utils/colorPalette';
import { getTagColor } from '../../utils/tagHelpers';

export const TagSelection = ({ selectedTags, setSelectedTags }) => {
  const queryClient = useQueryClient();

  // Tag management state
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);

  // Fetch all available tags
  const { data: availableTags = [] } = useQuery(['available-tags'], () =>
    api.get('/api/v1/tags/').then(res => res.data)
  );

  // Tag mutations
  const createTagMutation = useMutation(tagData => api.post('/api/v1/tags/', tagData), {
    onSuccess: newTag => {
      queryClient.invalidateQueries(['available-tags']);
      setSelectedTags(prev => [...prev, newTag.id]);
      setNewTagName('');
      setNewTagDescription('');
      setShowTagForm(false);
      toast.success('Tag created and selected successfully');
    },
    onError: error => {
      toast.error(extractErrorMessage(error) || 'Failed to create tag');
    },
  });

  return (
    <div className='border-t pt-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-gray-900'>Tags</h3>
        <button
          type='button'
          onClick={() => setShowTagForm(!showTagForm)}
          className='flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors'
        >
          <Tag className='w-4 h-4 mr-2' />
          Add Tag
        </button>
      </div>

      {/* Add Tag Form */}
      {showTagForm && (
        <div className='bg-gray-50 p-4 rounded-md mb-4'>
          <div className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label
                  htmlFor='new_tag_name'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Tag Name *
                </label>
                <input
                  id='new_tag_name'
                  type='text'
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label
                  htmlFor='new_tag_description'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Description
                </label>
                <input
                  id='new_tag_description'
                  type='text'
                  value={newTagDescription}
                  onChange={e => setNewTagDescription(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
            <div className='flex space-x-2'>
              <button
                type='button'
                onClick={() => {
                  if (!newTagName.trim()) {
                    toast.error('Tag name is required');
                    return;
                  }
                  createTagMutation.mutate({
                    name: newTagName,
                    description: newTagDescription,
                  });
                }}
                disabled={createTagMutation.isLoading}
                className='px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50'
              >
                {createTagMutation.isLoading ? 'Adding...' : 'Add Tag'}
              </button>
              <button
                type='button'
                onClick={() => setShowTagForm(false)}
                className='px-4 py-2 text-white rounded-md hover:bg-gray-800'
                style={{ backgroundColor: UI_COLORS.neutral }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Tags */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
        <h4 className='text-md font-semibold text-gray-800'>Select Tags</h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
          {Array.isArray(availableTags) && availableTags.length > 0 ? (
            availableTags.map(tag => (
              <label key={tag.id} className='flex items-center space-x-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={selectedTags.includes(tag.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedTags(prev => [...prev, tag.id]);
                    } else {
                      setSelectedTags(prev => prev.filter(id => id !== tag.id));
                    }
                  }}
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span className='text-sm font-medium text-gray-700'>{tag.name}</span>
              </label>
            ))
          ) : (
            <p className='text-gray-500 text-sm'>No tags available</p>
          )}
        </div>
      </div>

      {/* Selected Tags Summary */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
        <h4 className='text-md font-semibold text-gray-800'>
          Selected Tags ({selectedTags.length})
        </h4>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
          {selectedTags.length > 0 ? (
            selectedTags.map(tagId => {
              const tag = availableTags.find(t => t.id === tagId);
              return tag ? (
                <span
                  key={tagId}
                  className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${getTagColor(tag.name)}`}
                >
                  {tag.name}
                </span>
              ) : null;
            })
          ) : (
            <p className='text-gray-500 text-sm'>No tags selected</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagSelection;
