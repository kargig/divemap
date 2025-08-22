import { Map, Star, Anchor, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import BackgroundLogo from '../components/BackgroundLogo';
import HeroSection from '../components/HeroSection';

// Custom hook for animated counters with configurable growth patterns
const useAnimatedCounter = (
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
      const interval = setInterval(() => {
        setCurrentValue(prev => {
          const increment =
            Math.floor(
              Math.random() * (growthConfig.maxIncrement - growthConfig.minIncrement + 1)
            ) + growthConfig.minIncrement;
          return prev + increment;
        });
      }, growthConfig.speed);

      return () => clearInterval(interval);
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
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
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

const Home = () => {
  // Fetch statistics
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery(['stats'], () => api.get('/api/v1/stats'), {
    select: response => response.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once
  });

  // Determine if backend is available
  const isBackendAvailable = !isError && !isLoading;

  // Animated counters with different growth patterns for each category
  const animatedDives = useAnimatedCounter(
    stats?.dives || 0,
    2000,
    isBackendAvailable,
    { speed: 150, minIncrement: 2, maxIncrement: 8 } // Fast growth, medium increments
  );

  const animatedDiveSites = useAnimatedCounter(
    stats?.dive_sites || 0,
    2200,
    isBackendAvailable,
    { speed: 300, minIncrement: 1, maxIncrement: 4 } // Slower growth, smaller increments
  );

  const animatedReviews = useAnimatedCounter(
    stats?.reviews || 0,
    2400,
    isBackendAvailable,
    { speed: 180, minIncrement: 1, maxIncrement: 6 } // Medium-fast growth, variable increments
  );

  const animatedDivingCenters = useAnimatedCounter(
    stats?.diving_centers || 0,
    2600,
    isBackendAvailable,
    { speed: 400, minIncrement: 1, maxIncrement: 3 } // Slowest growth, smallest increments
  );

  return (
    <div className='max-w-6xl mx-auto relative'>
      {/* Background Logo Watermark */}
      <BackgroundLogo opacity={0.02} size='xlarge' />

      {/* Hero Section */}
      <HeroSection
        title='Discover Amazing Dive Sites'
        subtitle="Explore the world's best scuba diving locations, read reviews from fellow divers, and find diving centers for your next underwater adventure."
        background='ocean'
        size='large'
        showLogo={false}
        logoBackground={true}
        threeColumnLayout={true}
      >
        <Link
          to='/dive-sites'
          className='px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-base sm:text-lg font-semibold'
        >
          Explore Dive Sites
        </Link>
        <Link
          to='/dives'
          className='px-6 sm:px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-base sm:text-lg font-semibold'
        >
          Browse Dives
        </Link>
        <Link
          to='/register'
          className='px-6 sm:px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-base sm:text-lg font-semibold'
        >
          Join the Community
        </Link>
      </HeroSection>

      {/* Features Section */}
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 py-8 sm:py-12 px-4'>
        <div className='text-center p-4 sm:p-6 bg-white rounded-lg shadow-md'>
          <Map className='h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto mb-3 sm:mb-4' />
          <h3 className='text-lg sm:text-xl font-semibold mb-2'>Discover Sites</h3>
          <p className='text-sm sm:text-base text-gray-600'>
            Browse through our comprehensive database of dive sites with detailed information,
            difficulty levels, and access instructions.
          </p>
        </div>

        <div className='text-center p-4 sm:p-6 bg-white rounded-lg shadow-md'>
          <BookOpen className='h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto mb-3 sm:mb-4' />
          <h3 className='text-lg sm:text-xl font-semibold mb-2'>Log Your Dives</h3>
          <p className='text-sm sm:text-base text-gray-600'>
            Record your diving experiences, track your progress, and share your adventures with the
            diving community.
          </p>
        </div>

        <div className='text-center p-4 sm:p-6 bg-white rounded-lg shadow-md'>
          <Star className='h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto mb-3 sm:mb-4' />
          <h3 className='text-lg sm:text-xl font-semibold mb-2'>Rate & Review</h3>
          <p className='text-sm sm:text-base text-gray-600'>
            Share your experiences by rating dive sites and leaving detailed reviews to help other
            divers make informed decisions.
          </p>
        </div>

        <div className='text-center p-4 sm:p-6 bg-white rounded-lg shadow-md'>
          <Anchor className='h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto mb-3 sm:mb-4' />
          <h3 className='text-lg sm:text-xl font-semibold mb-2'>Find Centers</h3>
          <p className='text-sm sm:text-base text-gray-600'>
            Connect with professional diving centers, view their services, and get in touch for your
            next diving adventure.
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className='bg-blue-600 text-white py-12 rounded-lg mb-12'>
        <div className='grid md:grid-cols-4 gap-8 text-center'>
          <Link to='/dives' className='hover:bg-blue-700 p-4 rounded-lg transition-colors'>
            <div className='text-3xl font-bold mb-2'>
              {animatedDives.toLocaleString()}
              {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
            </div>
            <div className='text-blue-200'>Dives</div>
          </Link>
          <Link to='/dive-sites' className='hover:bg-blue-700 p-4 rounded-lg transition-colors'>
            <div className='text-3xl font-bold mb-2'>
              {animatedDiveSites.toLocaleString()}
              {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
            </div>
            <div className='text-blue-200'>Dive Sites</div>
          </Link>
          <div className='p-4'>
            <div className='text-3xl font-bold mb-2'>
              {animatedReviews.toLocaleString()}
              {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
            </div>
            <div className='text-blue-200'>Reviews</div>
          </div>
          <Link to='/diving-centers' className='hover:bg-blue-700 p-4 rounded-lg transition-colors'>
            <div className='text-3xl font-bold mb-2'>
              {animatedDivingCenters.toLocaleString()}
              {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
            </div>
            <div className='text-blue-200'>Diving Centers</div>
          </Link>
        </div>
        {!isBackendAvailable && (
          <div className='text-center mt-4'>
            <div className='text-blue-200 text-sm animate-pulse'>
              ✨ Live data loading... Our community is growing!
            </div>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className='text-center py-12'>
        <h2 className='text-3xl font-bold text-gray-900 mb-4'>
          Ready to Start Your Diving Journey?
        </h2>
        <p className='text-xl text-gray-600 mb-8'>
          Join our community of passionate divers and start exploring amazing underwater worlds.
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Link
            to='/register'
            className='px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold'
          >
            Get Started
          </Link>
          <Link
            to='/dive-sites'
            className='px-8 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold'
          >
            Browse Sites
          </Link>
          <Link
            to='/dives'
            className='px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold'
          >
            Browse Dives
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
