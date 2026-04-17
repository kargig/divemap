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
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';

import ChatbotIcon from '../components/Chat/ChatbotIcon';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  getSystemMetrics,
  getTurnstileStats,
  getStorageHealth,
  getGeneralStatistics,
} from '../services/admin';

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Set page title
  usePageTitle('Divemap - Admin Dashboard');

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
    <div className='w-full max-w-full p-4 sm:p-6'>
      <div className='mb-8 flex justify-end items-center'>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className='flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50'
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${metricsLoading || statsLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
        {/* Total Users Widget */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>Total Users</h3>
            <div className='p-2 bg-blue-50 rounded-lg'>
              <Users className='h-6 w-6 text-blue-600' />
            </div>
          </div>
          <div className='mt-auto'>
            {statsLoading ? (
              <div className='h-8 bg-gray-200 rounded animate-pulse w-1/2'></div>
            ) : (
              <div className='text-3xl font-bold text-gray-900'>
                {generalStats?.platform_stats?.users?.total?.toLocaleString() || 0}
              </div>
            )}
            <div className='text-sm text-gray-500 mt-1'>Registered accounts</div>
          </div>
        </div>

        {/* Total Dives Widget */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>Total Dives</h3>
            <div className='p-2 bg-teal-50 rounded-lg'>
              <Notebook className='h-6 w-6 text-teal-600' />
            </div>
          </div>
          <div className='mt-auto'>
            {statsLoading ? (
              <div className='h-8 bg-gray-200 rounded animate-pulse w-1/2'></div>
            ) : (
              <div className='text-3xl font-bold text-gray-900'>
                {generalStats?.platform_stats?.content?.dives?.toLocaleString() || 0}
              </div>
            )}
            <div className='text-sm text-gray-500 mt-1'>Logged by users</div>
          </div>
        </div>

        {/* Dive Sites Widget */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>Dive Sites</h3>
            <div className='p-2 bg-indigo-50 rounded-lg'>
              <MapPin className='h-6 w-6 text-indigo-600' />
            </div>
          </div>
          <div className='mt-auto'>
            {statsLoading ? (
              <div className='h-8 bg-gray-200 rounded animate-pulse w-1/2'></div>
            ) : (
              <div className='text-3xl font-bold text-gray-900'>
                {generalStats?.platform_stats?.content?.dive_sites?.toLocaleString() || 0}
              </div>
            )}
            <div className='text-sm text-gray-500 mt-1'>Published locations</div>
          </div>
        </div>

        {/* System Health Widget */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900'>Database Health</h3>
            <div className='p-2 bg-gray-50 rounded-lg'>
              <Database className='h-6 w-6 text-gray-600' />
            </div>
          </div>
          <div className='mt-auto'>
            {metricsLoading ? (
              <div className='h-8 bg-gray-200 rounded animate-pulse w-full'></div>
            ) : (
              <div className='flex items-center space-x-2'>
                {getStatusIcon(systemMetrics?.services?.database)}
                <span
                  className={`text-lg font-semibold ${
                    systemMetrics?.services?.database === 'healthy'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {systemMetrics?.services?.database
                    ? systemMetrics.services.database.charAt(0).toUpperCase() +
                      systemMetrics.services.database.slice(1)
                    : 'Unknown'}
                </span>
                <span className='text-sm text-gray-500 ml-2'>
                  ({systemMetrics?.database?.response_time_ms || 0}ms)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        {/* Quick Actions Panel */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
          <h3 className='text-xl font-bold text-gray-900 mb-6'>Content Moderation</h3>
          <div className='space-y-4'>
            <button
              onClick={() => navigate('/admin/dive-sites/edit-requests')}
              className='w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors'
            >
              <div className='flex items-center'>
                <FileText className='h-5 w-5 text-blue-600 mr-3' />
                <span className='font-medium text-gray-900'>Pending Site Edits</span>
              </div>
              <div className='flex items-center'>
                <ArrowRight className='h-4 w-4 text-blue-600' />
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/ownership-requests')}
              className='w-full flex items-center justify-between p-4 bg-yellow-50 border border-yellow-100 rounded-lg hover:bg-yellow-100 transition-colors'
            >
              <div className='flex items-center'>
                <Crown className='h-5 w-5 text-yellow-600 mr-3' />
                <span className='font-medium text-gray-900'>Ownership Requests</span>
              </div>
              <div className='flex items-center'>
                <ArrowRight className='h-4 w-4 text-yellow-600' />
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/chat-feedback')}
              className='w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors'
            >
              <div className='flex items-center'>
                <MessageSquare className='h-5 w-5 text-indigo-600 mr-3' />
                <span className='font-medium text-gray-900'>Chatbot Feedback</span>
              </div>
              <div className='flex items-center'>
                <ArrowRight className='h-4 w-4 text-indigo-600' />
              </div>
            </button>
          </div>
        </div>

        {/* System & Analytics Summary */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
          <h3 className='text-xl font-bold text-gray-900 mb-6'>System & Analytics</h3>
          <div className='grid grid-cols-2 gap-4'>
            <div
              onClick={() => navigate('/admin/system-metrics')}
              className='p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <Activity className='h-6 w-6 text-blue-600 mb-3' />
              <h4 className='font-medium text-gray-900'>System Metrics</h4>
              <p className='text-sm text-gray-500 mt-1'>View system health and usage</p>
            </div>
            <div
              onClick={() => navigate('/admin/general-statistics')}
              className='p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <BarChart3 className='h-6 w-6 text-green-600 mb-3' />
              <h4 className='font-medium text-gray-900'>Platform Stats</h4>
              <p className='text-sm text-gray-500 mt-1'>View detailed statistics</p>
            </div>
            <div
              onClick={() => navigate('/admin/growth-visualizations')}
              className='p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <TrendingUp className='h-6 w-6 text-indigo-600 mb-3' />
              <h4 className='font-medium text-gray-900'>Growth Stats</h4>
              <p className='text-sm text-gray-500 mt-1'>Track content growth</p>
            </div>
            <div
              onClick={() => navigate('/admin/recent-activity')}
              className='p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <Clock className='h-6 w-6 text-orange-600 mb-3' />
              <h4 className='font-medium text-gray-900'>Activity Log</h4>
              <p className='text-sm text-gray-500 mt-1'>Monitor recent actions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
