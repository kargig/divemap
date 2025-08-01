import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Star, MapPin, Phone, Mail, Globe, Calendar, DollarSign, Edit, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

// Helper function to safely extract error message
const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.detail) return error.response.data.detail;
  if (error?.detail) return error.detail;
  return 'An error occurred';
};

const DivingCenterDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Check if user has edit privileges
  const canEdit = user && (user.is_admin || user.is_moderator);

  // Fetch diving center details
  const { data: center, isLoading, error } = useQuery(
    ['diving-center', id],
    () => api.get(`/api/v1/diving-centers/${id}`),
    {
      select: (response) => response.data,
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Fetch center organizations
  const { data: organizations = [], isLoading: orgLoading } = useQuery(
    ['diving-center-organizations', id],
    () => api.get(`/api/v1/diving-centers/${id}/organizations`).then(res => res.data),
    {
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Set initial rating to user's previous rating if available
  useEffect(() => {
    if (center) {
      if (center.user_rating) {
        setRating(center.user_rating);
      } else {
        setRating(0); // Reset to 0 if user hasn't rated this diving center
      }
    }
  }, [center]);

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery(
    ['diving-center-comments', id],
    () => api.get(`/api/v1/diving-centers/${id}/comments`),
    {
      select: (response) => response.data,
      enabled: !!id,
      retry: 3,
      retryDelay: 1000,
      keepPreviousData: true, // Keep previous data while refetching
    }
  );

  // Rating mutation
  const rateMutation = useMutation(
    ({ score }) => api.post(`/api/v1/diving-centers/${id}/rate`, { score }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center', id]);
        toast.success('Rating submitted successfully!');
        setRating(0);
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to submit rating');
      }
    }
  );

  // Comment mutations
  const createCommentMutation = useMutation(
    (commentText) => api.post(`/api/v1/diving-centers/${id}/comments`, { comment_text: commentText }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        setNewComment('');
        toast.success('Comment added successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to add comment');
      }
    }
  );

  const updateCommentMutation = useMutation(
    ({ commentId, commentText }) => api.put(`/api/v1/diving-centers/${id}/comments/${commentId}`, { comment_text: commentText }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        setEditingComment(null);
        setEditCommentText('');
        toast.success('Comment updated successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to update comment');
      }
    }
  );

  const deleteCommentMutation = useMutation(
    (commentId) => api.delete(`/api/v1/diving-centers/${id}/comments/${commentId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center-comments', id]);
        toast.success('Comment deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to delete comment');
      }
    }
  );

  const handleRating = (score) => {
    setRating(score);
    rateMutation.mutate({ score });
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment.id);
    setEditCommentText(comment.comment_text);
  };

  const handleUpdateComment = () => {
    updateCommentMutation.mutate({
      commentId: editingComment,
      commentText: editCommentText
    });
  };

  const handleDeleteComment = (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const renderStars = (rating, interactive = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
            key={star}
            onClick={() => interactive && handleRating(star)}
            className={`${
              interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''
            }`}
            disabled={!interactive}
          >
            <Star
              className={`h-5 w-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-600">Failed to load diving center: {getErrorMessage(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render the main content if center is not loaded, if there's an error, or if center data is invalid
  if (!center || error || !center.name) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            {error ? (
              <div>
                <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                <p className="text-gray-600">Failed to load diving center: {getErrorMessage(error)}</p>
              </div>
            ) : (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{center?.name || 'Loading...'}</h1>
              {center?.description && (
                <p className="text-gray-600 mb-4">{center.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {canEdit && (
                <button
                  onClick={() => navigate(`/diving-centers/${id}/edit`)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
              )}
              {center?.average_rating && (
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {center.average_rating.toFixed(1)}/10
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {center.total_ratings} rating{center.total_ratings !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {center?.email && (
              <div className="flex items-center text-gray-600">
                <Mail className="h-5 w-5 mr-3" />
                <a href={`mailto:${center.email}`} className="hover:text-blue-600">
                  {center.email}
                </a>
              </div>
            )}
            {center?.phone && (
              <div className="flex items-center text-gray-600">
                <Phone className="h-5 w-5 mr-3" />
                <a href={`tel:${center.phone}`} className="hover:text-blue-600">
                  {center.phone}
                </a>
              </div>
            )}
            {center?.website && (
              <div className="flex items-center text-gray-600">
                <Globe className="h-5 w-5 mr-3" />
                <a 
                  href={center.website.startsWith('http') ? center.website : `https://${center.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600"
                >
                  {center.website}
                </a>
              </div>
            )}
            {center?.latitude && center?.longitude && (
              <div className="flex items-center text-gray-600">
                <MapPin className="h-5 w-5 mr-3" />
                <span>{center.latitude !== undefined && !isNaN(Number(center.latitude)) ? Number(center.latitude).toFixed(5) : 'N/A'}, {center.longitude !== undefined && !isNaN(Number(center.longitude)) ? Number(center.longitude).toFixed(5) : 'N/A'}</span>
              </div>
            )}
          </div>

          {/* Diving Organizations */}
          {orgLoading ? (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Award className="h-5 w-5 mr-2" />
                Associated Diving Organizations
              </h3>
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ) : organizations && organizations.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Award className="h-5 w-5 mr-2" />
                Associated Diving Organizations
              </h3>
              <div className="flex flex-wrap gap-2">
                {organizations.filter(org => org && org.diving_organization).map((org) => (
                  <div
                    key={org.id}
                    className={`flex items-center px-3 py-2 rounded-lg border ${
                      org.is_primary
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">
                      {org.diving_organization?.acronym || 'Unknown Organization'}
                    </span>
                    {org.is_primary && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating Section */}
          {user && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate this diving center</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Your rating:</span>
                {renderStars(rating, true)}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Comments</h2>
          
          {/* Add Comment Form */}
          {user && (
            <form onSubmit={handleSubmitComment} className="mb-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add a comment
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Share your experience with this diving center..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={createCommentMutation.isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createCommentMutation.isLoading ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          )}

          {/* Comments List */}
          {commentsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : comments?.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Link 
                          to={`/user/${comment.username}`}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {comment.username}
                        </Link>
                        {(comment.user_diving_certification || comment.user_number_of_dives) && (
                          <div className="flex items-center space-x-2 text-xs">
                            {comment.user_diving_certification && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {comment.user_diving_certification}
                              </span>
                            )}
                            {comment.user_number_of_dives > 0 && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                {comment.user_number_of_dives} dives
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 ml-2">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {user && (user.id === comment.user_id || user.is_admin) && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditComment(comment)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {editingComment === comment.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                      <div className="mt-2 space-x-2">
                        <button
                          onClick={handleUpdateComment}
                          disabled={updateCommentMutation.isLoading}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updateCommentMutation.isLoading ? 'Updating...' : 'Update'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingComment(null);
                            setEditCommentText('');
                          }}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700">{comment.comment_text}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No comments yet. Be the first to share your experience!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DivingCenterDetail; 