import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Typography,
  Alert,
  Popconfirm,
  Space,
  Card,
  Tooltip,
} from 'antd';
import {
  Key,
  Plus,
  Trash2,
  Shield,
  Clock,
  ExternalLink,
  ChevronLeft,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import usePageTitle from '../hooks/usePageTitle';

const { Text, Title, Paragraph } = Typography;

const PersonalAccessTokens = () => {
  usePageTitle('Divemap - Personal Access Tokens');
  const queryClient = useQueryClient();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [form] = Form.useForm();

  // Fetch tokens
  const { data: tokens, isLoading } = useQuery(['personal-access-tokens'], async () => {
    const response = await api.get('/api/v1/users/me/tokens');
    return response.data;
  });

  // Create token mutation
  const createTokenMutation = useMutation(
    async values => {
      const response = await api.post('/api/v1/users/me/tokens', values);
      return response.data;
    },
    {
      onSuccess: data => {
        setNewToken(data);
        setIsCreateModalVisible(false);
        setIsSuccessModalVisible(true);
        queryClient.invalidateQueries(['personal-access-tokens']);
        form.resetFields();
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to create token');
      },
    }
  );

  // Delete token mutation
  const deleteTokenMutation = useMutation(
    async tokenId => {
      await api.delete(`/api/v1/users/me/tokens/${tokenId}`);
    },
    {
      onSuccess: () => {
        toast.success('Token revoked successfully');
        queryClient.invalidateQueries(['personal-access-tokens']);
      },
      onError: error => {
        toast.error(error.response?.data?.detail || 'Failed to revoke token');
      },
    }
  );

  const handleCreateToken = values => {
    createTokenMutation.mutate(values);
  };

  const currentOrigin = window.location.origin;

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: name => <Text strong>{name}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const isExpired = record.expires_at && new Date(record.expires_at) < new Date();
        if (!record.is_active) return <Tag color='default'>Inactive</Tag>;
        if (isExpired) return <Tag color='error'>Expired</Tag>;
        return <Tag color='success'>Active</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: date => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Expires At',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: date => (date ? new Date(date).toLocaleDateString() : 'Never'),
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: date => (date ? new Date(date).toLocaleString() : 'Never'),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title='Revoke token?'
          description='Any applications using this token will no longer be able to access the API.'
          onConfirm={() => deleteTokenMutation.mutate(record.id)}
          okText='Yes, Revoke'
          cancelText='No'
          okButtonProps={{ danger: true, loading: deleteTokenMutation.isLoading }}
        >
          <Button type='text' danger icon={<Trash2 size={16} />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8'>
      <div className='mb-6'>
        <Link
          to='/profile'
          className='inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors'
        >
          <ChevronLeft className='h-4 w-4 mr-1' />
          Back to Profile
        </Link>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <Title level={2} className='!mb-1 flex items-center'>
              <Key className='mr-3 text-blue-600' />
              Personal Access Tokens
            </Title>
            <Paragraph className='text-gray-500'>
              Use these tokens to access the Divemap API programmatically.
            </Paragraph>
          </div>
          <Button
            type='primary'
            icon={<Plus size={18} />}
            onClick={() => setIsCreateModalVisible(true)}
            size='large'
            className='bg-blue-600'
          >
            Generate New Token
          </Button>
        </div>
      </div>

      <Alert
        message='Security Reminder'
        description='Personal Access Tokens (PATs) grant full access to your account. Never share them or commit them to public repositories.'
        type='warning'
        showIcon
        icon={<Shield className='h-5 w-5' />}
        className='mb-8'
      />

      <Card className='shadow-sm rounded-lg overflow-hidden'>
        <Table
          columns={columns}
          dataSource={tokens}
          rowKey='id'
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: 'No tokens generated yet.' }}
        />
      </Card>

      <div className='mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200'>
        <Title level={4} className='flex items-center'>
          <Info className='mr-2 text-gray-600' size={20} />
          How to use PATs
        </Title>
        <Paragraph>
          Pass your token in the <code>Authorization</code> header as a Bearer token:
        </Paragraph>
        <pre className='bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto mb-4'>
          curl -H &quot;Authorization: Bearer dm_pat_your_token_here&quot; {currentOrigin}
          /api/v1/auth/me
        </pre>
        <Paragraph className='text-gray-500 text-sm'>
          Note: These tokens are subject to rate limiting (100 requests per minute).
        </Paragraph>
      </div>

      {/* Create Token Modal */}
      <Modal
        title='Generate New Personal Access Token'
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout='vertical' onFinish={handleCreateToken} className='mt-4'>
          <Form.Item
            name='name'
            label='Token Name'
            rules={[{ required: true, message: 'Please enter a name for this token' }]}
            help='Give your token a descriptive name like "Python CLI" or "Home Assistant"'
          >
            <Input placeholder='e.g. My Automation Script' size='large' />
          </Form.Item>

          <Form.Item
            name='expires_in_days'
            label='Expiration'
            initialValue={30}
            help='Tokens with shorter lifespans are more secure.'
          >
            <Select size='large'>
              <Select.Option value={7}>7 Days</Select.Option>
              <Select.Option value={30}>30 Days</Select.Option>
              <Select.Option value={90}>90 Days</Select.Option>
              <Select.Option value={365}>1 Year</Select.Option>
              <Select.Option value={null}>
                <span className='text-red-500 font-medium'>No Expiration (Not recommended)</span>
              </Select.Option>
            </Select>
          </Form.Item>

          <div className='flex justify-end gap-3 mt-8'>
            <Button onClick={() => setIsCreateModalVisible(false)}>Cancel</Button>
            <Button
              type='primary'
              htmlType='submit'
              loading={createTokenMutation.isLoading}
              className='bg-blue-600'
            >
              Generate Token
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Success Modal (Token Reveal) */}
      <Modal
        title={
          <div className='flex items-center text-green-600'>
            <Shield className='mr-2' size={20} />
            Token Generated Successfully
          </div>
        }
        open={isSuccessModalVisible}
        onCancel={() => setIsSuccessModalVisible(false)}
        footer={[
          <Button
            key='close'
            type='primary'
            onClick={() => setIsSuccessModalVisible(false)}
            className='bg-blue-600'
          >
            I have saved my token
          </Button>,
        ]}
        maskClosable={false}
        closable={false}
      >
        <div className='py-4'>
          <Alert
            type='error'
            message='Make sure to copy your personal access token now.'
            description='You will not be able to see it again!'
            showIcon
            className='mb-6'
          />

          <div className='bg-gray-100 p-4 rounded-lg border border-gray-200 mb-4'>
            <Text copyable={{ text: newToken?.token }} className='text-base font-mono break-all'>
              {newToken?.token}
            </Text>
          </div>

          <Paragraph className='text-gray-500 text-sm italic'>
            Token name: <strong>{newToken?.name}</strong>
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};

export default PersonalAccessTokens;
