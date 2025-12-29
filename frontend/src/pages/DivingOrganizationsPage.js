import { Award, ChevronDown, ChevronUp, Search, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';

import { getDivingOrganizations, getDivingOrganizationLevels } from '../api';
import usePageTitle from '../hooks/usePageTitle';

const CertificationLevelsList = ({ organizationId, identifier }) => {
  const { data: levels, isLoading } = useQuery(
    ['organization-levels', organizationId],
    () => getDivingOrganizationLevels(identifier),
    {
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );

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

  return (
    <div className='bg-gray-50 p-4 border-t border-gray-100'>
      <h4 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>
        Certification Levels
      </h4>
      <div className='grid gap-2'>
        {levels.map(level => (
          <div
            key={level.id}
            className='flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-sm'
          >
            <span className='font-medium text-gray-900'>{level.name}</span>
            <span className='text-gray-500 text-xs'>{level.abbreviation}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrganizationLogo = ({ org }) => {
  const [imageError, setImageError] = useState(false);

  if (org.logo_url && !imageError) {
    return (
      <div className='h-24 w-24 rounded-full bg-white border border-gray-100 overflow-hidden flex-shrink-0'>
        <img
          src={org.logo_url}
          alt={`${org.name} logo`}
          className='h-full w-full object-contain'
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className='h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl border border-blue-200 flex-shrink-0'>
      {org.acronym || org.name.substring(0, 2).toUpperCase()}
    </div>
  );
};

const OrganizationCard = ({ org }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200'>
      <div className='p-5 cursor-pointer' onClick={() => setIsExpanded(!isExpanded)}>
        <div className='flex justify-between items-start'>
          <div className='flex items-start space-x-3'>
            <OrganizationLogo org={org} />
            <div>
              <h3 className='text-lg font-medium text-gray-900'>{org.name}</h3>
              {org.acronym && <p className='text-sm text-gray-500 font-medium'>{org.acronym}</p>}
            </div>
          </div>
          <div className='flex items-center space-x-2'>
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
              Visit Website
            </a>
            <ExternalLink className='h-3 w-3 ml-1' />
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
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
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
