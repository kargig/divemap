import {
  Users,
  MapPin,
  Building2,
  Tags,
  Settings,
  ArrowRight,
  Award,
  Crown,
  Notebook,
  FileText,
  Bell,
  Route as RouteIcon,
  MessageSquare,
  History,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  Database,
  TrendingUp,
  Clock,
  Bookmark,
  Eye,
  Globe,
  Lock,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate, Link } from 'react-router-dom';

import { getAdminPopularLists } from '../api';
import ChatbotIcon from '../components/Chat/ChatbotIcon';
import PageTitle from '../components/PageTitle';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import {
  getSystemMetrics,
  getTurnstileStats,
  getStorageHealth,
  getGeneralStatistics,
  getModerationPendingCounts,
} from '../services/admin';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch metrics data
  const { data: systemMetrics, isLoading: metricsLoading } = useQuery(
    ['system-metrics', refreshKey],
    getSystemMetrics,
    {
      refetchInterval: 60000, // Refetch every 60 seconds
      enabled: !!user?.is_admin,
    }
  );

  const { data: generalStats, isLoading: statsLoading } = useQuery(
    ['general-statistics', refreshKey],
    getGeneralStatistics,
    {
      refetchInterval: 60000,
      enabled: !!user?.is_admin,
    }
  );

  const { data: pendingCounts } = useQuery(
    ['moderation-pending-counts', refreshKey],
    getModerationPendingCounts,
    {
      refetchInterval: 15000, // Refetch every 15 seconds to keep counts fresh
      enabled: !!user?.is_admin,
    }
  );

  const { data: popularLists, isLoading: listsLoading } = useQuery(
    ['admin-popular-lists', refreshKey],
    getAdminPopularLists,
    {
      refetchInterval: 60000,
      enabled: !!user?.is_admin,
    }
  );

  const popularListsWithSites = popularLists?.filter(lst => (lst.items?.length || 0) > 0) || [];

  if (!user?.is_admin) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const formatPercentage = num => {
    if (num === null || num === undefined) return '0%';
    return `${num.toFixed(1)}%`;
  };

  const getStatusIcon = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return <CheckCircle className='h-5 w-5 text-green-600' />;
      case 'warning':
        return <AlertTriangle className='h-5 w-5 text-yellow-600' />;
      case 'critical':
        return <XCircle className='h-5 w-5 text-red-600' />;
      default:
        return <Activity className='h-5 w-5 text-gray-600' />;
    }
  };

  return (
    <>
      <SEO title='Divemap - Admin Dashboard' description='Divemap Admin Dashboard' />
      <div className='w-full max-w-full py-4 sm:py-6 pr-4 sm:pr-6 pl-2 sm:pl-4'>
        <div className='mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <PageTitle>Admin Dashboard</PageTitle>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className='flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 self-end sm:self-auto shadow-2xs'
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${metricsLoading || statsLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          {/* Total Users Widget */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100'>Total Users</h3>
              <div className='p-2 bg-blue-50 dark:bg-blue-900/40 rounded-lg'>
                <Users className='h-6 w-6 text-blue-600 dark:text-sky-400' />
              </div>
            </div>
            <div className='mt-auto'>
              {statsLoading ? (
                <div className='h-8 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2'></div>
              ) : (
                <div className='text-3xl font-bold text-gray-900 dark:text-slate-100'>
                  {generalStats?.platform_stats?.users?.total?.toLocaleString() || 0}
                </div>
              )}
              <div className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                Registered accounts
              </div>
            </div>
          </div>

          {/* Total Dives Widget */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100'>Total Dives</h3>
              <div className='p-2 bg-teal-50 dark:bg-teal-900/40 rounded-lg'>
                <Notebook className='h-6 w-6 text-teal-600 dark:text-teal-400' />
              </div>
            </div>
            <div className='mt-auto'>
              {statsLoading ? (
                <div className='h-8 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2'></div>
              ) : (
                <div className='text-3xl font-bold text-gray-900 dark:text-slate-100'>
                  {generalStats?.platform_stats?.content?.dives?.toLocaleString() || 0}
                </div>
              )}
              <div className='text-sm text-gray-500 dark:text-slate-400 mt-1'>Logged by users</div>
            </div>
          </div>

          {/* Dive Sites Widget */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100'>Dive Sites</h3>
              <div className='p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg'>
                <MapPin className='h-6 w-6 text-indigo-600 dark:text-indigo-400' />
              </div>
            </div>
            <div className='mt-auto'>
              {statsLoading ? (
                <div className='h-8 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2'></div>
              ) : (
                <div className='text-3xl font-bold text-gray-900 dark:text-slate-100'>
                  {generalStats?.platform_stats?.content?.dive_sites?.toLocaleString() || 0}
                </div>
              )}
              <div className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                Published locations
              </div>
            </div>
          </div>

          {/* System Health Widget */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-slate-100'>
                Database Health
              </h3>
              <div className='p-2 bg-gray-50 dark:bg-slate-700 rounded-lg'>
                <Database className='h-6 w-6 text-gray-600 dark:text-slate-300' />
              </div>
            </div>
            <div className='mt-auto'>
              {metricsLoading ? (
                <div className='h-8 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-full'></div>
              ) : (
                <div className='flex items-center space-x-2'>
                  {getStatusIcon(systemMetrics?.services?.database)}
                  <span
                    className={`text-lg font-semibold ${
                      systemMetrics?.services?.database === 'healthy'
                        ? 'text-green-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {systemMetrics?.services?.database
                      ? systemMetrics.services.database.charAt(0).toUpperCase() +
                        systemMetrics.services.database.slice(1)
                      : 'Unknown'}
                  </span>
                  <span className='text-sm text-gray-500 dark:text-slate-400 ml-2'>
                    ({systemMetrics?.database?.response_time_ms || 0}ms)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8'>
          {/* Quick Actions Panel */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6'>
            <h3 className='text-xl font-bold text-gray-900 dark:text-slate-100 mb-6'>
              Content Moderation
            </h3>
            <div className='space-y-4'>
              <button
                onClick={() => navigate('/admin/dive-sites/edit-requests')}
                className='w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors'
              >
                <div className='flex items-center'>
                  <FileText className='h-5 w-5 text-blue-600 dark:text-sky-400 mr-3' />
                  <span className='font-medium text-gray-900 dark:text-slate-100'>
                    Pending Site Edits
                  </span>
                  {pendingCounts?.pending_site_edits > 0 && (
                    <span className='ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white'>
                      {pendingCounts.pending_site_edits}
                    </span>
                  )}
                </div>
                <div className='flex items-center'>
                  <ArrowRight className='h-4 w-4 text-blue-600 dark:text-sky-400' />
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/ownership-requests')}
                className='w-full flex items-center justify-between p-4 bg-yellow-50 dark:bg-amber-950/30 border border-yellow-100 dark:border-amber-900 rounded-lg hover:bg-yellow-100 dark:hover:bg-amber-900/50 transition-colors'
              >
                <div className='flex items-center'>
                  <Crown className='h-5 w-5 text-yellow-600 dark:text-amber-400 mr-3' />
                  <span className='font-medium text-gray-900 dark:text-slate-100'>
                    Ownership Requests
                  </span>
                  {pendingCounts?.pending_ownership_requests > 0 && (
                    <span className='ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-600 text-white'>
                      {pendingCounts.pending_ownership_requests}
                    </span>
                  )}
                </div>
                <div className='flex items-center'>
                  <ArrowRight className='h-4 w-4 text-yellow-600 dark:text-amber-400' />
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/chat-feedback')}
                className='w-full flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors'
              >
                <div className='flex items-center'>
                  <MessageSquare className='h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-3' />
                  <span className='font-medium text-gray-900 dark:text-slate-100'>
                    Chatbot Feedback
                  </span>
                </div>
                <div className='flex items-center'>
                  <ArrowRight className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />
                </div>
              </button>
            </div>
          </div>

          {/* System & Analytics Summary */}
          <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6'>
            <h3 className='text-xl font-bold text-gray-900 dark:text-slate-100 mb-6'>
              System & Analytics
            </h3>
            <div className='grid grid-cols-2 gap-4'>
              <div
                onClick={() => navigate('/admin/system-metrics')}
                className='p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors'
              >
                <Activity className='h-6 w-6 text-blue-600 dark:text-sky-400 mb-3' />
                <h4 className='font-medium text-gray-900 dark:text-slate-100'>System Metrics</h4>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                  View system health and usage
                </p>
              </div>
              <div
                onClick={() => navigate('/admin/general-statistics')}
                className='p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors'
              >
                <BarChart3 className='h-6 w-6 text-green-600 dark:text-emerald-400 mb-3' />
                <h4 className='font-medium text-gray-900 dark:text-slate-100'>Platform Stats</h4>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                  View detailed statistics
                </p>
              </div>
              <div
                onClick={() => navigate('/admin/growth-visualizations')}
                className='p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors'
              >
                <TrendingUp className='h-6 w-6 text-indigo-600 dark:text-indigo-400 mb-3' />
                <h4 className='font-medium text-gray-900 dark:text-slate-100'>Growth Stats</h4>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                  Track content growth
                </p>
              </div>
              <div
                onClick={() => navigate('/admin/recent-activity')}
                className='p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors'
              >
                <Clock className='h-6 w-6 text-orange-600 dark:text-amber-400 mb-3' />
                <h4 className='font-medium text-gray-900 dark:text-slate-100'>Activity Log</h4>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                  Monitor recent actions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Popular User Curated Lists */}
        <div className='bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mt-6 md:mt-8'>
          <h3 className='text-xl font-bold text-gray-900 dark:text-slate-100 mb-6 flex items-center gap-2'>
            <Bookmark className='h-5 w-5 text-blue-600 dark:text-sky-400' />
            Popular Curated Collections
          </h3>
          {listsLoading ? (
            <div className='flex justify-center py-8'>
              <Loader2 className='animate-spin text-blue-600 dark:text-sky-400 h-8 w-8' />
            </div>
          ) : !popularListsWithSites || popularListsWithSites.length === 0 ? (
            <p className='text-center py-8 text-sm text-gray-500 dark:text-slate-400 italic'>
              No collections created yet.
            </p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm'>
                <thead className='bg-gray-50 dark:bg-slate-900/60 font-semibold text-gray-700 dark:text-slate-300 text-xs uppercase tracking-wider text-left'>
                  <tr>
                    <th className='px-6 py-3'>List Title</th>
                    <th className='px-6 py-3'>Owner</th>
                    <th className='px-6 py-3'>Visibility</th>
                    <th className='px-6 py-3 text-right'>Sites Count</th>
                    <th className='px-6 py-3 text-right'>Views</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-800 dark:text-slate-200 font-medium'>
                  {popularListsWithSites.map(lst => (
                    <tr
                      key={lst.id}
                      className='hover:bg-blue-50/20 dark:hover:bg-blue-900/20 transition-colors'
                    >
                      <td className='px-6 py-4'>
                        <Link
                          to={`/users/${lst.username}/lists/${lst.id}/${lst.slug}`}
                          className='text-blue-600 dark:text-sky-400 hover:underline font-bold text-sm sm:text-base'
                        >
                          {lst.title}
                        </Link>
                        {lst.system_type && (
                          <span className='ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-sky-300 uppercase tracking-tighter'>
                            SYSTEM
                          </span>
                        )}
                      </td>
                      <td className='px-6 py-4'>
                        <Link
                          to={`/users/${lst.username}`}
                          className='text-gray-900 dark:text-slate-100 hover:underline font-bold'
                        >
                          @{lst.username}
                        </Link>
                      </td>
                      <td className='px-6 py-4'>
                        {lst.is_public ? (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300 border border-green-100 dark:border-emerald-800 gap-1'>
                            <Globe size={11} /> Public
                          </span>
                        ) : (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800 gap-1'>
                            <Lock size={11} /> Private
                          </span>
                        )}
                      </td>
                      <td className='px-6 py-4 text-right text-gray-900 dark:text-slate-100 font-bold'>
                        {lst.items?.length || 0}
                      </td>
                      <td className='px-6 py-4 text-right text-blue-600 dark:text-sky-400 font-extrabold flex items-center justify-end gap-1.5'>
                        <Eye size={14} className='text-gray-400 dark:text-slate-500' />{' '}
                        {lst.view_count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Admin;
