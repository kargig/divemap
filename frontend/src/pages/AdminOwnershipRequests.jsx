import { Tabs, Table, Tag, Button, Space, Tooltip } from 'antd';
import { Check, Clock, X, User, ShieldCheck, ShieldAlert, FileText } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';

import Modal from '../components/ui/Modal';
import {
  approveDivingCenterOwnership,
  getOwnershipRequestHistory,
  getOwnershipRequests,
  revokeDivingCenterOwnership,
} from '../services/divingCenters';

// Extracted components to reduce complexity
const LoadingSpinner = () => (
  <div className='flex items-center justify-center min-h-screen'>
    <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600'></div>
  </div>
);

const ErrorDisplay = ({ error }) => (
  <div className='flex items-center justify-center min-h-screen'>
    <div className='text-center'>
      <h2 className='text-2xl font-bold text-red-600 mb-4'>Error</h2>
      <p className='text-gray-600'>
        Error loading ownership requests: {error?.message || 'Unknown error'}
      </p>
    </div>
  </div>
);

ErrorDisplay.propTypes = {
  error: PropTypes.shape({
    message: PropTypes.string,
  }),
};

const TimelineEvent = ({ request }) => {
  const isUserRequest = request.request_status === 'claimed';
  const isApproved = request.request_status === 'approved';
  const isDenied = request.request_status === 'denied';

  // Determine if it was a revocation (usually indicated in the notes from the backend)
  const isRevoked = isDenied && request.notes?.toLowerCase().includes('revoc');

  let EventIcon = FileText;
  let colorTheme = {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    iconBg: 'bg-gray-500',
    text: 'text-gray-800',
  };
  let actionText = '';

  if (isUserRequest) {
    EventIcon = User;
    colorTheme = {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-500',
      text: 'text-blue-800',
    };
    actionText = 'requested ownership of';
  } else if (isApproved) {
    EventIcon = ShieldCheck;
    colorTheme = {
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-500',
      text: 'text-green-800',
    };
    actionText = 'approved ownership claim for';
  } else if (isRevoked) {
    EventIcon = ShieldAlert;
    colorTheme = {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      iconBg: 'bg-orange-500',
      text: 'text-orange-800',
    };
    actionText = 'revoked ownership from';
  } else if (isDenied) {
    EventIcon = X;
    colorTheme = {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-500',
      text: 'text-red-800',
    };
    actionText = 'denied ownership claim for';
  }

  // Use processed_date for admin actions, request_date for user actions
  const displayDate =
    !isUserRequest && request.processed_date
      ? new Date(request.processed_date)
      : new Date(request.request_date);

  return (
    <div className='relative pl-8 sm:pl-32 py-4 group'>
      {/* Vertical line connecting events */}
      <div className='absolute left-4 sm:left-28 top-0 bottom-0 w-px bg-gray-200 group-last:h-full group-last:bottom-auto group-last:bg-gradient-to-b group-last:from-gray-200 group-last:to-transparent' />

      {/* Icon node */}
      <div
        className={`absolute left-0 sm:left-24 top-5 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${colorTheme.iconBg}`}
      >
        <EventIcon className='w-4 h-4 text-white' />
      </div>

      {/* Date (Left sidebar on desktop, above card on mobile) */}
      <div className='sm:absolute sm:left-0 sm:w-20 sm:text-right text-xs text-gray-500 mt-1 sm:mt-1.5 mb-2 sm:mb-0'>
        <div className='font-medium text-gray-700'>{displayDate.toLocaleDateString()}</div>
        <div className='text-[10px] uppercase tracking-wider'>
          {displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Event Content Card */}
      <div className={`rounded-lg shadow-sm border p-4 ${colorTheme.bg} ${colorTheme.border}`}>
        <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-2'>
          <div>
            <p className='text-sm text-gray-800 leading-relaxed'>
              <span className='font-semibold text-gray-900'>
                {!isUserRequest && request.admin_username
                  ? request.admin_username
                  : request.username}
              </span>{' '}
              {actionText}{' '}
              <span className='font-semibold text-gray-900'>{request.diving_center_name}</span>
              {!isUserRequest && !isRevoked && (
                <>
                  {' '}
                  (Claimed by <span className='font-medium'>{request.username}</span>)
                </>
              )}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white border ${colorTheme.text} ${colorTheme.border}`}
          >
            {isUserRequest ? 'User Request' : 'Admin Decision'}
          </span>
        </div>

        {/* Supplementary Data (Reasons & Notes) */}
        {(request.reason || request.notes) && (
          <div className='mt-3 pt-3 border-t border-black/5 grid grid-cols-1 gap-2 text-sm'>
            {request.reason && (
              <div className='bg-white/50 rounded p-2'>
                <span className='font-medium text-gray-700 text-[10px] uppercase tracking-wider block mb-1'>
                  Reason Provided
                </span>
                <p className='text-gray-600 whitespace-pre-wrap'>{request.reason}</p>
              </div>
            )}
            {request.notes && !isUserRequest && (
              <div className='bg-white/50 rounded p-2'>
                <span className='font-medium text-gray-700 text-[10px] uppercase tracking-wider block mb-1'>
                  Internal Admin Notes
                </span>
                <p className='text-gray-600 whitespace-pre-wrap'>{request.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

TimelineEvent.propTypes = {
  request: PropTypes.shape({
    id: PropTypes.number,
    diving_center_name: PropTypes.string,
    username: PropTypes.string,
    request_status: PropTypes.string,
    request_date: PropTypes.string,
    processed_date: PropTypes.string,
    admin_username: PropTypes.string,
    reason: PropTypes.string,
    notes: PropTypes.string,
  }).isRequired,
};

const ApprovalModal = ({
  request,
  isRevoking,
  onClose,
  onApproval,
  onRevoke,
  approvalReason,
  setApprovalReason,
  revokeReason,
  setRevokeReason,
  approvalMutation,
  revokeMutation,
}) => (
  <Modal
    isOpen={true}
    onClose={onClose}
    title={isRevoking ? 'Revoke Ownership' : 'Review Ownership Claim'}
    className='max-w-md w-full mx-4'
  >
    <div className='mb-4'>
      <h4 className='font-medium text-gray-900 mb-2'>{request.name}</h4>
      {request.owner_username && (
        <p className='text-sm text-gray-600 mb-2'>
          {isRevoking ? 'Current Owner:' : 'Claimed by:'} {request.owner_username}
        </p>
      )}
      <p className='text-sm text-gray-600'>
        Status: {request.ownership_status === 'claimed' ? 'Pending Approval' : 'Approved'}
      </p>
      {request.claim_reason && (
        <div className='mt-3 pt-3 border-t border-gray-200'>
          <p className='text-sm font-medium text-gray-900 mb-2'>Claim Reason:</p>
          <p className='text-sm text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap'>
            {request.claim_reason}
          </p>
        </div>
      )}
      {isRevoking && (
        <p className='text-sm text-red-600 mt-2'>
          ⚠️ This action will remove the current owner and set the diving center status to
          unclaimed.
        </p>
      )}
    </div>

    {request.ownership_status === 'claimed' && !isRevoking && (
      <>
        <div className='mb-4'>
          <label htmlFor='approval-reason' className='block text-sm font-medium text-gray-700 mb-2'>
            Approval Reason (Optional)
          </label>
          <textarea
            id='approval-reason'
            value={approvalReason}
            onChange={e => setApprovalReason(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            rows='3'
            placeholder='Add a reason for approval or denial...'
          />
        </div>

        <div className='flex justify-end space-x-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            onClick={() => onApproval(false)}
            disabled={approvalMutation.isLoading}
            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
          >
            {approvalMutation.isLoading ? (
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
            ) : (
              <X className='h-4 w-4' />
            )}
            <span>Deny</span>
          </button>
          <button
            onClick={() => onApproval(true)}
            disabled={approvalMutation.isLoading}
            className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
          >
            {approvalMutation.isLoading ? (
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
            ) : (
              <Check className='h-4 w-4' />
            )}
            <span>Approve</span>
          </button>
        </div>
      </>
    )}

    {isRevoking && (
      <>
        <div className='mb-4'>
          <label htmlFor='revoke-reason' className='block text-sm font-medium text-gray-700 mb-2'>
            Revocation Reason (Required)
          </label>
          <textarea
            id='revoke-reason'
            value={revokeReason}
            onChange={e => setRevokeReason(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500'
            rows='3'
            placeholder='Please provide a reason for revoking ownership...'
            required
          />
        </div>

        <div className='flex justify-end space-x-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            onClick={onRevoke}
            disabled={revokeMutation.isLoading || !revokeReason.trim()}
            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
          >
            {revokeMutation.isLoading ? (
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
            ) : (
              <X className='h-4 w-4' />
            )}
            <span>Revoke Ownership</span>
          </button>
        </div>
      </>
    )}
  </Modal>
);

ApprovalModal.propTypes = {
  request: PropTypes.shape({
    name: PropTypes.string,
    owner_username: PropTypes.string,
    ownership_status: PropTypes.string,
    claim_reason: PropTypes.string,
  }).isRequired,
  isRevoking: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApproval: PropTypes.func.isRequired,
  onRevoke: PropTypes.func.isRequired,
  approvalReason: PropTypes.string.isRequired,
  setApprovalReason: PropTypes.func.isRequired,
  revokeReason: PropTypes.string.isRequired,
  setRevokeReason: PropTypes.func.isRequired,
  approvalMutation: PropTypes.shape({
    isLoading: PropTypes.bool,
  }).isRequired,
  revokeMutation: PropTypes.shape({
    isLoading: PropTypes.bool,
  }).isRequired,
};

const AdminOwnershipRequests = () => {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  const queryClient = useQueryClient();

  // Fetch current ownership requests
  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery({
    queryKey: ['ownership-requests'],
    queryFn: getOwnershipRequests,
  });

  // Fetch ownership request history
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['ownership-request-history'],
    queryFn: getOwnershipRequestHistory,
  });

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ divingCenterId, approved, reason }) => {
      return approveDivingCenterOwnership(divingCenterId, { approved, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership-requests'] });
      queryClient.invalidateQueries({ queryKey: ['ownership-request-history'] });
      setSelectedRequest(null);
      setApprovalReason('');
    },
    onError: () => {
      alert('Failed to process ownership request. Please try again.');
    },
  });

  // Revoke mutation
  const revokeMutation = useMutation({
    mutationFn: async ({ divingCenterId, reason }) => {
      return revokeDivingCenterOwnership(divingCenterId, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownership-requests'] });
      queryClient.invalidateQueries({ queryKey: ['ownership-request-history'] });
      setSelectedRequest(null);
      setRevokeReason('');
      setIsRevoking(false);
    },
    onError: () => {
      alert('Failed to revoke ownership. Please try again.');
    },
  });

  const handleApproval = approved => {
    if (!selectedRequest) return;

    approvalMutation.mutate({
      divingCenterId: selectedRequest.id,
      approved,
      reason: approvalReason,
    });
  };

  const handleRevoke = () => {
    if (!selectedRequest) return;

    revokeMutation.mutate({
      divingCenterId: selectedRequest.id,
      reason: revokeReason,
    });
  };

  const handleModalOpen = (request, revoking = false) => {
    setSelectedRequest(request);
    setIsRevoking(revoking);
    setApprovalReason('');
    setRevokeReason('');
  };

  const handleModalClose = () => {
    setSelectedRequest(null);
    setIsRevoking(false);
  };

  const isLoading = requestsLoading || historyLoading;
  const error = requestsError || historyError;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  const getColumns = isActiveTab => [
    {
      title: 'Diving Center',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className='flex flex-col'>
          <span className='font-semibold text-gray-900'>{text}</span>
          <span className='text-xs text-gray-500'>{record.location}</span>
        </div>
      ),
    },
    {
      title: 'Claimed By',
      dataIndex: 'owner_username',
      key: 'owner_username',
      render: text => <span className='font-medium'>{text}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Tag color={record.ownership_status === 'claimed' ? 'orange' : 'green'}>
          {record.ownership_status === 'claimed' ? 'Pending Approval' : 'Approved'}
        </Tag>
      ),
    },
    {
      title: 'Request Date',
      dataIndex: 'request_date',
      key: 'request_date',
      render: date => new Date(date).toLocaleString(),
    },
    ...(!isActiveTab
      ? [
          {
            title: 'Claim Reason',
            dataIndex: 'claim_reason',
            key: 'claim_reason',
            render: text =>
              text ? (
                <Tooltip title={text}>
                  <div className='max-w-[200px] truncate text-gray-600 cursor-pointer'>{text}</div>
                </Tooltip>
              ) : (
                <span className='text-gray-400 italic'>No reason provided</span>
              ),
          },
        ]
      : []),
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size='middle'>
          {record.ownership_status === 'claimed' ? (
            <Button
              type='primary'
              className='flex items-center'
              onClick={() => handleModalOpen(record, false)}
            >
              <Clock className='h-4 w-4 mr-2' />
              Review
            </Button>
          ) : (
            <Button
              danger
              className='flex items-center'
              onClick={() => handleModalOpen(record, true)}
            >
              <X className='h-4 w-4 mr-2' />
              Revoke
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className='w-full max-w-full p-4 sm:p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Ownership Requests</h1>
        <p className='text-gray-600'>
          Manage diving center ownership requests and view request history.
        </p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className='mt-6'
        size='large'
        items={[
          {
            key: 'pending',
            label: 'Pending Requests',
            children: (
              <div className='bg-white rounded-lg shadow-sm border border-gray-200 mt-4 overflow-hidden'>
                <Table
                  dataSource={requests?.filter(r => r.ownership_status === 'claimed')}
                  columns={getColumns(false)}
                  rowKey='id'
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No pending ownership requests.' }}
                />
              </div>
            ),
          },
          {
            key: 'active',
            label: 'Active Ownerships',
            children: (
              <div className='bg-white rounded-lg shadow-sm border border-gray-200 mt-4 overflow-hidden'>
                <Table
                  dataSource={requests?.filter(r => r.ownership_status === 'approved')}
                  columns={getColumns(true)}
                  rowKey='id'
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No active diving center ownerships.' }}
                />
              </div>
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mt-4'>
                <div className='relative'>
                  {history?.map(request => (
                    <TimelineEvent key={request.id} request={request} />
                  ))}
                  {history?.length === 0 && (
                    <div className='py-12 text-center text-gray-500'>No history recorded yet.</div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Approval/Revoke Modal */}
      {selectedRequest && (
        <ApprovalModal
          request={selectedRequest}
          isRevoking={isRevoking}
          onClose={handleModalClose}
          onApproval={handleApproval}
          onRevoke={handleRevoke}
          approvalReason={approvalReason}
          setApprovalReason={setApprovalReason}
          revokeReason={revokeReason}
          setRevokeReason={setRevokeReason}
          approvalMutation={approvalMutation}
          revokeMutation={revokeMutation}
        />
      )}
    </div>
  );
};

export default AdminOwnershipRequests;
