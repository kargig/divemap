import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  MedicineBoxOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import {
  Table,
  Tag,
  Space,
  Input,
  Select,
  Button,
  Tooltip,
  Card,
  Typography,
  Avatar,
  Row,
  Col,
  Tabs,
  theme,
} from 'antd';
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';

import api from '../api';
import PageTitle from '../components/PageTitle';
import SEO from '../components/SEO';
import { formatDate, formatTime } from '../utils/dateHelpers';

const { Title, Text } = Typography;
const { Option } = Select;

const parseDetails = detailsStr => {
  if (!detailsStr) return {};
  try {
    return JSON.parse(detailsStr);
  } catch {
    return { raw: detailsStr };
  }
};

const AdminAuditLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = theme.useToken();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'auth');

  // Pagination state
  const [pagination, setPagination] = useState({
    current: parseInt(searchParams.get('page')) || 1,
    pageSize: parseInt(searchParams.get('page_size')) || 25,
    total: 0,
  });

  // Filter state
  const [filters, setFilters] = useState({
    action: searchParams.get('action') || undefined,
    username: searchParams.get('username') || '',
    targetDiver: searchParams.get('target_diver') || '',
    ipAddress: searchParams.get('ip_address') || '',
    success: searchParams.get('success') || undefined,
    entityType: searchParams.get('entity_type') || undefined,
    entityId: searchParams.get('entity_id') || '',
    authMethod: searchParams.get('auth_method') || undefined,
    excludeActions: searchParams.getAll('exclude_action') || [],
  });

  // Fetch audit logs
  const {
    data: logs,
    isLoading,
    refetch,
  } = useQuery(
    ['admin-audit-logs', activeTab, pagination.current, pagination.pageSize, filters],
    async () => {
      const params = new URLSearchParams();
      params.append('page', pagination.current);
      params.append('page_size', pagination.pageSize);

      if (activeTab === 'entity') {
        if (filters.entityType) params.append('entity_type', filters.entityType);
        if (filters.entityId) params.append('entity_id', filters.entityId);
        if (filters.action) params.append('action', filters.action);
        if (filters.authMethod) params.append('auth_method', filters.authMethod);
        if (filters.username) params.append('username', filters.username);

        const response = await api.get(
          `/api/v1/admin/system/entity-audit-logs?${params.toString()}`
        );
        return {
          data: response.data,
          totalCount: parseInt(response.headers['x-total-count'] || '0'),
        };
      }

      params.append('category', activeTab);
      if (filters.action) params.append('action', filters.action);
      if (filters.username) params.append('username', filters.username);
      if (filters.targetDiver) params.append('target_diver', filters.targetDiver);
      if (filters.ipAddress) params.append('ip_address', filters.ipAddress);
      if (filters.success !== undefined && filters.success !== null)
        params.append('success', filters.success);
      if (activeTab === 'auth' && filters.excludeActions && filters.excludeActions.length > 0) {
        filters.excludeActions.forEach(action => params.append('exclude_action', action));
      }

      const response = await api.get(`/api/v1/admin/system/audit-logs?${params.toString()}`);

      return {
        data: response.data,
        totalCount: parseInt(response.headers['x-total-count'] || '0'),
      };
    },
    {
      keepPreviousData: true,
      onSuccess: data => {
        setPagination(prev => ({ ...prev, total: data.totalCount }));
      },
      onError: err => {
        toast.error('Failed to load audit logs');
        console.error(err);
      },
    }
  );

  // Update URL params when state changes
  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set('tab', activeTab);
    newParams.set('page', pagination.current.toString());
    newParams.set('page_size', pagination.pageSize.toString());

    if (filters.action) newParams.set('action', filters.action);
    if (filters.username) newParams.set('username', filters.username);
    if (filters.targetDiver) newParams.set('target_diver', filters.targetDiver);
    if (filters.ipAddress) newParams.set('ip_address', filters.ipAddress);
    if (filters.success !== undefined && filters.success !== null)
      newParams.set('success', filters.success);

    if (activeTab === 'entity') {
      if (filters.entityType) newParams.set('entity_type', filters.entityType);
      if (filters.entityId) newParams.set('entity_id', filters.entityId);
      if (filters.authMethod) newParams.set('auth_method', filters.authMethod);
    }

    if (activeTab === 'auth') {
      filters.excludeActions.forEach(action => newParams.append('exclude_action', action));
    }

    setSearchParams(newParams, { replace: true });
  }, [activeTab, pagination.current, pagination.pageSize, filters, setSearchParams]);

  const handleTabChange = key => {
    setActiveTab(key);
    setFilters({
      action: undefined,
      username: '',
      targetDiver: '',
      ipAddress: '',
      success: undefined,
      entityType: undefined,
      entityId: '',
      authMethod: undefined,
      excludeActions: [],
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = newPagination => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 })); // Reset to first page
  };

  const toggleExcludeAction = (action, checked) => {
    setFilters(prev => {
      const newExcludeActions = checked
        ? [...prev.excludeActions, action]
        : prev.excludeActions.filter(a => a !== action);
      return { ...prev, excludeActions: newExcludeActions };
    });
  };

  const clearFilters = () => {
    setFilters({
      action: undefined,
      username: '',
      targetDiver: '',
      ipAddress: '',
      success: undefined,
      entityType: undefined,
      entityId: '',
      authMethod: undefined,
      excludeActions: [],
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getActionTagColor = action => {
    if (action.includes('login')) return 'blue';
    if (action.includes('reset')) return 'orange';
    if (action.includes('verification')) return 'cyan';
    if (action.includes('token_created')) return 'purple';
    return 'default';
  };

  // Columns for Tab 1: Authentication & Access Logs
  const authColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: text => (
        <Space orientation='vertical' size={0}>
          <Text strong>{formatDate(text)}</Text>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            {formatTime(text)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          <Avatar style={{ backgroundColor: token.colorPrimary }}>
            {text ? text.charAt(0).toUpperCase() : <UserOutlined />}
          </Avatar>
          <Space orientation='vertical' size={0}>
            <Text strong>{text || 'Unknown'}</Text>
            <Text type='secondary' style={{ fontSize: '12px' }}>
              ID: {record.user_id}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: text => (
        <Tag color={getActionTagColor(text)} style={{ textTransform: 'uppercase' }}>
          {text.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'success',
      key: 'success',
      render: success => (
        <Tag color={success ? 'success' : 'error'}>{success ? 'Success' : 'Failure'}</Tag>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: text => <Text code>{text || '-'}</Text>,
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: text =>
        text ? (
          <Tooltip title={text}>
            <Text ellipsis>{text}</Text>
          </Tooltip>
        ) : (
          <Text type='secondary'>-</Text>
        ),
    },
  ];

  // Columns for Tab 2: Medical & Health Privacy Audits
  const medicalColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: text => (
        <Space orientation='vertical' size={0}>
          <Text strong>{formatDate(text)}</Text>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            {formatTime(text)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Accessor (Staff / User)',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => {
        const details = parseDetails(record.details);
        const role = details.accessor_role || (text === 'admin' ? 'admin' : 'staff');
        return (
          <Space>
            <Avatar style={{ backgroundColor: role === 'admin' ? '#722ed1' : '#1890ff' }}>
              {text ? text.charAt(0).toUpperCase() : <UserOutlined />}
            </Avatar>
            <Space orientation='vertical' size={0}>
              <Text strong>{text || 'Unknown'}</Text>
              <Space size={4}>
                <Tag
                  color={role === 'admin' ? 'purple' : 'blue'}
                  style={{ margin: 0, fontSize: '10px', padding: '0 4px' }}
                >
                  {role.toUpperCase()}
                </Tag>
                <Text type='secondary' style={{ fontSize: '11px' }}>
                  ID: {record.user_id}
                </Text>
              </Space>
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Target Diver',
      key: 'target_diver',
      render: (_, record) => {
        const details = parseDetails(record.details);
        const diverName = details.target_diver_name || 'Self / Own Account';
        const diverId = details.target_diver_user_id;
        return (
          <Space orientation='vertical' size={0}>
            <Text strong style={{ color: '#0958d9' }}>
              {diverName}
            </Text>
            {diverId && (
              <Text type='secondary' style={{ fontSize: '11px' }}>
                User ID: {diverId}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Medical Action',
      dataIndex: 'action',
      key: 'action',
      render: action => {
        const actionMap = {
          medical_review_view: { label: 'Pre-Dive Screening Review', color: 'cyan' },
          medical_emergency_dossier_view: {
            label: 'Emergency Incident Dossier Export',
            color: 'red',
          },
          medical_annual_medical_status_view: {
            label: 'Annual Status Inspection',
            color: 'geekblue',
          },
          medical_annual_medical_delete: { label: 'GDPR Erasure Delete', color: 'volcano' },
          medical_answers_update: { label: 'Answers Modification', color: 'orange' },
        };
        const info = actionMap[action] || {
          label: action.replace('medical_', '').replace(/_/g, ' '),
          color: 'magenta',
        };
        return (
          <Tag color={info.color} style={{ fontWeight: 600 }}>
            {info.label}
          </Tag>
        );
      },
    },
    {
      title: 'Center / Trip',
      key: 'context',
      render: (_, record) => {
        const details = parseDetails(record.details);
        return (
          <Space orientation='vertical' size={0}>
            {details.diving_center_id ? (
              <Tag color='default' style={{ margin: 0, fontSize: '11px' }}>
                Center #{details.diving_center_id}
              </Tag>
            ) : (
              <Text type='secondary'>-</Text>
            )}
            {details.trip_id && (
              <Text type='secondary' style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                Trip: {details.trip_id.slice(0, 8)}...
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'success',
      key: 'success',
      render: success => (
        <Tag color={success ? 'success' : 'error'} style={{ fontWeight: 700 }}>
          {success ? 'SUCCESS' : 'DENIED'}
        </Tag>
      ),
    },
    {
      title: 'Reason / Justification',
      key: 'reason',
      render: (_, record) => {
        const details = parseDetails(record.details);
        const reason = details.reason || (record.success ? 'Authorized review' : 'Access denied');
        return (
          <Tooltip title={reason} styles={{ root: { maxWidth: 450 } }}>
            <Text
              ellipsis
              style={{
                maxWidth: 240,
                color: record.success ? undefined : '#cf1322',
                fontWeight: record.success ? undefined : 600,
              }}
            >
              {reason}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: text => (
        <Text code style={{ fontSize: '11px' }}>
          {text || '-'}
        </Text>
      ),
    },
  ];

  // Columns for Tab 3: Entity Lifecycle & Forensics
  const entityColumns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'created_at',
      render: text => (
        <Space orientation='vertical' size={0}>
          <Text style={{ fontWeight: 600 }}>{formatDate(text)}</Text>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            {formatTime(text)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      render: (_, record) => {
        const entityType = record.entity_type || 'unknown';
        const colorMap = {
          dive_site: 'cyan',
          diving_center: 'blue',
          dive: 'geekblue',
          user_certification: 'purple',
          dive_route: 'teal',
          octo_booking: 'green',
          setting: 'volcano',
          available_tag: 'orange',
          site_comment: 'magenta',
          center_comment: 'pink',
          ownership_request: 'gold',
          diving_center_manager: 'lime',
        };
        const color = colorMap[entityType] || 'default';
        return (
          <Space>
            <Tag color={color} style={{ fontWeight: 600 }}>
              {entityType.replace(/_/g, ' ').toUpperCase()}
            </Tag>
            {record.entity_id !== undefined && record.entity_id !== null && (
              <Text code>#{record.entity_id}</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: action => {
        const actionStr = String(action || 'unknown');
        let color = 'default';
        if (actionStr === 'create' || actionStr === 'import') color = 'success';
        else if (actionStr === 'update' || actionStr === 'restore') color = 'processing';
        else if (actionStr === 'delete') color = 'error';
        else if (actionStr.includes('approve')) color = 'green';
        else if (actionStr.includes('reject')) color = 'red';
        return (
          <Tag color={color} style={{ fontWeight: 700 }}>
            {actionStr.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'User / Role',
      key: 'user',
      render: (_, record) => (
        <Space orientation='vertical' size={0}>
          <Space size={4}>
            <Avatar size='small' icon={<UserOutlined />} />
            <Text strong>
              {record.username || (record.user_id ? `User #${record.user_id}` : 'System / Guest')}
            </Text>
          </Space>
          {record.user_role && (
            <Tag
              color={
                record.user_role === 'admin'
                  ? 'purple'
                  : record.user_role === 'moderator'
                    ? 'blue'
                    : 'default'
              }
              style={{ fontSize: '10px', marginTop: '2px' }}
            >
              {record.user_role.toUpperCase()}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Auth Method',
      key: 'auth_method',
      render: (_, record) => {
        if (record.auth_method === 'pat') {
          return (
            <Tag color='success' style={{ fontWeight: 600 }}>
              🔑 PAT: {record.pat_name || `#${record.pat_id}`}
            </Tag>
          );
        }
        if (record.auth_method === 'jwt') {
          return (
            <Tag color='processing' style={{ fontWeight: 600 }}>
              🌐 Web Session
            </Tag>
          );
        }
        if (record.auth_method === 'guest') {
          return (
            <Tag color='warning' style={{ fontWeight: 600 }}>
              👤 Guest
            </Tag>
          );
        }
        return <Tag color='default'>{record.auth_method?.toUpperCase() || 'SYSTEM'}</Tag>;
      },
    },
    {
      title: 'Client Type',
      dataIndex: 'client_type',
      key: 'client_type',
      render: text => <Tag color='default'>{text || '-'}</Tag>,
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: text => (
        <Text code style={{ fontSize: '11px' }}>
          {text || '-'}
        </Text>
      ),
    },
  ];

  const renderEntityDiff = record => {
    if (!record.changes) return <Text type='secondary'>No changes recorded.</Text>;
    const { changed_fields, before, after, snapshot } = record.changes;

    if (changed_fields && changed_fields.length > 0) {
      return (
        <div className='p-3 bg-gray-50 dark:bg-slate-900/60 dark:bg-slate-900 rounded-md border border-gray-200 dark:border-slate-700'>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Modified Attributes ({changed_fields.length}):
          </Text>
          <div className='overflow-x-auto'>
            <table className='min-w-full text-xs text-left divide-y divide-gray-200 dark:divide-slate-700'>
              <thead>
                <tr>
                  <th className='px-2 py-1 font-semibold text-gray-700 dark:text-slate-300'>
                    Field
                  </th>
                  <th className='px-2 py-1 font-semibold text-red-600 dark:text-red-400'>
                    Previous Value
                  </th>
                  <th className='px-2 py-1 font-semibold text-green-600 dark:text-green-400'>
                    New Value
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-slate-800 font-mono'>
                {changed_fields.map(field => (
                  <tr key={field}>
                    <td className='px-2 py-1 font-semibold text-gray-900 dark:text-slate-200'>
                      {field}
                    </td>
                    <td className='px-2 py-1 text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-950/20'>
                      {JSON.stringify(before?.[field] ?? null)}
                    </td>
                    <td className='px-2 py-1 text-green-700 dark:text-green-300 bg-green-50/50 dark:bg-green-950/20'>
                      {JSON.stringify(after?.[field] ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (snapshot) {
      return (
        <div className='p-3 bg-gray-50 dark:bg-slate-900/60 dark:bg-slate-900 rounded-md border border-gray-200 dark:border-slate-700'>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Record Snapshot:
          </Text>
          <pre className='text-xs font-mono bg-white dark:bg-slate-800 p-2 rounded border border-gray-100 dark:border-slate-700 overflow-x-auto'>
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <pre className='text-xs font-mono p-2 bg-gray-50 dark:bg-slate-900/60 dark:bg-slate-900 rounded'>
        {JSON.stringify(record.changes, null, 2)}
      </pre>
    );
  };

  const displayedData = useMemo(() => {
    if (!logs?.data) return [];
    if (activeTab === 'entity') {
      return logs.data.filter(r => r && r.entity_type !== undefined);
    }
    if (activeTab === 'medical') {
      return logs.data.filter(r => r && r.action && String(r.action).startsWith('medical_'));
    }
    return logs.data.filter(r => r && r.entity_type === undefined);
  }, [logs?.data, activeTab]);

  return (
    <>
      <SEO title='Divemap - Admin - Audit Logs' description='Divemap Admin Dashboard' />
      <div className='w-full max-w-full py-4 sm:py-6 pr-4 sm:pr-6 pl-2 sm:pl-4'>
        <div className='flex flex-col md:flex-row md:items-center md:justify-between mb-6'>
          <div>
            <PageTitle className='mb-1'>
              <SafetyCertificateOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
              Platform Security & Privacy Audits
            </PageTitle>
            <p className='text-sm text-gray-500 dark:text-slate-400 dark:text-gray-400'>
              Monitor authentication events, staff credential activity, and entity lifecycle
              forensics.
            </p>
          </div>
          <Space className='mt-4 md:mt-0'>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              Refresh
            </Button>
            <Link to='/admin'>
              <Button>Back to Dashboard</Button>
            </Link>
          </Space>
        </div>

        {/* Tab Switcher: Auth vs Medical vs Entity */}
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          size='large'
          className='mb-4'
          items={[
            {
              key: 'auth',
              label: (
                <span className='font-semibold text-gray-700 dark:text-gray-200'>
                  <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                  Authentication & Access Logs
                </span>
              ),
            },
            {
              key: 'medical',
              label: (
                <span className='font-semibold text-pink-600 dark:text-pink-400'>
                  <MedicineBoxOutlined style={{ marginRight: 6, color: '#eb2f96' }} />
                  Medical & Health Privacy Audits
                </span>
              ),
            },
            {
              key: 'entity',
              label: (
                <span className='font-semibold text-blue-600 dark:text-sky-400'>
                  <DatabaseOutlined style={{ marginRight: 6 }} />
                  Entity Lifecycle & Forensics
                </span>
              ),
            },
          ]}
        />

        {/* Filters Card */}
        <Card
          className='mb-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700'
          variant='borderless'
          style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
        >
          <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
            <div className='flex items-center justify-between'>
              <Space>
                <FilterOutlined style={{ color: token.colorTextSecondary }} />
                <Text strong style={{ textTransform: 'uppercase', fontSize: '12px' }}>
                  {activeTab === 'medical'
                    ? 'Medical Audit Filters'
                    : activeTab === 'entity'
                      ? 'Entity Forensics Filters'
                      : 'Authentication Filters'}
                </Text>
              </Space>
              {(filters.action ||
                filters.username ||
                filters.targetDiver ||
                filters.ipAddress ||
                filters.entityType ||
                filters.entityId ||
                filters.authMethod ||
                filters.success !== undefined ||
                filters.excludeActions.length > 0) && (
                <Button type='link' size='small' onClick={clearFilters}>
                  Clear All
                </Button>
              )}
            </div>

            {activeTab === 'entity' ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8} lg={6}>
                  <Input
                    placeholder='Search Username'
                    prefix={<UserOutlined style={{ color: token.colorTextPlaceholder }} />}
                    value={filters.username}
                    onChange={e => handleFilterChange('username', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} md={8} lg={4}>
                  <Input
                    placeholder='Entity ID (e.g. 485)'
                    value={filters.entityId}
                    onChange={e => handleFilterChange('entityId', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} md={8} lg={5}>
                  <Select
                    placeholder='Entity Type'
                    style={{ width: '100%' }}
                    value={filters.entityType}
                    onChange={value => handleFilterChange('entityType', value)}
                    allowClear
                  >
                    <Option value='dive_site'>Dive Site</Option>
                    <Option value='diving_center'>Diving Center</Option>
                    <Option value='dive'>Dive Log</Option>
                    <Option value='user_certification'>Certification</Option>
                    <Option value='dive_route'>Dive Route</Option>
                    <Option value='octo_booking'>Booking</Option>
                    <Option value='site_comment'>Site Review</Option>
                    <Option value='center_comment'>Center Review</Option>
                    <Option value='available_tag'>Tag</Option>
                    <Option value='setting'>System Setting</Option>
                    <Option value='ownership_request'>Ownership Claim</Option>
                    <Option value='dive_site_edit_request'>Site Edit Request</Option>
                    <Option value='diving_center_manager'>Center Manager</Option>
                  </Select>
                </Col>
                <Col xs={24} md={8} lg={4}>
                  <Select
                    placeholder='Action'
                    style={{ width: '100%' }}
                    value={filters.action}
                    onChange={value => handleFilterChange('action', value)}
                    allowClear
                  >
                    <Option value='create'>Create</Option>
                    <Option value='update'>Update</Option>
                    <Option value='delete'>Delete</Option>
                    <Option value='soft_delete'>Soft Delete</Option>
                    <Option value='hard_delete'>Hard Delete</Option>
                    <Option value='restore'>Restore</Option>
                    <Option value='import'>Import</Option>
                    <Option value='approve'>Approve</Option>
                    <Option value='reject'>Reject</Option>
                    <Option value='confirm'>Confirm</Option>
                    <Option value='cancel'>Cancel</Option>
                    <Option value='extend'>Extend</Option>
                    <Option value='ownership_claimed'>Ownership Claimed</Option>
                    <Option value='ownership_approved'>Ownership Approved</Option>
                    <Option value='ownership_rejected'>Ownership Rejected</Option>
                    <Option value='ownership_assigned'>Ownership Assigned</Option>
                    <Option value='ownership_revoked'>Ownership Revoked</Option>
                  </Select>
                </Col>
                <Col xs={24} md={8} lg={5}>
                  <Select
                    placeholder='Auth Method'
                    style={{ width: '100%' }}
                    value={filters.authMethod}
                    onChange={value => handleFilterChange('authMethod', value)}
                    allowClear
                  >
                    <Option value='jwt'>Web Session (JWT)</Option>
                    <Option value='pat'>Personal Access Token (PAT)</Option>
                    <Option value='system'>System / Automated</Option>
                  </Select>
                </Col>
              </Row>
            ) : (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8} lg={activeTab === 'medical' ? 6 : 6}>
                  <Input
                    placeholder={
                      activeTab === 'medical' ? 'Search Accessor (Staff)' : 'Search Username'
                    }
                    prefix={<UserOutlined style={{ color: token.colorTextPlaceholder }} />}
                    value={filters.username}
                    onChange={e => handleFilterChange('username', e.target.value)}
                    allowClear
                  />
                </Col>

                {activeTab === 'medical' && (
                  <Col xs={24} md={8} lg={6}>
                    <Input
                      placeholder='Search Target Diver Name'
                      prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                      value={filters.targetDiver}
                      onChange={e => handleFilterChange('targetDiver', e.target.value)}
                      allowClear
                    />
                  </Col>
                )}

                <Col xs={24} md={8} lg={6}>
                  <Input
                    placeholder='Search IP Address'
                    prefix={<SearchOutlined style={{ color: token.colorTextPlaceholder }} />}
                    value={filters.ipAddress}
                    onChange={e => handleFilterChange('ipAddress', e.target.value)}
                    allowClear
                  />
                </Col>

                <Col xs={24} md={8} lg={6}>
                  {activeTab === 'auth' ? (
                    <Select
                      placeholder='Event Type'
                      style={{ width: '100%' }}
                      value={filters.action}
                      onChange={value => handleFilterChange('action', value)}
                      allowClear
                    >
                      <Option value='login'>Login</Option>
                      <Option value='password_reset_request'>Reset Request</Option>
                      <Option value='password_reset_success'>Reset Success</Option>
                      <Option value='token_created'>Token Created</Option>
                      <Option value='token_refresh'>Token Refresh</Option>
                      <Option value='token_rotated'>Token Rotated</Option>
                    </Select>
                  ) : (
                    <Select
                      placeholder='Medical Event Type'
                      style={{ width: '100%' }}
                      value={filters.action}
                      onChange={value => handleFilterChange('action', value)}
                      allowClear
                    >
                      <Option value='medical_annual_medical_status_view'>
                        Annual Medical Status View
                      </Option>
                      <Option value='medical_review_view'>Manager Medical Screening Review</Option>
                      <Option value='medical_emergency_dossier_view'>
                        Emergency Incident Dossier Export
                      </Option>
                      <Option value='medical_answers_update'>Medical Answers Modification</Option>
                      <Option value='medical_annual_medical_delete'>
                        Annual Medical GDPR Deletion
                      </Option>
                    </Select>
                  )}
                </Col>

                <Col xs={24} md={8} lg={activeTab === 'medical' ? 6 : 6}>
                  <Select
                    placeholder='Access Status'
                    style={{ width: '100%' }}
                    value={filters.success}
                    onChange={value => handleFilterChange('success', value)}
                    allowClear
                  >
                    <Option value='true'>Success (Granted)</Option>
                    <Option value='false'>Failure (Denied / Blocked)</Option>
                  </Select>
                </Col>
              </Row>
            )}

            {activeTab === 'auth' && (
              <div>
                <Text
                  type='secondary'
                  style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}
                >
                  HIDE NOISY EVENTS
                </Text>
                <Space wrap>
                  {['token_created', 'token_refresh', 'token_rotated'].map(action => (
                    <Tag.CheckableTag
                      key={action}
                      checked={filters.excludeActions.includes(action)}
                      onChange={checked => toggleExcludeAction(action, checked)}
                      style={{
                        border: `1px solid ${
                          filters.excludeActions.includes(action) ? token.colorPrimary : '#d9d9d9'
                        }`,
                        padding: '4px 12px',
                        borderRadius: '12px',
                      }}
                    >
                      {action.replace(/_/g, ' ')}
                    </Tag.CheckableTag>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        </Card>

        {/* Data Table */}
        <Table
          columns={
            activeTab === 'medical'
              ? medicalColumns
              : activeTab === 'entity'
                ? entityColumns
                : authColumns
          }
          expandable={
            activeTab === 'entity'
              ? {
                  expandedRowRender: record => renderEntityDiff(record),
                  rowExpandable: record => Boolean(record.changes),
                }
              : undefined
          }
          dataSource={displayedData}
          rowKey='id'
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} entries`,
          }}
          loading={isLoading}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
          style={{
            borderRadius: '8px',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
          }}
        />
      </div>
    </>
  );
};

export default AdminAuditLogs;
