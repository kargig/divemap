import { Tags, Search, Hash } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';

import { getTagsWithCounts } from '../api';
import usePageTitle from '../hooks/usePageTitle';
import { getTagColor } from '../utils/tagHelpers';

const DivingTagsPage = () => {
  usePageTitle('Divemap - Diving Tags');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: tags, isLoading } = useQuery('public-tags', getTagsWithCounts, {
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const filteredTags = tags?.filter(
    tag =>
      tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tag.description && tag.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='bg-white shadow-sm rounded-lg overflow-hidden'>
        <div className='p-6 border-b border-gray-200'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 flex items-center'>
                <Tags className='h-8 w-8 mr-3 text-blue-600' />
                Diving Tags
              </h1>
              <p className='mt-1 text-gray-600'>
                Explore the tags used to categorize dive sites and experiences.
              </p>
            </div>
            <div className='relative w-full md:w-64'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Search className='h-5 w-5 text-gray-400' />
              </div>
              <input
                type='text'
                className='block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out'
                placeholder='Search tags...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className='flex justify-center items-center h-64'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          </div>
        ) : (
          <div className='bg-gray-50 p-6'>
            {filteredTags?.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {filteredTags.map(tag => (
                  <div
                    key={tag.id}
                    className='bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-5 border border-gray-100'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center'>
                        <span
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-full mr-3 ${getTagColor(
                            tag.name
                          )}`}
                        >
                          <Hash className='h-4 w-4' />
                        </span>
                        <h3 className='text-lg font-medium text-gray-900'>{tag.name}</h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColor(
                          tag.name
                        )}`}
                      >
                        {tag.dive_site_count} {tag.dive_site_count === 1 ? 'site' : 'sites'}
                      </span>
                    </div>
                    {tag.description && (
                      <p className='mt-3 text-sm text-gray-500 line-clamp-3'>{tag.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-12 bg-white rounded-lg border border-dashed border-gray-300'>
                <Tags className='mx-auto h-12 w-12 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>No tags found</h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {searchTerm
                    ? `No tags matching "${searchTerm}"`
                    : 'There are no tags in the system yet.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DivingTagsPage;
