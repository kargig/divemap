// Sort options configuration for different entity types
export const SORT_OPTIONS = {
  'dive-sites': [
    { value: 'name', label: 'Name', defaultOrder: 'asc' },
    { value: 'country', label: 'Country', defaultOrder: 'asc' },
    { value: 'region', label: 'Region', defaultOrder: 'asc' },
    { value: 'difficulty_level', label: 'Difficulty Level', defaultOrder: 'asc' },
    { value: 'created_at', label: 'Date Created', defaultOrder: 'desc' },
    { value: 'updated_at', label: 'Last Updated', defaultOrder: 'desc' },
  ],

  'diving-centers': [
    { value: 'name', label: 'Name', defaultOrder: 'asc' },
    { value: 'created_at', label: 'Date Created', defaultOrder: 'desc' },
    { value: 'updated_at', label: 'Last Updated', defaultOrder: 'desc' },
  ],

  dives: [
    { value: 'dive_date', label: 'Dive Date', defaultOrder: 'desc' },
    { value: 'max_depth', label: 'Maximum Depth', defaultOrder: 'desc' },
    { value: 'duration', label: 'Duration', defaultOrder: 'desc' },
    { value: 'difficulty_level', label: 'Difficulty Level', defaultOrder: 'asc' },
    { value: 'visibility_rating', label: 'Visibility Rating', defaultOrder: 'desc' },
    { value: 'user_rating', label: 'User Rating', defaultOrder: 'desc' },
    { value: 'created_at', label: 'Date Created', defaultOrder: 'desc' },
    { value: 'updated_at', label: 'Last Updated', defaultOrder: 'desc' },
  ],

  'dive-trips': [
    { value: 'trip_date', label: 'Trip Date', defaultOrder: 'desc' },
    { value: 'price', label: 'Price', defaultOrder: 'asc' },
    { value: 'duration', label: 'Duration', defaultOrder: 'asc' },
    { value: 'difficulty_level', label: 'Difficulty Level', defaultOrder: 'asc' },
    { value: 'distance', label: 'Distance', defaultOrder: 'asc' },
  ],
};

// Admin-only sort options that are added for admin users
export const ADMIN_SORT_OPTIONS = {
  'dive-sites': [
    { value: 'view_count', label: 'Popularity (Views)', defaultOrder: 'desc' },
    { value: 'comment_count', label: 'Comments', defaultOrder: 'desc' },
  ],

  'diving-centers': [
    { value: 'view_count', label: 'Popularity (Views)', defaultOrder: 'desc' },
    { value: 'comment_count', label: 'Comments', defaultOrder: 'desc' },
  ],

  dives: [{ value: 'view_count', label: 'Popularity (Views)', defaultOrder: 'desc' }],

  'dive-trips': [{ value: 'popularity', label: 'Popularity', defaultOrder: 'desc' }],
};

// Helper function to get sort options for a specific entity type
export const getSortOptions = (entityType, isAdmin = false) => {
  const baseOptions = SORT_OPTIONS[entityType] || SORT_OPTIONS['dive-sites'];

  if (isAdmin && ADMIN_SORT_OPTIONS[entityType]) {
    // Insert admin options at the beginning for better UX
    return [...ADMIN_SORT_OPTIONS[entityType], ...baseOptions];
  }

  return baseOptions;
};

// Helper function to get default sort for a specific entity type
export const getDefaultSort = entityType => {
  const options = getSortOptions(entityType);
  if (options.length > 0) {
    const firstOption = options[0];
    return {
      sortBy: firstOption.value,
      sortOrder: firstOption.defaultOrder || 'asc',
    };
  }
  return { sortBy: 'name', sortOrder: 'asc' };
};

// Helper function to validate sort parameters
export const validateSortParams = (sortBy, sortOrder, entityType) => {
  const options = getSortOptions(entityType);
  const validSortBy = options.some(opt => opt.value === sortBy);
  const validSortOrder = ['asc', 'desc'].includes(sortOrder);

  return {
    isValid: validSortBy && validSortOrder,
    errors: {
      sortBy: validSortBy
        ? null
        : `Invalid sort field. Must be one of: ${options.map(opt => opt.value).join(', ')}`,
      sortOrder: validSortOrder ? null : 'Sort order must be "asc" or "desc"',
    },
  };
};
