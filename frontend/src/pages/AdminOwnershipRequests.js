import { Check, Clock, X } from 'lucide-react';
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

const TabNavigation = ({ activeTab, setActiveTab }) => (
  <div className='mb-6 border-b border-gray-200'>
    <nav className='-mb-px flex space-x-8'>
      <button
        onClick={() => setActiveTab('current')}
        className={`py-2 px-1 border-b-2 font-medium text-sm ${
          activeTab === 'current'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        Current Requests
      </button>
      <button
        onClick={() => setActiveTab('history')}
        className={`py-2 px-1 border-b-2 font-medium text-sm ${
          activeTab === 'history'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        History
      </button>
    </nav>
  </div>
);

TabNavigation.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
};

const CurrentRequestCard = ({ request, onModalOpen }) => (
  <div className='bg-white rounded-lg shadow-md p-6 border border-gray-200'>
    <div className='flex items-start justify-between mb-4'>
      <div className='flex-1'>
        <h3 className='text-lg font-semibold text-gray-900 mb-2'>{request.name}</h3>
        <div className='space-y-2 text-sm'>
          <p className='text-gray-600'>
            <span className='font-medium'>Location:</span> {request.location}
          </p>
          {request.owner_username && (
            <p className='text-gray-600'>
              <span className='font-medium'>Claimed by:</span> {request.owner_username}
            </p>
          )}
          <p className='text-gray-600'>
            <span className='font-medium'>Status:</span>{' '}
            <span
              className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                request.ownership_status === 'claimed'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {request.ownership_status === 'claimed' ? 'Pending Approval' : 'Approved'}
            </span>
          </p>
          {request.request_date && (
            <p className='text-gray-600'>
              <span className='font-medium'>Request Date:</span>{' '}
              {new Date(request.request_date).toLocaleString()}
            </p>
          )}
          {request.created_at && (
            <p className='text-gray-600'>
              <span className='font-medium'>Created:</span>{' '}
              {new Date(request.created_at).toLocaleString()}
            </p>
          )}
          {request.updated_at && request.updated_at !== request.created_at && (
            <p className='text-gray-600'>
              <span className='font-medium'>Last Updated:</span>{' '}
              {new Date(request.updated_at).toLocaleString()}
            </p>
          )}
          {request.claim_reason && (
            <div className='mt-3 pt-3 border-t border-gray-200'>
              <p className='text-gray-700 font-medium mb-1'>Claim Reason:</p>
              <p className='text-gray-600 text-xs whitespace-pre-wrap'>{request.claim_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>

    <div className='flex justify-end space-x-2'>
      {request.ownership_status === 'claimed' ? (
        <button
          onClick={() => onModalOpen(request, false)}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2'
        >
          <Clock className='h-4 w-4' />
          <span>Review</span>
        </button>
      ) : (
        <div className='flex items-center space-x-2'>
          <span className='text-sm text-gray-500'>This diving center has an approved owner.</span>
          <button
            onClick={() => onModalOpen(request, true)}
            className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center space-x-2'
          >
            <X className='h-4 w-4' />
            <span>Revoke Ownership</span>
          </button>
        </div>
      )}
    </div>
  </div>
);

CurrentRequestCard.propTypes = {
  request: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    location: PropTypes.string,
    owner_username: PropTypes.string,
    ownership_status: PropTypes.string,
    request_date: PropTypes.string,
    created_at: PropTypes.string,
    updated_at: PropTypes.string,
    claim_reason: PropTypes.string,
  }).isRequired,
  onModalOpen: PropTypes.func.isRequired,
};

const HistoryCard = ({ request }) => {
  const getStatusColor = status => {
    switch (status) {
      case 'claimed':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'denied':
        return 'bg-red-100 text-red-800';
      case 'revoked':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = status => {
    switch (status) {
      case 'claimed':
        return 'Claim Pending';
      case 'approved':
        return 'Approved';
      case 'denied':
        return 'Denied';
      case 'revoked':
        return 'Revoked';
      default:
        return status;
    }
  };

  return (
    <div className='bg-white rounded-lg shadow-md p-6 border border-gray-200'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex-1'>
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>{request.diving_center_name}</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
            <div>
              <p className='text-gray-600'>
                <span className='font-medium'>User:</span> {request.username}
              </p>
              <p className='text-gray-600'>
                <span className='font-medium'>Status:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    request.request_status
                  )}`}
                >
                  {getStatusText(request.request_status)}
                </span>
              </p>
              <p className='text-gray-600'>
                <span className='font-medium'>Request Date:</span>{' '}
                {new Date(request.request_date).toLocaleString()}
              </p>
            </div>
            <div>
              {request.processed_date && (
                <p className='text-gray-600'>
                  <span className='font-medium'>Processed:</span>{' '}
                  {new Date(request.processed_date).toLocaleString()}
                </p>
              )}
              {request.admin_username && (
                <p className='text-gray-600'>
                  <span className='font-medium'>By Admin:</span> {request.admin_username}
                </p>
              )}
              {request.reason && (
                <p className='text-gray-600'>
                  <span className='font-medium'>Reason:</span> {request.reason}
                </p>
              )}
              {request.notes && (
                <p className='text-gray-600'>
                  <span className='font-medium'>Notes:</span> {request.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

HistoryCard.propTypes = {
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
  const [activeTab, setActiveTab] = useState('current');

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

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>Ownership Requests</h1>
        <p className='text-gray-600'>
          Manage diving center ownership requests and view request history.
        </p>
      </div>

      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Current Requests Tab */}
      {activeTab === 'current' && (
        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {requests?.map(request => (
            <CurrentRequestCard key={request.id} request={request} onModalOpen={handleModalOpen} />
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className='space-y-4'>
          {history?.map(request => (
            <HistoryCard key={request.id} request={request} />
          ))}
        </div>
      )}

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
