import { Spin, Result } from 'antd';
import { Activity, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { getUserPublicProfile } from '../api';
import AdvancedAnalytics from '../components/AdvancedAnalytics';
import Avatar from '../components/Avatar';
import DepthDensityHeatmap from '../components/DepthDensityHeatmap';
import usePageTitle from '../hooks/usePageTitle';

const UserAnalytics = () => {
  const { username } = useParams();
  usePageTitle(`Advanced Analytics - ${username}`);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserPublicProfile(username);
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err.response?.data?.detail || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
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
      <div className='mb-8 flex items-center justify-between flex-wrap gap-4'>
        <div className='flex items-center gap-4'>
          <Link
            to={`/users/${username}`}
            className='p-2 bg-white border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 hover:text-blue-600 transition-all'
            title='Back to Profile'
          >
            <ArrowLeft className='w-5 h-5' />
          </Link>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3'>
              <Activity className='w-7 h-7 text-blue-600' />
              Advanced Analytics
            </h1>
            <p className='text-gray-500 mt-1 flex items-center gap-2'>
              <Avatar
                src={profile.avatar_full_url || profile.avatar_url}
                username={username}
                size='xs'
                className='w-5 h-5 shadow-sm'
              />
              <span className='font-semibold text-gray-700'>{username}</span>'s diving patterns and
              behavioral insights
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className='space-y-8 bg-gray-50/50 p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-inner'>
        {/* Depth Density Heatmap */}
        {profile.diving_stats?.depth_density_heatmap &&
        profile.diving_stats.depth_density_heatmap.length > 0 ? (
          <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-2 sm:p-6 hover:shadow-md transition-shadow'>
            <DepthDensityHeatmap data={profile.diving_stats.depth_density_heatmap} />
          </div>
        ) : null}

        {/* Other Advanced Analytics */}
        <AdvancedAnalytics
          sacData={profile.diving_stats?.sac_vs_depth}
          durationData={profile.diving_stats?.duration_vs_depth}
          tempData={profile.diving_stats?.temp_vs_suit}
          yearlyData={profile.diving_stats?.dives_per_year}
          sacTimeData={profile.diving_stats?.sac_over_time}
          depthTimeData={profile.diving_stats?.depth_over_time}
        />
      </div>
    </div>
  );
};

export default UserAnalytics;
