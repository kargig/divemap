export const getDifficultyColor = difficulty => {
  switch (difficulty?.toLowerCase()) {
    case 'beginner':
      return 'bg-green-100 text-green-800';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800';
    case 'advanced':
      return 'bg-red-100 text-red-800';
    case 'expert':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const formatPrice = price => {
  if (!price) return 'Contact for pricing';
  return `$${price}`;
};

export const formatDate = dateString => {
  if (!dateString) return 'Date TBD';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
