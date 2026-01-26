import { useState, useEffect } from 'react';

// Custom hook for animated counters with configurable growth patterns
export const useAnimatedCounter = (
  targetValue,
  duration = 2000,
  isBackendAvailable = true,
  growthConfig = { speed: 200, minIncrement: 1, maxIncrement: 5 }
) => {
  const [currentValue, setCurrentValue] = useState(0);
  const [hasBackendDataArrived, setHasBackendDataArrived] = useState(false);

  useEffect(() => {
    if (!isBackendAvailable && !hasBackendDataArrived) {
      // If backend is not available, show animated increasing numbers with custom growth pattern
      const interval = window.setInterval(() => {
        setCurrentValue(prev => {
          const increment =
            Math.floor(
              Math.random() * (growthConfig.maxIncrement - growthConfig.minIncrement + 1)
            ) + growthConfig.minIncrement;
          return prev + increment;
        });
      }, growthConfig.speed);

      return () => window.clearInterval(interval);
    } else if (isBackendAvailable && targetValue !== undefined) {
      // Backend data has arrived - transition from current animated value to actual value
      setHasBackendDataArrived(true);

      const startValue = currentValue; // Start from current animated value
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(startValue + (targetValue - startValue) * easeOutQuart);

        setCurrentValue(current);

        if (progress < 1) {
          window.requestAnimationFrame(animate);
        }
      };

      window.requestAnimationFrame(animate);
    }
  }, [
    targetValue,
    duration,
    isBackendAvailable,
    hasBackendDataArrived,
    growthConfig.speed,
    growthConfig.minIncrement,
    growthConfig.maxIncrement,
  ]);

  return currentValue;
};

const AnimatedCounter = ({
  targetValue,
  duration = 2000,
  isBackendAvailable = true,
  growthConfig = { speed: 200, minIncrement: 1, maxIncrement: 5 },
  suffix = '',
  className = '',
}) => {
  const value = useAnimatedCounter(targetValue, duration, isBackendAvailable, growthConfig);

  return (
    <span className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
};

export default AnimatedCounter;
