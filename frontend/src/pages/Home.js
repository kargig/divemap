import { Map, Star, Anchor, BookOpen, Calendar, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import BackgroundLogo from '../components/BackgroundLogo';
import HeroSection from '../components/HeroSection';
import SEO from '../components/SEO';

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

  const animatedDiveTrips = useAnimatedCounter(
    stats?.dive_trips || 0,
    2800,
    isBackendAvailable,
    { speed: 250, minIncrement: 1, maxIncrement: 4 } // Medium growth, small increments
  );

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Divemap',
    url: window.location.origin,
    description:
      'The ultimate scuba diving platform. Discover and rate dive sites, log your dives, plan trips, and share underwater routes.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${window.location.origin}/dive-sites?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 relative'>
      <SEO
        title='Divemap - Discover and Rate Scuba Dive Sites Worldwide'
        description='The ultimate scuba platform. Discover and rate dive sites, log your dives, plan trips, share underwater routes, find diving centers, see all of those on maps, use scuba calculators and connect with the global diving community.'
        type='website'
        schema={schema}
      />
      {/* Background Logo Watermark */}
      <BackgroundLogo opacity={0.02} size='xlarge' />

      {/* Mobile Hero with Gradient - Visible only on Mobile */}

      <div className='block md:hidden w-full mb-8 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 text-center'>
        <h1 className='text-3xl font-extrabold tracking-tight mb-4'>
          Discover Amazing <span className='text-blue-200'>Dive Sites</span>
        </h1>

        <p className='text-lg text-blue-100 leading-relaxed'>
          Explore the world's best scuba locations, read reviews from fellow divers, and find your
          next underwater adventure.
        </p>
      </div>

      {/* Visual Banner - Contained and Compact with Overlaid Headline - Visible only on Desktop */}

      <div className='hidden md:block w-full mb-10 shadow-sm bg-white rounded-2xl overflow-hidden border border-gray-100 relative'>
        <img
          src='/divemap_logo_domain_top5_extend.jpg'
          alt='Divemap Banner'
          className='w-full h-auto object-contain max-h-[400px] mx-auto'
        />

        {/* Overlaid Headline on top part - Hidden on Mobile */}

        <div className='hidden md:block absolute top-0 left-0 right-0 pt-6 md:pt-10 px-4 text-center pointer-events-none'>
          <h1 className='text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm'>
            Discover Amazing <span className='text-blue-600'>Dive Sites</span>
          </h1>
        </div>
      </div>

      {/* Hero CTA Buttons Below Banner */}

      <div className='flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 mb-10 px-4'>
        <Link
          to='/map'
          className='w-full sm:w-auto h-12 md:h-14 px-8 md:px-10 bg-blue-600 text-white hover:bg-blue-700 text-base md:text-lg font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-1'
        >
          <Map className='h-5 w-5 md:h-6 md:w-6' />
          Explore Map
        </Link>

        <Link
          to='/dive-trips'
          className='w-full sm:w-auto h-12 md:h-14 px-8 md:px-10 bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-600 hover:bg-blue-50 text-base md:text-lg font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:-translate-y-1'
        >
          <Calendar className='h-5 w-5 md:h-6 md:w-6' />
          Browse Dive Trips
        </Link>

        <Link
          to='/help'
          className='w-full sm:w-auto h-12 md:h-14 px-8 md:px-10 bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-base md:text-lg font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:-translate-y-1'
        >
          <HelpCircle className='h-5 w-5 md:h-6 md:w-6' />
          Getting Started
        </Link>
      </div>

      {/* Hero Content - Subtitle Below CTAs - Visible only on Desktop */}

      <div className='hidden md:block w-full text-center mb-6 px-4'>
        <p className='text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-none inline-block lg:whitespace-nowrap'>
          Explore the world's best scuba locations, read reviews from fellow divers, and find your
          next underwater adventure.
        </p>
      </div>
      {/* Features Grid */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 pb-12 pt-2 px-4'>
        <Link
          to='/dive-sites'
          className='group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
        >
          <div className='bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors'>
            <Map className='h-8 w-8 text-blue-600 group-hover:text-white transition-colors' />
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-3'>Discover Sites</h2>
          <p className='text-gray-500 leading-relaxed'>
            Browse our comprehensive database of dive sites with detailed information, difficulty
            levels, and access.
          </p>
        </Link>

        <Link
          to='/dives'
          className='group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
        >
          <div className='bg-green-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors'>
            <BookOpen className='h-8 w-8 text-green-600 group-hover:text-white transition-colors' />
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-3'>Log Your Dives</h2>
          <p className='text-gray-500 leading-relaxed'>
            Record your diving experiences, track your progress, and share your adventures with the
            community.
          </p>
        </Link>

        <div className='group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300'>
          <div className='bg-yellow-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500 transition-colors'>
            <Star className='h-8 w-8 text-yellow-600 group-hover:text-white transition-colors' />
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-3'>Rate & Review</h2>
          <p className='text-gray-500 leading-relaxed'>
            Share your experiences by rating dive sites and leaving detailed reviews to help other
            divers.
          </p>
        </div>

        <Link
          to='/diving-centers'
          className='group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300'
        >
          <div className='bg-purple-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors'>
            <Anchor className='h-8 w-8 text-purple-600 group-hover:text-white transition-colors' />
          </div>
          <h2 className='text-xl font-bold text-gray-900 mb-3'>Find Centers</h2>
          <p className='text-gray-500 leading-relaxed'>
            Connect with professional diving centers, view their services, and plan your next
            underwater trip.
          </p>
        </Link>
      </div>

      {/* Stats Section (Integrated) */}
      <div className='relative overflow-hidden bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl py-16 mb-16 shadow-2xl'>
        <div className='absolute inset-0 opacity-10 bg-[url("https://www.transparenttextures.com/patterns/cubes.png")]'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-12'>
            <h3 className='text-sm font-bold uppercase tracking-widest text-blue-400 mb-3'>
              Our Growing Community
            </h3>
            <p className='text-3xl font-bold text-white'>Real-time Dive Statistics</p>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-5 gap-8'>
            <Link to='/dives' className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                {animatedDives.toLocaleString()}
                {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Dives Logged
              </div>
            </Link>
            <Link to='/dive-sites' className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                {animatedDiveSites.toLocaleString()}
                {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Dive Sites
              </div>
            </Link>
            <div className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                {animatedReviews.toLocaleString()}
                {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Reviews
              </div>
            </div>
            <Link to='/diving-centers' className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                {animatedDivingCenters.toLocaleString()}
                {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Centers
              </div>
            </Link>
            <Link to='/dive-trips' className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                {animatedDiveTrips.toLocaleString()}
                {!isBackendAvailable && <span className='text-2xl ml-1'>+</span>}
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Organized Trips
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className='text-center py-20 bg-blue-50 rounded-3xl mb-12 px-6'>
        <h2 className='text-4xl font-extrabold text-gray-900 mb-6'>
          Ready to Start Your Diving Journey?
        </h2>
        <p className='text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed'>
          Join our global community of passionate divers. Discover hidden gems, log your adventures,
          and connect with dive centers worldwide.
        </p>
        <div className='flex flex-wrap gap-4 justify-center'>
          <Link
            to='/register'
            className='px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 text-lg font-bold shadow-lg hover:shadow-blue-500/25 active:scale-95'
          >
            Get Started Free
          </Link>
          <Link
            to='/dive-sites'
            className='px-10 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-xl hover:bg-blue-50 transition-all duration-200 text-lg font-bold active:scale-95'
          >
            Explore Sites
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
