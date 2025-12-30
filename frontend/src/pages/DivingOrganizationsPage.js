import { Award, ChevronDown, ChevronUp, Search, Globe, Info } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';

import { getDivingOrganizations, getDivingOrganizationLevels } from '../api';
import OrganizationLogo from '../components/OrganizationLogo';
import usePageTitle from '../hooks/usePageTitle';

const CertificationLevelsList = ({ organizationId, identifier }) => {
  const { data: levels, isLoading } = useQuery(
    ['organization-levels', organizationId],
    () => getDivingOrganizationLevels(identifier),
    {
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );

  const [expandedCategories, setExpandedCategories] = useState({});

  if (isLoading) {
    return (
      <div className='flex justify-center p-4'>
        <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!levels || levels.length === 0) {
    return <div className='p-4 text-sm text-gray-500 italic'>No certification levels found.</div>;
  }

  // Group levels by category
  const groupedLevels = levels.reduce((acc, level) => {
    const category = level.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(level);
    return acc;
  }, {});

  const categories = Object.keys(groupedLevels);

  const toggleCategory = category => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleAll = () => {
    const allExpanded = categories.every(cat => expandedCategories[cat]);
    const newState = {};
    categories.forEach(cat => {
      newState[cat] = !allExpanded;
    });
    setExpandedCategories(newState);
  };

  const allExpanded = categories.length > 0 && categories.every(cat => expandedCategories[cat]);

  return (
    <div className='bg-gray-50 p-4 border-t border-gray-100'>
      <div className='flex justify-between items-center mb-3'>
        <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
          Certification Levels
        </h4>
        <button
          onClick={toggleAll}
          className='text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none'
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className='space-y-4'>
        {categories.map(category => (
          <div
            key={category}
            className='bg-white rounded border border-gray-200 shadow-sm overflow-hidden'
          >
            <button
              onClick={() => toggleCategory(category)}
              className='w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none'
            >
              <span className='font-medium text-gray-900 text-sm'>{category}</span>
              <span className='text-gray-500'>
                {expandedCategories[category] ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </span>
            </button>

            {expandedCategories[category] && (
              <div className='p-3 grid gap-3 border-t border-gray-200'>
                {groupedLevels[category].map(level => (
                  <div
                    key={level.id}
                    className='bg-white rounded border border-gray-200 text-sm overflow-hidden'
                  >
                    <div className='p-3 border-b border-gray-100 bg-blue-50/50'>
                      <span className='font-medium text-gray-900'>{level.name}</span>
                    </div>
                    <div className='p-3 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-xs'>
                      {level.max_depth && (
                        <div className='flex items-start'>
                          <span className='font-semibold text-gray-500 w-24 flex-shrink-0'>
                            Max Depth:
                          </span>
                          <span className='text-gray-700'>{level.max_depth}</span>
                        </div>
                      )}
                      {level.deco_time_limit && (
                        <div className='flex items-start'>
                          <span className='font-semibold text-gray-500 w-24 flex-shrink-0'>
                            Deco Limit:
                          </span>
                          <span className='text-gray-700'>{level.deco_time_limit}</span>
                        </div>
                      )}
                      {level.gases && (
                        <div className='flex items-start'>
                          <span className='font-semibold text-gray-500 w-24 flex-shrink-0'>
                            Gases:
                          </span>
                          <span className='text-gray-700'>{level.gases}</span>
                        </div>
                      )}
                      {level.tanks && (
                        <div className='flex items-start'>
                          <span className='font-semibold text-gray-500 w-24 flex-shrink-0'>
                            Tanks:
                          </span>
                          <span className='text-gray-700'>{level.tanks}</span>
                        </div>
                      )}
                      {level.prerequisites && (
                        <div className='flex items-start md:col-span-2'>
                          <span className='font-semibold text-gray-500 w-24 flex-shrink-0'>
                            Prerequisites:
                          </span>
                          <span className='text-gray-700'>{level.prerequisites}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const OrganizationCard = ({ org }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMobileDescription, setShowMobileDescription] = useState(false);

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200'>
      <div className='p-5 cursor-pointer' onClick={() => setIsExpanded(!isExpanded)}>
        <div className='flex justify-between items-start'>
          <div className='flex items-start space-x-3 flex-1 min-w-0'>
            <OrganizationLogo org={org} size='h-24 w-24' textSize='text-xl' />
            <div className='min-w-0'>
              <h3 className='text-lg font-medium text-gray-900 break-words'>{org.name}</h3>
              {org.acronym && <p className='text-sm text-gray-500 font-medium'>{org.acronym}</p>}
              {org.description && (
                <p
                  className={`mt-2 text-sm text-gray-600 ${showMobileDescription ? 'block' : 'hidden'} md:block`}
                >
                  {org.description}
                </p>
              )}
            </div>
          </div>
          <div className='flex items-center space-x-2 ml-2 flex-shrink-0'>
            {org.description && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowMobileDescription(!showMobileDescription);
                }}
                className={`md:hidden p-2 rounded-lg transition-all duration-200 ${
                  showMobileDescription
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
                title={showMobileDescription ? 'Hide description' : 'Show description'}
              >
                <Info className='h-5 w-5' />
              </button>
            )}
            <button
              onClick={e => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isExpanded
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
              title={isExpanded ? 'Hide certifications' : 'Show certifications'}
            >
              <Award className='h-5 w-5' />
            </button>
            <div className='text-gray-400'>
              {isExpanded ? <ChevronUp className='h-5 w-5' /> : <ChevronDown className='h-5 w-5' />}
            </div>
          </div>
        </div>

        {org.website && (
          <div
            className='mt-3 flex items-center text-sm text-blue-600 hover:text-blue-800'
            onClick={e => e.stopPropagation()}
          >
            <Globe className='h-3 w-3 mr-1' />
            <a
              href={org.website}
              target='_blank'
              rel='noopener noreferrer'
              className='hover:underline'
            >
              {org.website.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/')[0]}
            </a>
          </div>
        )}
      </div>

      {isExpanded && <CertificationLevelsList organizationId={org.id} identifier={org.id} />}
    </div>
  );
};

const DivingOrganizationsPage = () => {
  usePageTitle('Divemap - Diving Organizations');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: organizations, isLoading } = useQuery(
    'public-organizations',
    () => getDivingOrganizations({ limit: 100 }), // Get all reasonable amount
    {
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );

  const filteredOrgs = organizations?.filter(org => {
    const term = searchTerm.toLowerCase();
    return (
      org.name.toLowerCase().includes(term) ||
      (org.acronym && org.acronym.toLowerCase().includes(term))
    );
  });

  return (
    <div className='w-full max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='bg-white shadow-sm rounded-lg overflow-hidden mb-8'>
        <div className='p-6 border-b border-gray-200'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 flex items-center'>
                <Award className='h-8 w-8 mr-3 text-blue-600' />
                Diving Organizations
              </h1>
              <p className='mt-1 text-gray-600'>
                Browse recognized diving organizations and their certification levels.
              </p>
            </div>
            <div className='relative w-full md:w-64'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <Search className='h-5 w-5 text-gray-400' />
              </div>
              <input
                type='text'
                className='block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out'
                placeholder='Search organizations...'
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
            {filteredOrgs?.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6'>
                {filteredOrgs.map(org => (
                  <OrganizationCard key={org.id} org={org} />
                ))}
              </div>
            ) : (
              <div className='text-center py-12 bg-white rounded-lg border border-dashed border-gray-300'>
                <Award className='mx-auto h-12 w-12 text-gray-400' />
                <h3 className='mt-2 text-sm font-medium text-gray-900'>No organizations found</h3>
                <p className='mt-1 text-sm text-gray-500'>
                  {searchTerm
                    ? `No organizations matching "${searchTerm}"`
                    : 'There are no diving organizations in the system yet.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DivingOrganizationsPage;
