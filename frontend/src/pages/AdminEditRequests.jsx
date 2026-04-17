import { format } from 'date-fns';
import { Check, X, Clock, MapPin, User, FileText, Image as ImageIcon, Tag } from 'lucide-react';
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
    case 'tag_addition':
      return 'Add Tag';
    case 'tag_removal':
      return 'Remove Tag';
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
    case 'tag_addition':
    case 'tag_removal':
      return <Tag className='w-4 h-4 mr-1' />;
    default:
      return <FileText className='w-4 h-4 mr-1' />;
  }
};

const AdminEditRequests = () => {
  usePageTitle('Divemap - Pending Edit Requests');
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Fetch available tags for resolving tag names
  const { data: availableTags = [] } = useQuery(['available-tags'], () =>
    api.get('/api/v1/tags/').then(res => res.data)
  );
  const tagMap = availableTags.reduce((acc, tag) => {
    acc[tag.id] = tag.name;
    return acc;
  }, {});

  // Fetch pending requests
  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery(['admin-edit-requests'], () =>
    api.get('/api/v1/admin/dive-sites/edit-requests').then(res => res.data)
  );

  const approveMutation = useMutation(
    id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/approve`),
    {
      onMutate: variables => setProcessingId(variables),
      onSuccess: () => {
        toast.success('Edit request approved and applied!');
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => toast.error(`Failed to approve: ${getErrorMessage(error)}`),
      onSettled: () => setProcessingId(null),
    }
  );

  const rejectMutation = useMutation(
    id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/reject`),
    {
      onMutate: variables => setProcessingId(variables),
      onSuccess: () => {
        toast.success('Edit request rejected.');
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => toast.error(`Failed to reject: ${getErrorMessage(error)}`),
      onSettled: () => setProcessingId(null),
    }
  );

  const bulkApproveMutation = useMutation(
    async ids => {
      await Promise.all(
        ids.map(id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/approve`))
      );
    },
    {
      onSuccess: () => {
        toast.success('Selected requests approved and applied!');
        setSelectedIds([]);
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => toast.error(`Failed to approve some requests: ${getErrorMessage(error)}`),
    }
  );

  const bulkRejectMutation = useMutation(
    async ids => {
      await Promise.all(
        ids.map(id => api.post(`/api/v1/admin/dive-sites/edit-requests/${id}/reject`))
      );
    },
    {
      onSuccess: () => {
        toast.success('Selected requests rejected.');
        setSelectedIds([]);
        queryClient.invalidateQueries(['admin-edit-requests']);
      },
      onError: error => toast.error(`Failed to reject some requests: ${getErrorMessage(error)}`),
    }
  );

  const handleSelectAll = e => {
    if (e.target.checked) setSelectedIds(requests.map(req => req.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id, checked) => {
    if (checked) setSelectedIds(prev => [...prev, id]);
    else setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
  };

  const handleApprove = id => {
    if (window.confirm('Are you sure you want to approve and apply these changes?'))
      approveMutation.mutate(id);
  };
  const handleReject = id => {
    if (window.confirm('Are you sure you want to reject this request?')) rejectMutation.mutate(id);
  };
  const handleBulkApprove = () => {
    if (
      window.confirm(`Are you sure you want to approve and apply ${selectedIds.length} requests?`)
    )
      bulkApproveMutation.mutate(selectedIds);
  };
  const handleBulkReject = () => {
    if (window.confirm(`Are you sure you want to reject ${selectedIds.length} requests?`))
      bulkRejectMutation.mutate(selectedIds);
  };

  const isProcessingBulk = bulkApproveMutation.isLoading || bulkRejectMutation.isLoading;

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
    <div className='w-full max-w-full p-4 sm:p-6'>
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
        <>
          <div className='mb-4 flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg border shadow-sm'>
            <div className='flex items-center mb-4 sm:mb-0'>
              <input
                type='checkbox'
                checked={selectedIds.length === requests.length && requests.length > 0}
                onChange={handleSelectAll}
                className='w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer'
                id='selectAll'
              />
              <label
                htmlFor='selectAll'
                className='ml-2 text-sm font-medium text-gray-700 cursor-pointer'
              >
                Select All ({selectedIds.length} selected)
              </label>
            </div>

            {selectedIds.length > 0 && (
              <div className='flex space-x-3'>
                <button
                  onClick={handleBulkReject}
                  disabled={isProcessingBulk}
                  className='flex items-center px-4 py-2 text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50'
                >
                  {bulkRejectMutation.isLoading ? (
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2'></div>
                  ) : (
                    <X className='w-4 h-4 mr-2' />
                  )}{' '}
                  Reject Selected
                </button>
                <button
                  onClick={handleBulkApprove}
                  disabled={isProcessingBulk}
                  className='flex items-center px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors disabled:opacity-50'
                >
                  {bulkApproveMutation.isLoading ? (
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  ) : (
                    <Check className='w-4 h-4 mr-2' />
                  )}{' '}
                  Approve Selected
                </button>
              </div>
            )}
          </div>

          <div className='grid grid-cols-1 gap-6'>
            {requests.map(req => (
              <div
                key={req.id}
                className={`bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col md:flex-row transition-colors ${selectedIds.includes(req.id) ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200'}`}
              >
                <div className='bg-gray-50 p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 relative'>
                  <div className='absolute top-4 right-4 flex flex-col items-end'>
                    <input
                      type='checkbox'
                      checked={selectedIds.includes(req.id)}
                      onChange={e => handleSelectOne(req.id, e.target.checked)}
                      className='w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer'
                    />
                    <span className='text-xs text-gray-400 mt-2 font-mono'>ID: {req.id}</span>
                  </div>

                  <div className='flex items-center space-x-2 text-primary-600 font-medium mb-4 pr-8'>
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

                <div className='p-6 md:w-2/3 flex flex-col'>
                  <h4 className='text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3'>
                    Proposed Changes
                  </h4>
                  <div className='flex-grow border rounded-md overflow-hidden'>
                    <table className='min-w-full divide-y divide-gray-200'>
                      <thead className='bg-gray-50'>
                        <tr>
                          <th
                            scope='col'
                            className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                          >
                            Field
                          </th>
                          <th
                            scope='col'
                            className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                          >
                            Current Value
                          </th>
                          <th
                            scope='col'
                            className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
                          >
                            Proposed Change
                          </th>
                        </tr>
                      </thead>
                      <tbody className='bg-white divide-y divide-gray-200'>
                        {(() => {
                          if (req.edit_type === 'site_data' && req.proposed_data) {
                            return Object.entries(req.proposed_data).map(([key, newValue]) => {
                              const currentValue =
                                req.dive_site && req.dive_site[key] !== undefined
                                  ? req.dive_site[key]
                                  : 'Not loaded';
                              const displayCurrent =
                                typeof currentValue === 'object' && currentValue !== null
                                  ? JSON.stringify(currentValue)
                                  : String(currentValue);
                              const displayNew =
                                typeof newValue === 'object' && newValue !== null
                                  ? JSON.stringify(newValue)
                                  : String(newValue);
                              const isChanged =
                                displayCurrent !== displayNew &&
                                displayCurrent !== 'undefined' &&
                                parseFloat(displayCurrent) !== parseFloat(displayNew) &&
                                String(currentValue) !== String(newValue);

                              if (!isChanged) {
                                return (
                                  <tr key={key} className='bg-white opacity-60'>
                                    <td className='px-4 py-2 text-sm text-gray-500'>
                                      {key.replace(/_/g, ' ')}
                                    </td>
                                    <td className='px-4 py-2 text-sm text-gray-400'>
                                      {displayCurrent === 'undefined' ? 'Not Set' : displayCurrent}
                                    </td>
                                    <td className='px-4 py-2 text-sm text-gray-400'>-</td>
                                  </tr>
                                );
                              }
                              return (
                                <tr key={key} className='bg-yellow-50/30'>
                                  <td className='px-4 py-2 text-sm font-medium text-gray-900'>
                                    <div className='flex items-center'>
                                      {key.replace(/_/g, ' ')}
                                      <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800'>
                                        Modified
                                      </span>
                                    </div>
                                  </td>
                                  <td className='px-4 py-2 text-sm text-red-600 bg-red-50/30 line-through'>
                                    {displayCurrent === 'undefined' ? 'Not Set' : displayCurrent}
                                  </td>
                                  <td className='px-4 py-2 text-sm text-green-700 bg-green-50/30 font-medium'>
                                    {displayNew}
                                  </td>
                                </tr>
                              );
                            });
                          }

                          if (req.edit_type === 'media_addition') {
                            return Object.entries(req.proposed_data)
                              .filter(([key, val]) => val !== null && val !== '')
                              .map(([key, val]) => (
                                <tr key={key} className='bg-green-50/10'>
                                  <td className='px-4 py-2 text-sm font-medium text-gray-900'>
                                    {key.replace(/_/g, ' ')}
                                  </td>
                                  <td className='px-4 py-2 text-sm text-gray-400'>-</td>
                                  <td className='px-4 py-2 text-sm text-green-700 font-medium'>
                                    {key.includes('url') ? (
                                      <a
                                        href={val}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='underline truncate max-w-xs block'
                                      >
                                        {val}
                                      </a>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                </tr>
                              ));
                          }

                          if (req.edit_type === 'media_update') {
                            const mediaId = req.proposed_data.id;
                            const currentMedia = req.dive_site?.media?.find(m => m.id === mediaId);
                            return Object.entries(req.proposed_data)
                              .filter(([key, val]) => key !== 'id' && val !== null && val !== '')
                              .map(([key, newValue]) => {
                                const currentValue = currentMedia ? currentMedia[key] : 'Not found';
                                if (String(currentValue) === String(newValue)) return null;
                                return (
                                  <tr key={key} className='bg-yellow-50/30'>
                                    <td className='px-4 py-2 text-sm font-medium text-gray-900'>
                                      <div className='flex items-center'>
                                        {key.replace(/_/g, ' ')}
                                        <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800'>
                                          Modified
                                        </span>
                                      </div>
                                    </td>
                                    <td className='px-4 py-2 text-sm text-red-600 bg-red-50/30 line-through'>
                                      {String(currentValue)}
                                    </td>
                                    <td className='px-4 py-2 text-sm text-green-700 bg-green-50/30 font-medium'>
                                      {key.includes('url') ? (
                                        <a
                                          href={newValue}
                                          target='_blank'
                                          rel='noreferrer'
                                          className='underline truncate max-w-xs block'
                                        >
                                          {newValue}
                                        </a>
                                      ) : (
                                        String(newValue)
                                      )}
                                    </td>
                                  </tr>
                                );
                              });
                          }

                          if (req.edit_type === 'media_deletion') {
                            const mediaId = req.proposed_data.id;
                            const currentMedia = req.dive_site?.media?.find(m => m.id === mediaId);
                            return (
                              <tr className='bg-red-50/30'>
                                <td className='px-4 py-2 text-sm font-medium text-gray-900'>
                                  Media Record
                                </td>
                                <td className='px-4 py-2 text-sm text-red-600 line-through'>
                                  {currentMedia
                                    ? `${currentMedia.media_type}: ${currentMedia.url}`
                                    : `ID: ${mediaId}`}
                                </td>
                                <td className='px-4 py-2 text-sm text-gray-400'>[DELETE]</td>
                              </tr>
                            );
                          }

                          if (req.edit_type === 'tag_addition' || req.edit_type === 'tag_removal') {
                            const tagId = req.proposed_data.tag_id;
                            const tagName = tagMap[tagId] || `Tag #${tagId}`;
                            return (
                              <tr
                                className={
                                  req.edit_type === 'tag_addition'
                                    ? 'bg-green-50/10'
                                    : 'bg-red-50/10'
                                }
                              >
                                <td className='px-4 py-2 text-sm font-medium text-gray-900'>
                                  <div className='flex items-center'>
                                    Tag
                                    <span
                                      className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${req.edit_type === 'tag_addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                    >
                                      {req.edit_type === 'tag_addition' ? 'Added' : 'Removed'}
                                    </span>
                                  </div>
                                </td>
                                <td className='px-4 py-2 text-sm text-red-600 bg-red-50/30 line-through'>
                                  {req.edit_type === 'tag_removal' ? tagName : '-'}
                                </td>
                                <td className='px-4 py-2 text-sm text-green-700 bg-green-50/30 font-medium'>
                                  {req.edit_type === 'tag_addition' ? tagName : '-'}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr>
                              <td colSpan={3} className='px-4 py-4 text-sm text-gray-900'>
                                <div className='mb-2 font-semibold text-xs text-gray-500 uppercase'>
                                  Raw Request Data:
                                </div>
                                <pre className='text-xs whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded border border-gray-200'>
                                  {JSON.stringify(req.proposed_data, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  <div className='mt-6 flex justify-end space-x-3'>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={
                        processingId === req.id ||
                        rejectMutation.isLoading ||
                        approveMutation.isLoading ||
                        isProcessingBulk
                      }
                      className='flex items-center px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50'
                    >
                      {processingId === req.id && rejectMutation.isLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2'></div>
                      ) : (
                        <X className='w-4 h-4 mr-2' />
                      )}{' '}
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={
                        processingId === req.id ||
                        rejectMutation.isLoading ||
                        approveMutation.isLoading ||
                        isProcessingBulk
                      }
                      className='flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors disabled:opacity-50'
                    >
                      {processingId === req.id && approveMutation.isLoading ? (
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                      ) : (
                        <Check className='w-4 h-4 mr-2' />
                      )}{' '}
                      Approve & Apply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminEditRequests;
