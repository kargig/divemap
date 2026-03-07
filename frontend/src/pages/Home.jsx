import { Grid, Button, Typography, Space } from 'antd';
import { Grid as MobileGrid } from 'antd-mobile';
import { Map, Star, Anchor, BookOpen, Calendar, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api from '../api';
import AnimatedCounter from '../components/AnimatedCounter';
import BackgroundLogo from '../components/BackgroundLogo';
import HeroSection from '../components/HeroSection';
import SEO from '../components/SEO';

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
      icon: BookOpen,
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
      link: null, // No link for this one in original code
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
      <div className='flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-10 px-4'>
        <Link to='/map' className='w-full sm:w-auto'>
          <Button
            type='primary'
            size='large'
            icon={<Map className='h-5 w-5' />}
            className='w-full h-12 md:h-14 px-8 md:px-10 text-base md:text-lg font-bold rounded-xl shadow-lg flex items-center justify-center'
          >
            Explore Map
          </Button>
        </Link>

        <Link to='/dive-trips' className='w-full sm:w-auto'>
          <Button
            size='large'
            icon={<Calendar className='h-5 w-5' />}
            className='w-full h-12 md:h-14 px-8 md:px-10 text-base md:text-lg font-bold rounded-xl shadow-md flex items-center justify-center border-blue-100 hover:border-blue-600'
          >
            Browse Dive Trips
          </Button>
        </Link>

        <Link to='/help' className='w-full sm:w-auto'>
          <Button
            size='large'
            icon={<HelpCircle className='h-5 w-5' />}
            className='w-full h-12 md:h-14 px-8 md:px-10 text-base md:text-lg font-bold rounded-xl shadow-md flex items-center justify-center border-gray-200 hover:border-gray-400'
          >
            Getting Started
          </Button>
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
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 pb-12 pt-2 px-4'>
          {features.map((feature, index) => {
            const content = (
              <>
                <div
                  className={`${feature.bgColor} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${feature.hoverBg} transition-colors`}
                >
                  <feature.icon
                    className={`h-8 w-8 ${feature.iconColor} group-hover:text-white transition-colors`}
                  />
                </div>
                <h2 className='text-xl font-bold text-gray-900 mb-3'>{feature.title}</h2>
                <p className='text-gray-500 leading-relaxed'>{feature.description}</p>
              </>
            );

            const className =
              'group relative p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block h-full';

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
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
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
            <div className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
                <AnimatedCounter
                  targetValue={stats?.reviews || 0}
                  duration={2400}
                  isBackendAvailable={isBackendAvailable}
                  growthConfig={{ speed: 180, minIncrement: 1, maxIncrement: 6 }}
                  suffix={!isBackendAvailable ? '+' : ''}
                />
              </div>
              <div className='text-gray-400 font-medium uppercase tracking-wider text-xs'>
                Reviews
              </div>
            </div>
            <Link to='/diving-centers' className='text-center group'>
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
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
              <div className='text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors'>
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
          <Link to='/register'>
            <Button
              type='primary'
              size='large'
              className='h-14 px-10 text-lg font-bold rounded-xl shadow-lg'
            >
              Get Started Free
            </Button>
          </Link>
          <Link to='/dive-sites'>
            <Button
              size='large'
              className='h-14 px-10 text-lg font-bold rounded-xl border-2 border-blue-600 text-blue-600 hover:text-blue-700'
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
