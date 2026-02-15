import { ThumbsUp, ThumbsDown } from 'lucide-react';
import React, { useState } from 'react';

const FeedbackButtons = ({ messageId, onFeedback, currentRating }) => {
  const [rating, setRating] = useState(currentRating);

  const handleFeedback = newRating => {
    if (rating === newRating) return; // Prevent duplicate clicks
    setRating(newRating);
    onFeedback(messageId, newRating);
  };

  return (
    <div className='flex space-x-2 text-gray-400'>
      <button
        onClick={() => handleFeedback(true)}
        className={`p-1 hover:text-green-500 transition-colors ${rating === true ? 'text-green-500' : ''}`}
        aria-label='Helpful'
      >
        <ThumbsUp size={14} />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        className={`p-1 hover:text-red-500 transition-colors ${rating === false ? 'text-red-500' : ''}`}
        aria-label='Not Helpful'
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
};

export default FeedbackButtons;
