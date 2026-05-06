import { Spin, Result } from 'antd';
import { Activity, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getUserPublicProfile, getUserAdvancedAnalytics } from '../api';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import Avatar from '../components/Avatar';
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import usePageTitle from '../hooks/usePageTitle';

const UserAnalytics = () => {
  const { username } = useParams();
  usePageTitle(`Advanced Analytics - ${username}`);

  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch both concurrently
        const [profileData, analyticsData] = await Promise.all([
          getUserPublicProfile(username),
          getUserAdvancedAnalytics(username),
        ]);
        setProfile(profileData);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.response?.data?.detail || 'Failed to load user analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <Spin size='large' tip='Loading analytics...'>
          <div className='p-10' />
        </Spin>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-8'>
        <Result
          status='warning'
          title='Analytics Unavailable'
          subTitle={error || 'User profile could not be loaded.'}
          extra={
            <Link
              to={`/users/${username}`}
              className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            >
              <ArrowLeft className='w-4 h-4' />
              Back to Profile
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in'>
      {/* Header */}
      <div className='mb-8 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-6 w-full text-center sm:text-left gap-4'>
        <div className='shrink-0 relative'>
          <Link
            to={`/users/${username}`}
            className='absolute -top-2 -left-2 z-10 p-1.5 bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm'
            title='Back to Profile'
          >
            <ArrowLeft className='w-4 h-4' />
          </Link>
          <Avatar
            src={profile.avatar_full_url || profile.avatar_url}
            username={username}
            size='xl'
            className='sm:w-32 sm:h-32 shadow-md'
          />
        </div>
        <div className='flex-1 min-w-0 w-full pt-2'>
          <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 truncate mb-2'>{username}</h1>
          <h2 className='text-xl text-gray-600 flex items-center justify-center sm:justify-start gap-2'>
            <Activity className='w-6 h-6 text-blue-600' />
            Advanced Analytics
          </h2>
        </div>
      </div>

      {/* Analytics Content */}
      <div className='space-y-8 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-inner'>
        {/* Depth Density Heatmap */}
        {analytics?.depth_density_heatmap && analytics.depth_density_heatmap.length > 0 ? (
          <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:p-6 hover:shadow-md transition-shadow'>
            <DepthDensityHeatmap data={analytics.depth_density_heatmap} />
          </div>
        ) : null}

        {/* Other Advanced Analytics */}
        <AdvancedAnalytics
          sacData={analytics?.sac_vs_depth}
          durationData={analytics?.duration_vs_depth}
          tempData={analytics?.temp_vs_suit}
          yearlyData={analytics?.dives_per_year}
          sacTimeData={analytics?.sac_over_time}
          depthTimeData={analytics?.depth_over_time}
          gasConfigData={analytics?.dives_per_gas_config}
          weightSuitData={analytics?.weight_vs_gear}
          weightTimeData={analytics?.weight_over_time}
        />
      </div>
    </div>
  );
};

export default UserAnalytics;
