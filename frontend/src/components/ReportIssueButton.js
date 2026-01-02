import { Bug } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ReportIssueButton = () => {
  const location = useLocation();
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Update URL when location changes
    setCurrentUrl(window.location.href);
  }, [location]);

  const issueUrl = `https://github.com/kargig/divemap/issues/new?body=Issue reported from page: ${encodeURIComponent(currentUrl)}`;

  return (
    <a
      href={issueUrl}
      target='_blank'
      rel='noopener noreferrer'
      className='fixed bottom-4 right-4 p-2 bg-gray-100 text-gray-600 rounded-full shadow-sm
                 opacity-40 hover:opacity-100 hover:bg-white hover:text-black hover:shadow-md
                 transition-all duration-300 z-50 border border-gray-200'
      title='Report an issue'
      aria-label='Report an issue'
    >
      <Bug size={20} />
    </a>
  );
};

export default ReportIssueButton;
