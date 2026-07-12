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
  Settings,
  Bell,
  Plus,
  MapPin,
  Compass,
  Award,
  Clock,
  Activity,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';

import api, { getRecentActivity } from '../api';
import AnimatedCounter from '../components/AnimatedCounter';
import Avatar from '../components/Avatar';
import BackgroundLogo from '../components/BackgroundLogo';
import ScubaTools from '../components/calculators/ScubaTools';
import GlobalSearchBar from '../components/GlobalSearchBar';
import HeroSection from '../components/HeroSection';
import LoadingSkeleton from '../components/LoadingSkeleton';
import SEO from '../components/SEO';
import DepthIcon from '../components/ui/DepthIcon';
import { useAuth } from '../contexts/AuthContext';
import { getDives } from '../services/dives';
import { getDiveSites, getDiveRoutes } from '../services/diveSites';
import { getManagedDivingCenters, getDivingCenters } from '../services/divingCenters';
import { getMonthlyLeaderboard, getCategoryLeaderboard } from '../services/leaderboard';
import { slugify } from '../utils/slugify';

const { useBreakpoint } = Grid;
const { Title, Paragraph, Text } = Typography;

const Home = () => {
  const screens = useBreakpoint();
  const { user } = useAuth();

  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = window.setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 3);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [isHovered]);

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

  const { data: recentActivity = [] } = useQuery(['recent-activity'], getRecentActivity, {
    refetchInterval: 30000, // Refresh activity feed every 30s
    staleTime: 20000,
  });

  // Determine if backend is available
  const isBackendAvailable = !isError && !isLoading;

  const { data: managedCenters = [] } = useQuery(
    ['my-managed-diving-centers', user?.id],
    getManagedDivingCenters,
    {
      enabled: !!user,
      staleTime: 10 * 60 * 1000,
    }
  );

  const primaryCenter = managedCenters[0];

  const activeWidgetIndex = (() => {
    const params = new URLSearchParams(window.location.search);
    const mockParam = params.get('mock_widget');
    if (mockParam !== null) {
      const parsed = parseInt(mockParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
        return parsed;
      }
    }
    return new Date().getDate() % 6;
  })();

  const widgetConfigs = [
    {
      id: 'leaderboard',
      category: 'Community Leaders',
      title: 'Top Contributors This Month',
      description:
        'Meet the members of our community who have contributed the most reviews, edits, and logs this month.',
      ctaText: 'View Full Leaderboard',
      ctaLink: '/leaderboard',
    },
    {
      id: 'sites',
      category: 'New Horizons',
      title: 'Recently Added Dive Sites',
      description:
        'Explore the latest dive sites mapped and discovered by our global diving community.',
      ctaText: 'Explore All Sites',
      ctaLink: '/dive-sites',
    },
    {
      id: 'dives',
      category: 'Recent Adventures',
      title: 'Recent Dive Logs',
      description: 'Check out the latest underwater logs and experiences shared by fellow divers.',
      ctaText: 'View Public Logbook',
      ctaLink: '/dives',
    },
    {
      id: 'routes',
      category: 'Newly Mapped Routes',
      title: 'Recently Added Dive Routes',
      description:
        'Follow the exact underwater tracks and coordinate routes mapped by our community.',
      ctaText: 'Browse Dive Routes',
      ctaLink: '/dive-routes',
    },
    {
      id: 'centers',
      category: 'Verified Diving Centers',
      title: 'Recently Verified Diving Centers',
      description:
        'Discover professional dive operations that have recently verified their listings and claimed ownership.',
      ctaText: 'View All Centers',
      ctaLink: '/diving-centers',
    },
    {
      id: 'top_users',
      category: 'Prolific Divers',
      title: 'Top Divers by Logged Dives',
      description:
        'Celebrate our community members with the highest number of overall logged dives on Divemap.',
      ctaText: 'View Full Leaderboard',
      ctaLink: '/leaderboard',
    },
  ];

  const currentWidget = widgetConfigs[activeWidgetIndex];

  // 1. Leaderboard
  const { data: overallData, isLoading: isLeaderboardLoading } = useQuery(
    ['leaderboard', 'monthly-current'],
    () => {
      const now = new Date();
      return getMonthlyLeaderboard({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        limit: 3,
      });
    },
    {
      enabled: isBackendAvailable && activeWidgetIndex === 0,
      staleTime: 5 * 60 * 1000,
    }
  );

  // 2. Sites
  const { data: sitesData, isLoading: isSitesLoading } = useQuery(
    ['diveSites', 'recent-added-3'],
    () => getDiveSites({ sort_by: 'created_at', sort_order: 'desc', page_size: 3 }),
    {
      enabled: isBackendAvailable && activeWidgetIndex === 1,
      staleTime: 5 * 60 * 1000,
    }
  );

  // 3. Dives
  const { data: divesData, isLoading: isDivesLoading } = useQuery(
    ['dives', 'recent-logged-3'],
    () => getDives({ sort_by: 'created_at', sort_order: 'desc', page_size: 3 }),
    {
      enabled: isBackendAvailable && activeWidgetIndex === 2,
      staleTime: 5 * 60 * 1000,
    }
  );

  // 4. Routes
  const { data: routesData, isLoading: isRoutesLoading } = useQuery(
    ['diveRoutes', 'recent-routes-3'],
    () => getDiveRoutes({ sort_by: 'created_at', sort_order: 'desc', page_size: 3 }),
    {
      enabled: isBackendAvailable && activeWidgetIndex === 3,
      staleTime: 5 * 60 * 1000,
    }
  );

  // 5. Centers
  const { data: centersData, isLoading: isCentersLoading } = useQuery(
    ['divingCenters', 'recent-verified-3'],
    () =>
      getDivingCenters({
        only_claimed: true,
        sort_by: 'created_at',
        sort_order: 'desc',
        page_size: 3,
      }),
    {
      enabled: isBackendAvailable && activeWidgetIndex === 4,
      staleTime: 5 * 60 * 1000,
    }
  );

  // 6. Top Users
  const { data: topUsersData, isLoading: isTopUsersLoading } = useQuery(
    ['leaderboard', 'dives-leaderboard-3'],
    () => getCategoryLeaderboard('dives', { limit: 3 }),
    {
      enabled: isBackendAvailable && activeWidgetIndex === 5,
      staleTime: 5 * 60 * 1000,
    }
  );

  const DailyFeatureSnippet = () => {
    const isLoading =
      (activeWidgetIndex === 0 && isLeaderboardLoading) ||
      (activeWidgetIndex === 1 && isSitesLoading) ||
      (activeWidgetIndex === 2 && isDivesLoading) ||
      (activeWidgetIndex === 3 && isRoutesLoading) ||
      (activeWidgetIndex === 4 && isCentersLoading) ||
      (activeWidgetIndex === 5 && isTopUsersLoading);

    if (isLoading) {
      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          <LoadingSkeleton
            type={activeWidgetIndex === 0 || activeWidgetIndex === 5 ? 'user' : 'card'}
            count={3}
            className='grid grid-cols-1 sm:grid-cols-3 gap-6 space-y-0'
          />
        </div>
      );
    }

    if (!isBackendAvailable) return null;

    if (activeWidgetIndex === 0) {
      const topThree = overallData?.entries || [];
      if (topThree.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {topThree.map((user, index) => (
            <Link
              key={user.user_id}
              to={`/users/${user.username}`}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div className='relative shrink-0'>
                <Avatar
                  src={user.avatar_full_url || user.avatar_url}
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
              <div className='min-w-0 flex-1 text-left'>
                <p
                  className='font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate'
                  title={user.username}
                >
                  {user.username}
                </p>
                <p className='text-xs font-medium text-blue-600 uppercase tracking-wider truncate'>
                  {user.points.toLocaleString()} Points
                </p>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (activeWidgetIndex === 1) {
      const recentSites = sitesData?.items || [];
      if (recentSites.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {recentSites.map((site, index) => (
            <div
              key={site.id}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <Link
                to={`/dive-sites/${site.id}/${slugify(site.name)}`}
                className='shrink-0 w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors'
              >
                <MapPin className='w-6 h-6' />
              </Link>
              <div className='min-w-0 flex-1 text-left'>
                <Link
                  to={`/dive-sites/${site.id}/${slugify(site.name)}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate font-sans text-base'
                  title={site.name}
                >
                  {site.name}
                </Link>
                <p className='text-xs text-gray-500 truncate'>
                  {site.region && `${site.region}, `}
                  {site.country}
                  {site.created_by_username && (
                    <>
                      {' • by '}
                      <Link
                        to={`/users/${site.created_by_username}`}
                        className='font-semibold text-blue-600 hover:underline'
                      >
                        @{site.created_by_username}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeWidgetIndex === 2) {
      const recentDives = divesData?.items || [];
      if (recentDives.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {recentDives.map((dive, index) => (
            <div
              key={dive.id}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div className='shrink-0'>
                <Link to={`/users/${dive.user_username}`}>
                  <Avatar
                    src={dive.avatar_full_url || dive.avatar_url}
                    alt={dive.user_username}
                    size='lg'
                    fallbackText={dive.user_username}
                    className='hover:opacity-85 transition-opacity'
                  />
                </Link>
              </div>
              <div className='min-w-0 flex-1 text-left'>
                <Link
                  to={`/dives/${dive.id}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate font-sans text-base mb-0.5'
                  title={dive.dive_site?.name || 'Dive Log'}
                >
                  {dive.dive_site?.name || 'Unspecified Dive'}
                </Link>
                <div className='text-xs text-gray-500 truncate mb-1.5'>
                  {'by '}
                  <Link
                    to={`/users/${dive.user_username}`}
                    className='font-semibold text-blue-600 hover:underline'
                  >
                    @{dive.user_username}
                  </Link>
                </div>
                <div className='flex items-center space-x-3 text-xs text-gray-400'>
                  {dive.max_depth !== undefined && (
                    <span className='flex items-center gap-1' title='Max Depth'>
                      <DepthIcon className='text-blue-500' size={14} />
                      <span className='font-medium text-gray-600'>{dive.max_depth}m</span>
                    </span>
                  )}
                  {dive.duration !== undefined && (
                    <span className='flex items-center gap-1' title='Dive Duration'>
                      <Clock className='w-3.5 h-3.5 text-blue-500' />
                      <span className='font-medium text-gray-600'>{dive.duration} min</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeWidgetIndex === 3) {
      const recentRoutes = routesData?.routes || [];
      if (recentRoutes.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {recentRoutes.map((route, index) => (
            <div
              key={route.id}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <Link
                to={`/dive-routes/${route.id}/${slugify(route.name)}`}
                className='shrink-0 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 hover:bg-amber-100 transition-colors'
              >
                <Compass className='w-6 h-6' />
              </Link>
              <div className='min-w-0 flex-1 text-left'>
                <Link
                  to={`/dive-routes/${route.id}/${slugify(route.name)}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate font-sans text-base'
                  title={route.name}
                >
                  {route.name}
                </Link>
                <p className='text-xs text-gray-500 truncate'>
                  {route.route_type?.toUpperCase() || 'ROUTE'} • {route.points_count || 0} points
                  {route.creator?.username && (
                    <>
                      {' • by '}
                      <Link
                        to={`/users/${route.creator.username}`}
                        className='font-semibold text-blue-600 hover:underline'
                      >
                        @{route.creator.username}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeWidgetIndex === 4) {
      const recentCenters = centersData?.items || [];
      if (recentCenters.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {recentCenters.map((center, index) => (
            <div
              key={center.id}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <Link
                to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                className='shrink-0 w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors'
              >
                <Anchor className='w-6 h-6' />
              </Link>
              <div className='min-w-0 flex-1 text-left'>
                <Link
                  to={`/diving-centers/${center.id}/${slugify(center.name)}`}
                  className='font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate font-sans text-base'
                  title={center.name}
                >
                  {center.name}{' '}
                  <span className='text-emerald-500' title='Verified Center'>
                    ✅
                  </span>
                </Link>
                <p className='text-xs text-gray-500 truncate'>
                  {center.city && `${center.city}, `}
                  {center.country}
                  {center.owner_username && (
                    <>
                      {' • claimed by '}
                      <Link
                        to={`/users/${center.owner_username}`}
                        className='font-semibold text-blue-600 hover:underline'
                      >
                        @{center.owner_username}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeWidgetIndex === 5) {
      const prolificDivers = topUsersData?.entries || [];
      if (prolificDivers.length === 0) return null;

      return (
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          {prolificDivers.map((user, index) => (
            <Link
              key={user.user_id}
              to={`/users/${user.username}/analytics`}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group items-center space-x-4 min-w-0 ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div className='relative shrink-0'>
                <Avatar
                  src={user.avatar_full_url || user.avatar_url}
                  alt={user.username}
                  size='lg'
                  fallbackText={user.username}
                />
                <div className='absolute -top-2 -right-2 bg-blue-100 text-blue-800 rounded-full p-1 shadow-sm'>
                  <Notebook className='w-3 h-3' />
                </div>
              </div>
              <div className='min-w-0 flex-1 text-left'>
                <p
                  className='font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate'
                  title={user.username}
                >
                  {user.username}
                </p>
                <p className='text-xs font-medium text-blue-600 uppercase tracking-wider truncate'>
                  {user.count.toLocaleString()} Dives Logged
                </p>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    return null;
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
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-6 lg:py-8 relative'>
      <SEO
        title='Divemap - Discover and Rate Scuba Dive Sites Worldwide'
        description='The ultimate scuba platform. Discover and rate dive sites, log your dives, plan trips, share underwater routes, find diving centers, see all of those on maps, use scuba calculators and connect with the global diving community.'
        type='website'
        schema={schema}
      />
      {/* Background Logo Watermark */}
      <BackgroundLogo opacity={0.02} size='xlarge' />

      {/* Embedded CSS Animations for Wavy Mask & Bubbles */}
      <style>{`
        @keyframes waveSlow {
          0% { transform: translateX(0); }
          50% { transform: translateX(-40px); }
          100% { transform: translateX(0); }
        }
        @keyframes waveSlowAlt {
          0% { transform: translateX(0); }
          50% { transform: translateX(30px); }
          100% { transform: translateX(0); }
        }
        .wave-path-1 {
          animation: waveSlow 12s ease-in-out infinite;
        }
        .wave-path-2 {
          animation: waveSlowAlt 14s ease-in-out infinite;
        }
        @keyframes floatUp {
          0% { transform: translateY(110%) scale(0.5); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-10%) scale(1.1); opacity: 0; }
        }
        .bubble {
          position: absolute;
          bottom: -15px;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.75) 0%, rgba(135,206,250,0.1) 70%);
          border: 1px solid rgba(255, 255, 255, 0.45);
          border-radius: 50%;
          pointer-events: none;
        }
        .bubble-1 { left: 10%; width: 14px; height: 14px; animation: floatUp 8s infinite linear; animation-delay: 0s; }
        .bubble-2 { left: 30%; width: 22px; height: 22px; animation: floatUp 12s infinite linear; animation-delay: 2.5s; }
        .bubble-3 { left: 55%; width: 10px; height: 10px; animation: floatUp 7s infinite linear; animation-delay: 1s; }
        .bubble-4 { left: 75%; width: 18px; height: 18px; animation: floatUp 10s infinite linear; animation-delay: 4.5s; }
        .bubble-5 { left: 90%; width: 12px; height: 12px; animation: floatUp 9s infinite linear; animation-delay: 3s; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.45s ease-out forwards;
        }
      `}</style>

      {/* Morphing Hero Carousel - Visible on both Mobile & Desktop */}
      <div
        className='relative overflow-hidden w-full mb-6 sm:mb-8 rounded-none sm:rounded-3xl shadow-xl text-gray-900 pt-6 pb-12 sm:pt-10 sm:pb-16 px-3.5 sm:px-8 border-y sm:border border-gray-100 transition-all duration-700 ease-in-out'
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background:
            activeSlide === 0
              ? 'linear-gradient(135deg, #eaf4f9 0%, #d5eaf2 100%)'
              : activeSlide === 1
                ? 'linear-gradient(135deg, #e1f5fe 0%, #c4e4f5 100%)'
                : 'linear-gradient(135deg, #eaf4f9 0%, #d5eaf2 100%)',
          minHeight: '260px',
        }}
      >
        {/* HTML/SVG Wavy Divider Bottom Mask */}
        <div className='absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 select-none pointer-events-none'>
          <svg
            className='relative block w-full h-[40px] sm:h-[60px] md:h-[80px]'
            viewBox='0 0 1200 120'
            preserveAspectRatio='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M0,60 C150,100 350,20 500,60 C650,100 850,20 1000,60 C1150,100 1300,60 1400,60 L1400,120 L0,120 Z'
              fill='#ffffff'
              className='wave-path-1'
            ></path>
            <path
              d='M0,50 C200,90 400,10 600,50 C800,90 1000,10 1200,50 L1200,120 L0,120 Z'
              fill='#ffffff'
              opacity='0.35'
              className='wave-path-2'
            ></path>
          </svg>
        </div>

        {/* Floating Ambient Bubbles Layer */}
        <div className='absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30 select-none'>
          <div className='bubble bubble-1'></div>
          <div className='bubble bubble-2'></div>
          <div className='bubble bubble-3'></div>
          <div className='bubble bubble-4'></div>
          <div className='bubble bubble-5'></div>
        </div>

        {/* Carousel Content */}
        <div className='relative z-20 max-w-5xl mx-auto'>
          {/* SLIDE 1: Brand Intro + Fuzzy Search */}
          {activeSlide === 0 && (
            <div className='text-center transition-all duration-500 animate-fadeIn px-2'>
              <img
                src='/divemap_navbar_logo.png'
                alt='Divemap'
                className='mx-auto max-h-[45px] sm:max-h-[60px] md:max-h-[80px] object-contain mb-3 sm:mb-4 select-none pointer-events-none'
              />
              <h1 className='text-2xl sm:text-3xl md:text-5xl font-display font-extrabold tracking-tight text-gray-900 mb-1.5 sm:mb-2 md:mb-3'>
                Discover Amazing <span className='text-blue-600'>Dive Sites</span>
              </h1>
              <p className='text-gray-600 text-xs sm:text-sm md:text-base max-w-md mx-auto mb-4 sm:mb-5 px-4 leading-relaxed'>
                Explore the world's best scuba locations, read reviews from fellow divers, and find
                your next underwater adventure.
              </p>
              <div className='max-w-md mx-auto px-4 relative z-30'>
                <GlobalSearchBar
                  className='w-full shadow-lg rounded-xl'
                  placeholder='Search dives, sites, centers...'
                />
              </div>
            </div>
          )}

          {/* SLIDE 2: Our Growing Community Stats */}
          {activeSlide === 1 && (
            <div className='text-center transition-all duration-500 animate-fadeIn px-2 max-w-4xl mx-auto'>
              <span className='bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5 inline-block'>
                Our Growing Community
              </span>
              <h2 className='text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 mb-1.5'>
                Real-time Dive Statistics
              </h2>
              <p className='text-gray-600 text-xs sm:text-sm md:text-base max-w-lg mx-auto mb-4 sm:mb-6 px-4'>
                Track our global growing community milestones and real-time platform statistics.
              </p>
              <div className='grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 max-w-4xl mx-auto'>
                <Link
                  to='/dives'
                  className='text-center bg-white/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all block'
                >
                  <Notebook className='w-4 h-4 sm:w-5 h-5 text-[#0072B2] mb-1 sm:mb-1.5 mx-auto' />
                  <div className='text-lg sm:text-xl md:text-2xl font-extrabold text-blue-600'>
                    <AnimatedCounter
                      targetValue={stats?.dives || 0}
                      isBackendAvailable={isBackendAvailable}
                    />
                  </div>
                  <div className='text-gray-400 font-bold uppercase tracking-wider text-[9px] mt-1'>
                    Dives Logged
                  </div>
                </Link>
                <Link
                  to='/dive-sites'
                  className='text-center bg-white/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all block'
                >
                  <MapPin className='w-4 h-4 sm:w-5 h-5 text-[#0072B2] mb-1 sm:mb-1.5 mx-auto' />
                  <div className='text-lg sm:text-xl md:text-2xl font-extrabold text-blue-600'>
                    <AnimatedCounter
                      targetValue={stats?.dive_sites || 0}
                      isBackendAvailable={isBackendAvailable}
                    />
                  </div>
                  <div className='text-gray-400 font-bold uppercase tracking-wider text-[9px] mt-1'>
                    Dive Sites
                  </div>
                </Link>
                <Link
                  to='/dive-sites?sort_by=average_rating&sort_order=desc'
                  className='text-center bg-white/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all block'
                >
                  <Star
                    className='w-4 h-4 sm:w-5 h-5 text-yellow-500 mb-1 sm:mb-1.5 mx-auto'
                    fill='currentColor'
                  />
                  <div className='text-lg sm:text-xl md:text-2xl font-extrabold text-blue-600'>
                    <AnimatedCounter
                      targetValue={stats?.reviews || 0}
                      isBackendAvailable={isBackendAvailable}
                    />
                  </div>
                  <div className='text-gray-400 font-bold uppercase tracking-wider text-[9px] mt-1'>
                    Reviews
                  </div>
                </Link>
                <Link
                  to='/diving-centers'
                  className='text-center bg-white/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all block'
                >
                  <Anchor className='w-4 h-4 sm:w-5 h-5 text-[#0072B2] mb-1 sm:mb-1.5 mx-auto' />
                  <div className='text-lg sm:text-xl md:text-2xl font-extrabold text-blue-600'>
                    <AnimatedCounter
                      targetValue={stats?.diving_centers || 0}
                      isBackendAvailable={isBackendAvailable}
                    />
                  </div>
                  <div className='text-gray-400 font-bold uppercase tracking-wider text-[9px] mt-1'>
                    Centers
                  </div>
                </Link>
                <Link
                  to='/dive-trips'
                  className='text-center bg-white/80 backdrop-blur-sm p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-50 shadow-sm hover:scale-105 transition-all block col-span-2 md:col-span-1'
                >
                  <Calendar className='w-4 h-4 sm:w-5 h-5 text-[#0072B2] mb-1 sm:mb-1.5 mx-auto' />
                  <div className='text-lg sm:text-xl md:text-2xl font-extrabold text-blue-600'>
                    <AnimatedCounter
                      targetValue={stats?.dive_trips || 0}
                      isBackendAvailable={isBackendAvailable}
                    />
                  </div>
                  <div className='text-gray-400 font-bold uppercase tracking-wider text-[9px] mt-1'>
                    Organized Trips
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* SLIDE 3: Daily Featured Item */}
          {activeSlide === 2 && (
            <div className='text-center transition-all duration-500 animate-fadeIn max-w-[1600px] mx-auto px-4'>
              <div className='flex items-center justify-center gap-1.5 mb-1.5'>
                <span className='bg-yellow-400 text-yellow-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider'>
                  ★ Daily Feature
                </span>
                <span className='text-xs font-bold uppercase tracking-widest text-gray-500'>
                  {currentWidget?.category}
                </span>
              </div>
              <h2 className='text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 sm:mb-4'>
                {currentWidget?.title}
              </h2>
              <div className='mb-4 max-w-md sm:max-w-4xl mx-auto'>
                <DailyFeatureSnippet />
              </div>
              <Link
                to={currentWidget?.ctaLink}
                className='text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline'
              >
                {currentWidget?.ctaText} →
              </Link>
            </div>
          )}
        </div>

        {/* Carousel Indicators & Manual Pagination */}
        <div className='absolute bottom-4 left-0 right-0 flex justify-center items-center gap-2 z-20 select-none'>
          {/* Left Arrow */}
          <button
            onClick={() => setActiveSlide(prev => (prev - 1 + 3) % 3)}
            className='p-1 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white/20 transition-all mr-2'
            aria-label='Previous Slide'
          >
            ‹
          </button>
          {[0, 1, 2].map(idx => (
            <button
              key={idx}
              onClick={() => setActiveSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                activeSlide === idx ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
          {/* Right Arrow */}
          <button
            onClick={() => setActiveSlide(prev => (prev + 1) % 3)}
            className='p-1 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white/20 transition-all ml-2'
            aria-label='Next Slide'
          >
            ›
          </button>
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

      {/* Diving Center Portal Greeting Snippet */}
      {primaryCenter && !user?.is_admin && !user?.is_moderator && (
        <div className='w-full mb-8'>
          <div className='bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
            <div className='flex-1 min-w-0 w-full'>
              <h3 className='text-xs font-bold uppercase tracking-wider text-blue-600 mb-1'>
                Diving Center Portal
              </h3>
              <h2 className='text-xl sm:text-2xl font-bold text-gray-900 leading-snug'>
                Welcome back to {primaryCenter.name}!
              </h2>
              <p className='hidden sm:block text-sm text-gray-500 mt-1 leading-relaxed'>
                Create dive trips for followers, post announcements, update details, or manage staff
                managers.
              </p>
            </div>
            <div className='flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto shrink-0'>
              <Link
                to={`/dive-trips/create?center_id=${primaryCenter.id}`}
                className='inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-sm w-full sm:w-auto h-10'
              >
                <Plus className='h-4 w-4' />
                <span>Create Dive Trip</span>
              </Link>
              <Link
                to={`/diving-centers/${primaryCenter.id}/${slugify(primaryCenter.name)}?tab=manage`}
                className='inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm px-4 py-2 border border-gray-200 rounded-xl transition-all shadow-sm w-full sm:w-auto h-10'
              >
                <Bell className='h-4 w-4' />
                <span>Roster & Staff</span>
              </Link>
            </div>
          </div>
        </div>
      )}

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
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 pb-8 pt-2'>
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

      {/* Bottom Layout Container - Side-by-Side on Desktop, Stacked on Mobile with Scuba Tools first */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto mb-16 items-start'>
        {/* Scuba Tools (First on Mobile, Left/5-columns on Desktop) */}
        <div className='lg:col-span-5 w-full order-1 lg:order-none'>
          <ScubaTools />
        </div>

        {/* Live Pulse Recent Activity Timeline (Second on Mobile, Right/7-columns on Desktop) */}
        <div className='lg:col-span-7 w-full order-2 lg:order-none bg-white rounded-none sm:rounded-2xl border-y sm:border border-gray-100 shadow-sm sm:shadow-xl overflow-hidden'>
          <section className='w-full'>
            {/* Standardized Card Header matching Scuba Tools */}
            <div className='bg-[#eaf4f9]/50 p-5 border-b border-gray-100 flex items-center justify-between gap-3.5'>
              <div className='flex items-center gap-3.5 flex-1 min-w-0'>
                <div className='bg-white p-2.5 rounded-xl border border-blue-100/50 shadow-sm shrink-0 flex items-center justify-center h-11 w-11 relative'>
                  <span className='animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75'></span>
                  <span className='relative inline-flex rounded-full h-3 w-3 bg-emerald-500'></span>
                </div>
                <div className='min-w-0 flex-1 text-left'>
                  <h3 className='text-base font-extrabold text-gray-900 leading-snug'>
                    Live Community Pulse
                  </h3>
                  <p className='text-xs text-gray-500 leading-tight mt-0.5'>
                    Real-time community updates & public activity
                  </p>
                </div>
              </div>
              <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-white border border-gray-100 px-2 py-1 rounded-md shrink-0 self-center hidden sm:inline-block'>
                Live Feed
              </span>
            </div>

            <div className='p-3.5 sm:p-5 grid grid-cols-1 gap-3 bg-white'>
              {recentActivity.map((activity, index) => {
                const getIcon = () => {
                  switch (activity.event_type) {
                    case 'dive_logged':
                      return <Notebook className='h-[18px] w-[18px] text-[#0072B2]' />;
                    case 'site_added':
                      return <MapPin className='h-[18px] w-[18px] text-[#0072B2]' />;
                    case 'site_review':
                      return (
                        <Star className='h-[18px] w-[18px] text-yellow-500' fill='currentColor' />
                      );
                    case 'route_added':
                      return <Compass className='h-[18px] w-[18px] text-[#0072B2]' />;
                    case 'center_added':
                      return <Anchor className='h-[18px] w-[18px] text-[#0072B2]' />;
                    case 'trip_added':
                      return <Calendar className='h-[18px] w-[18px] text-[#0072B2]' />;
                    case 'claim_approved':
                      return <Award className='h-[18px] w-[18px] text-emerald-600' />;
                    default:
                      return <Activity className='h-[18px] w-[18px] text-[#0072B2]' />;
                  }
                };

                return (
                  <div
                    key={index}
                    className='bg-white p-2.5 sm:p-3 rounded-xl border border-gray-100 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-colors flex items-start gap-3 shadow-sm'
                  >
                    <div className='bg-blue-50/50 p-1.5 rounded-lg shrink-0 flex items-center justify-center h-9 w-9'>
                      {getIcon()}
                    </div>
                    <div className='min-w-0 flex-1 leading-relaxed'>
                      <p className='text-sm text-gray-700'>
                        {activity.event_type === 'claim_approved' ? (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            is now the verified owner of{' '}
                            <Link
                              to={`/diving-centers/${activity.center_id}/${slugify(activity.center_name)}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.center_name}
                            </Link>
                          </>
                        ) : activity.event_type === 'center_added' ? (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            listed a new diving center:{' '}
                            <Link
                              to={`/diving-centers/${activity.center_id}/${slugify(activity.center_name)}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.center_name}
                            </Link>
                          </>
                        ) : activity.event_type === 'trip_added' ? (
                          <>
                            A new diving trip was created by{' '}
                            <Link
                              to={`/diving-centers/${activity.center_id}/${slugify(activity.center_name)}`}
                              className='text-[#0072B2] font-bold hover:underline'
                            >
                              {activity.center_name}
                            </Link>
                          </>
                        ) : activity.event_type === 'route_added' ? (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            mapped a new dive route:{' '}
                            <span className='font-bold text-gray-800'>{activity.route_name}</span>{' '}
                            at{' '}
                            <Link
                              to={`/dive-sites/${activity.site_id}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.site_name}
                            </Link>
                          </>
                        ) : activity.event_type === 'dive_logged' ? (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            logged a new public dive at{' '}
                            <Link
                              to={`/dive-sites/${activity.site_id}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.site_name}
                            </Link>
                          </>
                        ) : activity.event_type === 'site_review' ? (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            rated{' '}
                            <Link
                              to={`/dive-sites/${activity.site_id}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.site_name}
                            </Link>
                            {activity.rating && (
                              <span className='ml-1.5 text-yellow-500 font-bold'>
                                {'★'.repeat(activity.rating)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className='font-extrabold text-gray-900'>
                              {activity.username}
                            </span>{' '}
                            discovered a new dive site:{' '}
                            <Link
                              to={`/dive-sites/${activity.site_id}`}
                              className='text-blue-600 font-bold hover:underline'
                            >
                              {activity.site_name}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
