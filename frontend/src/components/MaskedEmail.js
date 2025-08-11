import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

const MaskedEmail = ({ email, className = '', showMailto = true }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState(null);

  const maskEmail = email => {
    if (!email || !email.includes('@')) return email;

    const [localPart, domain] = email.split('@');

    if (localPart.length <= 2) {
      // If username is 2 characters or less, just show first character
      return `${localPart.charAt(0)}***@${domain}`;
    } else {
      // Show first and last character of username, mask the rest
      const firstChar = localPart.charAt(0);
      const lastChar = localPart.charAt(localPart.length - 1);
      const maskedPart = '*'.repeat(localPart.length - 2);
      return `${firstChar}${maskedPart}${lastChar}@${domain}`;
    }
  };

  const handleClick = () => {
    // Clear any existing timeout
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
    }

    setIsRevealed(true);

    // Auto-hide after 30 seconds
    const timeout = setTimeout(() => {
      setIsRevealed(false);
    }, 30000);

    setAutoHideTimeout(timeout);
  };

  const handleMouseLeave = () => {
    // Auto-hide when mouse leaves the element
    if (isRevealed) {
      const timeout = setTimeout(() => {
        setIsRevealed(false);
      }, 5000); // Hide after 5 seconds when mouse leaves

      setAutoHideTimeout(timeout);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
      }
    };
  }, [autoHideTimeout]);

  if (!email) return null;

  const displayEmail = isRevealed ? email : maskEmail(email);
  const tooltipText = isRevealed ? 'Email will auto-hide soon' : 'Click to reveal email';

  if (showMailto && isRevealed) {
    return (
      <a
        href={`mailto:${email}`}
        className={`hover:text-blue-600 ${className}`}
        title={tooltipText}
      >
        {displayEmail}
      </a>
    );
  }

  return (
    <span
      onClick={handleClick}
      onMouseLeave={handleMouseLeave}
      className={`cursor-pointer hover:text-blue-600 transition-colors ${className}`}
      title={tooltipText}
      role='button'
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {displayEmail}
    </span>
  );
};

MaskedEmail.propTypes = {
  email: PropTypes.string.isRequired,
  className: PropTypes.string,
  showMailto: PropTypes.bool,
};

MaskedEmail.defaultProps = {
  className: '',
  showMailto: true,
};

export default MaskedEmail;
