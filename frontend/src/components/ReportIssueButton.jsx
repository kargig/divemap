import { Bug } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const ReportIssueButton = () => {
  const location = useLocation();
  const [currentUrl, setCurrentUrl] = useState('');
  const [isInactive, setIsInactive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragJustFinishedRef = useRef(false);
  const buttonRef = useRef(null);

  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('divemap_bug_report_pos');
    // Default to bottom left
    const defaultPos = { x: 16, y: window.innerHeight - 80, side: 'left' };
    if (!saved) return defaultPos;
    try {
      const parsed = JSON.parse(saved);
      // Basic bounds check for window resize between sessions
      if (parsed.y > window.innerHeight) parsed.y = window.innerHeight - 80;
      if (parsed.y < 0) parsed.y = 80;
      return parsed;
    } catch (e) {
      return defaultPos;
    }
  });

  // Handle inactivity timeout to trigger "edge peek"
  useEffect(() => {
    if (isDragging) {
      setIsInactive(false);
      return;
    }

    let timeout;
    const resetTimer = () => {
      setIsInactive(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsInactive(true), 3000);
    };

    window.addEventListener('scroll', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('mousemove', resetTimer, { passive: true });

    resetTimer();

    return () => {
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      clearTimeout(timeout);
    };
  }, [isDragging]);

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, [location]);

  const handlePointerDown = e => {
    // Only handle primary button (left click) or touches
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...position };
    let hasMoved = false;

    const handlePointerMove = moveEvent => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
        setIsDragging(true);
      }

      if (hasMoved) {
        // Use absolute X for the dragging state
        const currentX = moveEvent.clientX - 20; // approximate center offset
        const currentY = moveEvent.clientY - 20;

        setPosition({
          x: currentX,
          y: currentY,
          side: 'moving',
        });
      }
    };

    const handlePointerUp = upEvent => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      if (hasMoved) {
        setIsDragging(false);
        dragJustFinishedRef.current = true;
        setTimeout(() => {
          dragJustFinishedRef.current = false;
        }, 100);

        const screenWidth = window.innerWidth;
        const margin = 16;
        const isRightSide = upEvent.clientX > screenWidth / 2;

        const finalPos = {
          x: isRightSide ? margin : margin, // We'll use absolute CSS positioning
          y: Math.max(margin, Math.min(upEvent.clientY - 20, window.innerHeight - 60)),
          side: isRightSide ? 'right' : 'left',
        };

        setPosition(finalPos);
        localStorage.setItem('divemap_bug_report_pos', JSON.stringify(finalPos));
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const issueUrl = `https://github.com/kargig/divemap/issues/new?body=Issue reported from page: ${encodeURIComponent(currentUrl)}`;

  // Translation direction depends on which side we are snapped to
  const getTranslation = () => {
    if (!isInactive || isDragging) return 'translate-x-0 opacity-100';
    return position.side === 'left'
      ? '-translate-x-12 opacity-40 hover:translate-x-0 hover:opacity-100'
      : 'translate-x-12 opacity-40 hover:translate-x-0 hover:opacity-100';
  };

  return (
    <a
      ref={buttonRef}
      href={isDragging ? '#' : issueUrl}
      target={isDragging ? '_self' : '_blank'}
      rel='noopener noreferrer'
      onPointerDown={handlePointerDown}
      onClick={e => {
        if (isDragging || dragJustFinishedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`fixed p-2 bg-gray-100 text-gray-600 rounded-full shadow-sm z-50 border border-gray-200
        transition-all duration-300 ease-in-out hover:opacity-100 hover:bg-white hover:text-black hover:shadow-md
        ${isDragging ? 'cursor-grabbing scale-110 shadow-lg z-[100] transition-none' : 'cursor-grab'}
        ${getTranslation()}
      `}
      style={{
        left: position.side === 'right' ? 'auto' : `${position.x}px`,
        right: position.side === 'right' ? `${position.x}px` : 'auto',
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      title='Report an issue (Drag to move)'
      aria-label='Report an issue'
    >
      <Bug size={20} />
    </a>
  );
};

export default ReportIssueButton;
