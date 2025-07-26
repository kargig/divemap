import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Star, MapPin, Phone, Mail, Globe, Calendar, DollarSign, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const DivingCenterDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
      select: (response) => response.data
    }
  );

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery(
    ['diving-center-comments', id],
    () => api.get(`/api/v1/diving-centers/${id}/comments`),
    {
      select: (response) => response.data
    }
  );

  // Rating mutation
  const rateMutation = useMutation(
    ({ score }) => api.post(`/api/v1/diving-centers/${id}/rate`, { score }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['diving-center', id]);
        toast.success('Rating submitted successfully!');
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
    if (!user) {
      toast.error('Please log in to rate this diving center');
      return;
    }
    rateMutation.mutate({ score });
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment.id);
    setEditCommentText(comment.comment_text);
  };

  const handleUpdateComment = () => {
    if (!editCommentText.trim()) return;
    updateCommentMutation.mutate({ commentId: editingComment, commentText: editCommentText });
  };

  const handleDeleteComment = (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const renderStars = (rating, interactive = false) => {
    const stars = [];
    for (let i = 1; i <= 10; i++) {
      const isFilled = i <= rating;
      stars.push(
        <Star
          key={i}
          className={`h-5 w-5 ${
            isFilled ? 'text-yellow-400 fill-current' : 'text-gray-300'
          } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
          onClick={() => interactive && handleRating(i)}
        />
      );
    }
    return stars;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading diving center: {error.message}</p>
      </div>
    );
  }

  if (!center) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Diving center not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{center.name}</h1>
            {center.description && (
              <p className="text-gray-600 text-lg">{center.description}</p>
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
            {center.average_rating && (
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
          {center.email && (
            <div className="flex items-center text-gray-600">
              <Mail className="h-5 w-5 mr-3" />
              <a href={`mailto:${center.email}`} className="hover:text-blue-600">
                {center.email}
              </a>
            </div>
          )}
          {center.phone && (
            <div className="flex items-center text-gray-600">
              <Phone className="h-5 w-5 mr-3" />
              <a href={`tel:${center.phone}`} className="hover:text-blue-600">
                {center.phone}
              </a>
            </div>
          )}
          {center.website && (
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
          {center.latitude && center.longitude && (
            <div className="flex items-center text-gray-600">
              <MapPin className="h-5 w-5 mr-3" />
              <span>{center.latitude !== undefined && !isNaN(Number(center.latitude)) ? Number(center.latitude).toFixed(5) : 'N/A'}, {center.longitude !== undefined && !isNaN(Number(center.longitude)) ? Number(center.longitude).toFixed(5) : 'N/A'}</span>
            </div>
          )}
        </div>

        {/* Rating Section */}
        {user && (
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate this diving center</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Your rating:</span>
              {renderStars(0, true)}
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
                    <span className="font-semibold text-gray-900">{comment.user.username}</span>
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
  );
};

export default DivingCenterDetail; 