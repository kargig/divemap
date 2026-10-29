import { Drawer } from 'antd';
import {
  Award,
  NotebookText,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Globe,
  Info,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { useSearchParams } from 'react-router-dom';

import OrganizationLogo from '../components/OrganizationLogo';
import PageHeader from '../components/PageHeader';
import SEO from '../components/SEO';
import { getDivingOrganizationLevels, getDivingOrganizations } from '../services/organizations';

const CertificationLevelsList = ({ organizationId, identifier, highlightCourse }) => {
  const { data: levels, isLoading } = useQuery(
    ['organization-levels', organizationId],
    () => getDivingOrganizationLevels(identifier),
    {
      staleTime: 60 * 60 * 1000, // 1 hour
    }
  );

  const [expandedCategories, setExpandedCategories] = useState({});
  const highlightedRef = useRef(null);

  useEffect(() => {
    if (levels && highlightCourse) {
      const lowerHighlight = highlightCourse.toLowerCase();
      const levelToHighlight = levels.find(l => l.name.toLowerCase().includes(lowerHighlight));
      if (levelToHighlight) {
        const category = levelToHighlight.category || 'General';
        setExpandedCategories(prev => ({ ...prev, [category]: true }));
      }
    }
  }, [levels, highlightCourse]);

  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expandedCategories]);

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
    <div className='bg-gray-50 dark:bg-slate-900 p-4 border-t border-gray-100 dark:border-slate-800 min-h-full'>
      <div className='flex justify-between items-center mb-3'>
        <button
          onClick={toggleAll}
          className='text-xs font-medium text-blue-600 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-300 focus:outline-none'
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      <div className='space-y-4'>
        {categories.map(category => (
          <div
            key={category}
            className='bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden'
          >
            <button
              onClick={() => toggleCategory(category)}
              className='w-full px-4 py-3 flex justify-between items-center bg-gray-50 dark:bg-slate-750 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none'
            >
              <span className='font-medium text-gray-900 dark:text-slate-100 text-sm'>
                {category}
              </span>
              <span className='text-gray-500 dark:text-slate-400'>
                {expandedCategories[category] ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </span>
            </button>

            {expandedCategories[category] && (
              <div className='p-3 grid gap-3 border-t border-gray-200 dark:border-slate-700'>
                {groupedLevels[category].map(level => {
                  const isHighlighted =
                    highlightCourse &&
                    level.name.toLowerCase().includes(highlightCourse.toLowerCase());
                  return (
                    <div
                      key={level.id}
                      ref={isHighlighted ? highlightedRef : null}
                      className={`bg-white dark:bg-slate-800 rounded border text-sm overflow-hidden transition-all duration-300 ${
                        isHighlighted
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900/50 shadow-md'
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      <div
                        className={`p-3 border-b ${
                          isHighlighted
                            ? 'border-blue-100 dark:border-blue-900 bg-blue-100/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                            : 'border-gray-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-750 text-gray-900 dark:text-slate-100'
                        }`}
                      >
                        <span
                          className={`font-medium ${isHighlighted ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-slate-100'}`}
                        >
                          {level.name}
                          {isHighlighted && (
                            <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'>
                              Highlighted
                            </span>
                          )}
                        </span>
                      </div>
                      <div className='p-3 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-xs'>
                        {level.max_depth && (
                          <div className='flex items-start'>
                            <span className='font-semibold text-gray-500 dark:text-slate-400 w-24 flex-shrink-0'>
                              Max Depth:
                            </span>
                            <span className='text-gray-700 dark:text-slate-200'>
                              {level.max_depth}
                            </span>
                          </div>
                        )}
                        {level.deco_time_limit && (
                          <div className='flex items-start'>
                            <span className='font-semibold text-gray-500 dark:text-slate-400 w-24 flex-shrink-0'>
                              Deco Limit:
                            </span>
                            <span className='text-gray-700 dark:text-slate-200'>
                              {level.deco_time_limit}
                            </span>
                          </div>
                        )}
                        {level.gases && (
                          <div className='flex items-start'>
                            <span className='font-semibold text-gray-500 dark:text-slate-400 w-24 flex-shrink-0'>
                              Gases:
                            </span>
                            <span className='text-gray-700 dark:text-slate-200'>{level.gases}</span>
                          </div>
                        )}
                        {level.tanks && (
                          <div className='flex items-start'>
                            <span className='font-semibold text-gray-500 dark:text-slate-400 w-24 flex-shrink-0'>
                              Tanks:
                            </span>
                            <span className='text-gray-700 dark:text-slate-200'>{level.tanks}</span>
                          </div>
                        )}
                        {level.prerequisites && (
                          <div className='flex items-start md:col-span-2'>
                            <span className='font-semibold text-gray-500 dark:text-slate-400 w-24 flex-shrink-0'>
                              Prerequisites:
                            </span>
                            <span className='text-gray-700 dark:text-slate-200'>
                              {level.prerequisites}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

CertificationLevelsList.propTypes = {
  organizationId: PropTypes.number.isRequired,
  identifier: PropTypes.number.isRequired,
  highlightCourse: PropTypes.string,
};

const OrganizationCard = ({ org, initialDrawerOpen, highlightCourse }) => {
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);

  useEffect(() => {
    if (initialDrawerOpen) {
      setDrawerOpen(true);
    }
  }, [initialDrawerOpen]);

  return (
    <>
      <div
        className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer ${
          initialDrawerOpen
            ? 'border-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/40'
            : 'border-gray-200 dark:border-slate-700'
        }`}
        onClick={() => setDrawerOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDrawerOpen(true);
          }
        }}
        role='button'
        tabIndex={0}
      >
        <div className='p-4 sm:p-5'>
          <div className='flex justify-between items-start'>
            <div className='flex items-start space-x-3'>
              <OrganizationLogo
                org={org}
                size='h-16 w-16 sm:h-24 sm:w-24'
                textSize='text-base sm:text-xl'
              />
              <div>
                <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100'>
                  {org.name}
                </h3>
                {org.acronym && (
                  <p className='text-sm text-gray-500 dark:text-slate-400 font-medium'>
                    {org.acronym}
                  </p>
                )}
              </div>
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setDrawerOpen(true);
                }}
                className='p-2 rounded-lg transition-all duration-200 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                title='View certifications'
              >
                <NotebookText className='h-5 w-5' />
              </button>
            </div>
          </div>

          {org.website && (
            <div
              className='mt-3 flex items-center text-sm text-blue-600 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-300'
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              role='button'
              tabIndex={0}
            >
              <Globe className='h-3 w-3 mr-1' />
              <a
                href={org.website}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:underline'
                tabIndex={-1}
              >
                Visit Website
              </a>
              <ExternalLink className='h-3 w-3 ml-1' />
            </div>
          )}
        </div>
      </div>

      <Drawer
        title={
          <div className='flex items-center space-x-3'>
            <OrganizationLogo org={org} size='h-8 w-8' textSize='text-sm' />
            <div>
              <span className='font-medium text-gray-900 dark:text-slate-100'>{org.name}</span>
              <span className='text-gray-500 dark:text-slate-400 ml-2'>- Certification Levels</span>
            </div>
          </div>
        }
        placement='right'
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        size={'large'}
      >
        <CertificationLevelsList
          organizationId={org.id}
          identifier={org.id}
          highlightCourse={highlightCourse}
        />
      </Drawer>
    </>
  );
};

OrganizationCard.propTypes = {
  org: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    acronym: PropTypes.string,
    description: PropTypes.string,
    website: PropTypes.string,
  }).isRequired,
  initialDrawerOpen: PropTypes.bool,
  highlightCourse: PropTypes.string,
};

const DivingOrganizationsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');
  const courseParam = searchParams.get('course');

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
    <>
      <SEO
        title='Diving Organizations & Certification Agencies | Divemap'
        description='Directory of recognized scuba certification agencies such as PADI, SSI, CMAS, and GUE. Explore certification levels and diving courses.'
      />
      <div className='w-full max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
        <PageHeader
          title='Diving Organizations'
          titleIcon={Award}
          badge={filteredOrgs?.length || organizations?.length || null}
          breadcrumbItems={[{ label: 'Resources' }, { label: 'Organizations' }]}
        />
        <div className='bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden mb-8 border border-gray-100 dark:border-slate-700'>
          <div className='p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
              <p className='text-sm text-gray-600 dark:text-slate-400'>
                Browse recognized diving organizations and their certification levels.
              </p>
              <div className='relative w-full md:w-64'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Search className='h-5 w-5 text-gray-400 dark:text-slate-500' />
                </div>
                <input
                  type='text'
                  className='block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md leading-5 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out'
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
            <div className='bg-gray-50 dark:bg-slate-900 p-2 sm:p-4 lg:p-6'>
              {filteredOrgs?.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6'>
                  {filteredOrgs.map(org => {
                    const isTargetOrg =
                      orgParam &&
                      (org.acronym?.toLowerCase() === orgParam.toLowerCase() ||
                        org.name.toLowerCase().includes(orgParam.toLowerCase()));
                    return (
                      <OrganizationCard
                        key={org.id}
                        org={org}
                        initialDrawerOpen={isTargetOrg}
                        highlightCourse={isTargetOrg ? courseParam : null}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className='text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700'>
                  <NotebookText className='mx-auto h-12 w-12 text-gray-400 dark:text-slate-500' />
                  <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-slate-100'>
                    No organizations found
                  </h3>
                  <p className='mt-1 text-sm text-gray-500 dark:text-slate-400'>
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
    </>
  );
};

export default DivingOrganizationsPage;
