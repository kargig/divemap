import {
  Clock,
  User,
  MessageSquare,
  Filter,
  RefreshCw,
  Activity,
  Users,
  FileText,
  Edit,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { getRecentActivity } from '../services/admin';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';

const AdminRecentActivity = () => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [timeFilter, setTimeFilter] = useState(24);
  const [activityFilter, setActivityFilter] = useState('all');

  // Set page title
  usePageTitle('Divemap - Admin - Recent Activity');

  // Fetch recent activity data
  const {
    data: activities,
    isLoading,
    error,
  } = useQuery(
    ['recent-activity', refreshKey, timeFilter],
    () => getRecentActivity(timeFilter, 100),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
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

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    toast.success('Activity data refreshed');
  };

  const getActivityIcon = type => {
    switch (type) {
      case 'user_registration':
        return <User className='h-4 w-4' />;
      case 'content_creation':
        return <FileText className='h-4 w-4' />;
      case 'content_update':
        return <Edit className='h-4 w-4' />;
      case 'engagement':
        return <MessageSquare className='h-4 w-4' />;
      default:
        return <Activity className='h-4 w-4' />;
    }
  };

  const getActivityColor = type => {
    switch (type) {
      case 'user_registration':
        return 'text-blue-600 bg-blue-100';
      case 'content_creation':
        return 'text-green-600 bg-green-100';
      case 'content_update':
        return 'text-yellow-600 bg-yellow-100';
      case 'engagement':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'success':
        return <CheckCircle className='h-4 w-4 text-green-600' />;
      case 'warning':
        return <AlertTriangle className='h-4 w-4 text-yellow-600' />;
      case 'error':
        return <XCircle className='h-4 w-4 text-red-600' />;
      default:
        return <Activity className='h-4 w-4 text-gray-600' />;
    }
  };

  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const filteredActivities =
    activities?.filter(activity => {
      if (activityFilter === 'all') return true;
      return activity.type === activityFilter;
    }) || [];

  const activityStats = {
    total: activities?.length || 0,
    user_registrations: activities?.filter(a => a.type === 'user_registration').length || 0,
    content_creation: activities?.filter(a => a.type === 'content_creation').length || 0,
    content_update: activities?.filter(a => a.type === 'content_update').length || 0,
    engagement: activities?.filter(a => a.type === 'engagement').length || 0,
  };

  if (isLoading) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='flex items-center justify-center py-12'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <span className='ml-2 text-gray-600'>Loading recent activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='text-center py-12'>
          <p className='text-red-600'>Error loading recent activity: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between mb-8'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>Recent Activity</h1>
          <p className='text-gray-600'>Monitor user actions and system changes in real-time</p>
        </div>
        <button
          onClick={handleRefresh}
          className='mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
        >
          <RefreshCw className='h-4 w-4 mr-2' />
          Refresh
        </button>
      </div>

      {/* Activity Statistics */}
      <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8'>
        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Total Activities</p>
              <p className='text-2xl font-bold text-gray-900'>{activityStats.total}</p>
            </div>
            <Activity className='h-8 w-8 text-blue-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>New Users</p>
              <p className='text-2xl font-bold text-gray-900'>{activityStats.user_registrations}</p>
            </div>
            <Users className='h-8 w-8 text-green-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Content Created</p>
              <p className='text-2xl font-bold text-gray-900'>{activityStats.content_creation}</p>
            </div>
            <FileText className='h-8 w-8 text-purple-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Content Updated</p>
              <p className='text-2xl font-bold text-gray-900'>{activityStats.content_update}</p>
            </div>
            <Edit className='h-8 w-8 text-yellow-600' />
          </div>
        </div>

        <div className='bg-white p-6 rounded-lg border shadow-sm'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-gray-600'>Engagement</p>
              <p className='text-2xl font-bold text-gray-900'>{activityStats.engagement}</p>
            </div>
            <MessageSquare className='h-8 w-8 text-orange-600' />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className='bg-white p-6 rounded-lg border shadow-sm mb-8'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <Filter className='h-5 w-5 mr-2' />
          Filters
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Time Range</label>
            <select
              value={timeFilter}
              onChange={e => setTimeFilter(Number(e.target.value))}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value={1}>Last Hour</option>
              <option value={6}>Last 6 Hours</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last Week</option>
              <option value={720}>Last Month</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>Activity Type</label>
            <select
              value={activityFilter}
              onChange={e => setActivityFilter(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value='all'>All Activities</option>
              <option value='user_registration'>User Registrations</option>
              <option value='content_creation'>Content Creation</option>
              <option value='content_update'>Content Updates</option>
              <option value='engagement'>Engagement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className='bg-white rounded-lg border shadow-sm'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-lg font-semibold text-gray-900 flex items-center'>
            <Clock className='h-5 w-5 mr-2' />
            Recent Activities ({filteredActivities.length})
          </h2>
        </div>
        <div className='divide-y divide-gray-200'>
          {filteredActivities.length === 0 ? (
            <div className='px-6 py-12 text-center'>
              <Activity className='h-12 w-12 text-gray-400 mx-auto mb-4' />
              <p className='text-gray-500'>No activities found for the selected filters</p>
            </div>
          ) : (
            filteredActivities.map((activity, index) => (
              <div key={index} className='px-6 py-4 hover:bg-gray-50 transition-colors'>
                <div className='flex items-start space-x-4'>
                  <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-sm font-medium text-gray-900'>{activity.action}</p>
                        <p className='text-sm text-gray-600'>{activity.details}</p>
                        {activity.username && (
                          <p className='text-xs text-gray-500'>by {activity.username}</p>
                        )}
                      </div>
                      <div className='flex items-center space-x-2'>
                        {getStatusIcon(activity.status)}
                        <span className='text-xs text-gray-500'>
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Last Updated */}
      <div className='mt-6 text-center'>
        <p className='text-sm text-gray-500'>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default AdminRecentActivity;
