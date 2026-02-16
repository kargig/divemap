import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
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
  theme,
} from 'antd';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';

import api from '../api';
import usePageTitle from '../hooks/usePageTitle';

const { Title, Text } = Typography;
const { Option } = Select;

const AdminAuditLogs = () => {
  usePageTitle('Divemap - Admin - Audit Logs');
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = theme.useToken();

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
    ipAddress: searchParams.get('ip_address') || '',
    success: searchParams.get('success') || undefined,
    excludeActions: searchParams.getAll('exclude_action') || [],
  });

  // Fetch audit logs
  const {
    data: logs,
    isLoading,
    refetch,
  } = useQuery(
    ['admin-audit-logs', pagination.current, pagination.pageSize, filters],
    async () => {
      const params = new URLSearchParams();
      params.append('page', pagination.current);
      params.append('page_size', pagination.pageSize);
      if (filters.action) params.append('action', filters.action);
      if (filters.username) params.append('username', filters.username);
      if (filters.ipAddress) params.append('ip_address', filters.ipAddress);
      if (filters.success !== undefined && filters.success !== null)
        params.append('success', filters.success);
      if (filters.excludeActions && filters.excludeActions.length > 0) {
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
    newParams.set('page', pagination.current.toString());
    newParams.set('page_size', pagination.pageSize.toString());

    if (filters.action) newParams.set('action', filters.action);
    if (filters.username) newParams.set('username', filters.username);
    if (filters.ipAddress) newParams.set('ip_address', filters.ipAddress);
    if (filters.success !== undefined && filters.success !== null)
      newParams.set('success', filters.success);

    filters.excludeActions.forEach(action => newParams.append('exclude_action', action));

    setSearchParams(newParams, { replace: true });
  }, [pagination.current, pagination.pageSize, filters, setSearchParams]);

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
      ipAddress: '',
      success: undefined,
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

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: text => (
        <Space direction='vertical' size={0}>
          <Text strong>{new Date(text).toLocaleDateString()}</Text>
          <Text type='secondary' style={{ fontSize: '12px' }}>
            {new Date(text).toLocaleTimeString()}
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
          <Space direction='vertical' size={0}>
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
        <Tag color={getActionTagColor(text)} style={{ textTransform: 'capitalize' }}>
          {text.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'success',
      key: 'success',
      width: 100,
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
            <Text style={{ maxWidth: 200 }} ellipsis>
              {text}
            </Text>
          </Tooltip>
        ) : (
          <Text type='secondary'>-</Text>
        ),
    },
  ];

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between mb-8'>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
            Auth Audit Logs
          </Title>
          <Text type='secondary'>
            Monitor security-sensitive authentication and authorization events.
          </Text>
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

      <Card className='mb-6' bordered={false} style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
        <Space direction='vertical' size='middle' style={{ width: '100%' }}>
          <div className='flex items-center justify-between'>
            <Space>
              <FilterOutlined style={{ color: token.colorTextSecondary }} />
              <Text strong style={{ textTransform: 'uppercase', fontSize: '12px' }}>
                Filters
              </Text>
            </Space>
            {(filters.action ||
              filters.username ||
              filters.ipAddress ||
              filters.success !== undefined ||
              filters.excludeActions.length > 0) && (
              <Button type='link' size='small' onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </div>

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
            </Col>
            <Col xs={24} md={8} lg={6}>
              <Select
                placeholder='Status'
                style={{ width: '100%' }}
                value={filters.success}
                onChange={value => handleFilterChange('success', value)}
                allowClear
              >
                <Option value='true'>Success</Option>
                <Option value='false'>Failure</Option>
              </Select>
            </Col>
          </Row>

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
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={logs?.data}
        rowKey='id'
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        }}
        loading={isLoading}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        }}
      />
    </div>
  );
};

export default AdminAuditLogs;
