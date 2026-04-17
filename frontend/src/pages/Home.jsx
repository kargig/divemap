import { Grid, Button, Typography, Space } from 'antd';
import { Grid as MobileGrid } from 'antd-mobile';
import {
  Map,
  Star,
  Anchor,
  Notebook,
  Calendar,
  HelpCircle,
  Trophy,
  Medal,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import AnimatedCounter from '../components/AnimatedCounter';
import Avatar from '../components/Avatar';
import BackgroundLogo from '../components/BackgroundLogo';
import HeroSection from '../components/HeroSection';
import LoadingSkeleton from '../components/LoadingSkeleton';
import SEO from '../components/SEO';
import { getOverallLeaderboard } from '../services/leaderboard';

const { useBreakpoint } = Grid;
const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const screens = useBreakpoint();

  const features = [
    {
      title: 'Discover Sites',
      description:
        'Browse our comprehensive database of dive sites with detailed information, difficulty levels, and access.',
      shortDescription: 'Browse our global database of dive sites.',
      icon: Map,
      link: '/dive-sites',
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverBg: 'group-hover:bg-blue-600',
    },
    {
      title: 'Log Your Dives',
      description:
        'Record your diving experiences, track your progress, and share your adventures with the community.',
      shortDescription: 'Record dives, track progress, and share.',
      icon: Notebook,
      link: '/dives',
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      hoverBg: 'group-hover:bg-green-600',
    },
    {
      title: 'Rate & Review',
      description:
        'Share your experiences by rating dive sites and leaving detailed reviews to help other divers.',
      shortDescription: 'Rate sites and leave reviews to help others.',
      icon: Star,
      link: '/dive-sites?sort_by=average_rating&sort_order=desc',
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      hoverBg: 'group-hover:bg-yellow-500',
    },
    {
      title: 'Find Centers',
      description:
        'Connect with professional diving centers, view their services, and plan your next underwater trip.',
      shortDescription: 'Find professional centers and plan trips.',
      icon: Anchor,
      link: '/diving-centers',
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      hoverBg: 'group-hover:bg-purple-600',
    },
  ];

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

  const { data: overallData, isLoading: isLeaderboardLoading } = useQuery(
    ['leaderboard', 'overall'],
    () => getOverallLeaderboard({ limit: 3 }),
    {
      enabled: isBackendAvailable,
      staleTime: 5 * 60 * 1000,
    }
  );

  const LeaderboardSnippet = () => {
    if (isLeaderboardLoading) {
      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          <LoadingSkeleton
            type='user'
            count={3}
            className='grid grid-cols-1 sm:grid-cols-3 gap-6 space-y-0'
          />
        </div>
      );
    }

    const topThree = overallData?.entries || [];

    if (topThree.length === 0) return null;

    return (
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
        {topThree.map((user, index) => (
          <Link
            key={user.user_id}
            to={`/users/${user.username}`}
            className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group flex items-center space-x-4'
          >
            <div className='relative'>
              <Avatar
                src={user.avatar_url}
                alt={user.username}
                size='lg'
                fallbackText={user.username}
                className={index === 0 ? 'border-2 border-yellow-400' : ''}
              />
              <div
                className={`absolute -top-2 -right-2 rounded-full p-1 shadow-sm ${
                  index === 0
                    ? 'bg-yellow-400 text-white'
                    : index === 1
                      ? 'bg-gray-300 text-gray-700'
                      : 'bg-amber-600 text-white'
                }`}
              >
                {index === 0 ? <Trophy className='w-3 h-3' /> : <Medal className='w-3 h-3' />}
              </div>
            </div>
            <div>
              <p className='font-bold text-gray-900 group-hover:text-blue-600 transition-colors'>
                {user.username}
              </p>
              <p className='text-xs font-medium text-blue-600 uppercase tracking-wider'>
                {user.points.toLocaleString()} Points
              </p>
            </div>
          </Link>
        ))}
      </div>
    );
  };

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

      <div
        className='block md:hidden w-full mb-8 rounded-2xl overflow-hidden shadow-lg text-white p-8 text-center'
        style={{
          background: 'linear-gradient(135deg, #0072B2 0%, #004d7a 100%)',
        }}
      >
        <h1 className='text-3xl font-extrabold tracking-tight mb-4'>
          Discover Amazing <span style={{ color: '#80c9ed' }}>Dive Sites</span>
        </h1>

        <p className='text-lg leading-relaxed' style={{ color: '#eaf4f9' }}>
          Explore the world's best scuba locations, read reviews from fellow divers, and find your
          next underwater adventure.
        </p>
      </div>

      {/* Visual Banner - Contained and Compact with Overlaid Headline - Visible only on Desktop */}

      <div className='hidden md:block isolate w-full mb-6 shadow-sm bg-[#cee5f4] rounded-2xl overflow-hidden border border-[#c2d9ea] relative'>
        <div
          className='pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[clamp(3.25rem,12vmin,6rem)] overflow-hidden'
          aria-hidden
        >
          <div className='absolute inset-0 bg-gradient-to-t from-[#64939e] from-0% via-[#7baab5]/80 via-45% to-transparent to-100%' />
          <div className='absolute -bottom-[46%] left-1/2 h-[89%] w-[min(185%,78rem)] max-w-none -translate-x-1/2 rounded-[100%] bg-[#4d828c]/90' />
          <div className='absolute -bottom-[47%] left-1/2 z-[1] h-[58%] w-[min(200%,88rem)] max-w-none -translate-x-1/2 rounded-[100%] bg-[#7bb0b9]' />
        </div>
        <img
          src='/divemap_logo_domain_top5_extend.png'
          alt='Divemap Banner'
          className='relative z-[1] w-full h-auto object-contain max-h-[300px] mx-auto'
        />

        {/* Overlaid Headline on top part - Hidden on Mobile */}

        <div className='hidden md:block absolute top-0 left-0 right-0 z-[2] pt-4 md:pt-6 px-4 text-center pointer-events-none'>
          <h1 className='text-3xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm'>
            Discover Amazing <span className='text-blue-600'>Dive Sites</span>
          </h1>
        </div>
      </div>

      {/* Hero CTA Buttons Below Banner */}
      <div className='flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-6 px-4'>
        <Link to='/map' className='w-full sm:w-auto'>
          <Button
            type='primary'
            size='large'
            icon={<Map className='h-5 w-5' />}
            className='w-full h-12 px-6 text-base md:text-lg font-bold rounded-xl shadow-lg flex items-center justify-center'
          >
            Explore Map
          </Button>
        </Link>

        <Link to='/dive-trips' className='w-full sm:w-auto'>
          <Button
            size='large'
            icon={<Calendar className='h-5 w-5' />}
            className='w-full h-12 px-6 text-base md:text-lg font-bold rounded-xl shadow-md flex items-center justify-center border-blue-100 hover:border-blue-600'
          >
            Browse Dive Trips
          </Button>
        </Link>

        <Link to='/help' className='w-full sm:w-auto'>
          <Button
            size='large'
            icon={<HelpCircle className='h-5 w-5' />}
            className='w-full h-12 px-6 text-base md:text-lg font-bold rounded-xl shadow-md flex items-center justify-center border-gray-200 hover:border-gray-400'
          >
            Getting Started
          </Button>
        </Link>
      </div>

      {/* Hero Content - Subtitle Below CTAs - Visible only on Desktop */}

      <div className='hidden md:block w-full text-center mb-6 px-4'>
        <p className='text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed max-w-none inline-block lg:whitespace-nowrap'>
          Explore the world's best scuba locations, read reviews from fellow divers, and find your
          next underwater adventure.
        </p>
      </div>
      {/* Features Grid */}
      {screens.xs ? (
        <div className='px-4 pb-8'>
          <MobileGrid columns={2} gap={8}>
            {features.map((feature, index) => {
              const Content = (
                <div className='bg-white p-3 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col items-center text-center'>
                  <div
                    className={`${feature.bgColor} w-10 h-10 rounded-lg flex items-center justify-center mb-2`}
                  >
                    <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>
                  <h3 className='text-sm font-bold text-gray-900 mb-1 leading-tight'>
                    {feature.title}
                  </h3>
                  <p className='text-xs text-gray-500 leading-snug'>{feature.shortDescription}</p>
                </div>
              );

              return (
                <MobileGrid.Item key={index}>
                  {feature.link ? (
                    <Link to={feature.link} className='block h-full'>
                      {Content}
                    </Link>
                  ) : (
                    <div className='h-full'>{Content}</div>
                  )}
                </MobileGrid.Item>
              );
            })}
          </MobileGrid>
        </div>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 pb-8 pt-2 px-4'>
          {features.map((feature, index) => {
            const content = (
              <>
                <div
                  className={`${feature.bgColor} w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.hoverBg} transition-colors`}
                >
                  <feature.icon
                    className={`h-6 w-6 ${feature.iconColor} group-hover:text-white transition-colors`}
                  />
                </div>
                <h2 className='text-lg font-bold text-gray-900 mb-2'>{feature.title}</h2>
                <p className='text-sm text-gray-500 leading-relaxed'>{feature.description}</p>
              </>
            );

            const className =
              'group relative p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block h-full';

            return feature.link ? (
              <Link to={feature.link} className={className} key={index}>
                {content}
              </Link>
            ) : (
              <div className={className} key={index}>
                {content}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Section (Integrated) */}
      <div
        className='relative overflow-hidden rounded-3xl py-10 mb-10 shadow-2xl'
        style={{
          background: 'linear-gradient(135deg, #003656 0%, #001a2a 100%)',
        }}
      >
        <div className='absolute inset-0 opacity-10 bg-[url("https://www.transparenttextures.com/patterns/cubes.png")]'></div>
        <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-8'>
            <h3
              className='text-sm font-bold uppercase tracking-widest mb-2'
              style={{ color: '#56B4E9' }}
            >
              Our Growing Community
            </h3>
            <p className='text-2xl font-bold text-white'>Real-time Dive Statistics</p>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-5 gap-6'>
            <Link to='/dives' className='text-center group'>
              <div className='text-3xl sm:text-4xl font-extrabold text-white mb-1 transition-colors group-hover:text-[#56B4E9]'>
                <AnimatedCounter
                  targetValue={stats?.dives || 0}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 150, minIncrement: 2, maxIncrement: 8 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Dives Logged
              </div>
            </Link>
            <Link to='/dive-sites' className='text-center group'>
              <div className='text-3xl sm:text-4xl font-extrabold text-white mb-1 transition-colors group-hover:text-[#56B4E9]'>
                <AnimatedCounter
                  targetValue={stats?.dive_sites || 0}
                  duration={2200}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 300, minIncrement: 1, maxIncrement: 4 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Dive Sites
              </div>
            </Link>
            <Link
              to='/dive-sites?sort_by=average_rating&sort_order=desc'
              className='text-center group block'
            >
              <div className='text-3xl sm:text-4xl font-extrabold text-white mb-1 transition-colors group-hover:text-[#56B4E9]'>
                <AnimatedCounter
                  targetValue={stats?.reviews || 0}
                  duration={2400}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 180, minIncrement: 1, maxIncrement: 6 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs group-hover:text-gray-300 transition-colors'>
                Reviews
              </div>
            </Link>
            <Link to='/diving-centers' className='text-center group'>
              <div className='text-3xl sm:text-4xl font-extrabold text-white mb-1 transition-colors group-hover:text-[#56B4E9]'>
                <AnimatedCounter
                  targetValue={stats?.diving_centers || 0}
                  duration={2600}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 400, minIncrement: 1, maxIncrement: 3 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Centers
              </div>
            </Link>
            <Link to='/dive-trips' className='text-center group'>
              <div className='text-3xl sm:text-4xl font-extrabold text-white mb-1 transition-colors group-hover:text-[#56B4E9]'>
                <AnimatedCounter
                  targetValue={stats?.dive_trips || 0}
                  duration={2800}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 250, minIncrement: 1, maxIncrement: 4 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Organized Trips
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Contributors Snippet */}
      <section className='mb-16 px-4'>
        <div className='flex flex-col md:flex-row items-center justify-between mb-8 gap-4'>
          <div>
            <h3 className='text-sm font-bold uppercase tracking-widest text-blue-600 mb-1'>
              Community Leaders
            </h3>
            <h2 className='text-3xl font-bold text-gray-900'>Top Contributors</h2>
          </div>
          <Link
            to='/leaderboard'
            className='flex items-center text-blue-600 font-bold hover:text-blue-700 transition-colors group'
          >
            View Full Leaderboard
            <ChevronRight className='ml-1 w-5 h-5 group-hover:translate-x-1 transition-transform' />
          </Link>
        </div>

        <LeaderboardSnippet />
      </section>

      {/* Final CTA */}
      <div
        className='text-center py-20 rounded-3xl mb-12 px-6'
        style={{ backgroundColor: '#eaf4f9' }}
      >
        <h2 className='text-4xl font-extrabold text-gray-900 mb-6'>
          Ready to Start Your Diving Journey?
        </h2>
        <p className='text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed'>
          Join our global community of passionate divers. Discover hidden gems, log your adventures,
          and connect with dive centers worldwide.
        </p>
        <div className='flex flex-wrap gap-4 justify-center'>
          <Link to='/register'>
            <Button
              type='primary'
              size='large'
              className='h-14 px-10 text-lg font-bold rounded-xl shadow-lg'
              style={{ backgroundColor: '#0072B2' }}
            >
              Get Started Free
            </Button>
          </Link>
          <Link to='/dive-sites'>
            <Button
              size='large'
              className='h-14 px-10 text-lg font-bold rounded-xl border-2 hover:opacity-80 transition-all'
              style={{ borderColor: '#0072B2', color: '#0072B2' }}
            >
              Explore Sites
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
