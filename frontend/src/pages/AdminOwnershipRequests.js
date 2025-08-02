import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getOwnershipRequests, approveDivingCenterOwnership } from '../api';
import { toast } from 'react-hot-toast';
import { Crown, Check, X, AlertCircle, Clock, User } from 'lucide-react';

const AdminOwnershipRequests = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalReason, setApprovalReason] = useState('');

  // Fetch ownership requests
  const { data: requests = [], isLoading, error } = useQuery(
    ['ownership-requests'],
    () => getOwnershipRequests(),
    {
      retry: 3,
      retryDelay: 1000,
    }
  );

  // Approve/deny ownership mutation
  const approvalMutation = useMutation(
    ({ divingCenterId, approved, reason }) => 
      approveDivingCenterOwnership(divingCenterId, { approved, reason }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ownership-requests']);
        setSelectedRequest(null);
        setApprovalReason('');
        toast.success('Ownership request processed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to process ownership request');
      },
    }
  );

  const handleApproval = (approved) => {
    if (!selectedRequest) return;
    
    approvalMutation.mutate({
      divingCenterId: selectedRequest.id,
      approved,
      reason: approvalReason
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      claimed: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      unclaimed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'claimed':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <Check className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading ownership requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading ownership requests: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Crown className="h-8 w-8 text-yellow-600" />
        <h1 className="text-3xl font-bold text-gray-900">Ownership Requests</h1>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <Crown className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No ownership requests found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {request.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.ownership_status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.ownership_status)}`}>
                      {request.ownership_status === 'claimed' ? 'Claim Pending' :
                       request.ownership_status === 'approved' ? 'Approved' :
                       'Unclaimed'}
                    </span>
                  </div>
                </div>
                {request.owner_username && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{request.owner_username}</span>
                  </div>
                )}
              </div>

              {request.ownership_status === 'claimed' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    A user has claimed ownership of this diving center and is waiting for approval.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Review Claim
                    </button>
                  </div>
                </div>
              )}

              {request.ownership_status === 'approved' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    This diving center has an approved owner.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Review Ownership Claim
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">
                {selectedRequest.name}
              </h4>
              {selectedRequest.owner_username && (
                <p className="text-sm text-gray-600 mb-2">
                  Claimed by: {selectedRequest.owner_username}
                </p>
              )}
              <p className="text-sm text-gray-600">
                Status: {selectedRequest.ownership_status === 'claimed' ? 'Pending Approval' : 'Approved'}
              </p>
            </div>

            {selectedRequest.ownership_status === 'claimed' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Reason (Optional)
                  </label>
                  <textarea
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Add a reason for approval or denial..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApproval(false)}
                    disabled={approvalMutation.isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {approvalMutation.isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span>Deny</span>
                  </button>
                  <button
                    onClick={() => handleApproval(true)}
                    disabled={approvalMutation.isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {approvalMutation.isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Approve</span>
                  </button>
                </div>
              </>
            )}

            {selectedRequest.ownership_status === 'approved' && (
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOwnershipRequests; 