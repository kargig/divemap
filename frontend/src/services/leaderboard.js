import api from '../api';

/**
 * Fetch the overall user leaderboard based on unified points system.
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max number of entries (default 10, max 100)
 * @returns {Promise<Object>} Leaderboard data
 */
export const getOverallLeaderboard = async (params = {}) => {
  const response = await api.get('/api/v1/leaderboard/users/overall', { params });
  return response.data;
};

/**
 * Fetch a specific category leaderboard for users.
 * @param {string} metric - The category (dives, sites, edits, reviews, comments)
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max number of entries
 * @returns {Promise<Object>} Leaderboard data
 */
export const getCategoryLeaderboard = async (metric, params = {}) => {
  const response = await api.get(`/api/v1/leaderboard/users/category/${metric}`, { params });
  return response.data;
};

/**
 * Fetch the diving center leaderboard based on organized trips.
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max number of entries
 * @returns {Promise<Object>} Leaderboard data
 */
export const getCenterLeaderboard = async (params = {}) => {
  const response = await api.get('/api/v1/leaderboard/centers', { params });
  return response.data;
};
