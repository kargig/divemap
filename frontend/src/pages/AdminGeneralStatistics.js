import {
  Users,
  MapPin,
  Building2,
  Anchor,
  MessageSquare,
  Star,
  Image,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Globe,
  BarChart3,
  Mail,
  Bell,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  Route,
  Calendar,
  Award,
  Tag,
  FileText,
  Activity,
  MailX,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { getGeneralStatistics, getNotificationAnalytics } from '../api';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminGeneralStatistics = () => {
  // Set page title
  usePageTitle('Divemap - Admin - General Statistics');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch general statistics data
  const {
    data: generalStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery(['general-statistics', refreshKey], getGeneralStatistics, {
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user?.is_admin,
  });

  const {
    data: notificationAnalytics,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useQuery(['notification-analytics', refreshKey], getNotificationAnalytics, {
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user?.is_admin,
  });

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Statistics refreshed');
  };

  const formatNumber = num => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  };

  const formatPercentage = num => {
    if (num === null || num === undefined) return '0%';
    return `${num.toFixed(1)}%`;
  };

  if (statsLoading || analyticsLoading) {
    return (
      <div className='max-w-7xl mx-auto p-6'>
        <div className='flex items-center justify-center h-64'>
          <RefreshCw className='h-8 w-8 animate-spin text-blue-600' />
          <span className='ml-2 text-gray-600'>Loading statistics...</span>
        </div>
      </div>
    );
  }

  if (statsError || analyticsError) {
    return (
      <div className='max-w-7xl mx-auto p-6'>
        <div className='text-center py-12'>
          <XCircle className='h-12 w-12 text-red-600 mx-auto mb-4' />
          <p className='text-red-600'>Error loading statistics. Please try again.</p>
          <button
            onClick={handleRefresh}
            className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-7xl mx-auto p-6'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>General Statistics</h1>
            <p className='text-gray-600 mt-2'>
              Platform statistics, geographic distribution, and notification analytics
            </p>
            {generalStats?.last_updated && (
              <p className='text-sm text-gray-500 mt-1'>
                Last updated: {new Date(generalStats.last_updated).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2'
          >
            <RefreshCw className='h-4 w-4' />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Platform Statistics */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Platform Statistics</h2>

        {/* User Statistics */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Users</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatNumber(generalStats?.platform_stats?.users?.total)}
                </p>
                <div className='flex items-center mt-1'>
                  {generalStats?.platform_stats?.users?.growth_rate > 0 ? (
                    <TrendingUp className='h-4 w-4 text-green-600' />
                  ) : (
                    <TrendingDown className='h-4 w-4 text-red-600' />
                  )}
                  <span
                    className={`text-sm ml-1 ${
                      generalStats?.platform_stats?.users?.growth_rate > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {generalStats?.platform_stats?.users?.growth_rate}%
                  </span>
                </div>
              </div>
              <Users className='h-8 w-8 text-blue-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Active Users (7d)</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatNumber(generalStats?.platform_stats?.users?.active_7d)}
                </p>
                <p className='text-sm text-gray-500'>Last week activity</p>
              </div>
              <Activity className='h-8 w-8 text-green-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Email Verified</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatNumber(generalStats?.platform_stats?.users?.email_verified?.count)}
                </p>
                <p className='text-sm text-gray-500'>
                  {formatPercentage(
                    generalStats?.platform_stats?.users?.email_verified?.percentage
                  )}{' '}
                  verified
                </p>
              </div>
              <CheckCircle className='h-8 w-8 text-teal-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Email Opted Out</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatNumber(generalStats?.platform_stats?.users?.email_opted_out)}
                </p>
                <p className='text-sm text-gray-500'>Global opt-out</p>
              </div>
              <MailX className='h-8 w-8 text-orange-600' />
            </div>
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Dive Sites</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.dive_sites)}
              </p>
              <p className='text-sm text-gray-500'>Total locations</p>
            </div>
            <MapPin className='h-8 w-8 text-green-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Diving Centers</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.diving_centers)}
              </p>
              <p className='text-sm text-gray-500'>Registered centers</p>
            </div>
            <Building2 className='h-8 w-8 text-purple-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Dives Logged</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.dives)}
              </p>
              <p className='text-sm text-gray-500'>User dives</p>
            </div>
            <Anchor className='h-8 w-8 text-teal-600' />
          </div>
        </div>
      </div>

      {/* Additional Content Statistics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Dive Routes</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.dive_routes)}
              </p>
              <p className='text-sm text-gray-500'>Planned routes</p>
            </div>
            <Route className='h-8 w-8 text-indigo-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Dive Trips</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.dive_trips)}
              </p>
              <p className='text-sm text-gray-500'>Parsed trips</p>
            </div>
            <Calendar className='h-8 w-8 text-cyan-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Total Tags</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.tags)}
              </p>
              <p className='text-sm text-gray-500'>Available tags</p>
            </div>
            <Tag className='h-8 w-8 text-pink-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Diving Organizations</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.diving_organizations)}
              </p>
              <p className='text-sm text-gray-500'>PADI, SSI, etc.</p>
            </div>
            <Award className='h-8 w-8 text-purple-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Newsletters</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.newsletters)}
              </p>
              <p className='text-sm text-gray-500'>Uploaded</p>
            </div>
            <FileText className='h-8 w-8 text-blue-600' />
          </div>
        </div>
      </div>

      {/* Engagement Statistics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Avg Site Rating</p>
              <p className='text-2xl font-bold text-gray-900'>
                {generalStats?.platform_stats?.engagement?.avg_site_rating}/10
              </p>
              <p className='text-sm text-gray-500'>Dive sites</p>
            </div>
            <Star className='h-8 w-8 text-yellow-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Avg Center Rating</p>
              <p className='text-2xl font-bold text-gray-900'>
                {generalStats?.platform_stats?.engagement?.avg_center_rating}/10
              </p>
              <p className='text-sm text-gray-500'>Diving centers</p>
            </div>
            <Star className='h-8 w-8 text-yellow-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Comments (24h)</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.engagement?.recent_comments_24h)}
              </p>
              <p className='text-sm text-gray-500'>Recent activity</p>
            </div>
            <MessageSquare className='h-8 w-8 text-blue-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Media Uploads</p>
              <p className='text-2xl font-bold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.content?.media_uploads)}
              </p>
              <p className='text-sm text-gray-500'>Photos & videos</p>
            </div>
            <Image className='h-8 w-8 text-pink-600' />
          </div>
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className='bg-white p-6 rounded-lg border shadow-sm mb-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <Globe className='h-5 w-5 mr-2' />
          Geographic Distribution
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
          <div>
            <h4 className='text-md font-semibold text-gray-700 mb-3'>Dive Sites by Country</h4>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {generalStats?.platform_stats?.geographic?.dive_sites_by_country
                ?.slice(0, 6)
                .map((item, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <span className='font-medium text-gray-700'>{item.country}</span>
                    <span className='text-sm text-gray-500'>{item.count} sites</span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <h4 className='text-md font-semibold text-gray-700 mb-3'>Diving Centers by Country</h4>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {generalStats?.platform_stats?.geographic?.diving_centers_by_country
                ?.slice(0, 6)
                .map((item, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <span className='font-medium text-gray-700'>{item.country}</span>
                    <span className='text-sm text-gray-500'>{item.count} centers</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Certifications */}
      {generalStats?.platform_stats?.users?.certifications && (
        <div className='bg-white p-6 rounded-lg border shadow-sm mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
            <Award className='h-5 w-5 mr-2' />
            User Certifications
          </h3>
          <div className='mb-4'>
            <p className='text-sm text-gray-600'>
              Total Certifications:{' '}
              <span className='font-semibold text-gray-900'>
                {formatNumber(generalStats?.platform_stats?.users?.certifications?.total || 0)}
              </span>
            </p>
          </div>
          {generalStats?.platform_stats?.users?.certifications?.by_organization &&
          generalStats?.platform_stats?.users?.certifications?.by_organization?.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {generalStats?.platform_stats?.users?.certifications?.by_organization?.map(
                (org, index) => (
                  <div
                    key={index}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                  >
                    <div>
                      <span className='font-medium text-gray-900'>{org.name}</span>
                      {org.acronym && (
                        <span className='text-sm text-gray-500 ml-2'>({org.acronym})</span>
                      )}
                    </div>
                    <span className='text-sm font-medium text-gray-700'>{org.count}</span>
                  </div>
                )
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* New Content (Last 7/30 days) */}
      {generalStats?.platform_stats?.content?.new_content_7d &&
      generalStats?.platform_stats?.content?.new_content_30d ? (
        <div className='bg-white p-6 rounded-lg border shadow-sm mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
            <Calendar className='h-5 w-5 mr-2' />
            New Content
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <h4 className='text-md font-semibold text-gray-700 mb-3'>Last 7 Days</h4>
              <div className='space-y-2'>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Dive Sites</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_7d?.dive_sites || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Diving Centers</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_7d?.diving_centers || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Dives</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_7d?.dives || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Routes</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_7d?.routes || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Trips</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_7d?.trips || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className='text-md font-semibold text-gray-700 mb-3'>Last 30 Days</h4>
              <div className='space-y-2'>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Dive Sites</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_30d?.dive_sites || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Diving Centers</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_30d?.diving_centers || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Dives</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_30d?.dives || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Routes</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_30d?.routes || 0
                    )}
                  </span>
                </div>
                <div className='flex items-center justify-between p-2 bg-gray-50 rounded'>
                  <span className='text-sm text-gray-600'>Trips</span>
                  <span className='font-medium text-gray-900'>
                    {formatNumber(
                      generalStats?.platform_stats?.content?.new_content_30d?.trips || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* System Usage */}
      <div className='bg-white p-6 rounded-lg border shadow-sm'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <BarChart3 className='h-5 w-5 mr-2' />
          System Usage
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='text-center'>
            <p className='text-sm font-medium text-gray-600'>API Calls Today</p>
            <p className='text-2xl font-bold text-gray-900'>
              {formatNumber(generalStats?.platform_stats?.system_usage?.api_calls_today)}
            </p>
          </div>
          <div className='text-center'>
            <p className='text-sm font-medium text-gray-600'>Peak Usage Time</p>
            <p className='text-2xl font-bold text-gray-900'>
              {generalStats?.platform_stats?.system_usage?.peak_usage_time}
            </p>
          </div>
          <div className='text-center'>
            <p className='text-sm font-medium text-gray-600'>Most Accessed Endpoint</p>
            <p className='text-lg font-bold text-gray-900 truncate'>
              {generalStats?.platform_stats?.system_usage?.most_accessed_endpoint}
            </p>
          </div>
        </div>
      </div>

      {/* Notification Analytics */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Notification Analytics</h2>

        {/* In-App Notifications */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
            <Bell className='h-5 w-5 mr-2' />
            In-App Notifications
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Total Notifications</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.in_app?.total || 0)}
                  </p>
                </div>
                <Bell className='h-8 w-8 text-blue-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Read</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.in_app?.read || 0)}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {formatPercentage(notificationAnalytics?.in_app?.read_rate || 0)} read rate
                  </p>
                </div>
                <CheckCircle className='h-8 w-8 text-green-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Unread</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.in_app?.unread || 0)}
                  </p>
                </div>
                <XCircle className='h-8 w-8 text-yellow-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Read Rate</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatPercentage(notificationAnalytics?.in_app?.read_rate || 0)}
                  </p>
                </div>
                <BarChart3 className='h-8 w-8 text-purple-600' />
              </div>
            </div>
          </div>
        </div>

        {/* Email Delivery Statistics */}
        <div className='mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
            <Mail className='h-5 w-5 mr-2' />
            Email Delivery Statistics
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Total Sent</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.email_delivery?.total_sent || 0)}
                  </p>
                </div>
                <Send className='h-8 w-8 text-blue-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Direct to SES</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.email_delivery?.sent_directly_to_ses || 0)}
                  </p>
                  <p className='text-sm text-gray-500'>Direct delivery</p>
                </div>
                <Mail className='h-8 w-8 text-green-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Queued to SQS</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatNumber(notificationAnalytics?.email_delivery?.queued_to_sqs || 0)}
                  </p>
                  <p className='text-sm text-gray-500'>Via queue</p>
                </div>
                <BarChart3 className='h-8 w-8 text-purple-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Delivery Rate</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {formatPercentage(notificationAnalytics?.email_delivery?.delivery_rate || 0)}
                  </p>
                </div>
                <CheckCircle className='h-8 w-8 text-teal-600' />
              </div>
            </div>

            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Avg Delivery Time</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {notificationAnalytics?.email_delivery?.avg_delivery_time_seconds
                      ? `${Math.round(notificationAnalytics.email_delivery.avg_delivery_time_seconds)}s`
                      : 'N/A'}
                  </p>
                </div>
                <Clock className='h-8 w-8 text-orange-600' />
              </div>
            </div>
          </div>
        </div>

        {/* Notification Statistics by Category */}
        {notificationAnalytics?.by_category && notificationAnalytics?.by_category?.length > 0 && (
          <div className='mb-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <BarChart3 className='h-5 w-5 mr-2' />
              Statistics by Category
            </h3>
            <div className='bg-white p-6 rounded-lg border shadow-sm overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Category
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Total
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      In-App
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Email Sent
                    </th>
                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                      Email Delivery Rate
                    </th>
                  </tr>
                </thead>
                <tbody className='bg-white divide-y divide-gray-200'>
                  {notificationAnalytics.by_category.map((category, index) => (
                    <tr key={index}>
                      <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'>
                        {category.category}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {formatNumber(category.total_notifications)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {formatNumber(category.in_app_sent)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {formatNumber(category.email_sent)}
                      </td>
                      <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                        {formatPercentage(category.email_delivery_rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Time-based Statistics */}
        {notificationAnalytics?.time_stats && (
          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <Clock className='h-5 w-5 mr-2' />
              Time-based Statistics
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='bg-white p-6 rounded-lg border shadow-sm'>
                <h4 className='text-md font-semibold text-gray-900 mb-4'>Last 24 Hours</h4>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Notifications</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_24h?.notifications || 0)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Emails Sent</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_24h?.emails_sent || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-white p-6 rounded-lg border shadow-sm'>
                <h4 className='text-md font-semibold text-gray-900 mb-4'>Last 7 Days</h4>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Notifications</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_7d?.notifications || 0)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Emails Sent</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_7d?.emails_sent || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className='bg-white p-6 rounded-lg border shadow-sm'>
                <h4 className='text-md font-semibold text-gray-900 mb-4'>Last 30 Days</h4>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Notifications</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_30d?.notifications || 0)}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600'>Emails Sent</span>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatNumber(notificationAnalytics.time_stats.last_30d?.emails_sent || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGeneralStatistics;
