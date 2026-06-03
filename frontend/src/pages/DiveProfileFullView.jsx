import { Row, Col, Space } from 'antd';
import { ArrowLeft, Activity, Info, AlertCircle } from 'lucide-react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';

import api from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import { getDive, getDiveProfile } from '../services/dives';
import { extractErrorMessage } from '../utils/apiErrors';
import { formatDate } from '../utils/dateHelpers';

const AdvancedDiveProfileChart = lazy(() => import('../components/AdvancedDiveProfileChart'));

const DiveProfileFullView = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const [profileHasDeco, setProfileHasDeco] = useState(undefined);

  // Fetch dive data for context
  const {
    data: dive,
    isLoading: diveLoading,
    error: diveError,
  } = useQuery(['dive', id], () => getDive(id), {
    enabled: !!id,
  });

  // Fetch dive profile data
  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery(['dive-profile', id], () => getDiveProfile(id), {
    enabled: !!id,
  });

  const handleBack = () => {
    navigate(`/dives/${id}/${slug}`);
  };

  if (diveLoading || profileLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading dive profile...</p>
        </div>
      </div>
    );
  }

  if (diveError || profileError) {
    const error = diveError || profileError;
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 p-4'>
        <div className='max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center'>
          <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
          <h1 className='text-xl font-bold text-gray-900 mb-2'>Error Loading Profile</h1>
          <p className='text-gray-600 mb-6'>{extractErrorMessage(error)}</p>
          <Button onClick={handleBack} variant='primary'>
            Back to Dive Details
          </Button>
        </div>
      </div>
    );
  }

  const diveName = dive?.name || dive?.dive_site?.name || 'Unnamed Dive';

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col'>
      <SEO
        title={`Dive Profile - ${diveName} - ${formatDate(dive?.dive_date)}`}
        description={`Detailed dive profile for ${diveName}. View depth, temperature, and deco information.`}
        noindex={dive?.is_private}
      />

      {/* Header Navigation */}
      <header className='bg-white border-b border-gray-200 sticky top-0 z-10'>
        <div className='max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-4 min-w-0'>
            <button
              onClick={handleBack}
              className='p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0'
              aria-label='Back to dive details'
            >
              <ArrowLeft className='h-6 w-6 text-gray-600' />
            </button>
            <div className='min-w-0'>
              <h1 className='text-lg font-bold text-gray-900 truncate'>{diveName} - Profile</h1>
              <p className='text-xs text-gray-500 truncate'>
                {formatDate(dive?.dive_date)} • {dive?.user_username}
              </p>
            </div>
          </div>
          <div className='hidden sm:flex items-center gap-2'>
            <Button to={`/dives/${id}/${slug}`} variant='secondary' size='sm'>
              View Details
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 overflow-y-auto'>
        <div className='max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8'>
          <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
            <div className='p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Activity className='h-5 w-5 text-blue-600' />
                <h2 className='text-lg font-semibold text-gray-800'>Interactive Profile Chart</h2>
              </div>
              {profileHasDeco && (
                <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1'>
                  <Info className='h-3 w-3' />
                  Deco Dive
                </span>
              )}
            </div>

            <div className='p-1 sm:p-4'>
              <Suspense
                fallback={
                  <div className='h-[60vh] flex items-center justify-center bg-gray-50 rounded animate-pulse'>
                    Loading chart content...
                  </div>
                }
              >
                <AdvancedDiveProfileChart
                  profileData={profileData}
                  isLoading={false}
                  error={null}
                  showTemperature={true}
                  screenSize='desktop'
                  diveId={id}
                  gasData={dive?.gas_bottles_used}
                  onDecoStatusChange={profileHasDeco => {
                  onClose={handleBack}
                />
              </Suspense>
            </div>

            <div className='p-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-500'>
              <p>
                <strong>Tip:</strong> You can hover over the chart to see specific data points. On
                mobile, you can pinch to zoom and pan the chart for more detail.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DiveProfileFullView;
