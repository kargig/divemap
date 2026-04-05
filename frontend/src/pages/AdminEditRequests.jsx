import { format } from 'date-fns';
import { Check, X, Clock, MapPin, User, FileText, Image as ImageIcon } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import api from '../api';
import usePageTitle from '../hooks/usePageTitle';
import { extractErrorMessage as getErrorMessage } from '../utils/apiErrors';

const getEditTypeLabel = type => {
  switch (type) {
    case 'site_data':
      return 'Core Data Update';
    case 'media_addition':
      return 'Add Media';
    case 'media_update':
      return 'Update Media';
    case 'media_deletion':
      return 'Delete Media';
    default:
      return type;
  }
};

const getEditTypeIcon = type => {
  switch (type) {
    case 'site_data':
      return <FileText className='w-4 h-4 mr-1' />;
    case 'media_addition':
    case 'media_update':
    case 'media_deletion':
      return <ImageIcon className='w-4 h-4 mr-1' />;
    default:
      return <FileText className='w-4 h-4 mr-1' />;
  }
};

const AdminEditRequests = () => {
  usePageTitle('Divemap - Pending Edit Requests');
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState(null);

  // Fetch pending requests
  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery(['admin-edit-requests'], () =>
    api.get('/api/v1/admin/dive-sites/edit-requests').then(res => res.data)
  );

  // Approve Mutation
  const approveMutation = useMutation(
    id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/approve`),
    {
      onMutate: variables => setProcessingId(variables),
      onSuccess: () => {
        toast.success('Edit request approved and applied!');
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => {
        toast.error(`Failed to approve: ${getErrorMessage(error)}`);
      },
      onSettled: () => setProcessingId(null),
    }
  );

  // Reject Mutation
  const rejectMutation = useMutation(
    id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/reject`),
    {
      onMutate: variables => setProcessingId(variables),
      onSuccess: () => {
        toast.success('Edit request rejected.');
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => {
        toast.error(`Failed to reject: ${getErrorMessage(error)}`);
      },
      onSettled: () => setProcessingId(null),
    }
  );

  const handleApprove = id => {
    if (window.confirm('Are you sure you want to approve and apply these changes?')) {
      approveMutation.mutate(id);
    }
  };

  const handleReject = id => {
    if (window.confirm('Are you sure you want to reject this request?')) {
      rejectMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-red-50 p-4 rounded-md text-red-700 my-4 max-w-4xl mx-auto'>
        <p>Error loading requests: {getErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Pending Edit Requests</h1>
        <p className='text-gray-600 mt-2'>Review and moderate community dive site contributions.</p>
      </div>

      {requests.length === 0 ? (
        <div className='bg-white p-8 text-center rounded-lg border border-gray-200 shadow-sm'>
          <Check className='w-12 h-12 text-green-500 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900'>All caught up!</h3>
          <p className='text-gray-500'>There are no pending edit requests to moderate.</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6'>
          {requests.map(req => (
            <div
              key={req.id}
              className='bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row'
            >
              {/* Left Column: Metadata */}
              <div className='bg-gray-50 p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200'>
                <div className='flex items-center space-x-2 text-primary-600 font-medium mb-4'>
                  {getEditTypeIcon(req.edit_type)}
                  <span>{getEditTypeLabel(req.edit_type)}</span>
                </div>

                <div className='space-y-4'>
                  <div>
                    <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1'>
                      Target Site
                    </div>
                    <div className='flex items-center text-gray-900'>
                      <MapPin className='w-4 h-4 mr-2 text-gray-400' />
                      <a
                        href={`/dive-sites/${req.dive_site_id}`}
                        target='_blank'
                        rel='noreferrer'
                        className='hover:underline text-blue-600 font-medium'
                      >
                        {req.dive_site?.name || `Site #${req.dive_site_id}`}
                      </a>
                    </div>
                  </div>

                  <div>
                    <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1'>
                      Proposed By
                    </div>
                    <div className='flex items-center text-gray-900'>
                      <User className='w-4 h-4 mr-2 text-gray-400' />
                      <a
                        href={`/users/${req.requested_by?.username}`}
                        target='_blank'
                        rel='noreferrer'
                        className='hover:underline text-blue-600'
                      >
                        {req.requested_by?.username || `User #${req.requested_by_id}`}
                      </a>
                    </div>
                  </div>

                  <div>
                    <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1'>
                      Submitted At
                    </div>
                    <div className='flex items-center text-gray-900 text-sm'>
                      <Clock className='w-4 h-4 mr-2 text-gray-400' />
                      {format(new Date(req.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Proposed Data & Actions */}
              <div className='p-6 md:w-2/3 flex flex-col'>
                <h4 className='text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3'>
                  Proposed Changes
                </h4>

                <div className='flex-grow bg-gray-900 rounded-md p-4 overflow-x-auto'>
                  <pre className='text-sm text-green-400 font-mono whitespace-pre-wrap'>
                    {JSON.stringify(req.proposed_data, null, 2)}
                  </pre>
                </div>

                <div className='mt-6 flex justify-end space-x-3'>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={
                      processingId === req.id ||
                      rejectMutation.isLoading ||
                      approveMutation.isLoading
                    }
                    className='flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50'
                  >
                    {processingId === req.id && rejectMutation.isLoading ? (
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2'></div>
                    ) : (
                      <X className='w-4 h-4 mr-2' />
                    )}
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={
                      processingId === req.id ||
                      rejectMutation.isLoading ||
                      approveMutation.isLoading
                    }
                    className='flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors disabled:opacity-50'
                  >
                    {processingId === req.id && approveMutation.isLoading ? (
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                    ) : (
                      <Check className='w-4 h-4 mr-2' />
                    )}
                    Approve & Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEditRequests;
