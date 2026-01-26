import {
  Activity,
  Database,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';

import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { getSystemMetrics, getTurnstileStats, getStorageHealth } from '../services/admin';

const AdminSystemMetrics = () => {
  // Set page title
  usePageTitle('Divemap - Admin - System Metrics');
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch system metrics data
  const {
    data: systemMetrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery(['system-metrics', refreshKey], getSystemMetrics, {
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user?.is_admin,
  });

  const {
    data: turnstileStats,
    isLoading: turnstileLoading,
    error: turnstileError,
  } = useQuery(['turnstile-stats', refreshKey], () => getTurnstileStats(24), {
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user?.is_admin,
  });

  const {
    data: storageHealth,
    isLoading: storageLoading,
    error: storageError,
  } = useQuery(['storage-health', refreshKey], getStorageHealth, {
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
    toast.success('System metrics refreshed');
  };

  const getStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return <CheckCircle className='h-4 w-4' />;
      case 'warning':
        return <AlertTriangle className='h-4 w-4' />;
      case 'critical':
        return <XCircle className='h-4 w-4' />;
      default:
        return <Activity className='h-4 w-4' />;
    }
  };

  const formatPercentage = num => {
    if (num === null || num === undefined) return '0%';
    return `${num.toFixed(1)}%`;
  };

  if (metricsLoading || turnstileLoading || storageLoading) {
    return (
      <div className='max-w-7xl mx-auto p-6'>
        <div className='flex items-center justify-center h-64'>
          <RefreshCw className='h-8 w-8 animate-spin text-blue-600' />
          <span className='ml-2 text-gray-600'>Loading system metrics...</span>
        </div>
      </div>
    );
  }

  if (metricsError || turnstileError || storageError) {
    return (
      <div className='max-w-7xl mx-auto p-6'>
        <div className='text-center py-12'>
          <XCircle className='h-12 w-12 text-red-600 mx-auto mb-4' />
          <p className='text-red-600'>Error loading system metrics. Please try again.</p>
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
            <h1 className='text-3xl font-bold text-gray-900'>System Metrics</h1>
            <p className='text-gray-600 mt-2'>System health, storage, usage, and alerts</p>
            {systemMetrics?.timestamp && (
              <p className='text-sm text-gray-500 mt-1'>
                Last updated: {new Date(systemMetrics.timestamp).toLocaleString()}
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

      {/* System Health Status */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>System Health</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {/* Overall Status */}
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Overall Status</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {systemMetrics?.status || 'Unknown'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${getStatusColor(systemMetrics?.status)}`}>
                {getStatusIcon(systemMetrics?.status)}
              </div>
            </div>
          </div>

          {/* Database */}
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Database</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {systemMetrics?.database?.healthy ? 'Healthy' : 'Unhealthy'}
                </p>
                <p className='text-sm text-gray-500'>
                  {systemMetrics?.database?.response_time_ms}ms
                </p>
              </div>
              <Database className='h-8 w-8 text-blue-600' />
            </div>
          </div>

          {/* CPU Usage */}
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>CPU Usage</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatPercentage(systemMetrics?.resources?.cpu?.usage_percent)}
                </p>
                <p className='text-sm text-gray-500'>
                  {systemMetrics?.resources?.cpu?.cores} cores
                </p>
              </div>
              <Cpu className='h-8 w-8 text-green-600' />
            </div>
          </div>

          {/* Memory Usage */}
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Memory Usage</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {formatPercentage(systemMetrics?.resources?.memory?.usage_percent)}
                </p>
                <p className='text-sm text-gray-500'>
                  {systemMetrics?.resources?.memory?.available_gb}GB available
                </p>
              </div>
              <HardDrive className='h-8 w-8 text-purple-600' />
            </div>
          </div>
        </div>
      </div>

      {/* Storage Health Status */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Storage Health</h2>
        {storageLoading ? (
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-center'>
              <div className='flex items-center space-x-3'>
                <RefreshCw className='h-6 w-6 text-blue-600 animate-spin' />
                <span className='text-gray-600'>Loading storage health status...</span>
              </div>
            </div>
          </div>
        ) : storageError ? (
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-center'>
              <div className='flex items-center space-x-3'>
                <XCircle className='h-6 w-6 text-red-600' />
                <span className='text-red-600'>Failed to load storage health status</span>
              </div>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {/* R2 Configuration Status */}
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>R2 Configuration</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {storageHealth?.r2_available ? 'Configured' : 'Not Configured'}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {storageHealth?.r2_available
                      ? 'Environment variables present'
                      : 'Missing credentials'}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${storageHealth?.r2_available ? 'bg-green-100' : 'bg-red-100'}`}
                >
                  {storageHealth?.r2_available ? (
                    <CheckCircle className='h-6 w-6 text-green-600' />
                  ) : (
                    <XCircle className='h-6 w-6 text-red-600' />
                  )}
                </div>
              </div>
            </div>

            {/* R2 Connectivity Status */}
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>R2 Connectivity</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {storageHealth?.r2_connectivity ? 'Connected' : 'Disconnected'}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {storageHealth?.r2_connectivity ? 'Bucket accessible' : 'Cannot reach R2'}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${storageHealth?.r2_connectivity ? 'bg-green-100' : 'bg-red-100'}`}
                >
                  {storageHealth?.r2_connectivity ? (
                    <CheckCircle className='h-6 w-6 text-green-600' />
                  ) : (
                    <XCircle className='h-6 w-6 text-red-600' />
                  )}
                </div>
              </div>
            </div>

            {/* Local Storage Status */}
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Local Storage</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {storageHealth?.local_storage_available ? 'Available' : 'Unavailable'}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {storageHealth?.local_storage_writable ? 'Writable' : 'Read-only'}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${storageHealth?.local_storage_available ? 'bg-green-100' : 'bg-red-100'}`}
                >
                  {storageHealth?.local_storage_available ? (
                    <CheckCircle className='h-6 w-6 text-green-600' />
                  ) : (
                    <XCircle className='h-6 w-6 text-red-600' />
                  )}
                </div>
              </div>
            </div>

            {/* Active Storage Mode */}
            <div className='bg-white p-6 rounded-lg border shadow-sm'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-gray-600'>Active Storage</p>
                  <p className='text-2xl font-bold text-gray-900'>
                    {storageHealth?.r2_connectivity ? 'R2 Cloud' : 'Local Only'}
                  </p>
                  <p className='text-sm text-gray-500'>
                    {storageHealth?.r2_connectivity
                      ? 'Using cloud storage'
                      : 'Using local fallback'}
                  </p>
                </div>
                <div
                  className={`p-2 rounded-full ${storageHealth?.r2_connectivity ? 'bg-green-100' : 'bg-yellow-100'}`}
                >
                  {storageHealth?.r2_connectivity ? (
                    <Globe className='h-6 w-6 text-green-600' />
                  ) : (
                    <HardDrive className='h-6 w-6 text-yellow-600' />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Turnstile Statistics */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>Turnstile Bot Protection</h2>

        {/* Turnstile Overview Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Success Rate</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {turnstileStats?.success_rate
                    ? formatPercentage(turnstileStats.success_rate * 100)
                    : 'N/A'}
                </p>
                <p className='text-sm text-gray-500'>Verification success</p>
              </div>
              <CheckCircle className='h-8 w-8 text-green-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Response Time</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {turnstileStats?.average_response_time_ms
                    ? `${turnstileStats.average_response_time_ms.toFixed(1)}ms`
                    : 'N/A'}
                </p>
                <p className='text-sm text-gray-500'>Average verification</p>
              </div>
              <Activity className='h-8 w-8 text-blue-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Events</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {turnstileStats?.total_events?.toLocaleString() || '0'}
                </p>
                <p className='text-sm text-gray-500'>Verification attempts</p>
              </div>
              <Database className='h-8 w-8 text-purple-600' />
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Status</p>
                <p className='text-2xl font-bold text-gray-900'>
                  {turnstileStats?.monitoring_active ? 'Active' : 'Inactive'}
                </p>
                <p className='text-sm text-gray-500'>Monitoring system</p>
              </div>
              <Database className='h-8 w-8 text-indigo-600' />
            </div>
          </div>
        </div>

        {/* Error Breakdown */}
        {turnstileStats?.error_breakdown &&
          Object.keys(turnstileStats.error_breakdown).length > 0 && (
            <div className='bg-white p-6 rounded-lg border shadow-sm mb-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
                <AlertTriangle className='h-5 w-5 mr-2' />
                Error Breakdown (Last 24h)
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {Object.entries(turnstileStats.error_breakdown).map(([errorCode, count]) => (
                  <div
                    key={errorCode}
                    className='flex items-center justify-between p-3 bg-red-50 rounded-lg'
                  >
                    <span className='font-medium text-red-700'>{errorCode}</span>
                    <span className='text-sm text-red-500'>{count} occurrences</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Top IP Addresses */}
        {turnstileStats?.top_ips && turnstileStats.top_ips.length > 0 && (
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
              <Globe className='h-5 w-5 mr-2' />
              Top IP Addresses (Last 24h)
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {turnstileStats.top_ips.map(([ip, count], index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'
                >
                  <span className='font-medium text-gray-700 font-mono text-sm'>{ip}</span>
                  <span className='text-sm text-gray-500'>{count} requests</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Data Message */}
        {(!turnstileStats || turnstileStats.total_events === 0) && (
          <div className='bg-gray-50 border border-gray-200 rounded-lg p-8 text-center'>
            <Activity className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <h3 className='text-lg font-medium text-gray-900 mb-2'>No Turnstile Data Available</h3>
            <p className='text-gray-500'>
              Turnstile verification events will appear here once users start using the
              authentication system.
            </p>
          </div>
        )}
      </div>

      {/* System Usage */}
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-gray-900 mb-4'>System Usage</h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='text-center'>
              <p className='text-sm font-medium text-gray-600 mb-2'>Disk Usage</p>
              <p className='text-3xl font-bold text-gray-900'>
                {formatPercentage(systemMetrics?.resources?.disk?.usage_percent)}
              </p>
              <p className='text-sm text-gray-500 mt-2'>
                {systemMetrics?.resources?.disk?.free_gb}GB free of{' '}
                {systemMetrics?.resources?.disk?.total_gb}GB
              </p>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='text-center'>
              <p className='text-sm font-medium text-gray-600 mb-2'>Services Status</p>
              <div className='space-y-2 mt-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-600'>Database</span>
                  <span
                    className={`text-sm font-medium ${
                      systemMetrics?.services?.database === 'healthy'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {systemMetrics?.services?.database || 'Unknown'}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-600'>API</span>
                  <span
                    className={`text-sm font-medium ${
                      systemMetrics?.services?.api === 'healthy' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {systemMetrics?.services?.api || 'Unknown'}
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-gray-600'>Frontend</span>
                  <span
                    className={`text-sm font-medium ${
                      systemMetrics?.services?.frontend === 'healthy'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {systemMetrics?.services?.frontend || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-lg border shadow-sm'>
            <div className='text-center'>
              <p className='text-sm font-medium text-gray-600 mb-2'>System Alerts</p>
              <div className='mt-4'>
                <p className='text-3xl font-bold text-gray-900'>0</p>
                <p className='text-sm text-gray-500 mt-2'>No active alerts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemMetrics;
